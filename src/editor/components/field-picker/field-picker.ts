import styles from "./field-picker.scss?inline";

import { visibleBand } from "../../controllers/visible-band";
import { interpolate, t } from "../../localization/editor-ui-strings";

/**
 * `<field-picker>` — the condition row's searchable question-or-variable
 * chooser (story 143). One component in the three places a condition is
 * written: a rule's case, a field's *visas om* and an answer option's.
 *
 * Facit is Astras three concept pictures (30/9, `docs/STORIES/143-*.png`):
 * a closed field in the select mixin's shape showing the question's name
 * alone, and an open surface just under it — a search zone of its own on top
 * (magnifier, clear cross, "1 träff av 8"), then the list in groups (*Svar
 * från guiden*, *Uträkningar*) with the question over its variable chip, the
 * chosen row tinted with a tick at its end, and a visible scrollbar. Fia built
 * it to those pictures as a prototype; the numbers behind each measure stand
 * in the scss.
 *
 * Only this chooser: short lists (the operator, *Kombinera villkor*) keep
 * their `<select>` (story point 1).
 *
 * ## Contract towards the panel
 *
 * The same as the `<select>` it replaced: a `value` property and `input` +
 * `change` events on the host, so `updateRuleCondition` and `nextVisibility`
 * read it as they read the select. `options` are the rows in the order
 * shown; a row's `group` is its heading, and groups keep the order first met.
 * The `label` attribute names the combobox — the panel's `<label>` around it
 * cannot, since a label does not reach into a shadow root.
 *
 * ## Why it opens inside itself and not in the top layer
 *
 * The open surface is absolutely placed in the host, the plus menu's layer
 * (`--fw-z-popover`), not a `popover` and not `position: fixed`. The sketch
 * used `popover`; it is above the editor's floor (Safari 17, Firefox 125 —
 * K18 says 16.4 and 121), and fixed is what the plus menu tried first and
 * lost on the iPad 27/9: with the keyboard up iPadOS moves the fixed layer,
 * and a search box is exactly what brings the keyboard up (rich-text-field,
 * `placeMenu`). Inside the panel's scroll box nothing clips it — the panel
 * scrolls, it moves with its anchor — and `visibleBand` chooses the side
 * that has room (story point 9).
 *
 * ## Semantics (story point 8)
 *
 * The closed field is a `role="combobox"` button with `aria-expanded` and
 * `aria-controls`. Opened, focus moves into the search box, which is the
 * combobox a screen reader then talks to: it owns the listbox and points at
 * the keyboard's row with `aria-activedescendant`, while focus stays in the
 * box so typing keeps working. The rows are `role="option"` with
 * `aria-selected`; a group is `role="group"` named by its heading. The plus
 * menu's look is reused, never its `role="menu"`. The listbox has
 * `tabindex="-1"`: Chrome makes a scrolling box a Tab stop of its own, and
 * Tab from the search landed on the list inside the picker — the surface
 * stayed open behind focus (measured 30/9). The arrows move in the list.
 */
export interface FieldPickerOption {
  value: string;
  /** The question's name, or the variable's label. */
  label: string;
  /** The group's heading; rows keep the order given, groups the order first met. */
  group?: string;
}

const SEARCH_ICON =
  '<svg class="search__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const CLEAR_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const TICK_ICON =
  '<svg class="option__tick" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** The surface's own ceiling; below it the list scrolls in what the band leaves. */
const MAX_HEIGHT = 480;
/** Between the field and the surface (Astras skiss 1: aligned edges, a small gap). */
const GAP = 4;
/** Kept free between the surface and the edge of what shows. */
const MARGIN = 8;

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A technical name may break after `_` and `.` before it breaks anywhere. */
const breakable = (html: string): string => html.replace(/([_.])/g, "$1<wbr>");

