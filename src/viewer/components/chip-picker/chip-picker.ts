import { escapeHtml } from "../../core/escape-html";
import { chipStrip } from "../../core/chip-strip";
import { interpolate } from "../../core/ui-strings";
import { displacedBy } from "../../core/exclusive-choice";
import styles from "./chip-picker.scss?inline";

import type { LookupResult } from "../../services/lookup-service";

/**
 * Choosing things from a list: labels for what is chosen, a box to search in,
 * and a button per option left.
 *
 * One control, and there is exactly one because a control that drifts
 * **behaves** differently in two places somebody uses in the same hour. It was
 * two copies for an afternoon and `lookup-field` beside it until 2026-08-31;
 * both stories, and the arguments weighed, are in `docs/LOGG.md` 2026-08-30
 * and 2026-08-31 and in `docs/UPPDRAG-2026-08-31-EN-VALJARE.md`.
 *
 * A custom element rather than shared functions, because the hosts sit in
 * different shadow roots: an element brings its own styles and its own
 * behaviour and needs nothing from the page around it.
 *
 * ## What it deliberately does not know
 *
 * Where the options come from. A code list, a question's own alternatives, a
 * catalogue of recipients, a service over HTTP — the host resolves them and
 * hands over `{label, value, hint?}`. And how the answer is stored: it reports
 * the values and the pairs, and a host that keeps a comma string turns them
 * into one. Both of those changed shape twice while this control stayed the
 * same, which is the point.
 *
 * ## The adder is buttons, not a listbox
 *
 * A `role="listbox"` with `aria-activedescendant` means writing the whole
 * keyboard model by hand, and that is nearly always got wrong. A button per
 * option is built in: focusable, operable with space and enter, announced as a
 * button. The search keeps the list short enough that tab order stays walkable
 * — and when it cannot, the count is said in words instead of rendering them.
 * There are deliberately **no arrow keys**; they are added the day somebody
 * misses them.
 *
 * ## The shell is drawn once
 *
 * `render()` builds it; `paint()` redraws the labels, the list, the count and
 * the status around it. The search box is created once and stays, because a
 * phone's on-screen keyboard belongs to **one** element: swap that element
 * mid-entry and the keyboard folds away, and no amount of `setSelectionRange`
 * brings it back.
 *
 * The remove cross is hit at 44px in the viewer and 24 in the editor
 * (`compact`) — drawn small, hit large, so the picture is the same while the
 * measure differs. 24 is WCAG 2.2 AA's floor, 2.5.8.
 *
 * ## An option that stands alone
 *
 * `exclusive` marks a choice that cannot be held with any other: *stateless*
 * beside a country is a contradiction, not an unusual answer. The rule is
 * **replacing, not blocking** — choosing the exclusive one drops the rest,
 * choosing an ordinary one drops the exclusive. Story 062 weighed the other
 * variant and threw it out: a button that refuses without saying why is the
 * same failure class as the palette's silent buttons, and on a tablet a dead
 * button reads as a bug.
 *
 * Two mechanisms carry the *why*, and neither is enough alone:
 *
 * - **The list says either-or before the press.** The exclusive options stand
 *   below a row reading *eller*, never mixed into the crowd. That row is drawn
 *   only when the list holds both kinds, because with one kind there is
 *   nothing to separate.
 * - **The status row says the reason, not only the event.** *"Statslös
 *   tillagt. 1 vald. Kan inte kombineras med andra val, så Danmark togs
 *   bort."* Without the second sentence the visitor is told what vanished and
 *   left to guess why — which was the whole objection to replacing.
 *
 * The flag travels with the pair, not beside it, so a value restored through
 * `value` or `choices` is still exclusive if the source knows it is. It is
 * deliberately absent from what `choices` reports back: the flag describes
 * the OPTION, and the answer is what was chosen.
 *
 * Single mode is untouched. Every choice already replaces the last one there,
 * so exclusivity has nothing to add and the separator nothing to separate.
 */

export interface ChipOption {
  label: string;
  value: string;
  /** Optional discriminator when two matches share a name, e.g. "Örebro län". */
  hint?: string;
  /**
   * Stands alone: choosing it drops every other choice, and choosing anything
   * else drops it. Absent means what every option meant before the flag
   * existed, which is why nothing had to be migrated.
   */
  exclusive?: boolean;
}

