import { escapeHtml } from "../../../viewer/core/escape-html";
import { displayTemplateLabel } from "../../services/template-library";
import styles from "./node-palette.scss?inline";

import { getNodeType, getNodeTypes, isEndingNodeType } from "../../../viewer/node-types/node-type-registry";
import { getEditorCapabilities } from "../../config/editor-capabilities";
import type { EditorCapabilities } from "../../config/editor-capabilities";

import { SOURCE_LOCALE } from "../../../viewer/core/localized-text";
import { registeredText } from "../../../viewer/localization/registry";
import { interpolate, t, tOr } from "../../localization/editor-ui-strings";

import type {
  NodeTypeAddDetail,
  NodeTypeDragStartDetail,
} from "../../types/events";
import type { NodeTemplate } from "../../../viewer/types/graph";

import { NODE_ICONS } from "../../../viewer/node-types/node-icons";

/*
 * The rail's category motifs where the first node's icon would mislead
 * (GRAFISK-PROFIL decision 14): a flag for Avslut, so the eye means only
 * Förhandsgranskning, and overlapping cards for Mallar instead of the @ that
 * says e-mail. 24-unit grid, round caps — profile section 11.
 */
const CATEGORY_MOTIFS: Record<string, string> = {
  "editor.palette.group.endings":
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 21V3h14l-3 5 3 5H5"/></svg>',
  "editor.palette.templates":
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="7" y="7" width="13" height="14" rx="2"/><path d="M16 7V3H3v14h4M10 11h7M10 15h5"/></svg>',
};

/** How long the full palette takes to fold in or out (story 145, criterion 9). */
const PALETTE_MOTION_MS = 180;

/** One palette button's worth: a node type or a template. */
interface PaletteItem {
  type: string;
  base?: string;
  definition: { label: string; icon?: string };
}

/** A non-empty group as drawn: its heading key, its name, its items. */
interface PaletteGroup {
  key: string;
  name: string;
  items: PaletteItem[];
}

/*
 * The unicode fallbacks. The built-ins draw stroke SVG from `node-icons.ts`
 * now; these remain for a template whose BASE has no stroke icon and for the
 * day a built-in is added before its icon is drawn — a letter is better than
 * a hole. Custom-typed icons (a template's own string) always win.
 */
const nodeIcons: Record<string, string> = {
  question: "?",
  "multi-choice": "☑",
  "number-question": "#",
  "text-question": "T",
  image: "▦",
  "annotated-image": "◉",
  code: "</>",
  "map-question": "⌖",
  page: "▤",
  "page-heading": "H",
  "page-spacer": "—",
  rule: "◇",
  calculation: "∑",
  "service-call": "⇄",
  result: "✓",
  annotation: "✎",
};

// The headings are referenced via i18n keys; the node types' own labels come
// from the node type registry and are localised separately.
/*
 * Grupperna, och vad som får stå i dem.
 *
 * Listan är handskriven, och det är dess enda fel: fem registrerade nodtyper
 * stod aldrig i den — Samtycke, Datumfråga, Bifoga fil och de två sökfälten.
 * Alla fem har etikett, ikon, översättning, tester och en visare som ritar dem.
 * De gick ändå inte att skapa i editorn, för paletten är den enda vägen att
 * lägga till en nod. Hittat när Johan bad om en nod för att ge tillåtelse —
 * den fanns sedan länge.
 *
 * `palette-covers-node-types.test.ts` fäller varje ny nodtyp som inte hamnar i
 * någon grupp, så en typ inte kan finnas i registret utan att kunna skapas.
 */
const nodeGroups = [
  /*
   * Ordningen HÄR är den som ritas — ämnen i följd: välja bland alternativ,
   * skriva fritt, söka i en lista (de två sökfälten i anslutning till
   * varandra), särskilda svar, visa (inte fråga), bygga sida. Johans regel
   * 31/8: "användaren behöver tycka det är logiskt"; vald ur tre uppritade
   * förslag. Fram till samma kväll styrde registreringsordningen och den
   * här listan bara medlemskap — ordningens två hem blev ett (se `items` i
   * renderingen).
   */
  /*
   * The fields that only mean something when the answers are sent somewhere
   * — free text, a rating, consent, an attachment — and the review step
   * before sending are FlowWeaver PRO's, and join their groups through
   * `addPaletteTypes` (src/pro/editor/palette.ts; Johan 8/10). The viewer
   * still draws them, so a guide that has them opens in the open FlowWeaver;
   * only the editor stops offering them.
   */
  { key: "editor.palette.group.content", types: ["question", "multi-choice", "number-question", "date-question", "autocomplete-question", "multi-autocomplete-question", "map-question", "image", "annotated-image", "code", "page", "page-heading", "page-spacer"] },
  { key: "editor.palette.group.logic", types: ["rule", "calculation"] },
  { key: "editor.palette.group.integrations", types: ["service-call"] },
  // The sending endings are FlowWeaver PRO's and join this group through
  // `addPaletteTypes` (src/pro/editor/palette.ts) — open-core step 4.
  { key: "editor.palette.group.endings", types: ["result"] },
  { key: "editor.palette.group.notes", types: ["annotation"] },
];