/** The text with the first case-insensitive hit of `needle` marked (Astras skiss 3). */
const marked = (text: string, needle: string): string => {
  const at = needle === "" ? -1 : text.toLocaleLowerCase().indexOf(needle);
  if (at < 0) return escapeHtml(text);
  return `${escapeHtml(text.slice(0, at))}<mark class="hit">${escapeHtml(text.slice(at, at + needle.length))}</mark>${escapeHtml(text.slice(at + needle.length))}`;
};

let counter = 0;

export class FieldPicker extends HTMLElement {
  /*
   * Labelable: the panel's `<label>` around the picker then focuses it on a
   * click, as it focused the `<select>` before (the lead 30/9; measured: a
   * click on *Svar eller värde* left focus on the panel). Form association
   * is what makes a custom element a label's control, and `delegatesFocus`
   * hands that focus on to the field. No form value is set — the panel
   * reads `value`. Safari 16.4, Firefox 98: inside K18.
   */
  static formAssociated = true;

  private root: ShadowRoot;
  private optionsValue: FieldPickerOption[] = [];
  private currentValue = "";
  private activeIndex = -1;
  /** Ids inside the shadow root; unique per instance only for a reader of the whole tree. */
  private readonly uid = `field-picker-${++counter}`;

  constructor() {
    super();
    /*
     * `delegatesFocus`: a press on a row (not focusable) hands focus to the
     * control instead of the body, so the surface's `focusout` sees focus
     * stay inside and the click that follows still lands on the row.
     */
    this.root = this.attachShadow({ mode: "open", delegatesFocus: true });
  }

  get options(): FieldPickerOption[] {
    return this.optionsValue;
  }

  set options(options: FieldPickerOption[]) {
    this.optionsValue = options;
    if (this.isConnected) this.render();
  }

  get value(): string {
    return this.currentValue;
  }

  set value(value: string) {
    this.currentValue = value;
    if (this.isConnected) this.render();
  }

  connectedCallback(): void {
    this.render();
  }

  get isOpen(): boolean {
    return !this.popup.hidden;
  }

  private get control(): HTMLButtonElement {
    return this.root.querySelector(".control")!;
  }

  private get popup(): HTMLElement {
    return this.root.querySelector(".popup")!;
  }

  private get search(): HTMLInputElement {
    return this.root.querySelector(".search input")!;
  }

  private get list(): HTMLElement {
    return this.root.querySelector(".list")!;
  }

  private get rows(): HTMLElement[] {
    return [...this.root.querySelectorAll<HTMLElement>('[role="option"]')];
  }

  private get visibleRows(): HTMLElement[] {
    return this.rows.filter((row) => !row.hidden);
  }

  private render(): void {
    const chosen = this.optionsValue.find((option) => option.value === this.currentValue);
    const label = this.getAttribute("label") ?? "";
    const searchText = t("editor.properties.field-picker-search");
    const closed = chosen ? chosen.label : t("editor.properties.field-picker-placeholder");

    // Groups in the order first met, rows in the order given (story point 6).
    const groups: { name: string; rows: { option: FieldPickerOption; index: number }[] }[] = [];
    this.optionsValue.forEach((option, index) => {
      const name = option.group ?? "";
      let group = groups.find((one) => one.name === name);
      if (!group) groups.push((group = { name, rows: [] }));
      group.rows.push({ option, index });
    });

    this.root.innerHTML = `
      <style>${styles}</style>
      <span class="field">
        <button
          type="button"
          class="control"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded="false"
          aria-controls="${this.uid}-list"
          aria-label="${escapeHtml(label)}"
        ><span class="control__text">${escapeHtml(closed)}</span></button>
      </span>
      <div class="popup" hidden>
        <div class="search">
          <div class="search__box">
            ${SEARCH_ICON}
            <input
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls="${this.uid}-list"
              autocomplete="off"
              spellcheck="false"
              aria-label="${escapeHtml(searchText)}"
              placeholder="${escapeHtml(searchText)}"
            >
            <button type="button" class="search__clear" hidden tabindex="-1" aria-label="${escapeHtml(t("editor.properties.field-picker-clear"))}">${CLEAR_ICON}</button>
          </div>
          <p class="search__count" role="status" aria-live="polite" hidden></p>
        </div>
        <div class="list" role="listbox" id="${this.uid}-list" aria-label="${escapeHtml(label)}" tabindex="-1">
          ${groups.map((group, g) => `
            <div class="group" role="group" ${group.name ? `aria-labelledby="${this.uid}-g${g}"` : ""}>
              ${group.name ? `<p class="group__label" id="${this.uid}-g${g}" role="presentation">${escapeHtml(group.name)}</p>` : ""}
              ${group.rows.map(({ option, index }) => `
                <div
                  class="option"
                  role="option"
                  id="${this.uid}-o${index}"
                  data-index="${index}"
                  aria-selected="${option.value === this.currentValue}"
                >
                  <span class="option__label"></span>
                  <span class="chip"></span>
                  ${option.value === this.currentValue ? TICK_ICON : ""}
                </div>
              `).join("")}
            </div>
          `).join("")}
        </div>
        <p class="empty" role="status" aria-live="polite" hidden>${escapeHtml(t("editor.properties.field-picker-none"))}</p>
      </div>
    `;
    this.paintRows("");
    this.bind();
  }