/** What the control says when something happens; the host supplies the words. */
export interface ChipPickerStrings {
  /** Placeholder in the search box. */
  search: string;
  /** Accessible name of the search box. */
  searchLabel: string;
  /** Shown inside the box when nothing is chosen. */
  empty: string;
  /** Accessible name of a remove button, with `{label}`. */
  remove: string;
  /**
   * Announced on add and remove, with `{label}` and `{n}`.
   *
   * The `One` variants are used when exactly one thing is chosen, because
   * Swedish agrees with the count: *1 vald*, *2 valda*. "1 valda" is wrong in
   * a way that makes the line look machine-written — which it is, but that
   * should not show.
   *
   * The control picks the form, not the host: it is the only one that knows
   * the count at the moment the line is written.
   */
  added: string;
  addedOne: string;
  removed: string;
  removedOne: string;
  /** How many options are left to choose, with `{n}`. */
  count: string;
  oneLeft: string;
  /**
   * How many a search found, with `{n}` — the count while a term is typed.
   * Its own words (uppdrag 29/9 Del D, Astra §11): what is counted then is
   * the matches, not what is left, and "2 kvar att välja" under a search
   * that left out the rest would say something untrue.
   */
  matches: string;
  oneMatch: string;
  noMatches: string;
  allChosen: string;
  /**
   * The three a searched source needs, and a ready-made list never shows.
   *
   * `hint` carries `{n}`, the minimum number of characters. They live here and
   * not in a second string set, because a host that swaps `options` for
   * `search` should not have to swap its texts as well.
   */
  hint: string;
  searching: string;
  error: string;
  /**
   * The row above the options that stand alone. One word, because it is the
   * word: whoever reads *eller* knows it is either-or before pressing.
   */
  or: string;
  /**
   * Why the others went, with `{removed}` — a whole sentence, appended after
   * `added`.
   *
   * Two strings and not one composed clause, because both halves are
   * sentences: the first agrees with the count, the second names a reason,
   * and a language that orders them differently can still translate each.
   * `exclusiveCleared` is said when the exclusive option was the one chosen,
   * `exclusiveRemoved` when it was the one that had to go.
   */
  exclusiveCleared: string;
  exclusiveRemoved: string;
}

const DEFAULT_STRINGS: ChipPickerStrings = {
  search: "Sök…",
  searchLabel: "Sök bland alternativen",
  empty: "Inget valt än",
  remove: "Ta bort {label}",
  added: "{label} tillagt. {n} valda.",
  addedOne: "{label} tillagt. 1 vald.",
  removed: "{label} borttaget. {n} valda.",
  removedOne: "{label} borttaget. 1 vald.",
  count: "{n} kvar att välja",
  oneLeft: "1 kvar att välja",
  matches: "{n} träffar",
  oneMatch: "1 träff",
  noMatches: "Inga träffar på {term}",
  allChosen: "Alla alternativ är valda",
  hint: "Skriv minst {n} tecken för att söka",
  searching: "Söker…",
  error: "Uppslaget kunde inte nås",
  or: "eller",
  exclusiveCleared: "Kan inte kombineras med andra val, så {removed} togs bort.",
  exclusiveRemoved: "{removed} kan inte kombineras med andra val och togs bort.",
};

/** Over this many, the eye stops scanning and starts hunting. */
const SEARCH_FROM = 8;
/** More than this in the tab order is not a list, it is an obstacle. */
const SHOW_AT_MOST = 50;
/** How long to wait after the last keystroke before a lookup is made. */
const DEBOUNCE_MS = 200;

/**
 * What the line under the box is saying.
 *
 * Only a searched source ever leaves `idle`, which is why the editor's three
 * hosts see exactly what they saw before.
 */
type SourceState = "idle" | "short" | "searching" | "error";

