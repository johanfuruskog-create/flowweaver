import styles from "./merge-dialog.scss?inline";

import { SOURCE_LOCALE } from "../../../viewer/core/localized-text";
import { interpolate, t } from "../../localization/editor-ui-strings";
import { possessive } from "../../localization/possessive";

import type {
  MergeLine,
  MergePlan,
  MergeRow,
  MergeSide,
} from "../../../viewer/services/guide-merge-service";

/**
 * `<merge-dialog>` — två har ändrat guiden, och nästan ingenting krockar
 * (berättelse 131).
 *
 * ## Varför den ser ut som granskningen och inte som krockrutan
 *
 * Krockrutan (129) ställer **en** fråga med tre svar. Den här ställer lika
 * många frågor som det finns rader där båda rört samma sak — oftast noll — och
 * visar dessutom allt som följer med utan att någon behöver säga något. Det är
 * granskningens form: en lista man läser, och ett beslut längst ner.
 *
 * Två spalter och inte en sammanslagen lista: frågan raden ska svara på är
 * *vems är vad?*, och en lista där hennes och mina meningar varvas kräver att
 * man läser ett namn före varje rad.
 *
 * ## Den bestämmer ingenting
 *
 * Den får en plan och svarar med valen. Sammanslagningen räknas av
 * `GuideMergeService`, frysningen görs av värden, och skrivningen av sidan —
 * samma delning som `publish-dialog`. Ett `merge-preview-intent` är allt den
 * ber om:
 *
 * ```
 * merge-preview-intent   visa mig resultatet, från start
 * ```
 *
 * ## Varför Bekräfta vägrar i stället för att vara avstängd
 *
 * Samma läxa som versionslistan och granskningen skrev ned: en `disabled`
 * knapp kan inte ta fokus, så skälet den bär är oläsbart för precis dem som
 * inte ser att den är grå. Den är `aria-disabled`, den går att nå, och raden
 * bredvid säger hur många val som återstår.
 *
 * Dräkten är `styles/_dialog-shell.scss`, som varje annan dialog i verktyget.
 */

export interface MergeRequest {
  plan: MergePlan;
  /** Den andres namn. Tom hos en värd som inte vet vem — då namnges ingen. */
  name: string;
  /** Vägar som skulle tas bort med de val som gjorts. Sidan räknar om det. */
  dropped?: number;
}

export class MergeDialog extends HTMLElement {
  private readonly root = this.attachShadow({ mode: "open" });
  private resolveAnswer: ((choices: Record<string, MergeSide> | null) => void) | null = null;
  private returnFocusTo: HTMLElement | null = null;
  private uiLocale: string = SOURCE_LOCALE;
  private held: MergeRequest | null = null;
  private choices: Record<string, MergeSide> = {};

  set editorLocale(value: string) {
    this.uiLocale = value;
  }

  private text(key: string, params?: Record<string, string | number>): string {
    const resolved = t(key, this.uiLocale);

    return params ? interpolate(resolved, params) : resolved;
  }

