import { startReorder } from "../../controllers/reorder-gesture";
import styles from "./guide-versions.scss?inline";

import { interpolate, t } from "../../localization/editor-ui-strings";
import { possessive } from "../../localization/possessive";

import { SOURCE_LOCALE } from "../../../viewer/core/localized-text";

import type { ThemeChoice } from "../../../viewer/core/theme";
import type { GuideVersion } from "../../../viewer/types/versions";

// The shape stays public from here — hosts and the editor entry import it as before.
export type { GuideVersion };

/**
 * `<guide-versions>` — the versions of a guide, and nothing about where they
 * are kept.
 *
 * ## Why it is ours
 *
 * The storage is the host's: a file archive, a database, a git log. **The
 * control is not.** Every host that keeps guides needs this list, and each one
 * building its own is the shape almost every fault in this project has had —
 * the same answer written twice, and the second copy never updated.
 *
 * So the words, the layout, what a row shows and which button is dangerous all
 * live here, once, in the tool's own language and the theme's own tokens.
 *
 * ## What it knows
 *
 * ```js
 * element.versions = [
 *   { id, label, note, savedAt, current, missing },
 * ];
 * ```
 *
 * `label` is what the host calls it — a file name, a row id, a commit hash.
 * `note` is what an editor wrote about *this* version, and it wins the title
 * when there is one: "guide-0728.json" says when, and never why.
 *
 * ## What it does about it
 *
 * Nothing. It renders, and it asks:
 *
 * ```
 * version-open-intent        show me this one
 * version-restore-intent     let me carry on from this one
 * version-activate-intent    make this the one visitors see
 * version-duplicate-intent   copy it
 * version-rename-intent      rename it
 * version-note-intent        say what this version is
 * version-delete-intent      remove it
 * version-reorder-intent     put them in this order
 * ```
 *
 * ## Sorting is a view; an order is data
 *
 * Sorting by date or name changes nothing, so the element does it alone — it
 * reorders a copy and never asks. A **hand-made order** is the opposite: it is
 * something someone decided, and only the host can keep it. So dragging asks,
 * with the whole new order in the intent, and nothing moves until the host
 * sends the list back that way.
 *
 * The two fight, and pretending otherwise is where this goes wrong: drag a row
 * in a date-sorted list and it springs back, which reads as broken. So dragging
 * **is** choosing your own order — the control switches with it, seeded from
 * what was on screen, so nothing jumps at the moment of the drag.
 *
 * `-intent` is the convention the rest of the editor already uses for "the user
 * asked; something above decides" — `save-as-node-template-intent`,
 * `start-node-change-intent`. A list that acted on its own would be a list with
 * opinions about storage.
 *
 * Naming is deliberately absent from the intents: they carry the version, not a
 * new name. Asking for one is interface, and the host owns the interface.
 *
 * **Deleting is not confirmed here.** Whether it can be undone is a property of
 * the store, not of the list: a host with a wastebasket should not make anyone
 * answer a frightening question, and one without needs a better warning than a
 * list could write.
 *
 * ## Not exported yet
 *
 * It is in the codebase, in the tool's language, under test — and deliberately
 * not on a public entry. Public surface binds us the moment it exists, and this
 * shape changed three times in one evening. See `docs/EFTER-LANSERING.md`.
 */

export type VersionOrder = "saved" | "label" | "custom";

type IntentAction =
  | "open"
  | "restore"
  | "activate"
  | "save"
  | "discard"
  | "duplicate"
  | "rename"
  | "note"
  | "delete";

/**
 * What a host says it answers (story 124's addendum).
 *
 * The element offers eight things somebody might do with a version. A host
 * answers the ones its own storage has — the guide-storage page has `open` and
 * `activate` and nothing else, because the storage contract has no rename, no
 * note, no duplicate and no delete. Showing the rest anyway left four menu
 * items that did nothing at all.
 *
 * Unset means every one of them, so nothing changes for a host that has not
 * thought about it.
 */
export type VersionAction = IntentAction;

export class GuideVersions extends HTMLElement {
  static readonly observedAttributes = ["editor-locale", "order", "theme"];

  private readonly root: ShadowRoot;

  private versionsValue: GuideVersion[] = [];
  private actionsValue: VersionAction[] | null = null;