export class ChipPicker extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["compact", "label", "single", "min-chars"];
  }

  private root: ShadowRoot;

  private optionsValue: ChipOption[] = [];

  /**
   * Set by a host whose options are not a list it already has.
   *
   * Null means the list in `options` is the source, and then everything below
   * — the wait, the sequence number, the minimum, the failure state — is
   * skipped rather than configured away.
   */
  private searchValue: ((term: string) => Promise<LookupResult>) | null = null;

  /**
   * The chosen values as pairs, not as values.
   *
   * A searched source returns labels this control has no other way of knowing:
   * `options` is empty then, so a value alone could never be drawn as a chip.
   */
  private chosen: ChipOption[] = [];

  /** What the last searched lookup returned. Unused by a local list. */
  private found: ChipOption[] = [];

  private filter = "";

  /** What the status row shows — and reads, being a live region. */
  private status = "";

  /*
   * What the status row only READS: *"Nordbo Hem Stor tillagt. 1 vald."*
   *
   * Astra 1/10 (bilaga 10, punkt 14): *"den extra bekräftelsemeningen blir
   * bara uppläst. Själva valet ligger synligt kvar i fältet."* The chip in the
   * box is what the eye needs; the sentence under it said the same thing again
   * and pushed the next label down (genomgången 30/9, V23). A screen reader
   * still needs it — nothing else tells the ear a choice landed — so it stays
   * in the live region, out of sight (`chip-picker__hidden`). Errors, the
   * hint, the counts and the *why* of an exclusive choice stay visible: they
   * say something the box does not.
   */
  private heard = "";

  private state: SourceState = "idle";

  private debounce = 0;

  /**
   * A sequence number for lookups. A slow response arriving after a faster one
   * must not overwrite the later one — otherwise the list is replaced with
   * matches for a term the user has already changed.
   */
  private lookupRun = 0;

  /**
   * Whether the options are showing.
   *
   * One rule and not two: they show when the control is used, and always on
   * top. The room is not the control's to take before somebody uses it.
   */
  private open = false;

  private stringsValue: ChipPickerStrings = DEFAULT_STRINGS;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    this.render();
    document.addEventListener("pointerdown", this.dismissOnOutsidePress);
  }

  disconnectedCallback(): void {
    window.clearTimeout(this.debounce);
    document.removeEventListener("pointerdown", this.dismissOnOutsidePress);
  }

  attributeChangedCallback(): void {
    this.paint();
  }

  get options(): ChipOption[] {
    return this.optionsValue;
  }

  set options(next: ChipOption[]) {
    this.optionsValue = next;
    this.paint();
  }

  set search(next: (term: string) => Promise<LookupResult>) {
    this.searchValue = next;
    this.paint();
  }

  /** The chosen values, in the order they were chosen. */
  get value(): string[] {
    return this.chosen.map((one) => one.value);
  }

  set value(next: string[]) {
    const same = next.length === this.chosen.length
      && next.every((one, at) => one === this.chosen[at]?.value);

    // Only when it says something else: a host that writes back what the
    // control just reported would otherwise rebuild the list mid-use.
    if (same) return;

    this.chosen = next.map((value) => this.pairFor(value));
    this.paint();
  }

  /**
   * The choices as one value: a label and the code behind it, per chosen item.
   *
   * ## Why the pair is called `label` and `value`
   *
   * It IS the answer, and the answer's parts are named that: `land.label`,
   * `land.value`. A lookup service already answers `items[].value`, so the
   * name is the same all the way from the service to the receiver.
   *
   * ## Why this exists beside `value`
   *
   * A host that only knows the values (the properties panel's three) has no
   * use for the labels; one that stores the answer (the viewer) must not keep
   * them as two lists held in step by **position**. What that cost when they
   * were two lists: `docs/LOGG.md` 2026-08-30, "Ett svar är inte alltid en
   * sträng längre".
   *
   * A property and not an attribute, because an attribute is a string, and a
   * string is exactly the encoding this replaces.
   */
  get choices(): ChipOption[] {
    return this.chosen.map((one) => ({ label: one.label, value: one.value }));
  }

  set choices(next: ChipOption[]) {
    /*
     * Compared part by part, not as one joined string.
     *
     * The joined form needs a separator that cannot occur in a label or a
     * value, and the only honest candidates are control characters — which
     * then sit as raw bytes in this file and make it read as binary to
     * everything that greps it. Comparing the parts needs no separator at
     * all: `{label: "a b", value: "c"}` and `{label: "a", value: "b c"}` are
     * two different choices and stay that way.
     */
    const same =
      next.length === this.chosen.length
      && next.every(
        (one, at) =>
          one.label === this.chosen[at]?.label && one.value === this.chosen[at]?.value,
      );

    // Only when it says something else, for the same reason as `value`.
    if (same) return;

    this.chosen = next
      .filter((one) => one.label.trim() !== "" && one.value.trim() !== "")
      // The flag is the host's to state: it describes the option, and the
      // host is the one that knows where the options came from.
      .map((one) => ({
        label: one.label,
        value: one.value,
        ...(one.exclusive ? { exclusive: true } : {}),
      }));
    this.paint();
  }

  /**
   * What stands in the search box right now.
   *
   * Free text: a lookup question may allow an answer that is not on the list,
   * and then what was typed is the answer with no code behind it. The host
   * decides whether that is allowed; the control only reports what it has.
   */
  get text(): string {
    return this.searchBox?.value ?? "";
  }

  /**
   * Puts free text back, without pretending somebody typed it.
   *
   * No lookup, no report: this is a host restoring an answer it already has —
   * a visitor stepping back to a question they answered with words that were
   * not on the list. Searching would have opened a list nobody asked for, and
   * reporting would have echoed the host's own write back at it.
   */
  set text(next: string) {
    this.filter = next;
    if (this.searchBox) this.searchBox.value = next;
    this.paint();
  }

  set strings(next: Partial<ChipPickerStrings>) {
    this.stringsValue = { ...DEFAULT_STRINGS, ...next };
    this.paint();
  }

  /**
   * Whether there is a box to type in.
   *
   * A searched source has nothing to show without a term, so it always has
   * one. A ready-made list gets one once scanning turns into hunting.
   */
  private get searchable(): boolean {
    return this.searchValue !== null || this.optionsValue.length > SEARCH_FROM;
  }

  /**
   * How much has to be typed before a lookup happens. Zero is allowed — and it
   * has to be tested for, not truthiness-checked: `> 0` in the old field made
   * `min-chars="0"` fall back to two, so the behaviour was not missing but
   * unreachable.
   *
   * Zero is what a **closed** list wants — countries, municipalities, case
   * types — because somebody who does not know how we spell it has nothing to
   * type. An address register still wants two: nobody needs to see every
   * address the moment they tab into the field. A local list is always zero;
   * it has nothing to spare by waiting.
   */
  private get minChars(): number {
    if (this.searchValue === null) return 0;

    const raw = Number(this.getAttribute("min-chars"));

    return Number.isFinite(raw) && raw >= 0 && this.hasAttribute("min-chars") ? raw : 2;
  }

  /**
   * One answer, not several: choosing replaces rather than adds. Two chips
   * would look like a multiple choice and leave open which of them decides
   * the way onward.
   */
  private get single(): boolean {
    return this.hasAttribute("single");
  }

  private get searchBox(): HTMLInputElement | null {
    return this.root.querySelector<HTMLInputElement>("[data-search]");
  }

  /**
   * The pair behind a bare value, from what is chosen or from the source.
   *
   * The flag comes along when the source carries one. A chosen thing that
   * forgot it stands alone would let a country be added beside *stateless*
   * one repaint later, and nothing in the picture would say why it was
   * allowed that time.
   */
  private pairFor(value: string): ChipOption {
    const known =
      this.chosen.find((one) => one.value === value)
      ?? this.optionsValue.find((one) => one.value === value)
      ?? this.found.find((one) => one.value === value);

    return {
      label: known?.label ?? value,
      value,
      ...(known?.exclusive ? { exclusive: true } : {}),
    };
  }

  /**
   * What the list would show, before it is capped or hidden.
   *
   * A local list filters itself here — that is the whole of its "search", and
   * it is why no timer is involved. A searched one has already been answered
   * and only has the chosen taken out of it.
   */
  /*
   * Not `matches`: `HTMLElement` already has a method by that name, and a
   * private member cannot shadow a public one on the base class. Caught by
   * `tsc` and not by the suite, which does not typecheck.
   */
  private get available(): ChipOption[] {
    const taken = new Set(this.chosen.map((one) => one.value));

    if (this.searchValue !== null) {
      return this.found.filter((one) => !taken.has(one.value));
    }

    const term = this.filter.trim().toLowerCase();

    return this.optionsValue
      .filter((one) => !taken.has(one.value))
      .filter((one) => term === "" || one.label.toLowerCase().includes(term));
  }

  private announce(key: "added" | "removed", label: string): void {
    const one = key === "added" ? "addedOne" : "removedOne";
    const form = this.chosen.length === 1 ? this.stringsValue[one] : this.stringsValue[key];

    this.heard = interpolate(form, { label, n: String(this.chosen.length) });
    this.status = "";
  }

  /**
   * Adds the reason to what was just announced.
   *
   * Johan's remaining worry about the replacing rule was *"om man förstår
   * varför valda alternativ försvinner"*. "Danmark togs bort" answers what;
   * only the clause about combining answers why, and the row is read aloud,
   * so the sentence is where a screen reader hears the rule at all.
   *
   * `theirs` says which side carried the exclusivity: the option just chosen,
   * or the ones that had to leave. Naming the wrong one would teach the rule
   * backwards.
   */
  private sayWhy(gone: ChipOption[], theirs: boolean): void {
    const text = this.stringsValue;
    const removed = gone.map((one) => one.label).join(", ");

    // Visible: a chip the visitor chose went, and the box alone cannot say why.
    this.status = interpolate(theirs ? text.exclusiveRemoved : text.exclusiveCleared, { removed });
  }

  /**
   * One event, not two.
   *
   * The values for a host that only stores values, the pairs for one that
   * stores the answer. Two events would have been two chances to listen to the
   * wrong one.
   */
  private report(): void {
    this.dispatchEvent(
      new CustomEvent("chip-change", {
        detail: { value: this.value, choices: this.choices },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ---------------------------------------------------------------- the source

  /**
   * Asks the source for a term.
   *
   * A ready-made list answers here and now: no wait to add, and no response
   * that can arrive out of order. Everything below the first branch exists
   * only because a service can be slow, can be asked twice, and can fail.
   */
  private lookUp(term: string): void {
    window.clearTimeout(this.debounce);

    if (this.searchValue === null) {
      this.state = "idle";
      this.paint();
      return;
    }

    if (term.trim().length < this.minChars) {
      this.found = [];
      this.state = "short";
      this.paint();
      return;
    }

    this.debounce = window.setTimeout(() => void this.ask(term), DEBOUNCE_MS);
  }

  private async ask(term: string): Promise<void> {
    const run = ++this.lookupRun;
    const source = this.searchValue;

    if (!source) return;

    this.state = "searching";
    this.paint();

    const result = await source(term);

    // An older lookup catching up with a newer one is ignored.
    if (run !== this.lookupRun) return;

    if (result.error) {
      this.found = [];
      this.state = "error";
      this.paint();
      return;
    }

    this.found = result.items;
    this.state = "idle";
    this.open = true;
    /*
     * The count is announced, once, when the answer lands.
     *
     * The rule that the search says nothing in the live region was written for
     * a ready-made list, where it is right: there is no wait there, so a line
     * per keystroke makes the region unusable. A searched source answers
     * AFTER the debounce — that is an event, not a letter — and without this
     * a screen reader heard "Söker…" and then silence. The count row is not a
     * live region and cannot do it — and it stays blank for a searched source
     * (see `countLine`), so the words stand once.
     */
    this.status = this.countText();
    this.heard = "";
    this.paint();
  }

  // ------------------------------------------------------------------ drawing

  /**
   * The shell, drawn once.
   *
   * Everything that changes is left empty here and filled by `paint()`. The
   * search box is the reason the split exists at all: it has to be the same
   * element from the first keystroke to the last.
   */
  private render(): void {
    const text = this.stringsValue;

    this.root.innerHTML = `
      <style>${styles}</style>
      <div role="group" data-group>
        <div class="chip-picker__anchor">
          <div class="chip-picker__box">
            <ul class="chip-picker__chips" data-chips></ul>
            <span class="chip-picker__empty" data-empty hidden></span>
            <input
              type="search"
              class="chip-picker__search"
              data-search
              autocomplete="off"
              aria-label="${escapeHtml(text.searchLabel)}"
              placeholder="${escapeHtml(text.search)}"
              hidden
            >
          </div>

          <ul class="chip-picker__list" data-options hidden></ul>
        </div>

        <p class="chip-picker__count" data-count></p>
        <p class="chip-picker__status" data-status aria-live="polite"></p>
      </div>
    `;

    this.listen();
    this.paint();
  }

  /**
   * Redraws everything around the search box.
   *
   * No listeners are attached here. The buttons it writes are reached by
   * delegation from the shadow root, bound once — a listener per painted
   * button would have been a new pile at every keystroke.
   */
  private paint(): void {
    const box = this.searchBox;

    // Before the shell exists: `connectedCallback` paints as soon as it does.
    if (!box) return;

    const text = this.stringsValue;
    const group = this.root.querySelector<HTMLElement>("[data-group]");
    const chips = this.root.querySelector<HTMLElement>("[data-chips]");
    const empty = this.root.querySelector<HTMLElement>("[data-empty]");
    const list = this.root.querySelector<HTMLElement>("[data-options]");
    const count = this.root.querySelector<HTMLElement>("[data-count]");
    const status = this.root.querySelector<HTMLElement>("[data-status]");

    if (!group || !chips || !empty || !list || !count || !status) return;

    group.setAttribute("aria-label", this.getAttribute("label") ?? "");
    box.setAttribute("aria-label", text.searchLabel);
    /*
     * No placeholder beside a chosen chip in single mode: the question is
     * answered, and an invitation to type next to the answer contradicts it
     * (seen on the tablet, 2026-08-31: "Lekplats ×  Börja skriva…"). In
     * multiple mode the box invites the next choice, so it keeps its words.
     */
    box.placeholder = this.single && this.chosen.length > 0 ? "" : text.search;
    box.hidden = !this.searchable;

    chips.innerHTML = chipStrip(this.chosen, text.remove, {
      prefix: "chip-picker__chip",
      itemAttribute: "data-chosen",
      removeAttribute: "data-remove",
    });

    /*
     * The empty line only when there is no search box. With one you type in
     * the same box, and the placeholder then stood to the left of the caret —
     * two texts competing for the same row. The search box's own placeholder
     * does the job; the other is in the way. Seen in a screenshot.
     */
    const sayEmpty = this.chosen.length === 0 && !this.searchable;

    empty.hidden = !sayEmpty;
    // Emptied and not just hidden: `textContent` on the box reads hidden
    // children too, so the line would still have stood beside what is typed.
    empty.textContent = sayEmpty ? text.empty : "";

    const shown = this.visibleOptions();
    const row = (one: ChipOption): string => `
          <li>
            <button type="button" class="chip-picker__option" data-add data-value="${escapeHtml(one.value)}">
              <span class="chip-picker__option-label">${escapeHtml(one.label)}</span>
              ${
                one.hint
                  ? `<span class="chip-picker__option-hint">${escapeHtml(one.hint)}</span>`
                  : ""
              }
            </button>
          </li>`;

    /*
     * The either-or is drawn, not merely enforced.
     *
     * The row is an `<li>` with words in it and no button: it must be read by
     * whoever cannot see the rule and reached by nobody tabbing through the
     * options. Only when both kinds are present — a separator with nothing on
     * one side of it separates nothing, and would read as a heading over a
     * list that has no other half.
     */
    const separated = this.separateExclusive(shown);

    list.hidden = shown.length === 0;
    list.innerHTML = separated
      ? [
          ...separated.ordinary.map(row),
          `<li class="chip-picker__separator" data-separator>${escapeHtml(text.or)}</li>`,
          ...separated.alone.map(row),
        ].join("")
      : shown.map(row).join("");

    count.textContent = this.countLine();
    const shownLine = this.statusLine();
    const heardOnly = this.state === "idle" ? this.heard : "";
    status.replaceChildren(
      ...(heardOnly ? [Object.assign(document.createElement("span"), { className: "chip-picker__hidden", textContent: heardOnly })] : []),
      ...(heardOnly && shownLine ? [" "] : []),
      shownLine,
    );
    // No margin under the box for a row with nothing to see in it.
    status.toggleAttribute("data-quiet", shownLine === "");
  }

  /**
   * The options that are actually drawn.
   *
   * They show when the control is used, and always on top. A long ready-made
   * list waits for a term on top of that: fifty entries in alphabetical order
   * say nothing about what you are looking for, and the first thing you meet
   * in a list of countries should not be Afghanistan.
   */
  private visibleOptions(): ChipOption[] {
    if (!this.open || this.state !== "idle") return [];

    const waitingForATerm =
      this.searchValue === null && this.searchable && this.filter.trim() === "";

    if (waitingForATerm) return [];

    return this.available.slice(0, SHOW_AT_MOST);
  }

  /**
   * The two halves of a list that has both, or null when it has one kind.
   *
   * Sorted here and not in `available`, so the count under the box goes on
   * counting the same set it always did — the order is a matter for the
   * drawing, and nothing else asks about it.
   */
  private separateExclusive(
    shown: ChipOption[],
  ): { ordinary: ChipOption[]; alone: ChipOption[] } | null {
    // Single mode replaces on every choice already; there is no either-or in
    // it to draw, and a lone word over the last two rows would only puzzle.
    if (this.single) return null;

    const ordinary = shown.filter((one) => !one.exclusive);
    const alone = shown.filter((one) => one.exclusive);

    if (ordinary.length === 0 || alone.length === 0) return null;

    return { ordinary, alone };
  }


  /**
   * The visible line under the list: what it holds.
   *
   * Blank while the source is saying something of its own, so the two lines
   * never answer the same question differently — "Alla alternativ är valda"
   * beside "Söker…" is two answers to one question.
   *
   * And blank for a searched source altogether. Its count arrives with the
   * answer and is said in the status row, which is both visible and read
   * aloud; writing it here as well put "Inga träffar på Tyra" twice under
   * the box (Johan's measurement on the tablet, 2026-08-31). A ready-made
   * list keeps its row: in the editor it stands under the box from the
   * start, saying how many there are to choose from.
   */
  private countLine(): string {
    if (this.state !== "idle") return "";
    if (this.searchValue !== null) return "";

    return this.countText();
  }

  /** The words for what is left to choose — or why nothing is. */
  private countText(): string {
    const text = this.stringsValue;
    const term = this.filter.trim();
    const left = this.available;

    if (left.length === 0) {
      return term === "" ? text.allChosen : interpolate(text.noMatches, { term });
    }

    if (term !== "") {
      return left.length === 1 ? text.oneMatch : interpolate(text.matches, { n: String(left.length) });
    }

    return left.length === 1 ? text.oneLeft : interpolate(text.count, { n: String(left.length) });
  }

  /** The announced line: what just happened, or why nothing did. */
  private statusLine(): string {
    const text = this.stringsValue;

    if (this.state === "short") return interpolate(text.hint, { n: String(this.minChars) });
    if (this.state === "searching") return text.searching;
    if (this.state === "error") return text.error;

    return this.status;
  }

  // ---------------------------------------------------------------- listening

  /**
   * Every listener the control has, bound once on the shell.
   *
   * Delegation rather than a listener per button: `paint()` runs at every
   * keystroke, and binding there would have added another listener to every
   * option each time. The shadow root outlives all of it.
   */
  private listen(): void {
    this.root.addEventListener("focusin", () => this.use());
    this.root.addEventListener("click", (event) => this.onClick(event));

    /*
     * The buttons never steal focus from the search box: `mousedown` is
     * cancelled, so focus and caret stay where they were and the click still
     * comes. The toolbar pattern every ordinary wysiwyg uses — why, and what
     * it cost to find out: `docs/LOGG.md` 2026-08-31.
     *
     * `mousedown`, NOT `pointerdown`: cancelling pointerdown stops iOS from
     * running the compatibility chain, and then no click arrives at all.
     */
    this.root.addEventListener("mousedown", (event) => {
      if (this.buttonIn(event, "data-add") || this.buttonIn(event, "data-remove")) {
        event.preventDefault();
      }
    });

    /*
     * Closing watches WHERE focus went — not that it left.
     * `relatedTarget: null` means "don't know", not "outside", so nothing
     * happens then; a press outside is closed by the pointer listener below.
     * What Safari does that makes this necessary: `docs/LOGG.md` 2026-08-31.
     */
    this.root.addEventListener("focusout", (event) => {
      const next = (event as FocusEvent).relatedTarget;

      if (!(next instanceof Node) || this.root.contains(next)) return;

      this.close();
    });

    const box = this.searchBox;

    box?.addEventListener("input", () => this.onType(box.value));

    /*
     * Escape closes without emptying the box: whoever changed their mind
     * stands where they were, with what they typed still there.
     *
     * And it is only swallowed when it closed something. The control sits
     * inside dialogs that close on Escape, and stopping the key regardless
     * made a closed pillbox a trap — the dialog never heard it.
     */
    box?.addEventListener("keydown", (event) => {
      const key = (event as KeyboardEvent).key;

      /*
       * Backspace in an empty box removes the last chip — what every pillbox
       * does when there is nothing left to erase in the box itself. Focus
       * stays in the box (so `byKeyboard` is false: the cross would have
       * moved it), and the status row says what went, as it does for the
       * cross. With text in the box, Backspace is the browser's.
       */
      if (key === "Backspace" && box.value === "" && this.chosen.length > 0) {
        event.preventDefault();
        this.drop(this.chosen[this.chosen.length - 1]!.value, false);
        return;
      }

      if (key !== "Escape") return;
      if (!this.open) return;

      event.stopPropagation();
      this.open = false;
      this.paint();
    });
  }

  private onType(term: string): void {
    /*
     * The search says nothing in the status line: the count already stands
     * under the list, and reading a number out at every keystroke makes the
     * announcement unusable.
     */
    this.filter = term;
    this.status = "";
    this.heard = "";
    this.open = true;

    /*
     * Typing IS the answer changing — but only when the source is a search.
     *
     * There the box is the answer field: what is typed is free text until
     * something on the list is picked, so an earlier pick is dropped (a code
     * left behind would have become a silent lie) and every keystroke is
     * reported. A host that unlocks its Next button on the answer has no other
     * way of hearing that free text arrived; without the report it stayed
     * locked however much somebody typed.
     *
     * A ready-made list is a chooser, not a text field: the panel's rule
     * condition keeps its value while somebody searches for the next one, and
     * says nothing until something is actually chosen.
     */
    if (this.single && this.searchValue !== null) {
      this.chosen = [];
      this.report();
    }

    this.lookUp(term);
  }

  private onClick(event: Event): void {
    const add = this.buttonIn(event, "data-add");

    if (add) {
      this.choose(add.dataset.value ?? "", (event as MouseEvent).detail === 0);
      return;
    }

    const remove = this.buttonIn(event, "data-remove");

    if (remove) {
      this.drop(remove.dataset.value ?? "", (event as MouseEvent).detail === 0);
      return;
    }

    this.use();
  }

  private choose(value: string, byKeyboard: boolean): void {
    const picked = this.available.find((one) => one.value === value) ?? this.pairFor(value);
    const pair: ChipOption = {
      label: picked.label,
      value: picked.value,
      ...(picked.exclusive ? { exclusive: true } : {}),
    };

    /*
     * Replacing, not blocking: every press does something, and what it did is
     * said. Worked out in `docs/STORIES/062-ett-val-som-utesluter-de-andra.md`
     * — a control that refuses is a dead end, and the visitor has no way to
     * learn what would make it live.
     */
    const { gone, theirs } = this.single
      ? { gone: [] as ChipOption[], theirs: false }
      : displacedBy(this.chosen, pair.exclusive === true, (one) => one.exclusive === true);
    const dropped = new Set(gone.map((one) => one.value));

    this.chosen = this.single
      ? [pair]
      : [...this.chosen.filter((one) => !dropped.has(one.value)), pair];
    /*
     * The search is cleared, so the list closes. Somebody typed to find one
     * thing; once it is chosen the list has done its work, and one left lying
     * over the content is in the way.
     */
    this.filter = "";
    if (this.searchBox) this.searchBox.value = "";
    this.found = [];
    this.state = "idle";
    this.open = !this.single;
    this.announce("added", pair.label);
    if (gone.length > 0) this.sayWhy(gone, theirs);
    this.paint();
    this.report();

    /*
     * Focus moves only when the keyboard did the choosing. Whoever pressed
     * Enter is standing on a button that just left the list, so focus goes
     * where they plausibly want to be next: the search box if there is one,
     * otherwise the first remaining option. Without it focus lands on the body
     * and the next tab starts from the top of the page.
     *
     * A pointer must not have focus moved for it: the press left focus exactly
     * where it was, and moving it is the theft this control was taught not to
     * commit.
     */
    if (byKeyboard) this.moveFocusTo("[data-search]", "[data-add]");
  }

  private drop(value: string, byKeyboard: boolean): void {
    const name = this.pairFor(value).label;

    this.chosen = this.chosen.filter((one) => one.value !== value);
    /*
     * Removing counts as using the control. Without it the click listener
     * opened it AFTERWARDS and painted a second time — whereupon focus, just
     * moved to the next label, sat on an element that no longer existed.
     */
    this.open = true;
    this.announce("removed", name);
    this.paint();
    this.report();

    // The chip stood on is gone; the next one is the nearest thing meant.
    // Keyboard only, for the same reason as above.
    if (byKeyboard) this.moveFocusTo("[data-remove]", "[data-search]", "[data-add]");
  }

  private moveFocusTo(...selectors: string[]): void {
    for (const selector of selectors) {
      const target = this.root.querySelector<HTMLElement>(selector);

      if (target && !target.hidden) {
        target.focus();
        return;
      }
    }
  }

  /** The control was reached or pressed: show what there is to choose from. */
  private use(): void {
    if (this.open) return;

    this.open = true;

    /*
     * A searched source looks itself up again when the control is returned to.
     *
     * `close()` keeps what was typed there — the box is the answer field — so
     * without this the count row went on describing a list that was thrown
     * away with the close: "Inga träffar på Kum" under a box nobody had
     * searched with. `lookUp` handles the too-short case itself, which is also
     * how a list needing no typing at all (`min-chars="0"`) opens on focus.
     */
    if (this.searchValue !== null) {
      this.lookUp(this.filter);
      return;
    }

    this.paint();
  }

  /**
   * A press anywhere else closes the list.
   *
   * On the document and not on the shadow root: this root holds the control
   * and nothing else, so a press outside it never reaches it. Bound once, in
   * `connectedCallback` — the root survives every repaint, and one listener
   * per paint would have been a pile of duplicates.
   *
   * `composedPath` and not `event.target`: at document level the target is
   * retargeted to the host, so a press inside the control looks identical to a
   * press on the element itself.
   */
  private dismissOnOutsidePress = (event: Event): void => {
    if (!this.open) return;
    if (event.composedPath().includes(this)) return;

    this.close();
  };

  /**
   * Hides the list. What has been typed is a different question.
   *
   * With a searched source the box IS the answer field: a lookup question may
   * allow an answer that is not on the list, and then what was typed is the
   * whole answer. Emptying it on the way out threw that away — somebody types
   * "Kumla", tabs on, and the field is blank. The old lookup field never
   * touched its input when the list closed.
   *
   * A ready-made list is the other case: there the box is a filter, and a
   * filter left lying around greets the next person who opens the control
   * with a list narrowed by somebody else's search.
   *
   * The in-flight lookup is dropped too. Without that, a slow answer lands
   * after the close, sets `open` and paints — and the list stands open again
   * over whatever was just pressed.
   */
  private close(): void {
    this.open = false;
    window.clearTimeout(this.debounce);
    this.lookupRun += 1;

    if (this.searchValue === null) {
      this.filter = "";
      if (this.searchBox) this.searchBox.value = "";
    } else {
      // What the last answer held goes with the list it was drawn in.
      this.found = [];
    }

    this.paint();
  }

  /** The button an event passed through on its way out of the shadow root. */
  private buttonIn(event: Event, attribute: string): HTMLElement | null {
    for (const step of event.composedPath()) {
      if (step === this.root) break;
      if (step instanceof HTMLElement && step.hasAttribute(attribute)) return step;
    }

    return null;
  }
}

if (!customElements.get("chip-picker")) {
  customElements.define("chip-picker", ChipPicker);
}
