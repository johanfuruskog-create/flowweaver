import styles from "./rich-text-field.scss?inline";

import "../prompt-dialog/prompt-dialog";
import type { PromptDialog } from "../prompt-dialog/prompt-dialog";
import { getLinkPicker } from "../../core/link-picker-registry";
import { interpolate, t } from "../../localization/editor-ui-strings";
import { SOURCE_LOCALE } from "../../../viewer/core/localized-text";
import type { FormattingFeature } from "../../../viewer/types/node-types";
import {
  CARET_MARKER,
  blockLength,
  blockTypeAt,
  blocksFromPlainText,
  caret,
  clampPosition,
  deleteBackward,
  deleteForward,
  deleteRange,
  emptyRichText,
  extractRange,
  hasMark,
  insertBlocks,
  insertInline,
  insertText,
  isCollapsed,
  isFaithful,
  linkRangeAt,
  marksAt,
  orderedRange,
  sliceInline,
  parseRichText,
  replaceChip,
  selectedChip,
  setLink,
  splitBlock,
  toggleBlockType,
  toggleMark,
  writeRichText,
  type Block,
  type Edit,
  type Inline,
  type Marks,
  type ParseOptions,
  type Position,
  type RichText,
  type Selection,
} from "../../core/rich-text-model";
import { readDom, type DomPoint } from "./read-dom";
import { visibleBand } from "../../controllers/visible-band";

/**
 * `<rich-text-field>` — write as the visitor sees it (stories 136 and 137).
 *
 * Bold is bold, a list is a list, and an answer is a chip with its label —
 * never `**`, `- ` or `{{fornamn}}`. What is stored is the same Markdown as
 * before; the field reads and writes it through `rich-text-model.ts`.
 *
 * ## The model owns the text; the browser is a keyboard
 *
 * Every change goes through the model, and the DOM is drawn from the model
 * after it. Two ways in (137 point 2):
 *
 *   a. `beforeinput`, cancelable and a kind we know → `preventDefault()`, the
 *      model changes, the DOM is redrawn and the caret put back.
 *   b. Anything else — composition, dictation, a correction the engine does
 *      not let us cancel — the browser writes, and on `input` the field reads
 *      the DOM back into the model (`read-dom.ts`), caret included, and
 *      redraws. Never during a composition: a redraw there breaks the input
 *      method, so the reading waits for `compositionend`.
 *
 * So the DOM only ever holds `<p>`, `<ul>`, `<ol>`, `<li>`, `<strong>`,
 * `<em>`, `<a>`, `<br>` and the chip — 137 criterion 4. `<br>` is the
 * viewer's own line break inside a paragraph (the map example has them).
 *
 * ## Its own history
 *
 * Ctrl/Cmd+Z and Y/Shift+Z undo within the field, a word at a time (137 open
 * question 3, the recommendation): typing merges until a space has been typed
 * and a letter follows it. Everything else — a chip, a paste, a format — is a
 * step of its own. The editor's own undo is not reached from inside a field
 * (`guide-editor` leaves editable targets alone).
 *
 * ## What leaves the field
 *
 * `value` and an `input` event, the way a native field does it — so the panel
 * binds it like its other fields. The value only changes when the text does:
 * a field opened and left is the string it was given (7b a), and undoing back
 * to the start gives back that string to the letter, not a rewrite (7b c).
 *
 * ## Selection in a shadow tree
 *
 * The field sits in shadow roots three deep. Chromium reads the selection
 * through `ShadowRoot.getSelection()`, Firefox through the document's, and
 * Safari 17 through `getComposedRanges`. Safari 16.4 (the editor's floor,
 * K18) has none of them for a shadow tree; there the field keeps the
 * position it last set itself and what `beforeinput`'s target ranges say.
 * Measured in Chromium only so far — Del D runs the same file in Firefox and
 * WebKit.
 */

export interface AnswerOption {
  value: string;
  label: string;
  /**
   * True when the guide's engine sets this itself — no question authored it
   * (`idag`, story 086). Johans iPad 27/9: these stand in their own menu
   * group, apart from answers a question sets, keyed on this flag and never
   * on the name — the day a second computed value exists it needs nothing
   * new here.
   */
  computed?: true;
  /**
   * A calculation's result. A formula's menu lists these first, under
   * *Uträkningar* (Astras bild 05, 29/9); a text's menu ignores it.
   */
  calculated?: true;
}

type HistoryKind = "typing" | "deleting" | "other";

interface HistoryEntry {
  doc: RichText;
  selection: Selection;
}

/*
 * Invisible formatting a paste leaves out (Johan 25/9), as it leaves out
 * colour and size: word joiner, zero-width space, byte order mark — nothing a
 * visitor can see or an editor can find. ZWNJ (U+200C) and ZWJ (U+200D) stay:
 * Persian and the Indic scripts need them to spell, and a host may register
 * any language.
 */
const INVISIBLE_FORMATTING = /[\u2060\u200B\uFEFF]/g;

const TOOLBAR_FEATURES = ["bold", "italic", "link", "bullet-list", "numbered-list"] as const;
type ToolbarFeature = (typeof TOOLBAR_FEATURES)[number];

const LABEL_KEYS: Record<ToolbarFeature, string> = {
  bold: "editor.properties.format-bold",
  italic: "editor.properties.format-italic",
  link: "editor.properties.format-link",
  "bullet-list": "editor.properties.format-bullet-list",
  "numbered-list": "editor.properties.format-numbered-list",
};

/*
 * The icons are drawn, not lettered — `B` and `I` read as English to a Swedish
 * eye, and the name is in `aria-label` and the tooltip either way.
 */
