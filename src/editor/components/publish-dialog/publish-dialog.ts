import styles from "./publish-dialog.scss?inline";

import { SOURCE_LOCALE } from "../../../viewer/core/localized-text";
import { interpolate, t } from "../../localization/editor-ui-strings";

import type { GuideHealthIssue } from "../../services/guide-health-service";
import type { GuideChange } from "../../../viewer/services/guide-diff-service";

/**
 * `<publish-dialog>` — what publishing would change, before it happens.
 *
 * ## Why it is not the prompt dialog with a list above it
 *
 * The prompt asks for a word. This asks a person to *decide*, and everything in
 * it is there to make the decision possible: what breaks, what changes, what a
 * visitor will meet. The note is the smallest part of it and the only part the
 * old dialog had.
 *
 * What it does share is the way a dialog behaves in this tool, and that is not
 * copied: a native `<dialog>` with `showModal()`, which is the focus trap, the
 * backdrop and Escape all at once — and `styles/_dialog-shell.scss`, which is
 * the box. There is no third focus trap in this codebase and there is no reason
 * for one.
 *
 * ## It decides nothing
 *
 * It is handed the changes, the health issues and the version numbers, and it
 * asks for the rest:
 *
 * ```
 * publish-goto-intent      take me to this node in the editor
 * publish-preview-intent   show me this — from the start, or at this node
 * ```
 *
 * The page owns the storage, the editor and the preview; a dialog that reached
 * for any of them would be a dialog with an opinion about where it is embedded.
 * The same `-intent` convention as the rest of the editor.
 *
 * ## Why it can be updated while it is open
 *
 * A working copy can change under an open dialog — autosave from another tab,
 * or somebody typing behind it. Reviewing one thing and publishing another is
 * the one failure this whole story exists to prevent, so the overview is
 * recomputed, it says out loud that it changed, and what the caller freezes is
 * the graph the overview was built from (story 125, criterion 7).
 */

export interface PublishRequest {
  /** The number this publication would get — *Publicera version 6*. */
  version: number;
  /** The one it replaces, or `null` when this is the first. */
  previous: number | null;
  /** The rows to show: a comparison, or the guide itself on a first publish. */
  changes: GuideChange[];
  /** True when `changes` is the content overview rather than a diff. */
  outline: boolean;
  issues: GuideHealthIssue[];
  /** Carried across a trip to the canvas and back. */
  note?: string;
  /**
   * Whose changes this publication contains, since the version it replaces
   * (story 130). The host's answer, names only — `me` is the host's too.
   *
   * Optional, like everything that needs a host that knows who is asking. A
   * host without a login leaves it out and the dialog says nothing about
   * people, exactly as before.
   */
  contributors?: Array<{ name: string; me: boolean; at: string }>;
  /**
   * The working note somebody left on the draft — *Inte klar, juristen ska
   * läsa resultattexterna* (story 130).
   *
   * `draftNote` and not `note`: `note` above is the label this publication
   * gets, typed in this dialog. Two different things, and the contract already
   * calls this one `draftNote`.
   */
  draftNote?: { text: string; name: string; at: string };
}

export class PublishDialog extends HTMLElement {
  private readonly root = this.attachShadow({ mode: "open" });
  private resolveAnswer: ((answer: { note: string } | null) => void) | null = null;
  private returnFocusTo: HTMLElement | null = null;
  private uiLocale: string = SOURCE_LOCALE;
  private request: PublishRequest | null = null;

  /** The tool's own language, like every other component's. */
  set editorLocale(value: string) {
    this.uiLocale = value;
  }

  /** What was typed, so a caller can keep it across a trip to the canvas. */
  get note(): string {
    return this.root.querySelector<HTMLInputElement>("[data-input]")?.value ?? "";
  }