/**
 * Page children that can only sit inside a Page (no ports of their own). They
 * appear in the palette only once the guide actually has a Page to put them in.
 */
const PAGE_CHILD_TYPES = ["page-heading", "page-spacer"];

/**
 * A node type registered from outside the open editor — FlowWeaver PRO's
 * *Inlämning* and *E-postresultat* — joins a palette group here. `before`
 * names the type it sits in front of; without it the type goes last. A type
 * already in a group is not added twice, so an index imported twice is safe.
 */
/**
 * The node types the viewer draws but only FlowWeaver PRO lets an editor add
 * (Johan 8/10). Written down here, beside the groups, so the palette's gate
 * (`palette-covers-node-types`) can tell "offered by PRO" from "offered by
 * nobody" — and checks, where PRO is present, that PRO adds each of them.
 */
const OFFERED_BY_PRO = ["text-question", "rating-question", "consent-question", "file-question", "review"];
void OFFERED_BY_PRO;

/**
 * Whether the editor offers this node type at all: it stands in one of the
 * palette's groups, open or added by PRO. The palette is the one list of what
 * can be added, so quick-open, the templates and *Nytt formulär* ask here
 * rather than the registry — which also holds the types the viewer draws but
 * the open editor does not build with (Johan 8/10).
 */
export function isOfferedNodeType(type: string): boolean {
  return nodeGroups.some((group) => group.types.includes(type));
}

export function addPaletteTypes(groupKey: string, types: string[], before?: string): void {
  const group = nodeGroups.find((candidate) => candidate.key === groupKey);
  if (!group) throw new Error(`Okänd palettgrupp: ${groupKey}`);
  for (const type of types) {
    if (group.types.includes(type)) continue;
    const at = before ? group.types.indexOf(before) : -1;
    if (at >= 0) group.types.splice(at, 0, type);
    else group.types.push(type);
  }
}

export class NodePalette extends HTMLElement {
  static readonly observedAttributes = ["open", "search"] as const;

  private readonly root = this.attachShadow({ mode: "open" });
  private capabilitiesValue = getEditorCapabilities("advanced");
  private hasPageValue = false;
  private suppressNextClick = false;
  private templatesValue: NodeTemplate[] = [];
  private uiLocale: string = SOURCE_LOCALE;
  /** The groups as last drawn — the rail, the menu and the full palette all read them. */
  private groups: PaletteGroup[] = [];
  /** What the full palette is filtered by; cleared when it folds (Johan 6/10). */
  private query = "";
  /** The category whose menu is open, and the button that opened it. */
  private menuTrigger: HTMLButtonElement | null = null;
  private motionTimer: number | undefined;
  /** True for the one redraw a person's own open or fold asked for. */
  private motionNext = false;

  /** Lokaliserad chrome-text i editorns UI-språk. */
  private text(key: string, params?: Record<string, string | number>): string {
    const resolved = t(key, this.uiLocale);
    return params ? interpolate(resolved, params) : resolved;
  }

  /**
   * The node templates to show. A list of its own, not a subset of the
   * registry: templates are not node types. See `node-templates.ts`.
   */
  set templates(value: NodeTemplate[]) {
    this.templatesValue = value;

    if (this.isConnected) {
      this.render();
    }
  }

  set capabilities(value: EditorCapabilities) {
    this.capabilitiesValue = { ...value };

    if (this.isConnected) {
      this.render();
    }
  }

  /** Har guiden minst en Sida? Styr om sido-barnen (Rubrik/Blank rad) visas. */
  set hasPage(value: boolean) {
    if (this.hasPageValue === value) {
      return;
    }
    this.hasPageValue = value;
    if (this.isConnected) {
      this.render();
    }
  }