const ICONS: Record<ToolbarFeature, string> = {
  bold: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>',
  italic: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h7M6 19h7M14.5 5l-5 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  "bullet-list": '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="7" r="1.6" fill="currentColor"/><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="5" cy="17" r="1.6" fill="currentColor"/><path d="M10 7h10M10 12h10M10 17h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  "numbered-list": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5 5.5 4.5V9M4 9h3M4 13.5a1.5 1.5 0 0 1 3 0c0 1.5-3 2-3 3.5h3M10 7h10M10 12h10M10 17h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

/*
 * Johans val (26/9) bland plus-varianterna: samma ritstil som `ICONS` — ett
 * streck, inget fyllt — så plusset läser som samma familj som
 * fet/kursiv/länk/lista.
 */
const PLUS_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

/*
 * Astras förslag (Johan 28/9, skickat "för bättring av menyn"): ikonen
 * flyttar från gruppens rubrik till varje rad — en pratbubbla för ett svar
 * en fråga satte, ritad i verktygsradens egen stil (streck, inget fyllt).
 * Ersätter den tidigare ikonen på rubriken (Johans förebild 26/9), som
 * Astras bilder inte har.
 */
const ANSWER_ROW_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-4 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';

/*
 * Samma förslag: en kalender för `idag` (och det som senare kan komma att
 * räknas ut samma väg), på raden i stället för på gruppens rubrik "Inbyggt".
 * Kalendern passar dagens enda uträknade värde; en andra sort av uträkning
 * kan behöva en egen ikon den dag den finns, i stället för att dela den här.
 */
const COMPUTED_ROW_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 9.5h16M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

/* The magnifier in a formula menu's search box (Astras bild 05, 29/9). */
const SEARCH_ICON =
  '<svg class="menu__search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

export class RichTextField extends HTMLElement {
  static observedAttributes = ["disabled", "placeholder", "label", "editor-locale"];
  /** So a `<label for>` beside it focuses it, as it would a textarea. */
  static formAssociated = true;

  private readonly root = this.attachShadow({ mode: "open", delegatesFocus: true });
  private doc: RichText = emptyRichText();
  private selection: Selection = caret({ block: 0, offset: 0 });
  private featuresValue: FormattingFeature[] | null = null;
  private variablesValue: AnswerOption[] = [];
  private knownValue: Set<string> | null = null;
  private initialValue: string | null = null;
  private initialWritten = "";
  private currentValue = "";
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private lastKind: HistoryKind | null = null;
  private lastTypedSpace = false;
  private pendingMarks: Marks | null = null;
  private composing = false;
  /** The pointer's last x over the text, however old — see `caretOutOfChip`. */
  private lastPointerX: number | null = null;
  /**
   * The text's own focus, from its `focus` and `blur` — not `activeElement`.
   * Only while it holds does a moved selection count as the redaktör's: a
   * toolbar button, however it is pressed (mouse, key, VoiceOver's
   * double-tap, which sends `click` without `mousedown`), then works on the
   * selection saved before it and puts focus back (fynd d, 25/9).
   */
  private textFocused = false;
  private built = false;

  private editable!: HTMLElement;
  private frame!: HTMLElement;
  private toolbar!: HTMLElement;
  private answerToggle!: HTMLButtonElement;
  private answerMenu!: HTMLElement;
  private chipMenu!: HTMLElement;
  private chipMenuAt: Position | null = null;

  // --- The element's surface -------------------------------------------------

  get value(): string {
    return this.initialValue === null ? this.getAttribute("value") ?? "" : this.currentValue;
  }

  /** Markdown in. A new value is a new text: the history starts over. */
  set value(value: string) {
    this.initialValue = value;
    this.currentValue = value;
    this.doc = parseRichText(value, this.options()) ?? { blocks: blocksFromPlainText(value, !this.multiline) };
    this.initialWritten = writeRichText(this.doc, this.options());
    /*
     * The end, not the start: an answer inserted into a field nobody has
     * clicked in goes last. The old panel field reported 0 for "untouched"
     * and put it first — `{{ort}}Hej` (story 060's test).
     */
    const last = this.doc.blocks.length - 1;

    this.selection = caret({ block: last, offset: blockLength(this.doc.blocks[last]!) });
    this.undoStack = [];
    this.redoStack = [];
    this.lastKind = null;
    if (this.built) this.renderText();
  }

  get features(): FormattingFeature[] {
    return this.featuresValue ?? ((this.getAttribute("features") ?? "").split(",").filter(Boolean) as FormattingFeature[]);
  }

  set features(value: FormattingFeature[]) {
    this.featuresValue = [...value];
    // The text is read with the features; read it again with the right ones.
    if (this.initialValue !== null) this.value = this.initialValue;
    if (this.built) this.build();
  }

  /** The answers *Infoga svar* offers, label first. */
  set variables(value: AnswerOption[]) {
    this.variablesValue = value.map((option) => ({ ...option }));
    // The names may arrive before the field is built (the panel's order,
    // and a test's): the model is re-read either way, the DOM only once built.
    this.rereadNames();
    if (this.built) {
      this.renderAnswerMenu();
      this.renderText();
    }
  }

  /**
   * A formula's chips depend on which names are known, and the panel gives
   * the names after the value (it sets `value` in the markup and `variables`
   * once the panel is drawn). Read the text again with the names it has now:
   * a name that became known is a chip, one that stopped being known is
   * text. The string does not change either way; the history is untouched.
   */
  private rereadNames(): void {
    if (!this.formula) return;
    this.reread();
  }

  get variables(): AnswerOption[] {
    return this.variablesValue.map((option) => ({ ...option }));
  }

  /**
   * The answers a chip may name here — the panel gives those set before the
   * node, on some path there (Johan 25/9: a heading offered an answer asked
   * further on, always empty for the visitor). A chip naming anything else is
   * missing: kept and shown as missing, never dropped and never re-pointed
   * (136). Unset, the offered answers are taken as the known ones.
   */
  set knownVariables(value: readonly string[]) {
    this.knownValue = new Set(value);
    this.rereadNames();
    if (this.built) this.renderText();
  }

  get multiline(): boolean {
    return this.hasAttribute("multiline");
  }

  get disabled(): boolean {
    return this.hasAttribute("disabled");
  }

  /** True when the stored text reads as a model — else the panel keeps its text mode. */
  static canEdit(value: string, features: readonly FormattingFeature[], multiline: boolean): boolean {
    return parseRichText(value, { features, inline: !multiline }) !== null;
  }

  /**
   * Selects the first chip whose answer the guide does not set — where the
   * health list's *unset-template-variable* leads (136 criterion 14).
   */
  selectMissingChip(): boolean {
    const known = this.knownValue ?? new Set(this.variablesValue.map((one) => one.value));

    return this.selectChipWhere((name) => !known.has(name));
  }

  /** Puts the focus in the text and selects the first chip naming `name`. */
  selectChip(name: string): boolean {
    return this.selectChipWhere((candidate) => candidate === name);
  }

  private selectChipWhere(match: (name: string) => boolean): boolean {
    for (let block = 0; block < this.doc.blocks.length; block += 1) {
      let offset = 0;

      for (const item of this.doc.blocks[block]!.content) {
        if (item.type === "chip" && match(item.name)) {
          this.editable.focus();
          this.selection = { anchor: { block, offset }, focus: { block, offset: offset + 1 } };
          this.restoreSelection();
          this.updateState();
          return true;
        }

        offset += item.type === "text" ? item.text.length : 1;
      }
    }

    return false;
  }

  connectedCallback(): void {
    if (this.initialValue === null) this.value = this.getAttribute("value") ?? "";
    this.build();
    document.addEventListener("selectionchange", this.onSelectionChange);
  }

  disconnectedCallback(): void {
    document.removeEventListener("selectionchange", this.onSelectionChange);
    this.closeMenus();
  }

  attributeChangedCallback(): void {
    if (this.built) this.build();
  }

  // --- Building ------------------------------------------------------------

  /**
   * A formula, not a text (story 139): one line, no marks, and the chips are
   * the formula parser's names — see `ParseOptions.formula`. Set as an
   * attribute by the panel, like `multiline`.
   */
  get formula(): boolean {
    return this.hasAttribute("formula");
  }

  private options(): ParseOptions {
    if (this.formula) {
      return {
        features: this.features,
        inline: true,
        formula: { known: this.knownValue ?? new Set(this.variablesValue.map((one) => one.value)) },
      };
    }
    return { features: this.features, inline: !this.multiline };
  }

  private text(key: string, params?: Record<string, string | number>): string {
    const resolved = t(key, this.getAttribute("editor-locale") ?? SOURCE_LOCALE);

    return params ? interpolate(resolved, params) : resolved;
  }

  private build(): void {
    const features = new Set(this.features);
    const buttons = TOOLBAR_FEATURES.filter((feature) => features.has(feature));
    const answers = features.has("variable");
    const disabled = this.disabled ? " disabled" : "";
    // One name for the plus in every field: "Infoga variabel", with the
    // same tooltip (Astra 30/9, B9). It was "Lägg till" in the text field
    // (136, Johans val 26/9) and "Infoga variabel" in the formula (139) —
    // the same action under two names.
    const addLabel = this.text("editor.properties.insert-variable");
    const showToolbar = buttons.length > 0 || (answers && this.multiline);
    // Astras förslag (Johan 28/9): en tunn lodrät linje mellan länken och
    // listknapparna skiljer "formatera text" från "formatera stycket" —
    // bara när något föregår `bullet-list` i den fasta ordningen ovan.

    this.root.innerHTML = `
      <style>${styles}</style>
      <div class="frame${this.multiline ? " frame--multiline" : ""}" data-frame>
        ${showToolbar ? `
          <div class="toolbar" role="toolbar" aria-label="${escapeAttr(this.text("editor.properties.format-text"))}" data-toolbar>
            ${buttons.map((feature, index) => `
              ${feature === "bullet-list" && index > 0 ? '<span class="toolbar__divider" aria-hidden="true"></span>' : ""}
              <button type="button" class="tool" data-command="${feature}" aria-pressed="false" tabindex="-1"
                aria-label="${escapeAttr(this.text(LABEL_KEYS[feature]))}" title="${escapeAttr(this.text(LABEL_KEYS[feature]))}"${disabled}>${ICONS[feature]}</button>`).join("")}
            ${answers && this.multiline ? this.answerToggleButton(addLabel, disabled) : ""}
          </div>` : ""}
        <div class="line">
        <div class="text" data-text role="textbox" contenteditable="${this.disabled ? "false" : "true"}"
          aria-multiline="${this.multiline ? "true" : "false"}"
          aria-label="${escapeAttr(this.getAttribute("label") ?? "")}"
          ${this.disabled ? 'aria-disabled="true"' : ""}
          data-placeholder="${escapeAttr(this.getAttribute("placeholder") ?? "")}"
          spellcheck="true"></div>
        ${answers && !this.multiline ? `<div class="answer" data-answer>${this.answerToggleButton(addLabel, disabled)}</div>` : ""}
        </div>
        ${answers ? `<div class="menu menu--answer" role="menu" aria-label="${escapeAttr(addLabel)}" data-answer-menu hidden></div>` : ""}
        <div class="menu" role="menu" data-chip-menu hidden></div>
      </div>
      ${this.multiline && buttons.length > 0 ? `<p class="hint">${escapeHtml(this.text("editor.properties.rich-text-hint"))}</p>` : ""}
      <prompt-dialog></prompt-dialog>
    `;

    this.frame = this.root.querySelector("[data-frame]")!;
    this.editable = this.root.querySelector("[data-text]")!;
    this.toolbar = this.root.querySelector("[data-toolbar]") as HTMLElement;
    this.answerToggle = this.root.querySelector("[data-answer-toggle]") as HTMLButtonElement;
    this.answerMenu = this.root.querySelector("[data-answer-menu]") as HTMLElement;
    this.chipMenu = this.root.querySelector("[data-chip-menu]")!;
    this.root.querySelector<PromptDialog>("prompt-dialog")!.editorLocale = this.getAttribute("editor-locale") ?? SOURCE_LOCALE;

    this.bind();
    this.built = true;
    this.renderAnswerMenu();
    this.renderText();
    this.updateState();
  }

  /**
   * Johans val (26/9) bland plus-varianterna: ett plus, samma form som
   * formateringsknapparna (`.tool`) — i verktygsraden hos ett flerradigt
   * fält, sist i raden, delar det nu deras pilnavigering (`tools()` läser
   * `this.toolbar`, och knappen står där); i ett enradigt fält står den
   * ensam i fältets högra kant, som "Infoga svar" gjorde tidigare.
   */
  private answerToggleButton(label: string, disabled: string): string {
    return `<button type="button" class="tool" data-answer-toggle aria-haspopup="menu" aria-expanded="false"
      aria-label="${escapeAttr(label)}" title="${escapeAttr(label)}"${disabled}>${PLUS_ICON}</button>`;
  }

  private bind(): void {
    const text = this.editable;

    text.addEventListener("beforeinput", this.onBeforeInput);
    text.addEventListener("input", this.onInput);
    text.addEventListener("compositionstart", () => {
      this.composing = true;
    });
    text.addEventListener("compositionend", () => {
      this.composing = false;
      // The last `input` of a composition may come before or after this
      // event depending on the engine; read after both have landed.
      setTimeout(() => this.readBack("other"), 0);
    });
    text.addEventListener("keydown", this.onKeyDown);
    text.addEventListener("paste", this.onPaste);
    text.addEventListener("copy", (event) => this.onCopy(event, false));
    text.addEventListener("cut", (event) => this.onCopy(event, true));
    text.addEventListener("click", this.onTextClick);
    for (const type of ["pointerdown", "pointermove", "pointerup"] as const) {
      text.addEventListener(type, (event) => {
        this.lastPointerX = event.clientX;
      });
    }
    text.addEventListener("focus", () => {
      this.textFocused = true;
      this.frame.setAttribute("data-focused", "");
    });
    text.addEventListener("blur", () => {
      this.textFocused = false;
      this.frame.removeAttribute("data-focused");
      // Leaving a formula ends the name being typed: it becomes a chip now
      // (139 criterion 5), not at the next keystroke somewhere else.
      if (this.formula) {
        this.reread();
        this.renderText();
      }
    });

    this.toolbar?.addEventListener("keydown", this.onToolbarKeyDown);
    this.root.querySelectorAll<HTMLButtonElement>("[data-command]").forEach((button) => {
      // Never steal focus from the text with a pointer (the panel's rule,
      // measured 31/8 on the iPad): the selection stays where the redaktör put it.
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => void this.command(button.dataset.command as ToolbarFeature));
    });

    this.answerToggle?.addEventListener("mousedown", (event) => event.preventDefault());
    this.answerToggle?.addEventListener("click", (event) => {
      const open = this.answerToggle.getAttribute("aria-expanded") === "true";

      this.closeMenus();
      if (!open) this.openMenu(this.answerToggle, this.answerMenu, (event as MouseEvent).detail === 0);
    });

    for (const menu of [this.answerMenu, this.chipMenu]) {
      if (!menu) continue;
      menu.addEventListener("keydown", (event) => this.onMenuKeyDown(event, menu));
      menu.addEventListener("focusout", (event) => {
        const next = (event as FocusEvent).relatedTarget as Node | null;

        // `null` is "unknown" on Safari's tap (the panel's variable menu, 31/8), not "outside".
        if (next && !menu.contains(next)) this.closeMenus();
      });
    }

  }

  /**
   * A press anywhere else closes the menus. On the document, not on the
   * field's root: Johan's iPad 27/9 (protocol item A, measured in WebKit as
   * iPad) — a tap outside the field never reached a listener on the field's
   * own shadow root, so the menu stayed open and the next tap on the plus
   * closed it instead of opening. Added on open and removed on close, like
   * the scroll listener; capture, so nothing can stop it on the way.
   */
  private onPointerDownAway = (event: Event): void => {
    const path = event.composedPath();

    if (![this.answerMenu, this.chipMenu, this.answerToggle].some((element) => element && path.includes(element))) {
      this.closeMenus();
    }
  };

  // --- Drawing ---------------------------------------------------------------

  /** The whole text, from the model. Hundreds of characters, not a page (137 point 3). */
  private renderText(): void {
    if (!this.editable) return;

    this.editable.replaceChildren(renderBlocks(this.doc, (item) => this.chipElement(item)));

    const empty = this.doc.blocks.every((block) => blockLength(block) === 0);

    this.editable.toggleAttribute("data-empty", empty);
  }

  private chipElement(item: Extract<Inline, { type: "chip" }>): HTMLElement {
    const option = this.variablesValue.find((one) => one.value === item.name);
    const known = this.knownValue ?? new Set(this.variablesValue.map((one) => one.value));
    const missing = !known.has(item.name);
    const label = missing
      ? this.text("editor.properties.variable-missing", { name: item.name })
      : option?.label || item.name;
    const chip = document.createElement("span");

    chip.className = missing ? "chip chip--missing" : "chip";
    chip.contentEditable = "false";
    chip.setAttribute("data-chip", "");
    chip.setAttribute("data-variable", item.name);
    if (item.source) chip.setAttribute("data-source", item.source);
    chip.setAttribute("role", "button");
    chip.setAttribute("aria-haspopup", "menu");
    chip.setAttribute("aria-label", this.text(this.formula ? "editor.properties.variable-chip" : "editor.properties.answer-chip", { label }));
    chip.innerHTML = `<span class="chip__label">${escapeHtml(label)}</span><span class="chevron" aria-hidden="true"></span>`;

    return chip;
  }

  /**
   * Johans val (26/9) bland plus-varianterna: menyn har en rubrik ovanför
   * listan, byggd som en egen grupp — så en kommande sort (t.ex. uträkning)
   * blir en till `menu__group` bredvid, aldrig en omritning av den här.
   * Ingen grupp alls när det inte finns något att erbjuda.
   *
   * Johans iPad 27/9: `idag` hör inte hemma bland svaren en fråga satte —
   * grupperingen läser `option.computed` (satt i `getOptions()`, aldrig
   * gissat på namnet "idag"), inte en lista av namn här.
   *
   * Astras förslag (Johan 28/9, "för bättring av menyn") döper om rubriken
   * till "Svar från guiden", tar bort dess ikon och streck under sig — bara
   * en tunn linje MELLAN grupperna kvar (`.menu__group + .menu__group`,
   * oförändrad sedan Johans val 26/9) — och flyttar ikonen ner till varje
   * rad i stället: samma ikon för hela gruppen, given till `group()` här.
   */
  private renderAnswerMenu(): void {
    if (!this.answerMenu) return;

    const formula = this.formula;
    const group = (rowIcon: string, key: string, options: AnswerOption[]): string => {
      if (options.length === 0) return "";

      const label = this.text(key);

      // A formula's rows carry the name beside the label (139 criterion 6):
      // two variables can share a label, and the name is what the formula
      // will hold. `data-search-text` is what the search box matches.
      return `
        <div class="menu__group" role="group" aria-label="${escapeAttr(label)}">
          <p class="menu__group-label" aria-hidden="true">${escapeHtml(label)}</p>
          ${options.map((option) => `<button type="button" role="menuitem" tabindex="-1" data-insert="${escapeAttr(option.value)}" data-search-text="${escapeAttr(`${option.label} ${option.value}`.toLowerCase())}">${formula ? "" : rowIcon}<span class="menu__item-label">${escapeHtml(option.label || option.value)}</span>${formula && option.label ? `<code class="menu__item-name">${escapeHtml(option.value)}</code>` : ""}</button>`).join("")}
        </div>`;
    };
    // A formula's menu (bild 05): the calculations' results first, then the
    // answers — each row its label over its name, no row icon.
    const calculated = formula ? this.variablesValue.filter((option) => option.calculated && !option.computed) : [];
    const answers = this.variablesValue.filter((option) => !option.computed && !calculated.includes(option));
    const computed = this.variablesValue.filter((option) => option.computed);
    const searchLabel = this.text("editor.properties.variable-search");
    // The search box first, in a formula only (Astras spec §8): typed into,
    // it hides every row whose label and name both miss the text.
    const search = formula && this.variablesValue.length > 0
      ? `<div class="menu__search">${SEARCH_ICON}<input type="search" data-answer-search autocomplete="off" aria-label="${escapeAttr(searchLabel)}" placeholder="${escapeAttr(`${searchLabel}…`)}"></div>`
      : "";

    // No heading and no footnote: bild 05 has neither, and the lead chose 05
    // over 03 for the menu (29/9) — the search box is the menu's first line.
    this.answerMenu.innerHTML =
      search +
      group(ANSWER_ROW_ICON, "editor.properties.formula-calculations-group", calculated) +
      group(ANSWER_ROW_ICON, formula ? "editor.properties.formula-answers-group" : "editor.properties.answers-group", answers) +
      group(COMPUTED_ROW_ICON, "editor.properties.computed-group", computed);
    this.answerMenu.querySelector<HTMLInputElement>("[data-answer-search]")?.addEventListener("input", (event) => {
      this.filterAnswerMenu((event.target as HTMLInputElement).value);
    });
    this.answerMenu.querySelectorAll<HTMLButtonElement>("[data-insert]").forEach((button) => {
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => {
        this.closeMenus();
        this.apply(insertInline(this.doc, this.selection, [{ type: "chip", name: button.dataset.insert ?? "", marks: marksAt(this.doc, orderedRange(this.selection)[0]) }]), "other");
        this.editable.focus();
        this.restoreSelection();
      });
    });

    // Nothing to insert: no button that promises a choice it cannot give (the
    // panel's rule). The wrapper exists only in a one-line field; a
    // multiline field's plus lives bare in the toolbar, so it is hidden
    // directly.
    const answerHost = this.root.querySelector<HTMLElement>("[data-answer]") ?? this.answerToggle;

    answerHost?.toggleAttribute("hidden", this.variablesValue.length === 0);
  }

  /** `aria-pressed` from the selection, and the selected chip's ring. */
  private updateState(): void {
    const pressed: Record<ToolbarFeature, boolean> = {
      bold: this.pendingMarks ? Boolean(this.pendingMarks.bold) : hasMark(this.doc, this.selection, "bold"),
      italic: this.pendingMarks ? Boolean(this.pendingMarks.italic) : hasMark(this.doc, this.selection, "italic"),
      link: hasMark(this.doc, this.selection, "link"),
      "bullet-list": blockTypeAt(this.doc, this.selection) === "bullet",
      "numbered-list": blockTypeAt(this.doc, this.selection) === "numbered",
    };

    this.root.querySelectorAll<HTMLButtonElement>("[data-command]").forEach((button) => {
      button.setAttribute("aria-pressed", String(pressed[button.dataset.command as ToolbarFeature]));
    });

    const chip = selectedChip(this.doc, this.selection);

    this.editable.querySelectorAll("[data-chip]").forEach((element) => element.removeAttribute("data-selected"));
    if (chip) this.chipAt(chip.position)?.setAttribute("data-selected", "");

    // One tab stop into the toolbar (136 criterion 10): the first enabled tool.
    const tools = this.tools();

    if (tools.length > 0 && !tools.some((tool) => tool.tabIndex === 0)) tools[0]!.tabIndex = 0;
  }

  // --- Positions between the model and the DOM ------------------------------

  private readSelection(): { anchor: DomPoint; focus: DomPoint } | null {
    const shadow = this.root as ShadowRoot & { getSelection?: () => globalThis.Selection | null };
    const own = shadow.getSelection?.();
    const selection = own ?? document.getSelection();

    if (!selection || selection.rangeCount === 0) return null;

    const composed = (selection as globalThis.Selection & {
      getComposedRanges?: (...args: unknown[]) => StaticRange[];
    }).getComposedRanges;

    if (!own && typeof composed === "function") {
      let ranges: StaticRange[];

      try {
        ranges = composed.call(selection, { shadowRoots: [this.root] });
      } catch {
        ranges = composed.call(selection, this.root);
      }

      const range = ranges[0];

      if (!range || !this.editable.contains(range.startContainer)) return null;

      const backward = (selection as globalThis.Selection & { direction?: string }).direction === "backward";
      const start = { node: range.startContainer, offset: range.startOffset };
      const end = { node: range.endContainer, offset: range.endOffset };

      return backward ? { anchor: end, focus: start } : { anchor: start, focus: end };
    }

    if (!selection.anchorNode || !this.editable.contains(selection.anchorNode)) return null;

    return {
      anchor: { node: selection.anchorNode, offset: selection.anchorOffset },
      focus: { node: selection.focusNode!, offset: selection.focusOffset },
    };
  }

  private toModel(points: DomPoint[]): Array<Position | null> {
    return readDom(this.editable, points).positions.map((position) => (position ? clampPosition(this.doc, position) : null));
  }

  /**
   * The model's position as a DOM point.
   *
   * Right before a chip it is after the chip's joiner, never the end of the
   * text before it (fynd f, Johan's iPad 25/9). When the chip has wrapped to
   * the next line, the end of the text is the end of the line above too, and
   * an engine may draw the caret there — after "oss!", while typing goes in
   * before the chip. Measured 25/9: at the text's end Firefox and WebKit put
   * the caret on the line above; the point between the nodes helped Firefox
   * but not WebKit, which only the joiner in the chip's box does (see
   * `renderInline`).
   */
  private toDom(position: Position): { node: Node; offset: number } {
    const blockElement = this.editable.querySelector(`[data-block="${position.block}"]`) ?? this.editable;
    let count = 0;
    let last: Node | null = null;
    let atTextEnd = false;

    for (const node of leaves(blockElement)) {
      if (atTextEnd) {
        if (node instanceof HTMLElement && node.hasAttribute("data-chip")) return beforeChip(node);
        return { node: last!, offset: last!.nodeValue?.length ?? 0 };
      }
      if (node.nodeType === Node.TEXT_NODE) {
        const length = node.nodeValue?.length ?? 0;

        if (position.offset < count + length) return { node, offset: position.offset - count };
        if (position.offset === count + length) atTextEnd = true;
        count += length;
      } else {
        if (position.offset === count) return node instanceof HTMLElement && node.hasAttribute("data-chip") ? beforeChip(node) : { node: node.parentNode!, offset: indexOf(node) };
        count += 1;
      }
      last = node;
    }

    if (last && last.nodeType === Node.TEXT_NODE) return { node: last, offset: last.nodeValue?.length ?? 0 };
    if (last) {
      const outer = last instanceof HTMLElement && last.parentElement?.hasAttribute("data-chip-glue") ? last.parentElement : last;

      return { node: outer.parentNode!, offset: indexOf(outer) + 1 };
    }

    return { node: blockElement, offset: 0 };
  }

  private restoreSelection(): void {
    if (this.root.activeElement !== this.editable && document.activeElement !== this) return;

    const anchor = this.toDom(this.selection.anchor);
    const focus = this.toDom(this.selection.focus);

    try {
      document.getSelection()?.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
    } catch {
      // A node that went with the redraw: the model's position stands.
    }

    this.revealCaret(focus);
  }

  /**
   * Scrolls a one-line field sideways to the caret (fynd a, Johan's iPad
   * 25/9: a long title ran on under *Infoga svar*). The browser scrolls to
   * the caret after its own edits; ours are prevented and redrawn, so the
   * field does it itself.
   */
  private revealCaret(at: { node: Node; offset: number }): void {
    if (this.multiline) return;

    const range = document.createRange();

    try {
      range.setStart(at.node, at.offset);
    } catch {
      return;
    }

    const caretBox = range.getBoundingClientRect();
    const box = this.editable.getBoundingClientRect();

    if (caretBox.height === 0 && caretBox.width === 0 && caretBox.left === 0) return;

    // The text's own padding, so the caret never stands on the very edge.
    const inset = parseFloat(getComputedStyle(this.editable).paddingRight) || 0;

    if (caretBox.right > box.right - inset) this.editable.scrollLeft += caretBox.right - (box.right - inset);
    else if (caretBox.left < box.left + inset) this.editable.scrollLeft -= box.left + inset - caretBox.left;
  }

  private chipAt(position: Position): HTMLElement | null {
    const blockElement = this.editable.querySelector(`[data-block="${position.block}"]`);
    let count = 0;

    for (const node of blockElement ? leaves(blockElement) : []) {
      if (count === position.offset && node instanceof HTMLElement && node.hasAttribute("data-chip")) return node;
      count += node.nodeType === Node.TEXT_NODE ? node.nodeValue?.length ?? 0 : 1;
      if (count > position.offset) return null;
    }

    return null;
  }

  /*
   * `selectionchange` arrives as a task of its own, after the key that moved
   * the caret — so a key pressed straight after (arrow, arrow, Enter, typed in
   * one breath or by a test) would find the model's caret one step behind.
   * Every change therefore reads the selection first.
   */
  private onSelectionChange = (): void => {
    if (this.composing || !this.editable || !this.editable.isConnected) return;
    if (!this.textFocused) return;

    const read = this.readSelection();

    if (!read) return;
    if (this.caretOutOfChip(read.anchor, read.focus)) return;

    const [anchor, focus] = this.toModel([read.anchor, { ...read.focus, bias: "end" }]);

    if (!anchor || !focus) return;

    const moved = JSON.stringify({ anchor, focus }) !== JSON.stringify(this.selection);

    this.selection = { anchor, focus };
    this.snapToChipLine(read.anchor, anchor, focus);
    if (moved) {
      this.pendingMarks = null;
      this.lastKind = null;
    }
    this.updateState();
  };

  /**
   * A caret the browser put inside a chip is moved out of it — after the
   * chip, or before it when the pointer last stood left of the chip's middle
   * (fynd l, Johan's iPad 26–27/9: *"Det gick inte att ställa sig sist om
   * brickan var sist i raden"*).
   *
   * A chip is one character to the model and has no inside; a collapsed
   * caret in its label, its chevron or the chip itself is never a place, and
   * the field used to read it as *the chip is selected*. With no text after
   * a last chip there was then no way past it by finger.
   *
   * Measured: a tap 10 px right and 14 px below a last chip put WebKit's
   * caret at `<span.chevron>@0` (Playwright as an iPad Pro 11). The first
   * rule answered only within 600 ms of a press beside the chip — and
   * Johan's log from the iPad the next day was a long press with the loupe:
   * pointerdown at 105 696 ms, the caret into the chevron at 106 324 ms,
   * pointerup at 108 205 ms. Late, and with the finger on the chip, because
   * during a long press the caret follows the finger. So no window and no
   * box test: the pointer's last x, however old, only picks the side.
   *
   * A chip is still selected by a click on it (`onTextClick`, which comes
   * after `selectionchange` and selects from the chip, not from the caret)
   * or from the keyboard (Shift+arrow, which never collapses). A range the
   * visitor drags is never touched. Moving the caret fires
   * `selectionchange` again, which finds it outside every chip.
   */
  private caretOutOfChip(anchor: DomPoint, focus: DomPoint): boolean {
    if (anchor.node !== focus.node || anchor.offset !== focus.offset) return false;

    const element = anchor.node instanceof Element ? anchor.node : anchor.node.parentElement;
    const chip = element?.closest<HTMLElement>("[data-chip]");

    if (!chip || !this.editable.contains(chip)) return false;

    const [at] = this.toModel([{ node: chip.parentNode!, offset: indexOf(chip) }]);

    if (!at) return false;

    const box = chip.getBoundingClientRect();
    const before = this.lastPointerX !== null && this.lastPointerX < box.left + box.width / 2;

    this.selection = caret({ block: at.block, offset: before ? at.offset : at.offset + 1 });
    this.pendingMarks = null;
    this.lastKind = null;
    this.restoreSelection();
    this.updateState();
    return true;
  }

  /**
   * A caret the browser put right before a chip is moved to the chip's own
   * line (fynd f, Johan's iPad 26/9).
   *
   * `toDom` puts the caret after the joiner in the chip's box, so a caret the
   * FIELD sets is drawn on the chip's line. A tap or a click is the browser's:
   * just before a chip that has wrapped, WebKit and Chromium put it at the end
   * of the text above — the same model position, drawn on the line above
   * (measured 26/9 in Playwright's WebKit as an iPad Pro 11: the text node,
   * its last offset). Reading it was not enough; it has to be written back.
   *
   * Only a collapsed caret, and only where `toDom` answers inside a chip's
   * box: everywhere else the browser's point is as good as ours, and a field
   * that rewrote every caret would fight every selection a person drags. The
   * write fires `selectionchange` again, which reads the joiner's point and
   * finds nothing to do.
   */
  private snapToChipLine(read: DomPoint, anchor: Position, focus: Position): void {
    if (anchor.block !== focus.block || anchor.offset !== focus.offset) return;

    const target = this.toDom(anchor);

    if (!(target.node.parentNode instanceof HTMLElement) || !target.node.parentNode.hasAttribute("data-chip-glue")) return;
    if (target.node === read.node && target.offset === read.offset) return;

    try {
      document.getSelection()?.setBaseAndExtent(target.node, target.offset, target.node, target.offset);
    } catch {
      // A node that went with a redraw: the model's position stands.
    }
  }

  // --- Changing the text -----------------------------------------------------

  /**
   * One change to the model, and everything that follows from it: a history
   * step (or not, when a word is still being typed), the re-read when the
   * visitor would see something else, the redraw, the caret, the value.
   */
  private apply(edit: Edit, kind: HistoryKind, typed = ""): void {
    const merge =
      kind === this.lastKind &&
      kind !== "other" &&
      !(kind === "typing" && this.lastTypedSpace && /\S/.test(typed));

    if (!merge) this.undoStack.push({ doc: this.doc, selection: this.selection });
    this.redoStack = [];
    this.lastKind = kind;
    if (kind === "typing") this.lastTypedSpace = /\s$/.test(typed);

    this.doc = edit.doc;
    this.selection = edit.selection;
    this.reread();
    this.commit();
  }

  /**
   * Shows what the visitor will get when the text says something else.
   *
   * Since 25/9 the viewer has an escape, so `2*3*4`, `[a](b)` and `{{namn}}`
   * typed as text are stored as text. What remains is `- ` or `1. ` first on
   * a line, which the viewer reads as a list: when the model no longer reads
   * back as itself (`isFaithful`), the field re-reads what it would store and
   * shows the list — the only honest picture. A marker holds the caret's
   * place through the re-read.
   */
  private reread(): void {
    const options = this.options();

    if (isFaithful(this.doc, options)) return;

    /*
     * The marker holds the caret's place — and, in a formula, keeps the name
     * the caret is IN from becoming a chip (139 criterion 5). Only while the
     * text has focus: an unfocused field's "caret" is just where the last
     * edit left it, at the end, and a known name written last stayed text
     * for ever when the panel handed the names in after the value (Fia
     * 29/9, "x - grund"). Without focus nothing is being typed, so nothing
     * is protected and the caret is clamped to where it was.
     */
    const marker = this.textFocused ? CARET_MARKER : "";
    const withMarker = marker
      ? insertText(this.doc, caret(this.selection.focus), marker, marksAt(this.doc, this.selection.focus)).doc
      : this.doc;
    const reread = parseRichText(writeRichText(withMarker, options), options);

    if (!reread) return;
    if (!marker) {
      this.doc = reread;
      this.selection = caret(clampPosition(reread, this.selection.focus));
      return;
    }

    let found: Position | null = null;

    reread.blocks = reread.blocks.map((block, blockIndex) => {
      let offset = 0;
      const content: Inline[] = [];

      for (const item of block.content) {
        if (item.type === "text" && item.text.includes(marker)) {
          found ??= { block: blockIndex, offset: offset + item.text.indexOf(marker) };
          const text = item.text.replace(marker, "");

          if (text) content.push({ ...item, text });
          offset += text.length;
          continue;
        }
        if (item.type === "chip" && item.name.includes(marker)) {
          content.push({ ...item, name: item.name.replace(marker, ""), source: item.source?.replace(marker, "") });
          offset += 1;
          found ??= { block: blockIndex, offset };
          continue;
        }
        content.push(item);
        offset += item.type === "text" ? item.text.length : 1;
      }

      return { ...block, content };
    });

    this.doc = reread;
    this.selection = caret(clampPosition(reread, found ?? this.selection.focus));
  }

  private commit(): void {
    this.renderText();
    this.restoreSelection();
    this.updateState();
    this.emit();
  }

  private emit(): void {
    const written = writeRichText(this.doc, this.options());
    // Back where it started: the string it was given, to the letter.
    const value = written === this.initialWritten ? this.initialValue ?? written : written;

    if (value === this.currentValue) return;

    this.currentValue = value;
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }

  private undo(): void {
    const entry = this.undoStack.pop();

    if (!entry) return;

    this.redoStack.push({ doc: this.doc, selection: this.selection });
    this.doc = entry.doc;
    this.selection = entry.selection;
    this.lastKind = null;
    this.commit();
  }

  private redo(): void {
    const entry = this.redoStack.pop();

    if (!entry) return;

    this.undoStack.push({ doc: this.doc, selection: this.selection });
    this.doc = entry.doc;
    this.selection = entry.selection;
    this.lastKind = null;
    this.commit();
  }

  // --- The keyboard ------------------------------------------------------------

  /** The browser's own range for the change, when it gives one — graphemes and words are its to know. */
  private targetRange(event: InputEvent): Selection | null {
    const range = event.getTargetRanges?.()[0];

    if (!range) return null;

    const [start, end] = this.toModel([
      { node: range.startContainer, offset: range.startOffset, bias: "start" },
      { node: range.endContainer, offset: range.endOffset, bias: "end" },
    ]);

    return start && end ? { anchor: start, focus: end } : null;
  }

  private onBeforeInput = (event: InputEvent): void => {
    if (this.disabled) {
      event.preventDefault();
      return;
    }

    this.onSelectionChange();

    // Path (b): the browser writes, `input` reads it back.
    if (event.isComposing || this.composing || !event.cancelable) return;

    const type = event.inputType;
    const target = this.targetRange(event);
    const collapsed = isCollapsed(this.selection);

    switch (type) {
      case "insertText":
      case "insertReplacementText": {
        const text = event.data ?? event.dataTransfer?.getData("text/plain") ?? "";
        const where = type === "insertReplacementText" && target ? target : this.selection;
        const marks = this.pendingMarks ?? marksAt(this.doc, orderedRange(where)[0]);

        event.preventDefault();
        this.pendingMarks = null;
        this.apply(insertText(this.doc, where, text.replace(/\r?\n/g, " "), marks), type === "insertText" ? "typing" : "other", text);
        return;
      }
      case "insertParagraph":
        event.preventDefault();
        if (this.multiline) this.apply(splitBlock(this.doc, this.selection), "other");
        return;
      case "insertLineBreak": {
        event.preventDefault();
        if (!this.multiline) return;
        const [start] = orderedRange(this.selection);
        // A list item is one line in the viewer: Shift+Enter there is Enter.
        this.apply(
          this.doc.blocks[start.block]!.type === "paragraph"
            ? insertInline(this.doc, this.selection, [{ type: "break" }])
            : splitBlock(this.doc, this.selection),
          "other",
        );
        return;
      }
      case "deleteContentBackward":
      case "deleteWordBackward":
      case "deleteSoftLineBackward":
      case "deleteHardLineBackward":
        event.preventDefault();
        this.apply(
          !collapsed || this.selection.focus.offset === 0 || !target || isCollapsed(target)
            ? deleteBackward(this.doc, this.selection)
            : deleteRange(this.doc, ...orderedRange(target)),
          "deleting",
        );
        return;
      case "deleteContentForward":
      case "deleteWordForward":
      case "deleteSoftLineForward":
      case "deleteHardLineForward":
        event.preventDefault();
        this.apply(
          !collapsed || !target || isCollapsed(target) || target.anchor.block !== target.focus.block
            ? deleteForward(this.doc, this.selection)
            : deleteRange(this.doc, ...orderedRange(target)),
          "deleting",
        );
        return;
      case "deleteByCut":
      case "deleteContent":
        event.preventDefault();
        this.apply(deleteRange(this.doc, ...orderedRange(this.selection)), "other");
        return;
      case "historyUndo":
        event.preventDefault();
        this.undo();
        return;
      case "historyRedo":
        event.preventDefault();
        this.redo();
        return;
      case "formatBold":
      case "formatItalic":
        event.preventDefault();
        void this.command(type === "formatBold" ? "bold" : "italic");
        return;
      case "insertFromPaste":
      case "insertFromDrop": {
        // Reached only where `paste` did not take it first.
        const data = event.dataTransfer;

        event.preventDefault();
        if (data) this.insertTransfer(data.getData("text/html"), data.getData("text/plain"));
        return;
      }
      default:
        // Something we have no word for: the browser writes, path (b) reads.
        return;
    }
  };

  /** Path (b): read what the browser wrote. */
  private onInput = (event: Event): void => {
    // The host sends its own `input`, once, when the value changed.
    event.stopPropagation();

    if (this.composing || (event as InputEvent).isComposing) return;

    /*
     * An undo the engine would not let us cancel (fynd g, the iPad's shake and
     * keyboard button): it has undone its own stack — which holds none of the
     * model's changes, a removed chip least of all — so the model undoes
     * instead, and the redraw replaces whatever the engine did. Every step the
     * engine could have undone (path b) is in the model's history too.
     */
    const type = (event as InputEvent).inputType;

    if (type === "historyUndo" || type === "historyRedo") {
      if (type === "historyUndo") this.undo();
      else this.redo();
      return;
    }

    this.readBack(type === "insertText" ? "typing" : "other");
  };

  private readBack(kind: HistoryKind): void {
    const read = this.readSelection();
    const reading = readDom(this.editable, read ? [read.anchor, { ...read.focus, bias: "end" }] : []);
    const [anchor, focus] = reading.positions;
    const doc = reading.doc;
    const selection = anchor && focus
      ? { anchor: clampPosition(doc, anchor), focus: clampPosition(doc, focus) }
      : caret(clampPosition(doc, this.selection.focus));

    if (JSON.stringify(doc) === JSON.stringify(this.doc)) {
      // Nothing new (a composition that ended where it began) — just redraw the one way.
      this.renderText();
      this.selection = selection;
      this.restoreSelection();
      return;
    }

    this.apply({ doc, selection }, kind);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    this.onSelectionChange();
    const key = event.key.toLowerCase();
    const modifier = (event.ctrlKey || event.metaKey) && !event.altKey;
    const features = new Set(this.features);

    if (modifier && (key === "z" || key === "y")) {
      event.preventDefault();
      if (key === "y" || event.shiftKey) this.redo();
      else this.undo();
      return;
    }

    if (modifier && !event.shiftKey) {
      const command = key === "b" ? "bold" : key === "i" ? "italic" : key === "k" ? "link" : null;

      if (command && features.has(command)) {
        event.preventDefault();
        void this.command(command);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey && !modifier) {
      const chip = selectedChip(this.doc, this.selection);

      if (chip) {
        event.preventDefault();
        this.openChipMenu(chip.position, true);
        return;
      }
    }

    /*
     * Past a chip in one press (fynd f): beside the joiner the engines stop
     * once more at the same place in the text — measured in all three, the
     * caret stood still one press. Plain arrows only; Shift+arrow still
     * selects the chip, which Enter opens (136 criterion 10).
     */
    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && !event.shiftKey && !event.altKey && !modifier && !this.composing) {
      const [start, end] = orderedRange(this.selection);
      const content = this.doc.blocks[start.block]?.content ?? [];
      const at = (offset: number) => sliceInline(content, offset, offset + 1)[0];
      const collapsed = start.block === end.block && start.offset === end.offset;
      const target = !collapsed ? null
        : event.key === "ArrowLeft"
          ? (start.offset > 0 && (at(start.offset)?.type === "chip" || at(start.offset - 1)?.type === "chip") ? start.offset - 1 : null)
          : (at(start.offset)?.type === "chip" ? start.offset + 1 : null);

      if (target !== null) {
        event.preventDefault();
        this.selection = caret({ block: start.block, offset: target });
        this.restoreSelection();
        this.updateState();
      }
    }

    if (/^(Arrow|Home|End|Page)/.test(event.key)) {
      this.lastKind = null;
      this.pendingMarks = null;
    }
  };

  private onToolbarKeyDown = (event: KeyboardEvent): void => {
    const tools = this.tools();
    const index = tools.indexOf(this.root.activeElement as HTMLButtonElement);

    if (index < 0) return;

    const next =
      event.key === "ArrowRight" ? (index + 1) % tools.length
        : event.key === "ArrowLeft" ? (index - 1 + tools.length) % tools.length
          : event.key === "Home" ? 0
            : event.key === "End" ? tools.length - 1
              : -1;

    if (next < 0) return;

    event.preventDefault();
    tools.forEach((tool, at) => {
      tool.tabIndex = at === next ? 0 : -1;
    });
    tools[next]!.focus();
  };

  /** The toolbar's roving group: the format buttons, then *Infoga svar* when it sits there. */
  private tools(): HTMLButtonElement[] {
    if (!this.toolbar) return [];

    return [...this.toolbar.querySelectorAll<HTMLButtonElement>("[data-command], [data-answer-toggle]")].filter(
      (tool) => !tool.disabled && !tool.closest("[hidden]"),
    );
  }

  private onTextClick = (event: MouseEvent): void => {
    const chip = (event.target as Element | null)?.closest?.("[data-chip]");

    if (!chip || this.disabled) return;
    // A press beside the chip is not a press on it (fynd l) — see `caretOutOfChip`.
    if (event.detail !== 0 && besideBox(chip.getBoundingClientRect(), event.clientX, event.clientY)) return;

    const [position] = this.toModel([{ node: chip.parentNode!, offset: indexOf(chip) }]);

    if (!position) return;

    this.selection = { anchor: position, focus: { ...position, offset: position.offset + 1 } };
    this.restoreSelection();
    this.updateState();
    this.openChipMenu(position, event.detail === 0);
  };

  // --- Commands --------------------------------------------------------------

  private async command(feature: ToolbarFeature): Promise<void> {
    if (this.disabled) return;

    this.lastKind = null;

    if (feature === "bold" || feature === "italic") {
      if (isCollapsed(this.selection)) {
        // Nothing selected: the next letters take the change (as in every editor).
        const marks = { ...(this.pendingMarks ?? marksAt(this.doc, this.selection.focus)) };

        if (marks[feature]) delete marks[feature];
        else marks[feature] = true;
        this.pendingMarks = marks;
        this.focusText();
        this.updateState();
        return;
      }

      this.apply(toggleMark(this.doc, this.selection, feature), "other");
      this.focusText();
      return;
    }

    if (feature === "bullet-list" || feature === "numbered-list") {
      this.apply(toggleBlockType(this.doc, this.selection, feature === "bullet-list" ? "bullet" : "numbered"), "other");
      this.focusText();
      return;
    }

    await this.link();
  }

  /**
   * Link: in a link, the button takes it away (it is pressed there, like bold);
   * elsewhere it asks for the address — the host's picker when one is
   * registered (story 100), otherwise our own dialog.
   */
  private async link(): Promise<void> {
    const selection = this.selection;
    const [start, end] = orderedRange(selection);

    if (hasMark(this.doc, selection, "link")) {
      const whole = isCollapsed(selection) ? linkRangeAt(this.doc, start) : null;
      const range: Selection = whole
        ? { anchor: { block: start.block, offset: whole.from }, focus: { block: start.block, offset: whole.to } }
        : selection;

      this.apply(setLink(this.doc, range, null), "other");
      this.focusText();
      return;
    }

    const selectedText = extractRange(this.doc, selection).blocks.map((block) => block.content.map((item) => (item.type === "text" ? item.text : "")).join("")).join(" ");
    const picker = getLinkPicker();
    let picked: { url: string; label?: string; ref?: string } | null;

    if (picker) {
      picked = await picker.pick({ locale: this.getAttribute("locale") ?? SOURCE_LOCALE, selectedText });
    } else {
      const dialog = this.root.querySelector<PromptDialog>("prompt-dialog")!;
      const url = await dialog.ask({
        title: this.text("editor.properties.format-link"),
        label: this.text("editor.properties.link-address"),
        value: "https://",
        confirmLabel: this.text("editor.properties.link-add"),
      });

      picked = url && url.trim() !== "https://" ? { url: url.trim() } : null;
    }

    this.selection = selection;
    this.focusText();

    if (!picked) return;

    const link = picked.ref ? { url: picked.url, ref: picked.ref } : { url: picked.url };

    if (isCollapsed(selection) || (start.block === end.block && start.offset === end.offset)) {
      const label = picked.label || this.text("editor.properties.link-placeholder-text");

      this.apply(insertText(this.doc, selection, label, { ...marksAt(this.doc, start), link }), "other");
      return;
    }

    this.apply(setLink(this.doc, selection, link), "other");
  }

  private focusText(): void {
    this.editable.focus();
    this.restoreSelection();
  }

  // --- Menus -----------------------------------------------------------------

  private openMenu(toggle: HTMLElement | null, menu: HTMLElement, withKeyboard: boolean, anchor?: DOMRect): void {
    toggle?.setAttribute("aria-expanded", "true");
    if (toggle === this.answerToggle) this.setAnswerToggleLabel(true);
    menu.hidden = false;
    // Astras förslag (Johan 28/9): svarsmenyn följer fältets bredd — `fit`,
    // see `placeMenu`. Brickans byt-meny (`this.chipMenu`) är oförändrad.
    this.placeMenu(menu, anchor ?? toggle!.getBoundingClientRect(), anchor ? "start" : "end", menu === this.answerMenu);
    document.addEventListener("pointerdown", this.onPointerDownAway, true);

    const search = menu.querySelector<HTMLElement>("[data-answer-search]");

    // Focus into the menu only from the keyboard; a pointer keeps the text's
    // focus, and a tablet keeps its keyboard up (the panel's rule, 31/8).
    // A search box is the exception, and the rule's reason is why: it is a
    // text field, so the keyboard stays up — and with focus left in the
    // formula, what is typed for the search would land in the formula (Fia
    // 29/9, measured in Chromium).
    if (search) search.focus();
    else if (withKeyboard) menu.querySelector<HTMLButtonElement>("button")?.focus();
  }

  /**
   * Johans iPad 27/9: the plus becomes a cross while its own menu is open —
   * same icon (`.tool[aria-expanded] svg` turns 45°, the scss), the name
   * "Stäng" instead of "Infoga variabel". Only the answer toggle has a name that
   * changes with its state; the chip's menu has no toggle button of its own.
   */
  private setAnswerToggleLabel(expanded: boolean): void {
    if (!this.answerToggle) return;

    const label = this.text(expanded ? "editor.properties.close-menu" : "editor.properties.insert-variable");

    this.answerToggle.setAttribute("aria-label", label);
    this.answerToggle.setAttribute("title", label);
  }

  /**
   * Absolute in the field's frame, like the panel's own variable menu — not
   * `position: fixed`. Fixed was the first answer to fynd (e) (Johan's iPad
   * 25/9: the chip's menu clipped by the text's own scroll box), and it
   * failed on the same iPad 27/9 (protocol item A): with the keyboard up,
   * iPadOS moves the fixed layer against the visible part of the page, and
   * the menu opened at −235 px while the visible band lay at 394–834 — open
   * in the DOM, nowhere on screen. Offsets between two boxes do not depend on
   * any viewport, so the menu is placed from the anchor's box relative to
   * the frame's, under the anchor, never past the frame's sides; the panel
   * that scrolls then scrolls it into view. Nothing closes it on scroll any
   * more — it moves with its anchor. `popover` would also do, but it is
   * above the editor's floor (Safari 17, Firefox 125; K18 says 16.4 and 121).
   *
   * `fit` (Astras exakta mått, Johan 28/9, tredje vändan): svarsmenyn är
   * 270 px inklusive kant, 16 px in från ramens vänsterkant — inte
   * högerställd under plusset och inte längre utfylld mot fältets bredd
   * (360 px, förra vändan). På ett smalt fält krymper den i stället:
   * `min(270, ramens bredd − 2×16)`. Bara svarsmenyn: brickans byt-meny
   * (`align: "start"`, aldrig `fit`) står kvar som förut, ankrad under
   * brickan, med sin egen 220 px-golv (`min-width` i scss:en).
   *
   * `left`/`width` på ett absolut placerat barn räknas från ramens
   * paddingkant, en kantbredd innanför `getBoundingClientRect()`s ruta
   * (som mäter hela synliga lådan) — nettat ut här, annars hamnade menyn
   * en kantbredd för smal (mätt, provet nedan såg det falla innan detta
   * fanns). `.menu` har `box-sizing: border-box` (scss:en), så bredden
   * här är precis den synliga, kanten inräknad.
   *
   * `gap` 4 → 6 (Astras mått): mellanrummet mellan verktygsradens/fältets
   * underkant och menyns egen topp.
   */
  private placeMenu(menu: HTMLElement, anchor: DOMRect, align: "start" | "end", fit = false): void {
    const gap = 6;
    const frame = this.frame.getBoundingClientRect();

    if (fit) {
      const margin = 16;
      const frameStyle = getComputedStyle(this.frame);
      const frameBorder = (parseFloat(frameStyle.borderLeftWidth) || 0) + (parseFloat(frameStyle.borderRightWidth) || 0);
      const inner = frame.width - frameBorder;

      const width = Math.round(Math.max(0, Math.min(270, inner - margin * 2)));
      // Johan 28/9: the menu's right edge in line with the plus's right edge.
      const frameBorderLeft = parseFloat(frameStyle.borderLeftWidth) || 0;
      const left = Math.max(0, Math.round(anchor.right - frame.left - frameBorderLeft - width));

      menu.style.width = `${width}px`;
      menu.style.left = `${left}px`;
    } else {
      const size = menu.getBoundingClientRect();
      const wanted = (align === "start" ? anchor.left : anchor.right - size.width) - frame.left;
      const left = Math.max(0, Math.min(wanted, frame.width - size.width));

      menu.style.left = `${Math.round(left)}px`;
    }

    menu.style.top = `${Math.round(anchor.bottom - frame.top + gap)}px`;
    this.fitMenuHeight(menu, gap, anchor);
    menu.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  /**
   * No taller than the part of the page that shows (uppdrag 28/9, Del 3).
   *
   * Measured in 900 × 600 with fourteen answers: the panel showed 460 px and
   * the menu stood at the scss's ceiling of 520 px, so it could never be seen
   * whole — its last 60 px lay under the panel's edge and off the window, and
   * a pointer reached the last rows only through two scroll boxes, one inside
   * the other. The height left is the visible part of the nearest scrolling
   * ancestor (the panel), cut by the visual viewport — which on the iPad with
   * the keyboard up is the band that actually shows. The scss's `max-height`
   * stays the ceiling; below it the menu scrolls inside itself, and
   * `scrollIntoView` then brings the whole of it into view.
   */
  private fitMenuHeight(menu: HTMLElement, gap: number, anchor: DOMRect): void {
    menu.style.maxHeight = "";

    /*
     * The anchor's height and a gap on each side too: the menu opens under
     * what it was opened from, and with the menu filling the whole band
     * `scrollIntoView` pushed that above the panel's edge — the chip being
     * swapped stood 54 px out of sight (mätt 28/9). Which of the two gives
     * way is decided below.
     */
    const ceiling = parseFloat(getComputedStyle(menu).maxHeight) || Infinity;
    const shown = visibleBand(menu);
    const band = Math.floor(shown.bottom - shown.top - gap * 2);
    const beside = Math.floor(band - anchor.height - gap);
    const whole = Math.min(menu.scrollHeight, ceiling);
    /*
     * A menu that fits the band whole is shown whole, even if its anchor has
     * to scroll away for it — three rows scrolling inside a 160 px box
     * (rich-text-field's own test) is worse than a chip out of sight. A menu
     * that has to scroll anyway leaves room for its anchor, unless that would
     * leave it fewer than about three rows.
     */
    const room = whole <= band ? band : beside >= MENU_FLOOR ? beside : band;

    if (room > 0 && room < ceiling) menu.style.maxHeight = `${room}px`;
  }

  /** Rows whose label or name holds the text stay; a group with none left hides with them. */
  private filterAnswerMenu(term: string): void {
    const needle = term.trim().toLowerCase();

    for (const group of this.answerMenu.querySelectorAll<HTMLElement>(".menu__group")) {
      let shown = 0;

      for (const button of group.querySelectorAll<HTMLButtonElement>("[data-insert]")) {
        const hit = needle === "" || (button.dataset.searchText ?? "").includes(needle);

        button.hidden = !hit;
        if (hit) shown += 1;
      }
      group.hidden = shown === 0;
    }
  }

  private closeMenus(): void {
    document.removeEventListener("pointerdown", this.onPointerDownAway, true);
    this.answerToggle?.setAttribute("aria-expanded", "false");
    this.setAnswerToggleLabel(false);
    if (this.answerMenu) {
      this.answerMenu.hidden = true;
      // Next opening starts from the whole list, not from the last search.
      const search = this.answerMenu.querySelector<HTMLInputElement>("[data-answer-search]");

      if (search && search.value !== "") {
        search.value = "";
        this.filterAnswerMenu("");
      }
    }
    this.chipMenu.hidden = true;
    this.chipMenuAt = null;
  }

  /** The chip's menu: swap for another answer, or take it away. Both undo. */
  private openChipMenu(position: Position, withKeyboard: boolean): void {
    const chip = selectedChip(this.doc, { anchor: position, focus: { ...position, offset: position.offset + 1 } });
    const element = this.chipAt(position);

    if (!chip || !element) return;

    this.closeMenus();
    this.chipMenuAt = position;
    this.chipMenu.setAttribute("aria-label", element.getAttribute("aria-label") ?? "");
    // A formula's chip shows its label; the name the formula holds is read
    // here (139 criterion 3), and the swap rows carry names for the same
    // reason the plus menu does.
    this.chipMenu.innerHTML = [
      ...(this.formula ? [`<p class="menu__group-label menu__name"><code data-chip-name>${escapeHtml(chip.name)}</code></p>`] : []),
      ...this.variablesValue.map((option) => `<button type="button" role="menuitemradio" tabindex="-1" aria-checked="${option.value === chip.name}" data-swap="${escapeAttr(option.value)}">${escapeHtml(option.label || option.value)}${this.formula && option.label ? `<code class="menu__item-name">${escapeHtml(option.value)}</code>` : ""}</button>`),
      `<button type="button" role="menuitem" tabindex="-1" class="menu__remove" data-remove>${escapeHtml(this.text("editor.properties.remove"))}</button>`,
    ].join("");

    this.chipMenu.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => {
        const at = this.chipMenuAt;

        this.closeMenus();
        if (!at) return;

        if (button.hasAttribute("data-remove")) {
          this.apply(deleteRange(this.doc, at, { ...at, offset: at.offset + 1 }), "other");
        } else if (button.dataset.swap && button.dataset.swap !== chip.name) {
          this.apply(replaceChip(this.doc, at, button.dataset.swap), "other");
        }
        this.focusText();
      });
    });

    this.openMenu(null, this.chipMenu, withKeyboard, element.getBoundingClientRect());
  }

  private onMenuKeyDown(event: KeyboardEvent, menu: HTMLElement): void {
    const items = [...menu.querySelectorAll<HTMLButtonElement>("button:not([hidden])")];
    const index = items.indexOf(this.root.activeElement as HTMLButtonElement);
    const inSearch = (event.target as HTMLElement | null)?.matches?.("[data-answer-search]") === true;

    // In the search box, letters, Home and End are the box's own; the arrows
    // step into the rows, Enter takes the first row that matches, Escape
    // closes as anywhere in the menu.
    if (inSearch && !["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) return;
    if (inSearch && event.key === "Enter") {
      event.preventDefault();
      items[0]?.click();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      const fromAnswer = menu === this.answerMenu;

      this.closeMenus();
      if (fromAnswer) this.answerToggle.focus();
      else this.focusText();
      return;
    }

    const next =
      event.key === "ArrowDown" ? (index + 1) % items.length
        : event.key === "ArrowUp" ? (index - 1 + items.length) % items.length
          : event.key === "Home" ? 0
            : event.key === "End" ? items.length - 1
              : -1;

    if (next >= 0) {
      event.preventDefault();
      items[next]?.focus();
    }
  }

  // --- Clipboard ---------------------------------------------------------------

  private onPaste = (event: ClipboardEvent): void => {
    event.preventDefault();
    if (this.disabled || !event.clipboardData) return;
    this.insertTransfer(event.clipboardData.getData("text/html"), event.clipboardData.getData("text/plain"));
  };

  /**
   * HTML keeps what the model has a word for — bold, italic, links, lists —
   * and loses the rest (136 open question 3, the recommendation). Plain text
   * is read the way the field's stored value is: as the standard format when
   * it parses as one, else line by line. The field writes the standard format
   * into text/plain on copy (`onCopy`), so reading it back is what makes
   * copy → paste keep its formatting through an app that drops the HTML part
   * — Notes on the iPad does (Johan 28/9, protocol item E: the list came
   * through, the bold stayed `**…**`). What the reader has no word for (`##`,
   * `==`, tags) stays text. Every line is a paragraph of its own (136
   * handling 10) — the standard format would read a lone line break as a
   * soft break inside the paragraph, so the lines are separated first. A
   * one-line field gets one line, with a space where the lines met: nothing
   * dropped (criterion 5).
   */
  private insertTransfer(rawHtml: string, rawPlain: string): void {
    const features = new Set(this.features);
    const html = rawHtml.replace(INVISIBLE_FORMATTING, "");
    const plain = rawPlain.replace(INVISIBLE_FORMATTING, "");
    let blocks: Block[];

    if (html) {
      const parsed = new DOMParser().parseFromString(html, "text/html");

      blocks = allowedBlocks(readDom(parsed.body).doc.blocks, features);
    } else {
      const paragraphs = plain.replace(/\r\n?/g, "\n").replace(/\n+/g, "\n\n");

      blocks = allowedBlocks(
        parseRichText(paragraphs, { ...this.options(), inline: false })?.blocks ?? blocksFromPlainText(plain, false),
        features,
      );
    }

    if (!this.multiline) {
      const joined: Inline[] = [];

      blocks.forEach((block, index) => {
        if (index > 0 && block.content.length > 0) joined.push({ type: "text", text: " ", marks: {} });
        joined.push(...block.content.map((item): Inline => (item.type === "break" ? { type: "text", text: " ", marks: {} } : item)));
      });
      blocks = [{ type: "paragraph", content: joined }];
    }

    this.apply(insertBlocks(this.doc, this.selection, blocks), "other");
  }

  /** A copy carries the Markdown as its plain text, so pasting it back gives the same text. */
  private onCopy(event: ClipboardEvent, cut: boolean): void {
    if (isCollapsed(this.selection) || !event.clipboardData) return;

    const fragment = extractRange(this.doc, this.selection);
    const holder = document.createElement("div");

    holder.append(renderBlocks(fragment, (item) => this.chipElement(item)));
    event.preventDefault();
    event.clipboardData.setData("text/plain", writeRichText(fragment, this.options()));
    event.clipboardData.setData("text/html", holder.innerHTML);

    if (cut && !this.disabled) this.apply(deleteRange(this.doc, ...orderedRange(this.selection)), "other");
  }
}

/** The model as DOM: `<p>`, `<ul>`/`<ol>` with `<li>`, and inside them link › italic › bold. */
function renderBlocks(doc: RichText, chip: (item: Extract<Inline, { type: "chip" }>) => HTMLElement): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let list: HTMLElement | null = null;
  let listType: string | null = null;

  doc.blocks.forEach((block, index) => {
    let element: HTMLElement;

    if (block.type === "paragraph") {
      list = null;
      listType = null;
      element = document.createElement("p");
      fragment.append(element);
    } else {
      if (!list || listType !== block.type || block.newList) {
        list = document.createElement(block.type === "bullet" ? "ul" : "ol");
        listType = block.type;
        fragment.append(list);
      }
      element = document.createElement("li");
      list.append(element);
    }

    element.dataset.block = String(index);
    renderInline(element, block.content, chip);

    const last = block.content[block.content.length - 1];

    // An empty block, or one ending in a break, needs a line to stand on.
    if (!last || last.type === "break") {
      const filler = document.createElement("br");

      filler.setAttribute("data-filler", "");
      element.append(filler);
    }
  });

  return fragment;
}