  connectedCallback(): void {
    this.root.innerHTML = `
      <style>${styles}</style>
      <dialog aria-labelledby="publish-title">
        <form method="dialog">
          <!-- Three parts, and only the middle one scrolls: what the dialog is
               about stays at the top, and the decision stays at the bottom. On a
               390 px screen with a blocking error and four changes, *Publicera*
               was below the fold — a decision you have to go looking for is a
               decision somebody makes without reading. -->
          <div class="publish-dialog__head">
            <!-- The heading takes focus when the dialog opens (tabindex -1, so it
                 leaves the tab order afterwards). What the dialog is about is the
                 first thing to read, and a screen reader that lands on a Cancel
                 button has been told nothing. -->
            <h2 id="publish-title" data-title tabindex="-1"></h2>
            <p data-subtitle></p>
            <!-- Vilkas ändringar det här är (berättelse 130). Under
                 underrubriken, som en upplysning om vad man håller på att
                 publicera — inte som en varning, för det är inget fel att två
                 har arbetat i samma guide. -->
            <p class="publish-dialog__contributors" data-contributors hidden></p>
          </div>

          <div class="publish-dialog__body" data-body>
            <section class="publish-dialog__errors" data-errors hidden role="alert">
              <h3 data-errors-title></h3>
              <ul data-errors-list></ul>
            </section>

            <!-- Och en mening från en människa, före maskinens varningar: den
                 som skrev *Inte klar* har sagt något som väger tyngre än en
                 hälsoanmärkning, och den ska läsas först. Publicera går ändå
                 — ingen ska kunna säga att de inte visste. -->
            <section class="publish-dialog__draft-note" data-draft-note hidden>
              <h3 data-draft-note-title></h3>
              <p class="publish-dialog__quote" data-draft-note-text></p>
              <p data-draft-note-ask></p>
            </section>

            <section class="publish-dialog__warnings" data-warnings hidden>
              <h3 data-warnings-title></h3>
              <ul data-warnings-list></ul>
            </section>

            <section class="publish-dialog__changes" data-changes role="status">
              <h3 data-changes-title></h3>
              <p class="publish-dialog__updated" data-updated hidden></p>
              <ul data-changes-list></ul>
            </section>

            <label class="publish-dialog__note">
              <span data-note-label></span>
              <input type="text" data-input>
            </label>
          </div>

          <div class="publish-dialog__actions">
            <button type="button" data-action="preview-start"></button>
            <span class="publish-dialog__spacer"></span>
            <button type="button" data-action="cancel"></button>
            <button type="button" class="publish-dialog__confirm" data-action="confirm"></button>
          </div>
        </form>
      </dialog>
    `;

    this.root
      .querySelector<HTMLButtonElement>('[data-action="cancel"]')
      ?.addEventListener("click", () => this.finish(false));

    this.root
      .querySelector<HTMLButtonElement>('[data-action="confirm"]')
      ?.addEventListener("click", () => {
        /*
         * Refused rather than disabled — the same lesson the versions list
         * wrote down: a `disabled` button cannot take focus, so the reason it
         * carries is unreadable to exactly the people who cannot see that it is
         * grey.
         */
        if (this.blocked()) {
          return;
        }

        this.finish(true);
      });

    this.root
      .querySelector<HTMLButtonElement>('[data-action="preview-start"]')
      ?.addEventListener("click", () => this.askPreview(undefined));

    this.getDialog()?.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.finish(false);
    });
  }

  /**
   * Opens, and resolves with the note when published — or `null` on a refusal.
   *
   * An empty note is allowed here, unlike in `prompt-dialog`. There the answer
   * *was* the name of the thing; here the thing already has a number and a
   * date, and what is being asked for is a courtesy to whoever reads the
   * history later.
   */
  ask(request: PublishRequest): Promise<{ note: string } | null> {
    if (this.resolveAnswer) {
      this.finish(false);
    }

    const dialog = this.getDialog();

    if (!dialog) {
      return Promise.resolve(null);
    }

    this.returnFocusTo = this.getDeepActiveElement();
    this.render(request, false);
    dialog.showModal();

    /*
     * The first thing to read, not the first thing to press. Focus goes to the
     * dialog's own heading — the decision starts with what is wrong or what
     * changes, and a cursor blinking in the note field says *type here* to
     * somebody who has not read anything yet.
     *
     * Measured 17/9: removing this line changed nothing in the smoke, and that
     * is an answer rather than a reason to drop it. Chromium's `showModal()`
     * focuses the first focusable area, and a `tabindex="-1"` heading is one —
     * so it already lands here. Other engines follow the newer wording and
     * focus the dialog element itself. The line is what makes the two agree.
     */
    this.root.querySelector<HTMLElement>("[data-title]")?.focus();

    return new Promise<{ note: string } | null>((resolve) => {
      this.resolveAnswer = resolve;
    });
  }

  /**
   * The same dialog, over a working copy that has moved since it opened.
   *
   * Says so, because a list that quietly becomes a different list is worse than
   * no list: the reader has already decided on the old one. The note survives —
   * it is the one thing on screen that is the person's own.
   */
  update(request: PublishRequest): void {
    if (!this.getDialog()?.open) {
      return;
    }

    this.render({ ...request, note: this.note }, true);
  }

  /**
   * *Sedan version 3 har Anna Andersson (08:29) och du ändrat guiden.*
   *
   * The line answers the question the overview above it does not: it says
   * **what** changes, this says **whose** changes they are. A publisher who
   * knows a colleague has been in the draft reads the list differently.
   *
   * Everybody but me first, each with the time of their last save, and *du*
   * last — a list that starts with yourself is a list you have to read past to
   * find the part that matters.
   */
  private renderContributors(request: PublishRequest): void {
    const line = this.root.querySelector<HTMLElement>("[data-contributors]");
    const people = request.contributors ?? [];

    if (!line) {
      return;
    }

    line.hidden = people.length === 0;

    if (people.length === 0) {
      line.textContent = "";
      return;
    }

    const others = people.filter((one) => !one.me);
    const mine = people.some((one) => one.me);
    const first = request.previous === null;

    if (others.length === 0) {
      line.textContent = first
        ? this.text("editor.publish.contributorsOnlyYouFirst")
        : this.text("editor.publish.contributorsOnlyYou", { previous: request.previous ?? 0 });
      return;
    }

    const named = others.map((one) =>
      one.at === "" ? one.name : `${one.name} (${this.clockOf(one.at)})`,
    );
    const all = mine ? [...named, this.text("editor.publish.contributorsYou")] : named;
    /*
     * *A, B och C* — kommatecken mellan alla utom de två sista. Samma regel i
     * båda språken; bindeordet är det enda som byts.
     */
    const who =
      all.length === 1
        ? all[0]
        : `${all.slice(0, -1).join(", ")} ${this.text("editor.publish.contributorsAnd")} ${
            all[all.length - 1]
          }`;

    line.textContent = first
      ? this.text("editor.publish.contributorsFirst", { who })
      : this.text("editor.publish.contributors", { previous: request.previous ?? 0, who });
  }

  /**
   * The working note, drawn as a warning that does not block.
   *
   * Three elements and no interpolation of the note into a sentence: the text
   * is somebody's own words, it belongs in its own element with its own
   * styling, and a sentence built around it would have to quote it. The quote
   * marks are then the stylesheet's job, not the string's.
   *
   * `textContent`, as everywhere here: the note comes from a host's session
   * and is author content (K11).
   */
  private renderDraftNote(request: PublishRequest): void {
    const box = this.root.querySelector<HTMLElement>("[data-draft-note]");
    const note = request.draftNote ?? null;

    if (!box) {
      return;
    }

    box.hidden = note === null || note.text === "";

    if (!note || note.text === "") {
      return;
    }

    this.setText(
      "[data-draft-note-title]",
      this.text("editor.publish.draftNote", {
        name: note.name,
        clock: this.clockOf(note.at),
      }),
    );
    this.setText("[data-draft-note-text]", note.text);
    this.setText("[data-draft-note-ask]", this.text("editor.publish.draftNoteAsk"));
  }

  /** Whether publishing is refused, and why the button says what it says. */
  private blocked(): boolean {
    return (this.request?.issues ?? []).some((issue) => issue.severity === "error");
  }

  private render(request: PublishRequest, updated: boolean): void {
    this.request = request;

    const errors = request.issues.filter((issue) => issue.severity === "error");
    const warnings = request.issues.filter((issue) => issue.severity === "warning");

    this.setText("[data-title]", this.text("editor.publish.title", { version: request.version }));
    this.setText(
      "[data-subtitle]",
      request.previous === null
        ? this.text("editor.publish.subtitleFirst", { version: request.version })
        : this.text("editor.publish.subtitle", {
            version: request.version,
            previous: request.previous,
          }),
    );

    this.renderContributors(request);
    this.renderDraftNote(request);

    /* ── What stops a publication ───────────────────────────────────────── */

    const errorBox = this.root.querySelector<HTMLElement>("[data-errors]");
    const errorList = this.root.querySelector<HTMLElement>("[data-errors-list]");

    if (errorBox && errorList) {
      errorBox.hidden = errors.length === 0;
      this.setText(
        "[data-errors-title]",
        errors.length === 1
          ? this.text("editor.publish.oneError")
          : this.text("editor.publish.errors", { count: errors.length }),
      );
      errorList.replaceChildren(...errors.map((issue) => this.issueRow(issue)));
    }

    const warningBox = this.root.querySelector<HTMLElement>("[data-warnings]");
    const warningList = this.root.querySelector<HTMLElement>("[data-warnings-list]");

    if (warningBox && warningList) {
      warningBox.hidden = warnings.length === 0;
      this.setText(
        "[data-warnings-title]",
        warnings.length === 1
          ? this.text("editor.publish.oneWarning")
          : this.text("editor.publish.warnings", { count: warnings.length }),
      );
      warningList.replaceChildren(...warnings.map((issue) => this.issueRow(issue)));
    }

    /* ── What changes ───────────────────────────────────────────────────── */

    this.setText(
      "[data-changes-title]",
      request.outline ? this.text("editor.publish.outline") : this.text("editor.publish.changes"),
    );

    const list = this.root.querySelector<HTMLElement>("[data-changes-list]");

    if (list) {
      list.replaceChildren(
        ...(request.changes.length === 0
          ? [this.plainRow(this.text("editor.diff.none"))]
          : request.changes.map((change) => this.changeRow(change))),
      );
    }

    const updatedLine = this.root.querySelector<HTMLElement>("[data-updated]");

    if (updatedLine) {
      updatedLine.hidden = !updated;
      updatedLine.textContent = this.text("editor.publish.updated");
    }

    /* ── The note, the preview and the buttons ──────────────────────────── */

    this.setText("[data-note-label]", this.text("editor.publish.note"));

    const input = this.root.querySelector<HTMLInputElement>("[data-input]");

    if (input) {
      input.value = request.note ?? "";
    }

    this.setText("[data-action='preview-start']", this.text("editor.publish.previewStart"));
    this.setText("[data-action='cancel']", t("editor.dialogs.confirmation.cancel", this.uiLocale));

    const confirm = this.root.querySelector<HTMLButtonElement>('[data-action="confirm"]');

    if (confirm) {
      confirm.textContent = this.text("editor.publish.confirm");
      confirm.setAttribute("aria-disabled", errors.length > 0 ? "true" : "false");
      /*
       * The reason travels with the button rather than sitting beside it: a
       * screen reader meets *Publicera, Åtgärda felen först* as one thing, and
       * a sighted reader has the same sentence at the top of the dialog in the
       * alert.
       */
      confirm.setAttribute(
        "aria-label",
        errors.length > 0
          ? `${this.text("editor.publish.confirm")}: ${this.text("editor.publish.blocked")}`
          : this.text("editor.publish.confirm"),
      );
      confirm.title = errors.length > 0 ? this.text("editor.publish.blocked") : "";
    }
  }

  /**
   * One health problem: which node, what is wrong, and a way there.
   *
   * A warning gets the way there too (Johan 24/9). It does not stop the
   * publication, but a row that names a clash in *Spara svaret som* without
   * leading to it hands the editor a search — the same row in the health
   * list has always had its button.
   */
  private issueRow(issue: GuideHealthIssue): HTMLLIElement {
    const row = document.createElement("li");
    const message = document.createElement("span");

    row.dataset.issue = issue.code;
    message.className = "publish-dialog__text";
    /*
     * `textContent`, never `innerHTML`. The message carries the editor's own
     * titles and variable names, and a node called `<img onerror=…>` is a way
     * in — see `docs/RUNTIME-SECURITY.md`, where the health strip learned it.
     */
    message.textContent = issue.message;
    row.appendChild(message);

    if (issue.nodeId) {
      const go = document.createElement("button");

      go.type = "button";
      go.dataset.goto = issue.nodeId;
      go.textContent = this.text("editor.publish.goToNode");
      go.addEventListener("click", () => this.askGoto(issue.nodeId, issue.field));
      row.appendChild(go);
    }

    return row;
  }

  /** One change, and the offer to look at it. */
  private changeRow(change: GuideChange): HTMLLIElement {
    const row = document.createElement("li");
    /*
     * The words in one column, the button in another.
     *
     * They were siblings in a wrapping flex row, so a row with a before-and-
     * after line pushed its button underneath the text while a row without one
     * kept it on the right — the buttons walked about the list. Everything that
     * is text now shares a box, and the button is the row's second child at
     * every width (seen in the 900 px screenshot, 18/9).
     */
    const text = document.createElement("div");
    const message = document.createElement("span");

    row.dataset.kind = change.kind;
    text.className = "publish-dialog__text";
    message.textContent = change.message;
    text.appendChild(message);
    row.appendChild(text);

    /*
     * Before and after where there is one — the story's *expansion*, drawn as
     * the quiet second line it always was rather than as a control that has to
     * be found and pressed.
     */
    if (change.before !== undefined && change.after !== undefined) {
      const detail = document.createElement("span");

      detail.className = "publish-dialog__detail";
      detail.textContent = `${change.before} → ${change.after}`;
      text.appendChild(detail);
    }

    if (change.nodeId) {
      const preview = document.createElement("button");

      preview.type = "button";
      preview.dataset.preview = change.nodeId;
      preview.textContent = this.text("editor.publish.previewNode");
      preview.setAttribute("aria-label", this.text("editor.publish.previewNodeNamed", { title: change.title }));
      preview.addEventListener("click", () => this.askPreview(change.nodeId));
      row.appendChild(preview);
    }

    return row;
  }

  private plainRow(text: string): HTMLLIElement {
    const row = document.createElement("li");

    row.dataset.empty = "true";
    row.textContent = text;

    return row;
  }

  /**
   * *Gå till frågan* closes the dialog — the node is behind it, and a dialog
   * over the thing it just pointed at is the same as not going anywhere. The
   * note goes with the intent so the caller can hand it back.
   */
  private askGoto(nodeId: string, field?: string): void {
    const note = this.note;

    this.finish(false);
    this.dispatchEvent(
      new CustomEvent("publish-goto-intent", {
        // `field` when the check named one: the host hands it to
        // `revealNode`, which puts the cursor in it and unfolds Avancerat if
        // that is where it lives (Johans beslut 23/9 2026).
        detail: { nodeId, note, field },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Previewing leaves the dialog open: it is a look, not a decision, and the
   * preview is its own modal on top.
   *
   * The line about unanswered questions belongs *in* that preview, and the
   * caller passes it there. Written here as well it would sit behind the
   * dialog it describes — visible to nobody, and a second copy of a sentence to
   * keep in step.
   */
  private askPreview(nodeId: string | undefined): void {
    this.dispatchEvent(
      new CustomEvent("publish-preview-intent", {
        detail: { nodeId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private finish(confirmed: boolean): void {
    const resolve = this.resolveAnswer;
    const returnFocusTo = this.returnFocusTo;
    const note = this.note.trim();

    this.resolveAnswer = null;
    this.returnFocusTo = null;

    if (this.getDialog()?.open) {
      this.getDialog()?.close();
    }

    resolve?.(confirmed ? { note } : null);
    returnFocusTo?.focus();
  }

  /**
   * *08:29* ur värdens ISO-tid, i **läsarens** klocka och editorns språk.
   *
   * Värden skickar tidpunkten och aldrig ett klockslag, av samma skäl som
   * versionslistan lärde sig 17/9: ett klockslag myntat hos värden myntas i
   * värdens tidszon, och raden bredvid ritas i läsarens. En tid som visas på
   * två ställen måste räknas ut på ett.
   *
   * Bara timme och minut: frågan är *hur färskt är det här*, och ett datum i
   * en uppräkning av namn är brus. En sparning från i förrgår ser likadan ut
   * som en från nyss — men då är arbetskopian så gammal att raden inte är det
   * som säger det.
   */
  private clockOf(iso: string): string {
    const when = new Date(iso);

    return Number.isNaN(when.getTime())
      ? ""
      : new Intl.DateTimeFormat(this.uiLocale, { hour: "2-digit", minute: "2-digit" }).format(when);
  }

  private text(key: string, params?: Record<string, string | number>): string {
    const resolved = t(key, this.uiLocale);

    return params ? interpolate(resolved, params) : resolved;
  }

  private setText(selector: string, value: string): void {
    const element = this.root.querySelector<HTMLElement>(selector);

    if (element) {
      element.textContent = value;
    }
  }

  private getDialog(): HTMLDialogElement | null {
    return this.root.querySelector<HTMLDialogElement>("dialog");
  }

  private getDeepActiveElement(): HTMLElement | null {
    let activeElement: Element | null = document.activeElement;

    while (activeElement instanceof HTMLElement && activeElement.shadowRoot?.activeElement) {
      activeElement = activeElement.shadowRoot.activeElement;
    }

    return activeElement instanceof HTMLElement ? activeElement : null;
  }
}

if (!customElements.get("publish-dialog")) {
  customElements.define("publish-dialog", PublishDialog);
}