  /** Editorns UI-språk (chrome). Styrs uppifrån av <guide-editor editor-locale>. */
  set editorLocale(value: string) {
    if (value === this.uiLocale) return;
    this.uiLocale = value;
    this.refresh();
  }

  /**
   * Whether the full palette is open (story 145/146). Folded, the palette is
   * its rail. Set by `<guide-editor palette-open>`; a person's own open or fold
   * draws moving and ends in `palette-open-changed`.
   */
  set open(value: boolean) {
    this.toggleAttribute("open", value === true);
  }

  get open(): boolean {
    return this.hasAttribute("open");
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) return;

    if (name === "open") {
      this.drawOpen();
    } else if (name === "search") {
      this.render();
    }
  }

  connectedCallback(): void {
    this.render();
  }

  disconnectedCallback(): void {
    window.clearTimeout(this.motionTimer);
    document.removeEventListener("pointerdown", this.handleOutside, true);
  }

  /** Ritar om paletten, t.ex. när guidens egna nodtyper ändrats. */
  refresh(): void {
    if (this.isConnected) {
      this.render();
    }
  }

  /**
   * The overlay that lies over the canvas right now — the full palette or a
   * category menu — or null. The editor reads it to move the canvas's own
   * controls out from under it (story 145, criterion 8).
   */
  overlayBox(): DOMRect | null {
    const full = this.root.querySelector<HTMLElement>(".node-palette__full");
    const menu = this.root.querySelector<HTMLElement>(".node-palette__menu");

    if (full && !full.hidden && !this.hasAttribute("sheet")) return full.getBoundingClientRect();
    if (menu && !menu.hidden) return menu.getBoundingClientRect();
    return null;
  }

  /** A palette button. `type` is a node type or a template's key. */
  private renderPaletteButton({ type, base, definition }: PaletteItem): string {
    const label = this.labelOf({ type, base, definition });

    return `
      <button
        type="button"
        data-node-type="${escapeHtml(type)}"${isEndingNodeType(type) ? " data-ending" : ""}
        title="${escapeHtml(
          this.text("editor.palette.add", { label })
        )}"
        aria-label="${escapeHtml(
          this.text("editor.palette.add", { label })
        )}"
      >
        <span class="node-palette__icon" aria-hidden="true">
          ${this.iconOf({ type, base, definition })}
        </span>
        <span class="node-palette__label">
          ${escapeHtml(label)}
        </span>
      </button>
    `;
  }

  // Nodtypens namn översätts om en nyckel finns, annars visas källtexten
  // (så egna nodmallar behåller sitt egna namn).
  private labelOf({ type, definition }: PaletteItem): string {
    return tOr(`nodeType.${type}.label`, definition.label, this.uiLocale);
  }

  /*
   * Stroke SVG for the built-ins, the typed string for everything custom.
   *
   * A built-in's stroke wins even over the registry's own glyph (six types
   * still carry one — "✓", "📎" … — and those are ours, not the editor's
   * choice). A TEMPLATE's typed icon wins over its base type's stroke,
   * because that string is its author's and lives in the graph. The SVG
   * comes from our own map and is the ONLY thing rendered without escaping
   * here — a typed icon is escaped exactly as before.
   */
  private iconOf({ type, base, definition }: PaletteItem): string {
    const strokeIcon =
      NODE_ICONS[type] ?? (definition.icon ? undefined : NODE_ICONS[base ?? ""]);
    const icon =
      definition.icon ??
      nodeIcons[type] ??
      this.labelOf({ type, base, definition }).trim()[0]?.toUpperCase() ??
      "+";

    return strokeIcon ?? escapeHtml(icon);
  }

  /**
   * The words a node type is also found by, beyond its name (story 146,
   * criterion 7). The host's, never ours: one key per type in the strings a
   * host already registers (`registerLocale`), empty in the library. We know
   * what a node is called; the host knows what its editors call it.
   */
  private keywordsOf(type: string): string {
    return registeredText(`nodeType.${type}.keywords`, this.uiLocale) ?? "";
  }

  /** The groups with something in them, in the drawn order, templates last. */
  private gatherGroups(): PaletteGroup[] {
    const nodeTypes = getNodeTypes().filter(
      ({ type, definition }) =>
        (!definition.requiredCapability ||
          this.capabilitiesValue[definition.requiredCapability]) &&
        // Page children show only once there is a Page to put them in.
        (this.hasPageValue || !PAGE_CHILD_TYPES.includes(type))
    );
    /*
     * The templates do not come from the registry — they are not node types.
     * They are gathered in a group of their own and inherit their icon from the
     * base type when they lack one.
     *
     * But they are *made of* a node type, and that type can be one this level
     * does not have. A template built on a text question was offered in basic
     * mode, where text questions are off: the button was there, clicking it
     * added nothing, and nothing said why. So the same capability decides
     * both. A template is offered exactly when the node it would create is.
     */
    const allowed = (base: string): boolean => {
      const need = getNodeType(base)?.requiredCapability;

      // Offered at all (PRO's types only with PRO), and at this level.
      return isOfferedNodeType(base) && (!need || this.capabilitiesValue[need]);
    };

    const groups: PaletteGroup[] = nodeGroups.map(({ key, types }) => ({
      key,
      name: this.text(key),
      /*
       * Listans ordning vinner. `filter` på registret lät
       * registreringsordningen styra medan listan ovanför såg ut att göra
       * det — två hem för ordningen, där det synliga var det falska.
       */
      items: types
        .map((wanted) => nodeTypes.find(({ type }) => type === wanted))
        .filter((item): item is (typeof nodeTypes)[number] => item !== undefined),
    }));

    groups.push({
      key: "editor.palette.templates",
      name: this.text("editor.palette.templates"),
      items: this.templatesValue
        .filter((template) => allowed(template.base))
        .map((template) => ({
          type: template.type,
          base: template.base,
          definition: {
            // Ours are translated, theirs are left as typed — one call, no branch.
            label: displayTemplateLabel(template, this.uiLocale),
            // The empty string means "inherit": the base type's stroke icon,
            // or its letter.
            ...(template.icon ? { icon: template.icon } : {}),
          },
        })),
    });

    return groups.filter((group) => group.items.length > 0);
  }

  /**
   * One rail button per non-empty category (story 146, criteria 1–4). A
   * category of one is that node, added at once and named by it; a category
   * of more opens its menu beside the rail. Both carry one colour (decision
   * 14) — the colours mean something on the canvas and in the menu, not here.
   */
  private renderCategory(group: PaletteGroup, index: number): string {
    const [first] = group.items;
    const motif = CATEGORY_MOTIFS[group.key] ?? this.iconOf(first);

    if (group.items.length === 1) {
      const label = this.labelOf(first);
      const name = this.text("editor.palette.add", { label });

      return `
        <button
          type="button"
          class="node-palette__category"
          data-node-type="${escapeHtml(first.type)}"
          aria-label="${escapeHtml(name)}"
          data-tip="${escapeHtml(label)}"
        ><span class="node-palette__plate" aria-hidden="true">${this.iconOf(first)}</span></button>
      `;
    }

    return `
      <button
        type="button"
        class="node-palette__category"
        data-category="${index}"
        aria-expanded="false"
        aria-controls="node-palette-menu"
        aria-label="${escapeHtml(group.name)}"
        data-tip="${escapeHtml(group.name)}"
      ><span class="node-palette__plate" aria-hidden="true">${motif}</span></button>
    `;
  }

  private render(): void {
    this.groups = this.gatherGroups();
    const searching = this.getAttribute("search") !== "off";
    const fullOpen = this.open;

    this.root.innerHTML = `
      <style>${styles}</style>
      <!--
        The rail (story 146): » opens the whole palette, then one button per
        category. Always 57 px, so the canvas has the same width whatever is
        open over it (story 145, criterion 2).
      -->
      <div class="node-palette">
        <button
          type="button"
          class="node-palette__arrow"
          data-action="palette-open"
          aria-expanded="${fullOpen}"
          aria-controls="node-palette-full"
          aria-label="${escapeHtml(this.text("editor.palette.show"))}"
          data-tip="${escapeHtml(this.text("editor.palette.show"))}"
        ><span aria-hidden="true">»</span></button>
        <div class="node-palette__categories">
          ${this.groups.map((group, index) => this.renderCategory(group, index)).join("")}
        </div>
        <!--
          A category's nodes, beside its button (criterion 3). After the rail's
          buttons in the DOM, so Tab goes from the button into its menu; a
          disclosure (\`aria-expanded\` on the button, a labelled group here),
          not a \`menu\` role — the items are ordinary buttons that add a node,
          and a menu role would promise arrow keys and typeahead it does not
          keep (K4).
        -->
        <div class="node-palette__menu" id="node-palette-menu" role="group" aria-labelledby="node-palette-menu-title" hidden>
          <div class="node-palette__menu-head">
            <h3 id="node-palette-menu-title"></h3>
            <button
              type="button"
              class="node-palette__menu-close"
              data-action="menu-close"
              aria-label="${escapeHtml(this.text("editor.palette.menuClose"))}"
              title="${escapeHtml(this.text("editor.palette.menuClose"))}"
            ><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
          </div>
          <div class="node-palette__items" data-menu-items></div>
        </div>
        <span class="node-palette__tip" role="tooltip" aria-hidden="true" hidden></span>
      </div>
      <!--
        The whole palette, over the canvas (criterion 6): « folds it, *Sök nod*
        filters it, and it stays open for one add after another. Under 600 px
        of editor it is a sheet over the whole screen (story 145, decided 6/10).
        Focus lands on « when it opens, never in the search: on a tablet a
        focused field opens the keyboard over the list one came to see (Johan
        7/10).
      -->
      <aside class="node-palette__full" id="node-palette-full" aria-label="${escapeHtml(this.text("editor.palette.title"))}" ${fullOpen ? "" : "hidden"}>
        <div class="node-palette__full-head">
          <button
            type="button"
            class="node-palette__arrow"
            data-action="palette-close"
            aria-controls="node-palette-full"
            aria-label="${escapeHtml(this.text("editor.palette.hide"))}"
            title="${escapeHtml(this.text("editor.palette.hide"))}"
          ><span aria-hidden="true">«</span></button>
        </div>
        ${
          searching
            ? `
          <div class="node-palette__search">
            <label for="node-palette-search">${escapeHtml(this.text("editor.palette.search"))}</label>
            <input type="search" id="node-palette-search" autocomplete="off" spellcheck="false" value="${escapeHtml(this.query)}">
          </div>
          <p class="node-palette__search-status" role="status"></p>`
            : ""
        }
        <div class="node-palette__groups">
          ${this.groups
            .map(
              (group) => `
                <section>
                  <h3>${escapeHtml(group.name)}</h3>
                  <div class="node-palette__items">
                    ${group.items.map((item) => this.renderPaletteButton(item)).join("")}
                  </div>
                </section>
              `
            )
            .join("")}
        </div>
      </aside>
    `;

    this.menuTrigger = null;
    this.root.querySelectorAll<HTMLButtonElement>("[data-node-type]").forEach((button) => this.bindAdd(button));
    this.bindRail();
    this.bindFull();
    this.applyQuery();
    this.drawOpen();
  }

  /** Click adds the node; a small drag pulls it onto the canvas (unchanged since 2/9). */
  private bindAdd(button: HTMLButtonElement, afterAdd?: () => void): void {
    button.addEventListener("click", () => {
      const type = button.dataset.nodeType;

      if (!type || this.suppressNextClick) {
        this.suppressNextClick = false;
        return;
      }

      this.dispatchEvent(
        new CustomEvent<NodeTypeAddDetail>("node-type-add", {
          detail: { type },
          bubbles: true,
          composed: true,
        })
      );
      afterAdd?.();
    });

    // Drag the node out of the palette: a small movement after pointerdown
    // starts a drag; a stationary release stays a click.
    button.addEventListener("pointerdown", (event) => {
      const type = button.dataset.nodeType;
      if (!type || event.button !== 0) return;

      const startX = event.clientX;
      const startY = event.clientY;
      const pointerId = event.pointerId;

      const handleMove = (moveEvent: PointerEvent): void => {
        if (moveEvent.pointerId !== pointerId) return;
        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 5) {
          return;
        }

        cleanup();
        this.suppressNextClick = true;
        if (button.hasPointerCapture(pointerId)) {
          button.releasePointerCapture(pointerId);
        }
        afterAdd?.();
        this.dispatchEvent(
          new CustomEvent<NodeTypeDragStartDetail>("node-type-drag-start", {
            detail: {
              type,
              pointerId,
              clientX: moveEvent.clientX,
              clientY: moveEvent.clientY,
            },
            bubbles: true,
            composed: true,
          })
        );
      };
      const cleanup = (): void => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", handleUp);
      };
      const handleUp = (upEvent: PointerEvent): void => {
        if (upEvent.pointerId !== pointerId) return;
        cleanup();
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", handleUp);
    });
  }

  private bindRail(): void {
    this.root
      .querySelector<HTMLButtonElement>('[data-action="palette-open"]')
      ?.addEventListener("click", () => this.setOpen(true));

    this.root.querySelectorAll<HTMLButtonElement>("[data-category]").forEach((button) => {
      button.addEventListener("click", () => {
        const same = this.menuTrigger === button;

        this.closeMenu(false);
        if (!same) this.openMenu(button);
      });
    });

    this.root
      .querySelector<HTMLButtonElement>('[data-action="menu-close"]')
      ?.addEventListener("click", () => this.closeMenu(true));

    this.root.querySelector<HTMLElement>(".node-palette__menu")?.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      this.closeMenu(true);
    });

    // The rail's names, shown on hover and on keyboard focus (criterion 10):
    // `title` alone shows on hover only, and never to a keyboard.
    const tip = this.root.querySelector<HTMLElement>(".node-palette__tip");
    const rail = this.root.querySelector<HTMLElement>(".node-palette");

    for (const button of this.root.querySelectorAll<HTMLElement>(".node-palette [data-tip]")) {
      const show = (): void => {
        if (!tip || !rail) return;
        tip.textContent = button.dataset.tip ?? "";
        tip.hidden = false;
        const top = button.getBoundingClientRect().top - rail.getBoundingClientRect().top;
        tip.style.top = `${Math.round(top + button.offsetHeight / 2 - tip.offsetHeight / 2)}px`;
      };
      const hide = (): void => {
        if (tip) tip.hidden = true;
      };

      button.addEventListener("pointerenter", show);
      button.addEventListener("focus", () => {
        if (button.matches(":focus-visible")) show();
      });
      button.addEventListener("pointerleave", hide);
      button.addEventListener("blur", hide);
      button.addEventListener("click", hide);
    }
  }

  private bindFull(): void {
    const full = this.root.querySelector<HTMLElement>(".node-palette__full");

    this.root
      .querySelector<HTMLButtonElement>('[data-action="palette-close"]')
      ?.addEventListener("click", () => this.setOpen(false));

    full?.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      this.setOpen(false);
    });

    this.root.querySelector<HTMLInputElement>("#node-palette-search")?.addEventListener("input", (event) => {
      this.query = (event.target as HTMLInputElement).value;
      this.applyQuery();
    });
  }

  /**
   * Filters the full palette (criterion 7): case-insensitive, outer spaces
   * ignored, on the name and the host's words. Groups with nothing left go;
   * an empty search shows everything. The status line says what a sighted
   * person sees — how many, or that nothing matched.
   */
  private applyQuery(): void {
    const needle = this.query.trim().toLocaleLowerCase(this.uiLocale);
    const status = this.root.querySelector<HTMLElement>(".node-palette__search-status");
    let shown = 0;

    for (const section of this.root.querySelectorAll<HTMLElement>(".node-palette__full section")) {
      let inSection = 0;

      for (const button of section.querySelectorAll<HTMLElement>("[data-node-type]")) {
        const type = button.dataset.nodeType ?? "";
        const haystack = `${button.textContent ?? ""} ${this.keywordsOf(type)}`.toLocaleLowerCase(this.uiLocale);
        const match = needle === "" || haystack.includes(needle);

        button.hidden = !match;
        if (match) inSection += 1;
      }

      section.hidden = inSection === 0;
      shown += inSection;
    }

    if (status) {
      status.textContent =
        needle === ""
          ? ""
          : shown === 0
            ? this.text("editor.palette.searchEmpty")
            : this.text("editor.palette.searchCount", { count: shown });
      status.hidden = status.textContent === "";
    }
  }

  /** A person opened or folded the full palette. */
  private setOpen(open: boolean): void {
    if (this.open === open) return;

    this.closeMenu(false);
    this.motionNext = true;
    this.open = open;
    this.motionNext = false;
    this.dispatchEvent(
      new CustomEvent<{ open: boolean }>("palette-open-changed", {
        detail: { open },
        bubbles: true,
        composed: true,
      })
    );
    this.root
      .querySelector<HTMLButtonElement>(open ? '[data-action="palette-close"]' : '[data-action="palette-open"]')
      ?.focus({ preventScroll: true });
  }

  /**
   * Draws the full palette open or folded: moving only when a person asked,
   * never under reduced motion; inert from the first frame of a fold, hidden
   * when it ends; the search cleared when it folds (story 146, criterion 8).
   */
  private drawOpen(): void {
    const full = this.root.querySelector<HTMLElement>(".node-palette__full");
    const arrow = this.root.querySelector<HTMLElement>('[data-action="palette-open"]');
    const rail = this.root.querySelector<HTMLElement>(".node-palette");

    if (!full || !rail) return;

    const open = this.open;
    const moving = this.motionNext && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wasShown = !full.hidden && full.dataset.motion !== "closing";

    window.clearTimeout(this.motionTimer);
    this.motionTimer = undefined;
    arrow?.setAttribute("aria-expanded", String(open));

    if (open) {
      this.closeMenu(false);
      full.hidden = false;
      full.inert = false;
      // The rail lies under the open palette; only one of them takes focus.
      rail.inert = true;
      if (moving && !wasShown) {
        full.dataset.motion = "opening";
        this.motionTimer = window.setTimeout(() => {
          delete full.dataset.motion;
        }, PALETTE_MOTION_MS);
      } else {
        delete full.dataset.motion;
      }
    } else {
      full.inert = true;
      rail.inert = false;
      if (this.query !== "") {
        this.query = "";
        const input = this.root.querySelector<HTMLInputElement>("#node-palette-search");
        if (input) input.value = "";
        this.applyQuery();
      }
      if (moving && wasShown) {
        full.dataset.motion = "closing";
        this.motionTimer = window.setTimeout(() => {
          full.hidden = true;
          delete full.dataset.motion;
          this.toggleAttribute("data-overlay", this.overlayBox() !== null);
        }, PALETTE_MOTION_MS);
      } else {
        full.hidden = true;
        delete full.dataset.motion;
      }
    }

    this.toggleAttribute("data-overlay", this.overlayBox() !== null || full.dataset.motion === "closing");
  }

  /**
   * Opens a category's menu beside its button (criteria 3 and 5). Short menus
   * sit level with the button; long ones are held to the workspace's height
   * and scroll. Focus goes to the first node in it.
   */
  private openMenu(trigger: HTMLButtonElement): void {
    const group = this.groups[Number(trigger.dataset.category)];
    const menu = this.root.querySelector<HTMLElement>(".node-palette__menu");
    const rail = this.root.querySelector<HTMLElement>(".node-palette");
    const items = this.root.querySelector<HTMLElement>("[data-menu-items]");
    const title = this.root.querySelector<HTMLElement>("#node-palette-menu-title");

    if (!group || !menu || !rail || !items || !title) return;

    title.textContent = group.name;
    items.innerHTML = group.items.map((item) => this.renderPaletteButton(item)).join("");
    items.querySelectorAll<HTMLButtonElement>("[data-node-type]").forEach((button) =>
      this.bindAdd(button, () => this.closeMenu(false))
    );
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    this.menuTrigger = trigger;

    const room = rail.getBoundingClientRect();
    const height = menu.getBoundingClientRect().height;
    const top = trigger.getBoundingClientRect().top - room.top;

    menu.style.top = `${Math.max(0, Math.min(top, room.height - height))}px`;
    this.toggleAttribute("data-overlay", true);
    document.addEventListener("pointerdown", this.handleOutside, true);
    items.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }

  /** Closes the open menu; with `focus`, back to the button that opened it. */
  private closeMenu(focus: boolean): void {
    const menu = this.root.querySelector<HTMLElement>(".node-palette__menu");
    const trigger = this.menuTrigger;

    document.removeEventListener("pointerdown", this.handleOutside, true);
    if (!menu || menu.hidden) {
      this.menuTrigger = null;
      return;
    }

    menu.hidden = true;
    trigger?.setAttribute("aria-expanded", "false");
    this.menuTrigger = null;
    this.toggleAttribute("data-overlay", this.overlayBox() !== null);
    if (focus) trigger?.focus({ preventScroll: true });
  }

  /** A press anywhere outside the menu and the rail closes the menu. */
  private readonly handleOutside = (event: PointerEvent): void => {
    const path = event.composedPath();
    const menu = this.root.querySelector(".node-palette__menu");
    const rail = this.root.querySelector(".node-palette__categories");

    if ((menu && path.includes(menu)) || (rail && path.includes(rail))) return;
    this.closeMenu(false);
  };
}

if (!customElements.get("node-palette")) {
  customElements.define("node-palette", NodePalette);
}

declare global {
  interface HTMLElementTagNameMap {
    "node-palette": NodePalette;
  }
}