function renderInline(parent: HTMLElement, content: Inline[], chip: (item: Extract<Inline, { type: "chip" }>) => HTMLElement): void {
  const marks = (item: Inline): Marks => (item.type === "break" ? {} : item.marks);
  const groups = <T,>(items: T[], key: (item: T) => string): T[][] => {
    const out: T[][] = [];

    items.forEach((item) => {
      const last = out[out.length - 1];

      if (last && key(last[0]!) === key(item)) last.push(item);
      else out.push([item]);
    });
    return out;
  };

  for (const linked of groups(content, (item) => JSON.stringify(marks(item).link ?? null))) {
    const link = marks(linked[0]!).link;
    let target: HTMLElement = parent;

    if (link) {
      const anchor = document.createElement("a");

      anchor.setAttribute("href", link.url);
      if (link.ref) anchor.setAttribute("data-ref", link.ref);
      parent.append(anchor);
      target = anchor;
    }

    for (const italicGroup of groups(linked, (item) => String(Boolean(marks(item).italic)))) {
      let italicTarget = target;

      if (marks(italicGroup[0]!).italic) {
        italicTarget = document.createElement("em");
        target.append(italicTarget);
      }

      for (const boldGroup of groups(italicGroup, (item) => String(Boolean(marks(item).bold)))) {
        let boldTarget = italicTarget;

        if (marks(boldGroup[0]!).bold) {
          boldTarget = document.createElement("strong");
          italicTarget.append(boldTarget);
        }

        for (const item of boldGroup) {
          if (item.type === "text") boldTarget.append(document.createTextNode(item.text));
          else if (item.type === "chip") {
            /*
             * The chip stands in a box with a word joiner before it (fynd f,
             * Johan's iPad 25/9). WebKit puts any caret before a
             * non-editable chip that starts a line at the end of the line
             * above — the text's end, the point between the nodes, a joiner
             * or ZWSP beside it: all measured there. After a joiner in the
             * chip's own box the caret has a place on the chip's line, in
             * every engine. The box is inline and `nowrap` (Johan 26/9): the
             * joiner binds the word right before the chip to it, so what is
             * typed before a wrapped chip goes with the chip instead of
             * filling the line above — *"för texten är det som brickan inte
             * är där"* was the inline-block, which let the line break before
             * the box. The model never holds the joiner — that is the point:
             * `leaves` and `readDom` step over it by where it stands, and the
             * arrow keys never stop on it (onKeyDown).
             */
            const glue = document.createElement("span");

            glue.className = "glue";
            glue.setAttribute("data-chip-glue", "");
            glue.append(document.createTextNode("\u2060"), chip(item));
            boldTarget.append(glue);
          }
          else boldTarget.append(document.createElement("br"));
        }
      }
    }
  }
}