  /** Which way the rows are shown. A view, until someone drags. */
  private orderValue: VersionOrder = "saved";


  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }

  /** The versions to show. Setting this redraws; there is no other way in. */
  /**
   * When a version was written, in the reader's own clock.
   *
   * Short, because a column of full timestamps is a column of noise: the
   * question a date answers here is "which is newer", not "at what second".
   *
   * One function since 17/9, because the same moment was being written twice
   * with two different answers: a storage minted the row's name as UTC while
   * this column rendered the reader's zone, so one frozen version said both
   * *13:05* and *15:05* on the same line. A time shown twice has to be shown
   * by one thing.
   */
  private whenText(savedAt: number): string {
    /*
     * `medium` och inte `short`: svenskans korta datumform ÄR `2026-09-17`, och
     * på en rad bredvid ett namn läses den som en maskinsträng snarare än som
     * ett datum (Johan 18/9 kväll). `medium` ger *17 sep. 2026 22:50*, samma
     * form som guidelistan på sajten redan skriver — och det är fortfarande
     * läsarens zon, vilket är hela skälet att den här funktionen finns.
     */
    return new Intl.DateTimeFormat(this.editorLocale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(savedAt));
  }

  /**
   * What the row is called: what somebody wrote, else its name, else *when*.
   *
   * The id is the last resort and reads as one — `v-3f2a-…` tells a person
   * nothing. A version nobody named is known by when it was saved, which is
   * exactly what every version list has always done, and it is the same text
   * the column shows rather than a second rendering of the same instant.
   */
  /**
   * What the row is called on screen.
   *
   * The host's number first — *Version 4* — because that is the name an editor
   * says out loud, and it is the host's to set: it is fixed when the version is
   * frozen and survives pruning (`docs/LAGRING-KONTRAKT.md`). The list counts
   * nothing itself; counting here would rename every row the day a host tidies
   * an old version away.
   *
   * Without a number the row falls back to what it always did: the host's own
   * label, the note, the clock. A row with no number is a row with no number —
   * never a number this end made up.
   */
  private headingOf(version: GuideVersion): string {
    if (typeof version.number === "number") {
      return interpolate(this.text("editor.versions.numbered"), { number: version.number });
    }

    /*
     * En kopia frusen vid en krock (berättelse 131) heter **vems kopia den
     * är**, och namnet byggs här och lagras aldrig: vem *du* är beror på vem
     * som läser.
     *
     * Johan mätte 20/9 varför det behövs: två rader per krock, samma etikett,
     * samma minut, och *av Anna Andersson* på båda — för hon var den som slog
     * ihop, inte den som skrivit arbetet. Nu bär raden ägaren, och värden
     * avgör vem det är (`by.me`).
     */
    if (version.reason === "conflict") {
      return this.conflictHeading(version);
    }

    return version.label && version.label.trim() !== "" ? version.label : this.nameOf(version);
  }

  private conflictHeading(version: GuideVersion): string {
    if (version.by?.me === true) {
      return this.text("editor.versions.conflictMine");
    }

    /* Utan namn namnges ingen — hellre en rad som säger en sak mindre. */
    return version.by?.name
      ? interpolate(this.text("editor.versions.conflictTheirs"), {
          owner: possessive(version.by.name, this.editorLocale ?? SOURCE_LOCALE),
        })
      : this.text("editor.versions.conflict");
  }

  private restoreConflictLabel(version: GuideVersion): string {
    if (version.by?.me === true) {
      return this.text("editor.versions.restoreConflictMine");
    }

    return version.by?.name
      ? interpolate(this.text("editor.versions.restoreConflictTheirs"), {
          owner: possessive(version.by.name, this.editorLocale ?? SOURCE_LOCALE),
        })
      : this.text("editor.versions.restoreConflict");
  }

  private nameOf(version: GuideVersion): string {
    return (
      version.note ||
      version.label ||
      (version.savedAt ? this.whenText(version.savedAt) : "") ||
      version.id
    );
  }

  /**
   * Which of the element's offers this host answers. Unset: all of them.
   *
   * Hiding the others with CSS was the alternative, and it is the worse one:
   * the buttons would still be there for a keyboard and a screen reader, which
   * is a menu that lies rather than a menu that is short.
   */
  set actions(value: VersionAction[] | null) {
    this.actionsValue = value === null ? null : [...value];
    this.render();
  }

  get actions(): VersionAction[] | null {
    return this.actionsValue === null ? null : [...this.actionsValue];
  }

  /** Whether this host answers an action at all. */
  private allows(action: IntentAction): boolean {
    return this.actionsValue === null || this.actionsValue.includes(action);
  }

  /**
   * Asked for by name — the rule for anything added after hosts existed.
   *
   * Unset means *all of them*, which is right for the seven offers that were
   * here before a host could say anything: nothing changed for anyone. It is
   * wrong for a new one. *Återställ* arrived on 17/9, and under the old rule
   * every page that had never heard of it would have grown a button on every
   * row that nothing listens to — which is the exact fault `actions` was added
   * to remove.
   */
  private asked(action: IntentAction): boolean {
    return this.actionsValue !== null && this.actionsValue.includes(action);
  }

  set versions(value: GuideVersion[]) {
    this.versionsValue = Array.isArray(value) ? value : [];
    this.render();
  }

  get versions(): GuideVersion[] {
    return this.versionsValue;
  }

  /** How the rows are shown: by date, by name, or as the host handed them. */
  set order(value: VersionOrder) {
    this.orderValue = value;
    this.render();
  }

  get order(): VersionOrder {
    return this.orderValue;
  }

  /** The tool's own language, like every other component's. */
  get editorLocale(): string | undefined {
    return this.getAttribute("editor-locale") ?? undefined;
  }

  /**
   * A light or dark theme, in the same words as `<guide-editor>`.
   *
   * A host that pins its editor to dark and cannot pin the list beside it ends
   * up with a dark editor and a white table under it — which reads as a bug in
   * the tool rather than as a gap in its API. Without this the list followed
   * the operating system alone, and the operating system does not know what the
   * host decided.
   *
   * Set on the **element**, not on the document: a list embedded in a host's
   * own page must not recolour the page around it. The library does not
   * remember the choice — the host does (K6d).
   */
  set theme(value: ThemeChoice | null) {
    // `data-fw-theme`, not `data-theme`: the latter is a convention the host may
    // use itself, and the tokens must not hang off their element.
    if (value) {
      this.dataset.fwTheme = value;
    } else {
      delete this.dataset.fwTheme;
    }
  }

  get theme(): ThemeChoice | null {
    const value = this.dataset.fwTheme;
    return value === "dark" || value === "light" ? value : null;
  }

  /** Sets the theme. `null` hands the decision back to the OS setting. */
  setTheme(theme: ThemeChoice | null): void {
    this.theme = theme;
  }

  /**
   * A press anywhere else closes the menu.
   *
   * On the document, because "anywhere else" includes the page around us — the
   * host's own Save button is the likeliest next thing someone reaches for, and
   * a menu still hanging over the row while they press it is a menu that has
   * stopped tracking what the person is doing.
   */
  private readonly closeOnOutsidePress = (event: Event): void => {
    if (!event.composedPath().includes(this)) {
      this.closeMenus();
    }
  };

  connectedCallback(): void {
    document.addEventListener("pointerdown", this.closeOnOutsidePress);
    this.render();
  }

  disconnectedCallback(): void {
    document.removeEventListener("pointerdown", this.closeOnOutsidePress);
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "order" && (value === "saved" || value === "label" || value === "custom")) {
      this.orderValue = value;
    }
    /*
     * `theme` is the host's word; `data-fw-theme` is what the tokens hang off.
     * Accepting the attribute as well as the property means a host can write it
     * in markup — which is how the editor is usually wired, and the list should
     * not be the one element that has to be scripted.
     */
    if (name === "theme") {
      this.theme = value === "dark" || value === "light" ? value : null;
    }
    this.render();
  }

  /**
   * The rows in the order they are shown.
   *
   * `custom` renders the array exactly as it arrived: the host's order is the
   * host's, and re-sorting it here would silently overrule the thing someone
   * dragged into place.
   */
  private shown(): GuideVersion[] {
    if (this.orderValue === "custom") {
      return this.versionsValue;
    }

    const rows = [...this.versionsValue];

    if (this.orderValue === "label") {
      /*
       * Sorted by what the row says, not by what it holds. The heading is the
       * host's name when there is one — the same rule the row renders by — so a
       * list sorted by name lands in the order somebody reading it expects.
       */
      const named = (one: GuideVersion): string => one.label || one.note || one.id;

      return rows.sort((a, b) => named(a).localeCompare(named(b), this.editorLocale));
    }

    // Newest first. A version list is read from the top, and the top is where
    // the thing that just happened belongs.
    return rows.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
  }

  /**
   * Asks for a new order, and switches to showing one.
   *
   * The switch happens here rather than waiting for the host: the row is
   * already under someone's finger, and a list that sprang back to date order
   * while they held it would read as a refusal.
   *
   * `movedId` is who to announce, when there is a "who" — both callers (the
   * pointer drag and the Alt+arrow move) know exactly which row they moved,
   * and it is the row that answers what a screen reader needs to hear: not
   * that *a* list changed, but where *this* one landed.
   */
  private askReorder(order: string[], movedId?: string): void {
    this.orderValue = "custom";
    this.dispatchEvent(
      new CustomEvent("version-reorder-intent", {
        detail: { order },
        bubbles: true,
        composed: true,
      }),
    );
    this.render();

    if (movedId) {
      const moved = this.versionsValue.find((version) => version.id === movedId);

      if (moved) {
        this.announce(
          interpolate(this.text("editor.announce.reordered"), {
            title: this.headingOf(moved),
            position: order.indexOf(movedId) + 1,
            count: order.length,
          }),
        );
      }
    }
  }

  /**
   * Says something once, to whoever is listening rather than looking.
   *
   * Samma idiom som `node-editor`s `announce()`: en tom text, sedan den
   * riktiga texten strax efter. `render()` byggde precis om hela skuggroten
   * (`this.root.innerHTML = ...`), och en region som redan bar gårdagens ord
   * skulle annars stå tyst nästa gång orden råkar bli desamma — en skärmläsare
   * läser bara upp en *ändring*, inte samma text den redan sa.
   */
  private announce(message: string): void {
    const region = this.root.querySelector<HTMLElement>("[data-announce]");

    if (!region) {
      return;
    }

    region.textContent = "";
    window.setTimeout(() => {
      region.textContent = message;
    }, 30);
  }

  /**
   * Taking hold of a row and arranging the list.
   *
   * Everything about pointers, thresholds, geometry and animation lives in
   * `startReorder`; this hands over the four things it cannot know — which
   * container, how to find a row, what the order is, and where the result goes.
   *
   * It used to live here in full. The answer options in a question need the
   * same gesture, and five rounds of tuning is not something to copy: *does not
   * work with a finger*, *jumps back and forth*, *a bit too sensitive*, *the row
   * glides down too fast*. A second copy is the one nobody adjusts when the
   * sixth report arrives.
   */
  private startReorder(event: PointerEvent, id: string): void {
    const body = this.root.querySelector<HTMLElement>("tbody");

    if (!body) {
      return;
    }

    startReorder(event, {
      id,
      order: this.shown().map((version) => version.id),
      container: body,
      itemFor: (each) =>
        body.querySelector<HTMLElement>(`tr[data-id="${CSS.escape(each)}"]`),
      onCommit: (order) => this.askReorder(order, id),
    });
  }

  /** Moves a row by `step` places and asks for the result. */
  private move(id: string, step: number): void {
    const order = this.shown().map((version) => version.id);
    const from = order.indexOf(id);
    const to = from + step;

    if (from < 0 || to < 0 || to >= order.length) {
      return;
    }

    order.splice(to, 0, ...order.splice(from, 1));
    this.askReorder(order, id);

    // The row moved out from under the pointer, so focus follows it. Losing
    // focus on every keystroke makes the keyboard path unusable after one move.
    requestAnimationFrame(() => {
      this.root
        .querySelector<HTMLElement>(`li[data-id="${CSS.escape(id)}"]`)
        ?.focus();
    });
  }

  private text(key: string): string {
    return t(key, this.editorLocale);
  }

  private ask(action: IntentAction, version: GuideVersion): void {
    this.dispatchEvent(
      new CustomEvent(`version-${action}-intent`, {
        detail: { version },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private button(action: IntentAction, version: GuideVersion, heading?: string): HTMLButtonElement {
    const label = this.text(`editor.versions.${action}`);
    const element = document.createElement("button");

    element.type = "button";
    element.textContent = label;
    element.dataset.action = action;
    /*
     * The version's own name in the accessible name. A screen reader hearing
     * "Ta bort" four times over learns nothing about which one it is — and this
     * is a list where pressing the wrong row is the whole risk.
     */
    element.setAttribute(
      "aria-label",
      interpolate(this.text("editor.versions.action"), {
        action: label,
        version: heading ?? this.nameOf(version),
      }),
    );
    element.addEventListener("click", () => {
      /*
       * Refused, not disabled. A `disabled` button cannot take focus, so the
       * one item on this list that comes with a reason was the one item a
       * keyboard could never reach — and the reason sat in a `title`, which is
       * a tooltip, which is a mouse. `aria-disabled` keeps it in the tab and
       * arrow order with its reason in the accessible name, and the refusal
       * moves here where it can still be refused.
       */
      if (element.getAttribute("aria-disabled") === "true") {
        return;
      }

      this.ask(action, version);
    });

    return element;
  }

  private renderRow(version: GuideVersion): HTMLTableRowElement {
    const row = document.createElement("tr");
    /*
     * What the row is called — one answer, used by everything on it.
     *
     * The name a host chose leads (see the two lines below); the note is the
     * second line. Every accessible name on the row says the same thing the eye
     * reads, because a menu item announced by words that are not on screen is a
     * menu item a voice user cannot ask for (WCAG 2.5.3).
     */
    const heading = this.headingOf(version);

    row.dataset.id = version.id;

    /*
     * The row itself opens the version.
     *
     * Choosing a version means reading one, and reading one means having it in
     * front of you — so the thing you do most while looking should be the
     * cheapest thing to do. It was a menu item, which is one press too many for
     * the act of browsing.
     *
     * It asks the same `version-open-intent` the menu does: opening loads and
     * moves nothing, so a host that wired the menu has already wired this.
     *
     * A row whose version is gone opens nothing, and a press that landed on a
     * button is that button's — otherwise every action in the menu would also
     * open the row it sits on.
     */
    if (!version.missing) {
      row.classList.add("openable");
      row.addEventListener("click", (event) => {
        if ((event.target as HTMLElement)?.closest("button, [role=\"menu\"]")) {
          return;
        }

        this.ask("open", version);
      });
    }

    if (this.orderValue === "custom") {
      /*
       * The keyboard path, and not an afterthought: a reorder nobody can reach
       * is a feature only some people have.
       */
      row.tabIndex = 0;
      row.setAttribute(
        "aria-label",
        interpolate(this.text("editor.versions.move"), { version: heading }),
      );

      row.addEventListener("keydown", (event) => {
        if (!event.altKey) {
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          this.move(version.id, -1);
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          this.move(version.id, 1);
        }
      });
    }

    if (version.current) {
      row.dataset.current = "true";
    }
    if (version.open) {
      row.dataset.open = "true";
    }
    if (version.missing) {
      row.dataset.missing = "true";
    }
    /*
     * Och varför raden finns, när det inte är en publicering (berättelse 131).
     *
     * Stilmallen behöver det: en versions namn är kort — *Version 4* — och
     * klipps därför med ellips hellre än att göra raden hög. En krockfrysnings
     * namn är en mening med ett namn i, och den ska brytas i stället
     * (Johans bild 20/9 i 390 px: *Sparad vid krock · Anna Anderss…*).
     */
    if (version.reason) {
      row.dataset.reason = version.reason;
    }

    /*
     * The note is the version's name when there is one, and the file's own name
     * follows it on the same line, quieter. Both are wanted: the note is what a
     * person remembers, the label is what they will search for wherever guides
     * are kept.
     *
     * They shared a row and had a column each until the actions were counted:
     * six buttons took five sixths of the width, and the two identifying facts
     * were squeezed into what was left. One is a heading and one is a
     * reference, so they read as one line — and the column they used to need
     * went back to the name.
     *
     * A version that is gone says so here. One that quietly disappeared would
     * look like the tool forgot.
     */
    const name = document.createElement("th");
    name.scope = "row";
    name.className = "name";

    /*
     * A grip, and why it is a thing you can see rather than the whole row.
     *
     * The rows used to carry `draggable` and the browser's own drag events.
     * That has two faults. Nothing on screen said a row could be moved — you
     * had to try. And on a touch screen it does not work at all: Safari on
     * iPadOS never starts an HTML5 drag from a finger, so the one way to
     * arrange a list was mouse-only.
     *
     * Pointer events work for mouse, pen and finger alike, but they need
     * `touch-action: none` on whatever is grabbed, or the browser scrolls
     * instead of handing the gesture over. Putting that on the whole row would
     * mean a list you cannot scroll past by swiping — so it goes on a grip of
     * its own, a few millimetres wide, which is also the thing that was missing
     * as a signal.
     *
     * It appears only in your own order, exactly as dragging did: in a
     * date-sorted list a moved row springs back, and a control that undoes what
     * you just did is worse than one that was never there.
     */

    /*
     * The cell stays a cell; the flex lives in a box inside it. The same lesson
     * as the buttons, learned twice: a `<td>` or `<th>` told to be a flex
     * container stops taking part in the table's width calculation, and here it
     * collapsed the name to nothing at all.
     */
    const box = document.createElement("div");
    box.className = "namebox";

    if (this.orderValue === "custom") {
      const grip = document.createElement("span");

      grip.className = "grip";
      grip.dataset.grip = "";
      grip.setAttribute("aria-hidden", "true");
      grip.textContent = "\u283F";
      grip.addEventListener("pointerdown", (event) =>
        this.startReorder(event, version.id),
      );
      box.insertBefore(grip, box.firstChild);
    }

    /*
     * The name is the button that opens the version.
     *
     * Pressing the row opened it and a menu item did the same, which is one act
     * with two doors — and the menu item existed only because a `<tr>` is not
     * something a keyboard can press. Making the name itself the control fixes
     * that at the root: it is reachable by Tab, announced as *Öppna i editorn:
     * Före regeländringen*, and it is the thing a person was already aiming at.
     *
     * A row whose version is gone keeps a plain span. There is nothing to open,
     * and a button that refuses is worse than no button.
     */
    /*
     * Two lines, and which is which was decided by a screenshot (17/9).
     *
     * The note used to be the row's first words with the host's own name in
     * small type beside it. In a 480 px history panel any note of normal length
     * then pushed *Version 2* and the *Publicerad* badge onto a second line —
     * so the two things that identify a row, which version it is and whether
     * visitors are reading it, were the two that gave way to free text.
     *
     * The name the host chose leads, with the badge anchored to its right. The
     * note follows underneath: one line, quieter, the whole of it in `title`
     * for anyone who wants it. A note is why a version exists; a name is how
     * you find it again, and finding comes first in a list.
     */
    const text = document.createElement(version.missing ? "span" : "button");

    if (text instanceof HTMLButtonElement) {
      text.type = "button";
      /*
       * The visible words are part of the spoken name (WCAG 2.5.3): the button
       * says *Version 2*, so the accessible name has to contain *Version 2* —
       * a control announced by a note nobody can see is a control a voice user
       * cannot ask for by name.
       */
      text.setAttribute(
        "aria-label",
        interpolate(this.text("editor.versions.action"), {
          action: this.text("editor.versions.open"),
          version: heading,
        }),
      );
      text.addEventListener("click", () => this.ask("open", version));
    }

    text.className = "text";
    text.textContent = version.missing
      ? `${heading} — ${this.text("editor.versions.missing")}`
      : heading;
    box.appendChild(text);

    /*
     * Two marks, two questions, and they are not the same question.
     *
     * *Publicerad* answers what residents get. *Öppen* answers where the work in
     * the editor came from — which is the one an editor needs while they are
     * typing, and the one that tells them which row Save is meant for.
     *
     * Only the published one wears colour. A second coloured state would cost
     * the first one its meaning, so this is a word in a quiet frame beside it.
     */
    if (version.open) {
      const state = document.createElement("span");
      state.className = "state";
      state.textContent = this.text("editor.versions.openState");
      box.appendChild(state);
    }

    /*
     * Two marks, because they are two facts.
     *
     * *Öppen* is where the writing lands. *Utkast* is that something is sitting
     * there unsaved. One replaced the other for an afternoon, which took the
     * row's anchor away exactly when it mattered most, and joining them into one
     * pill made a compound word out of two plain ones.
     *
     * A draft does **not** only sit on the open row, whatever this comment said
     * until 18/9. Measured in the host that uses it: the versions workbench
     * marks every version that holds unattended work, open or not — *"unattended
     * is not the same as gone"*, in its own words. On the open row the two marks
     * therefore appear together; on any other row *Utkast* stands alone and
     * says there is something waiting over there.
     *
     * Which is the reason the marks are two and not one: a row can be the one
     * being written in, the one holding unsaved work, both, or neither.
     */
    if (version.draft) {
      const draft = document.createElement("span");
      draft.className = "state";
      draft.dataset.draft = "true";
      draft.textContent = this.text("editor.versions.draftState");
      box.appendChild(draft);
    }

    if (version.current) {
      const badge = document.createElement("span");
      badge.className = "badge";
      // Answers "which one is actually showing?" without anyone working it out.
      badge.textContent = this.text("editor.versions.current");
      box.appendChild(badge);
    }

    name.appendChild(box);

    /*
     * The note, on its own line — and only when it is not already the heading.
     * A host that sends no label gets the note as line one, exactly as before,
     * and a second line saying the same thing would be the duplicate this
     * codebase keeps being bitten by.
     */
    if (version.note && version.note !== heading) {
      const note = document.createElement("div");

      note.className = "note";
      note.textContent = version.note;
      note.title = version.note;
      name.appendChild(note);
    }

    /*
     * The third line: who and when, together and quiet.
     *
     * Three lines per row, not four (Johan 18/9 kväll): the name, the note
     * somebody wrote, and then the facts about the act. Who and when belong on
     * one line because they answer one question — *who changed this, and when*
     * — and four equal left-aligned lines made the row a list of four things of
     * equal weight, none of which was the one you read.
     *
     * The date used to have a column of its own. It sat beside a name it
     * described and took width from it; here it is where it belongs, in the
     * same sentence as the person.
     *
     * Either half may be missing. A host without a login sends no `by`, and
     * then the line is only the date — never the word *av* followed by
     * nothing (story 126, criterion 8). A missing version has no date.
     */
    const meta = document.createElement("div");
    /*
     * *av Anna Andersson* betyder **vem som frös versionen**. På en
     * krockfrysning är det alltid den som slog ihop, alltså en uppgift som
     * inte hjälper någon — och rubriken säger redan vems arbetet är. En rad
     * per uppgift: raden säger vems kopia, metaraden säger när.
     */
    const who =
      version.by?.name && version.reason !== "conflict"
        ? interpolate(this.text("editor.versions.by"), { name: version.by.name })
        : "";
    const when = version.savedAt && !version.missing ? this.whenText(version.savedAt) : "";

    meta.className = "meta";
    meta.dataset.meta = "";

    if (who !== "") {
      const byPart = document.createElement("span");

      /*
       * `data-by` bor kvar på sin egen del av raden. Kontrollerna frågar efter
       * VEM, och en mätning som läser hela metaraden hade räknat datumet som en
       * del av namnet — den sortens kontroll är grön oavsett.
       */
      byPart.dataset.by = "";
      byPart.textContent = who;
      meta.appendChild(byPart);
    }

    if (when !== "") {
      const whenPart = document.createElement("span");

      whenPart.dataset.when = "";
      whenPart.textContent = when;
      meta.appendChild(whenPart);
    }

    if (meta.childElementCount > 0) {
      name.appendChild(meta);
    }

    row.appendChild(name);

    const cell = document.createElement("td");
    cell.className = "actions";

    /*
     * One control on the row, and the actions inside it.
     *
     * Six labelled buttons per row is six offers of equal weight, and they took
     * five sixths of the width: the version's own name was down to six
     * characters while "Duplicera" had room to spare. A row is read far more
     * often than it is acted on, so the reading gets the space and the acting
     * gets a menu.
     *
     * The words come along. Shrinking them to icons would have saved the same
     * width and cost the one thing this list is careful about — "Öppna i
     * editorn" and "Publicera" differ by *whose eyes*, and no pair of
     * glyphs says that.
     */
    /*
     * Which action the row wears itself, decided before the menu is built so the
     * menu can leave it out.
     *
     * An action offered twice on one row is two ways to the same thing side by
     * side, and the second one always looks like it must be different. It is the
     * fault this list has spent the day removing everywhere else.
     */
    const promoted: IntentAction | null = version.missing
      ? null
      : version.draft
        ? "save"
        : version.current
          ? "duplicate"
          : "activate";

    const menu = document.createElement("div");
    menu.className = "menu";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "trigger";
    trigger.dataset.menuTrigger = version.id;
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute(
      "aria-label",
      interpolate(this.text("editor.versions.action"), {
        action: this.text("editor.versions.actions"),
        version: heading,
      }),
    );
    /*
     * A word, not a glyph. "⋯" is a developer's idiom for "there is more here";
     * the person reading this row is an editor deciding which version residents
     * see, and a control that has to be learned before it can be used is a
     * control that gets left alone. The caret is the same one the editor's own
     * menus wear, so the tool has one answer to "this opens something".
     */
    trigger.textContent = this.text("editor.versions.actions");

    const actions = document.createElement("div");
    actions.className = "buttons";
    actions.setAttribute("role", "menu");
    actions.hidden = true;
    actions.setAttribute(
      "aria-label",
      interpolate(this.text("editor.versions.action"), {
        action: this.text("editor.versions.actions"),
        version: heading,
      }),
    );

    if (!version.missing) {
      /*
       * No Spara here. Saving is the row's own button on the one row that holds
       * a draft (`promoted`), and nowhere else: a version without a draft has
       * nothing new to take. It used to be offered on every row, and that was
       * one button read two ways — the example page saved nothing there, the
       * Sitevision host wrote the editor's content into that version after a
       * confirm. Johan 3/9: only where a draft exists. And no padlock on the
       * others — a version is not locked, it is merely up to date, and a lock
       * promises an unlocking that does not exist.
       */
      if (promoted !== "duplicate" && this.allows("duplicate")) {
        actions.appendChild(this.button("duplicate", version, heading));
      }
      if (this.allows("rename")) {
        actions.appendChild(this.button("rename", version, heading));
      }
      if (this.allows("note")) {
        actions.appendChild(this.button("note", version, heading));
      }
    }

    /*
     * Removing stays on every row, including one that is already gone: that row
     * is a leftover pointer, and clearing it is exactly what someone wants.
     *
     * On the live version it is **there and disabled**. Deleting it would leave
     * the page showing nothing, and an editor would discover that from a
     * visitor rather than from us. Hiding the button would be the smaller lie
     * and the worse one — the row would just be missing something every other
     * row has, and someone would go looking for what they did wrong.
     *
     * **Unless the live one is also gone.** Then the block is guarding a state
     * that already happened: the page is showing nothing, because the thing it
     * points at is not there. Refusing here would leave the one row that
     * explains the empty page as the one row nobody can clear, and the only way
     * out would be to make some other version live first — which is a change to
     * what visitors see, asked of someone who only wanted to remove a dead
     * pointer.
     */
    const remove = this.allows("delete") ? this.button("delete", version, heading) : null;

    if (remove && version.current && !version.missing) {
      remove.setAttribute("aria-disabled", "true");
      remove.title = this.text("editor.versions.deleteBlocked");
      remove.setAttribute(
        "aria-label",
        `${remove.textContent}: ${this.text("editor.versions.deleteBlocked")}`,
      );
    }

    /*
     * Removing sits below a line, apart from the rest. It is the one item here
     * that pressing again does not undo, and a menu that lists it flush with
     * "Byt namn" invites the slip where the hand arrives one item too low.
     */
    if (remove && actions.childElementCount > 0) {
      const separator = document.createElement("div");
      separator.className = "separator";
      separator.setAttribute("role", "separator");
      actions.appendChild(separator);
    }

    if (remove) {
      actions.appendChild(remove);
    }

    /*
     * The items are menu items, and they have to say so — for a screen reader,
     * which announces "menu, six items" rather than six loose buttons, and for
     * the styling, which hangs off the role. Set here rather than in `button()`
     * because the same helper builds the one control that is *not* in the menu.
     */
    for (const item of actions.querySelectorAll("button")) {
      item.setAttribute("role", "menuitem");
    }

    /*
     * A menu with nothing in it is not a menu. A host that answers none of
     * these (the guide-storage page answers `open` and `activate`) would
     * otherwise get a control that opens an empty box — worse than no control,
     * because somebody presses it twice to check.
     */
    if (actions.childElementCount > 0) {
      menu.append(trigger, actions);
    }

    /*
     * The controls live in a box inside the cell, not in the cell itself. A
     * `<td>` told to be a flex container stops taking part in the table's own
     * width calculation, and its contents get drawn across the columns beside
     * it. The comment was already here; the lesson was learned twice.
     */
    const rowActions = document.createElement("div");
    rowActions.className = "rowactions";

    /*
     * Switching version stays on the row.
     *
     * It is the one thing this list exists for — which version residents see —
     * and a menu makes the answer to "show that one instead" cost two presses
     * and a decision about where it lives. Everything else can wait behind the
     * control; this cannot.
     *
     * Only where it means something: the live row is already live, and a row
     * whose file is gone has nothing to show. Both would be a button that does
     * nothing, which is worse than no button — it makes someone wonder what
     * they missed.
     */
    /*
     * The row's own action, and which one it is depends on what the row needs.
     *
     * Unsaved work outranks everything: the thing to do with a draft is put it
     * somewhere, and it belongs to this row. Otherwise it is Publicera, on the
     * rows where that means anything — the published one is already published,
     * and one that is gone has nothing to show.
     */
    /*
     * The row's own action, and what it is depends on what the row needs.
     *
     * A draft outranks everything: the thing to do with unsaved work is put it
     * somewhere, and both ways out belong here rather than one of them being
     * filed under *more options* — they are the same size of act.
     *
     * Otherwise Publicera, on the rows where that means something. The published
     * row cannot publish, and its slot stood empty on the one row people most
     * often want to start a change from, so it offers a copy: the only act there
     * that leads somewhere without touching what residents are reading.
     */
    if (promoted && this.allows(promoted)) {
      const primary = this.button(promoted, version, heading);

      primary.classList.add("primary");

      if (promoted === "save") {
        primary.classList.add("urgent");
      }
      rowActions.appendChild(primary);
    }

    /*
     * *Återställ* — carrying on from an old version, and why it is on the row.
     *
     * Opening a version is reading it; restoring it is the act somebody opened
     * the history *for*. Behind a menu it would be the thing they go looking
     * for, and that is the wrong kind of effort for a decision already made.
     *
     * Not on the published row: the working copy already starts from that one,
     * so the button would either do nothing or say the same thing as the host's
     * own *Kasta ändringarna* — two doors to one act, which is the fault this
     * list has spent its life removing. The same judgment `promoted` already
     * makes about *Publicera*.
     *
     * Not on a missing one either: there is nothing left to come back to.
     */
    if (!version.missing && !version.current && this.asked("restore")) {
      const restore = this.button("restore", version, heading);

      /*
       * Knappen bär versionens namn: *Återställ version 5*, aldrig bara
       * *Återställ*. Ordet ensamt läser som *ångra allt*, och den som hör det
       * uppläst eller bara tittar på knappen har inte raden bredvid sig.
       */
      /*
       * Utom på en krockfrysning, där ordet ensamt INTE är tvetydigt: rubriken
       * strax intill har redan sagt *Sparad vid krock · Johan Furuskogs
       * kopia*, och en knapp som upprepar det tar bredden namnet behöver.
       *
       * Johan mätte det 20/9 två gånger. Först *"Återställ Sparad vid krock är
       * otympligt"* — löst med den kortare *Återställ {ägare} kopia*, som
       * fortfarande är namnet en andra gång på samma rad. Sedan, i en bild av
       * den lösningen: *rubriken klipptes* — `td.actions` krymper till
       * knappens bredd (`width: 1%`) och tog utrymmet ifrån namnet den skulle
       * spara. Genomgången (129–131) löser det: bara ordet syns, den fulla
       * meningen står kvar för den som lyssnar (`aria-label`, satt av
       * `button()` annars — här satt om, så den säger *vems kopia* och inte
       * *Sparad vid krock* en tredje gång).
       */
      if (version.reason === "conflict") {
        restore.textContent = this.text("editor.versions.restore");
        restore.setAttribute("aria-label", this.restoreConflictLabel(version));
      } else {
        restore.textContent = interpolate(this.text("editor.versions.restoreNamed"), {
          version: inPhrase(heading),
        });
      }

      restore.classList.add("primary");
      rowActions.appendChild(restore);
    }

    if (version.draft && this.allows("discard")) {
      const discard = this.button("discard", version, heading);

      discard.classList.add("primary", "quiet");
      rowActions.appendChild(discard);
    }

    /*
     * An empty menu is not put in the row at all. It was appended whether or
     * not it held anything, and on a host that answers few actions that left an
     * empty box on every row — which drew as a stray rule under the date once
     * the row stacked (seen in a 390 px screenshot, 17/9).
     */
    if (menu.childElementCount > 0) {
      rowActions.appendChild(menu);
    }
    cell.appendChild(rowActions);
    row.appendChild(cell);

    this.wireMenu(trigger, actions);

    return row;
  }

  /**
   * Opening, closing, and the ways out.
   *
   * The same behaviour as the toolbar's menus, because a tool with two answers
   * to "how does a menu close" has taught its user nothing. Escape returns the
   * focus to the control that opened it — a menu that closes and leaves the
   * focus nowhere strands anyone not using a mouse.
   */
  private wireMenu(trigger: HTMLButtonElement, panel: HTMLElement): void {
    trigger.addEventListener("click", () => {
      const open = trigger.getAttribute("aria-expanded") === "true";

      this.closeMenus();

      if (!open) {
        trigger.setAttribute("aria-expanded", "true");
        panel.hidden = false;
        /*
         * The panel leaves the element's box, and everything the host drew
         * after us paints on top of it — in the mock, the page's own Save row
         * came straight through the menu. A z-index inside the shadow root
         * cannot help: the thing painting too low is this element.
         *
         * So the element claims a place in the stack, and only while it has
         * something to hold up. A component that permanently sat above its
         * host's page would be a component with an opinion about a layout it
         * cannot see.
         */
        this.dataset.menuOpen = "true";
        panel.querySelector<HTMLButtonElement>("button")?.focus();
      }
    });

    panel.addEventListener("keydown", (event) => {
      const items = [...panel.querySelectorAll<HTMLButtonElement>("button")];
      /*
       * The shadow root's own idea of focus, not the document's. `document
       * .activeElement` stops at the host — every item looked equally unfocused
       * from here, so every arrow press landed back on the first one.
       */
      const at = items.indexOf(this.root.activeElement as HTMLButtonElement);

      if (event.key === "Escape") {
        event.stopPropagation();
        this.closeMenus();
        trigger.focus();
      }

      // Arrow keys walk the menu, skipping nothing: an item that is offered and
      // refused still has to be reachable, or its reason never gets read.
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        items[(at + step + items.length) % items.length]?.focus();
      }
    });

    // Acting on a row is the end of the menu's job.
    for (const item of panel.querySelectorAll("button")) {
      item.addEventListener("click", () => this.closeMenus());
    }
  }

  /** Shuts every open menu. Safe to call when none is. */
  private closeMenus(): void {
    for (const panel of this.root.querySelectorAll<HTMLElement>('[role="menu"]')) {
      panel.hidden = true;
    }
    for (const trigger of this.root.querySelectorAll("[data-menu-trigger]")) {
      trigger.setAttribute("aria-expanded", "false");
    }

    // The place in the stack is given back with the menu that needed it.
    delete this.dataset.menuOpen;
  }

  /**
   * The order control.
   *
   * A `<select>` rather than three buttons: it is a view preference, and giving
   * it the weight of three controls would put it on a level with the actions
   * that change what a resident sees.
   */
  private renderOrder(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "order";

    const label = document.createElement("label");
    label.textContent = this.text("editor.versions.sort");
    label.htmlFor = "order";

    const select = document.createElement("select");
    select.id = "order";

    for (const value of ["saved", "label", "custom"] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = this.text(`editor.versions.sort.${value}`);
      option.selected = value === this.orderValue;
      select.appendChild(option);
    }

    select.addEventListener("change", () => {
      const next = select.value as VersionOrder;

      /*
       * Switching *to* your own order asks for the one on screen, so the list
       * does not rearrange itself the moment someone chooses to arrange it.
       * That jump is what makes people distrust a control.
       */
      if (next === "custom") {
        this.askReorder(this.shown().map((version) => version.id));
        return;
      }

      this.orderValue = next;
      this.render();
    });

    // The drawn chevron hangs off a wrapper: a select carries no ::after.
    const field = document.createElement("span");

    field.className = "order-select";
    field.append(select);
    wrapper.append(label, field);

    if (this.orderValue === "custom") {
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = this.text("editor.versions.reorderHint");
      wrapper.appendChild(hint);
    }

    return wrapper;
  }

  private render(): void {
    this.root.innerHTML = `<style>${styles}</style>`;

    /*
     * Beskedet om var en flyttad rad landade. Byggs om varje `render()` precis
     * som allt annat här — `announce()` skriver in ordet en tick senare, så
     * regionen måste finnas innan dess, tom.
     */
    const announce = document.createElement("p");

    announce.className = "guide-versions__announce";
    announce.dataset.announce = "";
    announce.setAttribute("role", "status");
    announce.setAttribute("aria-live", "polite");
    this.root.appendChild(announce);

    if (this.versionsValue.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = this.text("editor.versions.empty");
      this.root.appendChild(empty);
      return;
    }

    // Only worth offering when there is something to order.
    if (this.versionsValue.length > 1) {
      this.root.appendChild(this.renderOrder());
    }

    /*
     * A table rather than a list of cards. Every version answers the same
     * questions — what it is, when it was saved, and what you can do — and a
     * line each says that. Cards said it in a paragraph each, and a year of
     * versions would have been a scroll.
     *
     * A real `<table>`, not a grid of divs: a screen reader then says which
     * column a cell is in, and "Sparad, 5 aug 15:20" is the difference between
     * a date and a number.
     */
    const table = document.createElement("table");
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");

    /*
     * Two columns, not three. Filen fick sin egen en gång och läser sedan länge
     * på samma rad som namnet den beskriver; **Sparad** gick samma väg 18/9
     * kväll och står nu i radens metarad tillsammans med vem som frös den.
     *
     * Skälet är detsamma båda gångerna: en kolumn tar bredd från namnet, som är
     * det man letar efter, för att visa något man läser efter att man hittat
     * rätt rad.
     */
    for (const column of ["version", "actions"] as const) {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = this.text(`editor.versions.column.${column}`);
      /*
       * Båda rubrikerna är för skärmläsaren, ingen för ögat.
       *
       * *Åtgärder* har alltid varit dold — knapparna säger vad de är, och ett
       * ord ovanför dem är brus. *Version* följde med dit när kolumnen *Sparad*
       * gick och lämnade den ensam: en rubrik utan grannar rubricerar
       * ingenting, den står bara och ser ut som en etikett över hela listan.
       *
       * Raden finns kvar i trädet, och det är skillnaden mot att ta bort
       * `thead`. Utan rubriker har cellerna i varje rad inget att höra ihop
       * med, och en skärmläsare tappar det enda som gör en tabell till en
       * tabell. Klassen är den som redan fanns här; ingen ny skrevs.
       */
      cell.className = "sr-only-head";
      headRow.appendChild(cell);
    }

    head.appendChild(headRow);
    table.appendChild(head);

    const body = document.createElement("tbody");

    for (const version of this.shown()) {
      body.appendChild(this.renderRow(version));
    }

    table.appendChild(body);
    this.root.appendChild(table);
  }
}

/**
 * A name as it reads *inside* a phrase.
 *
 * The row is headed *Version 2* — a common noun and a number, capitalised
 * because it starts a line. Dropped into *Återställ …* the same words are an
 * ordinary phrase, and Swedish writes them lowercase there; English does the
 * same in this shape.
 *
 * Only that shape is touched. A label that is a real name — `guide-0728.json`,
 * a product, somebody's note — is left exactly as the host wrote it: names do
 * not bend to where in a sentence they land, and a rule that lowercased every
 * label would quietly rewrite them.
 */
function inPhrase(name: string): string {
  return /^\p{Lu}\p{Ll}+ \d+$/u.test(name) ? name[0]!.toLowerCase() + name.slice(1) : name;
}

if (!customElements.get("guide-versions")) {
  customElements.define("guide-versions", GuideVersions);
}