  /** Each row's name and chip, with the search's hit marked in both. */
  private paintRows(needle: string): void {
    this.rows.forEach((row) => {
      const option = this.optionsValue[Number(row.dataset.index)];
      row.querySelector(".option__label")!.innerHTML = marked(option.label, needle);
      row.querySelector(".chip")!.innerHTML = breakable(marked(option.value, needle));
    });
  }

  private bind(): void {
    this.control.addEventListener("click", () => (this.isOpen ? this.close() : this.open()));
    this.control.addEventListener("keydown", (event) => {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        this.open();
      }
    });
    /*
     * The search's `input` is composed: uncaught, it reaches the panel as an
     * `input` on `<field-picker>`, which the condition row reads as a new
     * choice and redraws — measured in Fia's sketch: the list closed on the
     * first letter. Searching never writes the choice (story point 6).
     */
    this.search.addEventListener("input", (event) => {
      event.stopPropagation();
      this.filter(this.search.value);
    });
    this.search.addEventListener("keydown", (event) => this.onSearchKey(event));
    this.root.querySelector(".search__clear")!.addEventListener("click", () => {
      this.search.value = "";
      this.filter("");
      this.search.focus();
    });
    this.list.addEventListener("click", (event) => {
      const row = (event.target as Element).closest<HTMLElement>('[role="option"]');
      if (!row) return;
      this.guardSecondPress();
      this.choose(this.optionsValue[Number(row.dataset.index)].value);
    });
    // Focus leaving the picker — Tab past the search, a press elsewhere — closes without a choice.
    this.popup.addEventListener("focusout", (event) => {
      const next = event.relatedTarget as Node | null;
      if (!next || !this.root.contains(next)) this.close(false);
    });
  }

  /** Opens with an empty search and the chosen row in view (story point 7). */
  open(): void {
    if (this.isOpen) return;
    this.search.value = "";
    this.filter("");
    delete this.popup.dataset.keyboard;
    this.popup.hidden = false;
    /*
     * The search box takes over as the combobox that owns the listbox (the
     * class comment explains why); the field button stays visible but is not
     * a second one. Measured 30/9 (Siv) in Chromium's own accessibility tree:
     * left as `role="combobox"` on both, the tree carries two comboboxes
     * pointed at the same list at once — K4's "halvimplementerad ARIA" one
     * level up, since nothing in the DOM says which of the two is real. The
     * button keeps its name and value (still readable, still closes the
     * popup on a press) but stops claiming a role, state and relationship it
     * is not the owner of while the search is open.
     */
    this.control.removeAttribute("role");
    this.control.removeAttribute("aria-haspopup");
    this.control.removeAttribute("aria-expanded");
    this.control.removeAttribute("aria-controls");
    this.root.querySelector(".field")!.classList.add("field--open");
    this.place();
    const chosen = this.rows.findIndex((row) => row.getAttribute("aria-selected") === "true");
    this.setActive(chosen >= 0 ? chosen : 0, null);
    this.revealChosen(chosen);
    this.search.focus();
  }

  close(returnFocus = true): void {
    if (!this.isOpen) return;
    this.popup.hidden = true;
    this.control.setAttribute("role", "combobox");
    this.control.setAttribute("aria-haspopup", "listbox");
    this.control.setAttribute("aria-expanded", "false");
    this.control.setAttribute("aria-controls", this.list.id);
    this.root.querySelector(".field")!.classList.remove("field--open");
    if (returnFocus) this.control.focus();
  }

  /**
   * Under the field and exactly as wide (Astras skiss 1); above it when the
   * room below is short of the whole surface and the room above is larger.
   * The room is what shows of the panel (`visibleBand`: the panel's scroll
   * box cut by the visual viewport), so the surface never reaches past it
   * and the list scrolls in what is left (story point 9). Measured once per
   * opening: the surface is inside the host and moves with it on scroll.
   */
  private place(): void {
    const popup = this.popup;
    popup.style.maxHeight = "";
    delete popup.dataset.side;
    const anchor = this.control.getBoundingClientRect();
    const band = visibleBand(this);
    const wanted = Math.min(popup.scrollHeight, MAX_HEIGHT);
    const below = band.bottom - anchor.bottom - GAP - MARGIN;
    const above = anchor.top - band.top - GAP - MARGIN;
    const up = below < wanted && above > below;
    popup.style.maxHeight = `${Math.max(0, Math.min(MAX_HEIGHT, up ? above : below))}px`;
    if (up) popup.dataset.side = "above";
  }

  /** Case-insensitive on the name and on the technical name (point 6). */
  private filter(term: string): void {
    const needle = term.trim().toLocaleLowerCase();
    this.rows.forEach((row) => {
      const option = this.optionsValue[Number(row.dataset.index)];
      row.hidden = needle !== "" &&
        !option.label.toLocaleLowerCase().includes(needle) &&
        !option.value.toLocaleLowerCase().includes(needle);
    });
    this.root.querySelectorAll<HTMLElement>(".group").forEach((group) => {
      group.hidden = !group.querySelector('[role="option"]:not([hidden])');
    });
    this.paintRows(needle);
    const hits = this.visibleRows.length;
    const none = hits === 0;
    this.root.querySelector<HTMLElement>(".empty")!.hidden = !none;
    this.list.hidden = none;
    // With no hits there is no list to expand into; the empty state says so in words.
    this.search.setAttribute("aria-expanded", String(!none));
    this.root.querySelector<HTMLElement>(".search__clear")!.hidden = term === "";
    // "1 träff av 8" (skiss 3) only while searching; the empty state says it in words.
    const count = this.root.querySelector<HTMLElement>(".search__count")!;
    count.textContent = needle === "" || none
      ? ""
      : interpolate(t(hits === 1 ? "editor.properties.field-picker-count-one" : "editor.properties.field-picker-count"), { n: hits, total: this.rows.length });
    count.hidden = count.textContent === "";
    /*
     * Typing leaves no row active (skiss 3 draws the hit unmarked but for its
     * text): the arrows make one active, and Enter takes the only hit when
     * there is exactly one — "ålder", Enter.
     */
    this.setActive(-1);
    delete this.popup.dataset.keyboard;
  }

  /**
   * The list from its top, scrolled only as far as the chosen row needs to be
   * whole — and then to the nearest row or group boundary at or past that, so
   * no row stands cut at the top (the lead 30/9: the first take opened on a
   * chip without its name).
   */
  private revealChosen(index: number): void {
    const list = this.list;
    list.style.paddingBottom = "";
    list.scrollTop = 0;
    const row = this.rows[index];
    if (!row) return;
    const top = row.offsetTop - list.offsetTop;
    const needed = top + row.offsetHeight - list.clientHeight;
    if (needed <= 0) return;
    const boundaries = [...list.querySelectorAll<HTMLElement>('.group__label, [role="option"]')]
      .filter((el) => el.offsetParent)
      .map((el) => el.offsetTop - list.offsetTop);
    const target = boundaries.find((b) => b >= needed) ?? top;
    /*
     * Near the list's end the boundary can lie past the furthest the list
     * scrolls; clamped there, the top row stood cut (measured: "bidrag"
     * chosen). The missing distance goes in as room under the last row.
     */
    const furthest = list.scrollHeight - list.clientHeight;
    if (target > furthest) list.style.paddingBottom = `${target - furthest}px`;
    list.scrollTop = target;
  }

  private setActive(index: number, block: ScrollLogicalPosition | null = "nearest"): void {
    this.rows.forEach((row, i) => row.classList.toggle("option--active", i === index));
    this.activeIndex = index;
    const row = this.rows[index];
    if (row) {
      this.search.setAttribute("aria-activedescendant", row.id);
      if (block) row.scrollIntoView({ block });
    } else {
      this.search.removeAttribute("aria-activedescendant");
    }
  }

  private onSearchKey(event: KeyboardEvent): void {
    const visible = this.visibleRows;
    const at = visible.indexOf(this.rows[this.activeIndex]);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      this.popup.dataset.keyboard = "";
      if (visible.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = at < 0 ? visible[0] : visible[Math.min(visible.length - 1, Math.max(0, at + step))];
      this.setActive(this.rows.indexOf(next));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = this.rows[this.activeIndex] ?? (visible.length === 1 ? visible[0] : undefined);
      if (row && !row.hidden) this.choose(this.optionsValue[Number(row.dataset.index)].value);
    } else if (event.key === "Escape") {
      // `preventDefault` is the claim: the wide panel's own Escape (guide-editor) skips a prevented one.
      event.preventDefault();
      this.close();
    } else if (event.key === "Tab" && event.shiftKey) {
      /*
       * Back from the search is the control, which is inside the picker, so
       * `focusout` would keep the surface open with focus on its own field.
       * Close it instead, nothing chosen, focus where Shift+Tab sends it.
       */
      event.preventDefault();
      this.close();
    }
    // Tab forward: nothing here — focus leaves the picker, `focusout` closes,
    // nothing is chosen. The clear cross is out of the tab order for that
    // reason: it is for a pointer, and the keyboard clears the box as any
    // text box.
  }

  private choose(value: string): void {
    if (value === this.currentValue) {
      this.close();
      return;
    }
    /*
     * Redrawn here, closed, with the new name and tick: the panel redraws the
     * whole row on the events below anyway, but a picker must not depend on
     * its host for its own face (measured: without it the field kept the
     * old name).
     */
    this.value = value;
    this.control.focus();
    // Both, as a select fires them: the rule's row listens to `input`, a visibility's to `change`.
    this.dispatchEvent(new Event("input", { bubbles: true }));
    this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /**
   * A double-click on a row: the first click chooses and closes, so the
   * second press lands on whatever lay under the list — in the panel the
   * next field's label — and marks a word there (measured 30/9 with
   * Playwright's mouse: the rows' `user-select: none` cannot reach it, the
   * list is gone). Only that press of that multi-click is held back.
   */
  private guardSecondPress(): void {
    const hold = (event: MouseEvent): void => {
      if (event.detail >= 2) event.preventDefault();
      release();
    };
    const release = (): void => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", hold, true);
    };
    const timer = setTimeout(release, 600);
    document.addEventListener("mousedown", hold, true);
  }
}

if (!customElements.get("field-picker")) {
  customElements.define("field-picker", FieldPicker);
}

declare global {
  interface HTMLElementTagNameMap {
    "field-picker": FieldPicker;
  }
}