  connectedCallback(): void {
    this.root.innerHTML = `
      <style>${styles}</style>
      <dialog aria-labelledby="merge-title">
        <form method="dialog">
          <!-- Tre delar, och bara mitten rullar: vad rutan handlar om står
               kvar överst, och beslutet står kvar nederst. Samma form som
               granskningen, av samma skäl — på 390 px med sex rader låg
               *Bekräfta* annars under vikten. -->
          <div class="merge-dialog__head">
            <h2 id="merge-title" data-title tabindex="-1"></h2>
            <!-- Hur mycket som kräver ett svar. En status-region, för den
                 ändras när man väljer: den som klickat den sista knappen ska
                 få höra att allt är valt, inte upptäcka det genom att trycka
                 på Bekräfta. -->
            <p class="merge-dialog__count" data-count role="status"></p>
          </div>

          <div class="merge-dialog__body">
            <section data-overlaps hidden>
              <h3 data-overlaps-title></h3>
              <ul class="merge-dialog__rows" data-overlaps-list></ul>
            </section>

            <section data-rest hidden>
              <h3 data-rest-title></h3>
              <ul class="merge-dialog__rows" data-rest-list></ul>
            </section>

            <p class="merge-dialog__dropped" data-dropped hidden></p>
          </div>

          <div class="merge-dialog__actions">
            <button type="button" data-action="preview-start"></button>
            <span class="merge-dialog__spacer"></span>
            <button type="button" data-action="cancel"></button>
            <button type="button" class="merge-dialog__confirm" data-action="confirm"></button>
          </div>
        </form>
      </dialog>
    `;

    this.root
      .querySelector<HTMLButtonElement>('[data-action="cancel"]')
      ?.addEventListener("click", () => this.finish(null));

    this.root
      .querySelector<HTMLButtonElement>('[data-action="confirm"]')
      ?.addEventListener("click", () => {
        if (this.remaining() > 0) {
          /*
           * Vägran och inte avstängning — men aldrig tyst. Fokus flyttas till
           * första raden som saknar ett svar, vilket är det enda svaret på
           * frågan *varför hände ingenting?* som också visar vad man ska göra.
           */
          this.focusFirstUnanswered();
          return;
        }

        this.finish({ ...this.choices });
      });

    this.root
      .querySelector<HTMLButtonElement>('[data-action="preview-start"]')
      ?.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("merge-preview-intent", {
            bubbles: true,
            composed: true,
            detail: { choices: { ...this.choices } },
          }),
        );
      });

    this.getDialog()?.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.finish(null);
    });
  }

  /** Öppnar, och svarar med valen — eller `null` när någon avbröt. */
  ask(request: MergeRequest): Promise<Record<string, MergeSide> | null> {
    if (this.resolveAnswer) {
      this.finish(null);
    }

    const dialog = this.getDialog();

    if (!dialog || !this.isConnected) {
      return Promise.resolve(null);
    }

    this.held = request;
    this.choices = {};
    this.returnFocusTo = this.getDeepActiveElement();
    this.render();

    if (dialog.open) {
      dialog.close();
    }

    dialog.showModal();
    /* Det första att läsa, inte det första att trycka på — som granskningen. */
    this.root.querySelector<HTMLElement>("[data-title]")?.focus();

    return new Promise((resolve) => {
      this.resolveAnswer = resolve;
    });
  }

  /** Vad som skulle städas bort med dagens val — sidan räknar, rutan säger. */
  set dropped(count: number) {
    if (this.held) {
      this.held = { ...this.held, dropped: count };
      this.renderDropped();
    }
  }

  private render(): void {
    const request = this.held;

    if (!request) {
      return;
    }

    this.setText("[data-title]", this.text("editor.merge.title"));
    this.setText("[data-overlaps-title]", this.text("editor.merge.overlapsTitle"));
    this.setText("[data-rest-title]", this.text("editor.merge.restTitle"));
    this.setText("[data-action='preview-start']", this.text("editor.merge.previewStart"));
    this.setText("[data-action='cancel']", this.text("editor.merge.cancel"));
    this.setText("[data-action='confirm']", this.text("editor.merge.confirm"));

    const overlaps = request.plan.rows.filter((row) => row.overlap);
    const rest = request.plan.rows.filter((row) => !row.overlap);

    this.fill("[data-overlaps]", "[data-overlaps-list]", overlaps, true);
    this.fill("[data-rest]", "[data-rest-list]", rest, false);
    this.renderCount();
    this.renderDropped();
  }

  /**
   * En sektion och dess rader.
   *
   * Element och aldrig `innerHTML`: varje mening bär en rubrik någon skrivit i
   * ett fält och ett namn ur en värds session, och en sträng som blir markup
   * är en sträng någon en dag kan styra (K11).
   */
  private fill(sectionSelector: string, listSelector: string, rows: MergeRow[], pick: boolean): void {
    const section = this.root.querySelector<HTMLElement>(sectionSelector);
    const list = this.root.querySelector<HTMLElement>(listSelector);

    if (!section || !list) {
      return;
    }

    section.hidden = rows.length === 0;
    list.replaceChildren(...rows.map((row) => this.rowElement(row, pick)));
  }

  private rowElement(row: MergeRow, pick: boolean): HTMLElement {
    const item = document.createElement("li");

    item.className = "merge-dialog__row";
    item.dataset.row = row.id;

    /*
     * Markeringen hör till **kravet på ett svar**, inte till raden.
     *
     * Den satt på `:not([data-resolved])` till 19/9, vilket gjorde varenda rad
     * under *Följer med* gul — en lista där allt larmar säger ingenting om vad
     * som behöver göras. Sett i bild, inte i sviten: testet frågade om
     * knapparna och inte om ytan.
     */
    if (row.overlap) {
      item.dataset.overlap = "true";
    }

    if (row.resolved) {
      item.dataset.resolved = "true";
    }

    const title = document.createElement("p");

    title.className = "merge-dialog__row-title";
    title.textContent = this.rowHeading(row);

    const columns = document.createElement("div");

    columns.className = "merge-dialog__columns";
    columns.append(
      this.column(
        row.theirs,
        this.held?.name
          ? this.text("editor.merge.theirs", { name: this.held.name })
          : this.text("editor.merge.theirsUnknown"),
      ),
      this.column(row.mine, this.text("editor.merge.mine")),
    );

    item.append(title, columns);

    if (row.resolved) {
      const note = document.createElement("p");

      note.className = "merge-dialog__resolved";
      note.textContent = this.text("editor.merge.same");
      item.append(note);
    }

    if (pick) {
      item.append(this.picker(row));
    }

    return item;
  }

  /**
   * Radens rubrik: frågans namn en gång, och vad som hände en gång.
   *
   * Puts efter Johans bild 20/9: namnet stod tre gånger — i rubriken, i
   * *"Namn: rubriken har ändrats."* under vardera spalt, och i den nya texten
   * (som för en rubrikändring ÄR namnet). Beskrivningen flyttar hit, en gång;
   * `column()` visar sedan bara den nya texten, aldrig meningen den kom ur.
   *
   * Beskrivningen är den fasta halvan av `message` — alltid *"{namn}: …"*
   * (`guide-diff-service.ts`). Hittas inget kolon att klippa vid (bör inte
   * hända, men meningarna är text någon kan skriva om) står rubriken kvar
   * som förut, utan tillägg — hellre kort än en gissning.
   */
  private rowHeading(row: MergeRow): string {
    const described = [...row.theirs, ...row.mine].find(
      (line) => line.after !== undefined && line.after !== "",
    );

    if (!described) {
      return row.title;
    }

    const cut = described.message.indexOf(": ");

    if (cut === -1) {
      return row.title;
    }

    const description = described.message.slice(cut + 2);

    return description === "" ? row.title : `${row.title} · ${description}`;
  }

  private column(lines: MergeLine[], heading: string): HTMLElement {
    const column = document.createElement("div");
    const label = document.createElement("p");

    column.className = "merge-dialog__column";
    label.className = "merge-dialog__column-label";
    label.textContent = heading;
    column.append(label);

    if (lines.length === 0) {
      const nothing = document.createElement("p");

      /*
       * En tom spalt säger **ingenting** med ett tecken, inte med tomhet: två
       * tomma rutor bredvid varandra läser som att listan är trasig.
       */
      nothing.className = "merge-dialog__nothing";
      nothing.textContent = this.text("editor.merge.nothing");
      column.append(nothing);

      return column;
    }

    for (const line of lines) {
      /*
       * Har ändringen ett nytt värde visas **bara** det — beskrivningen
       * ("rubriken har ändrats") står redan en gång i radens rubrik
       * (`rowHeading`), och en mening som upprepar namnet en tredje gång är
       * inget den som väljer mellan *Annas* och *Min* behöver läsa.
       *
       * Johan mätte 20/9: båda spalterna sa *rubriken har ändrats* och
       * skillnaden var ett enda ord inbakat i en lång mening. Valet gjordes i
       * blindo. Texten under varandra i två spalter är det enda som gör
       * skillnaden synlig.
       *
       * **Hela texten står i DOM:en och klipps av stilmallen.** En sträng
       * klippt här hade varit klippt också för den som lyssnar, och en andra
       * kopia i `title` hade varit en andra sanning att hålla i takt. `title`
       * sätts ändå, för musen — men den är samma sträng som står i elementet,
       * inte en längre variant av den.
       */
      if (line.after !== undefined && line.after !== "") {
        const value = document.createElement("p");

        value.className = "merge-dialog__value";
        value.textContent = line.after;
        value.title = line.after;
        column.append(value);
        continue;
      }

      /* Ingen ny text att ställa fram — meningen är allt raden vet, och den
         får stå kvar hel (t.ex. *steget har tagits bort*). */
      const paragraph = document.createElement("p");

      paragraph.textContent = line.message;
      column.append(paragraph);
    }

    return column;
  }

  /**
   * *Annas* / *Min*, som två knappar med ett gemensamt tillstånd.
   *
   * `role="radiogroup"` med `aria-checked` och inte två vanliga knappar: det
   * ÄR ett val mellan två, och en skärmläsare som säger *vald* om den ena har
   * sagt hela raden. Ingen är förvald — berättelsen är uttrycklig, och en
   * förvald sida är en sida som blir vald av den som inte läste.
   */
  private picker(row: MergeRow): HTMLElement {
    const group = document.createElement("div");

    group.className = "merge-dialog__pick";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", row.title);

    const sides: Array<[MergeSide, string]> = [
      [
        "theirs",
        this.held?.name
          ? possessive(this.held.name, this.uiLocale)
          : this.text("editor.merge.pickTheirsUnknown"),
      ],
      ["mine", this.text("editor.merge.pickMine")],
    ];

    for (const [side, label] of sides) {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "merge-dialog__pick-button";
      button.dataset.pick = side;
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", "false");
      button.textContent = label;
      button.addEventListener("click", () => this.choose(row.id, side));
      group.append(button);
    }

    return group;
  }

  private choose(rowId: string, side: MergeSide): void {
    this.choices[rowId] = side;

    const item = this.root.querySelector<HTMLElement>(`[data-row="${CSS.escape(rowId)}"]`);

    for (const button of item?.querySelectorAll<HTMLButtonElement>("[data-pick]") ?? []) {
      button.setAttribute("aria-checked", button.dataset.pick === side ? "true" : "false");
    }

    if (item) {
      item.dataset.answered = "true";
    }

    this.renderCount();
    this.dispatchEvent(
      new CustomEvent("merge-choice-intent", {
        bubbles: true,
        composed: true,
        detail: { choices: { ...this.choices } },
      }),
    );
  }

  /**
   * Hur många val som återstår — i **raden**, och på knappen som `aria-disabled`.
   *
   * Båda, för de gör olika saker: attributet hindrar, meningen förklarar. En
   * knapp som bara hindrar är en knapp man trycker på fem gånger.
   */
  private renderCount(): void {
    const left = this.remaining();
    const confirm = this.root.querySelector<HTMLButtonElement>('[data-action="confirm"]');
    const overlaps = this.held?.plan.overlaps.length ?? 0;

    this.setText(
      "[data-count]",
      overlaps === 0
        ? this.text("editor.merge.nothingToChoose")
        : left === 0
          ? this.text("editor.merge.ready")
          : left === 1
            ? this.text("editor.merge.remainingOne")
            : this.text("editor.merge.remaining", { count: left }),
    );

    confirm?.setAttribute("aria-disabled", left > 0 ? "true" : "false");
  }

  private renderDropped(): void {
    const dropped = this.held?.dropped ?? 0;
    const line = this.root.querySelector<HTMLElement>("[data-dropped]");

    if (!line) {
      return;
    }

    line.hidden = dropped === 0;
    line.textContent =
      dropped === 0
        ? ""
        : dropped === 1
          ? this.text("editor.merge.droppedOne")
          : this.text("editor.merge.dropped", { count: dropped });
  }

  private remaining(): number {
    return (this.held?.plan.overlaps ?? []).filter((row) => !this.choices[row.id]).length;
  }

  private focusFirstUnanswered(): void {
    const row = (this.held?.plan.overlaps ?? []).find((one) => !this.choices[one.id]);

    if (!row) {
      return;
    }

    this.root
      .querySelector<HTMLElement>(`[data-row="${CSS.escape(row.id)}"] [data-pick]`)
      ?.focus();
  }

  private setText(selector: string, value: string): void {
    const element = this.root.querySelector<HTMLElement>(selector);

    if (element) {
      element.textContent = value;
    }
  }

  private finish(choices: Record<string, MergeSide> | null): void {
    const resolve = this.resolveAnswer;
    const returnFocusTo = this.returnFocusTo;

    this.resolveAnswer = null;
    this.returnFocusTo = null;

    if (this.getDialog()?.open) {
      this.getDialog()?.close();
    }

    resolve?.(choices);
    returnFocusTo?.focus();
  }

  private getDialog(): HTMLDialogElement | null {
    return this.root.querySelector<HTMLDialogElement>("dialog");
  }

  private getDeepActiveElement(): HTMLElement | null {
    let active: Element | null = document.activeElement;

    while (active instanceof HTMLElement && active.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }

    return active instanceof HTMLElement ? active : null;
  }
}

if (!customElements.get("merge-dialog")) {
  customElements.define("merge-dialog", MergeDialog);
}

declare global {
  interface HTMLElementTagNameMap {
    "merge-dialog": MergeDialog;
  }
}