/** What the field's `formatting` allows, and nothing it does not. */
function allowedBlocks(blocks: Block[], features: Set<FormattingFeature>): Block[] {
  return blocks.map((block) => {
    const listAllowed = (block.type === "bullet" && features.has("bullet-list")) || (block.type === "numbered" && features.has("numbered-list"));

    return {
      type: listAllowed ? block.type : "paragraph",
      content: block.content.map((item): Inline => {
        if (item.type === "break") return item;

        const marks: Marks = {};

        if (item.marks.bold && features.has("bold")) marks.bold = true;
        if (item.marks.italic && features.has("italic")) marks.italic = true;
        if (item.marks.link && features.has("link")) marks.link = item.marks.link;

        return { ...item, marks };
      }),
    };
  });
}

/**
 * The things in a drawn block that take an offset, in order: text, chips and
 * line breaks — never the inside of a chip, never the filler `<br>`.
 */
function* leaves(block: Element): Generator<Node> {
  for (const child of block.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.parentElement?.hasAttribute("data-chip-glue")) continue;
      yield child;
    } else if (child instanceof Element) {
      if (child.hasAttribute("data-chip")) yield child;
      else if (child.tagName === "BR") {
        if (!child.hasAttribute("data-filler")) yield child;
      } else yield* leaves(child);
    }
  }
}

/** Right before a chip: after its joiner, inside its box — on the chip's line (fynd f). */
function beforeChip(chip: HTMLElement): { node: Node; offset: number } {
  const glue = chip.parentElement;

  if (glue?.hasAttribute("data-chip-glue") && glue.firstChild?.nodeType === Node.TEXT_NODE) return { node: glue.firstChild, offset: 1 };
  return { node: chip.parentNode!, offset: indexOf(chip) };
}

/** About three menu rows: below it a menu is too short to be worth its anchor's room. */
const MENU_FLOOR = 140;

/** To the right of a box, or below it: beside it, not on it (fynd l). */
function besideBox(box: DOMRect, x: number, y: number): boolean {
  return x > box.right || y > box.bottom;
}

function indexOf(node: Node): number {
  return node.parentNode ? Array.prototype.indexOf.call(node.parentNode.childNodes, node) : 0;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

if (!customElements.get("rich-text-field")) {
  customElements.define("rich-text-field", RichTextField);
}

declare global {
  interface HTMLElementTagNameMap {
    "rich-text-field": RichTextField;
  }
}
