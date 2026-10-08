import styles from "./confirmation-dialog.scss?inline";

import { SOURCE_LOCALE } from "../../../viewer/core/localized-text";
import { interpolate, t } from "../../localization/editor-ui-strings";

/**
 * En mening där en del väger tyngre — text, framhävd bit, text.
 *
 * En sträng räcker för nästan varje fråga. Den här formen finns för den enda
 * som har ett **värde** mitt i sig: *Det som skrivits efter 01:57 går
 * förlorat* (Johan 19/9: *"Den tredje tiden bör vara fetmarkerad i alla
 * fall"*). Tiden är samma uppgift som i faktaraderna ovanför och ska väga
 * lika mycket; en mening där den ligger i löptext läses förbi.
 *
 * Delar och ingen HTML-sträng: innehållet kommer ur en värds session, och en
 * sträng som blir markup är en sträng någon en dag kan styra (K11).
 */
export type ConfirmationText = string | Array<string | { strong: string }>;

export interface ConfirmationOptions {
  title: string;
  message: ConfirmationText;
  /**
   * Fakta som rader, mellan rubriken och meningen — etikett och värde.
   *
   * Johan 19/9, om Ta över-dialogen i telefonen: *"det måste kunna vara lite
   * tydligare."* Rubriken var ett påstående och allt annat — två tider, vad som
   * händer den andre, vad som kan gå förlorat — stod i ett stycke på fem rader,
   * så den som läste fick leta efter frågan själv.
   *
   * Formen är därför tre delar som gör var sitt jobb: rubriken är **frågan**,
   * de här raderna är **fakta**, och meddelandet är **konsekvensen i en
   * mening**. En `<dl>` och inte en tabell eller prosa: det är par av etikett
   * och värde, och det är precis vad `dt`/`dd` betyder — en skärmläsare läser
   * *Sparade senast, 00:29* i stället för en mening man måste ta sig igenom.
   *
   * Valfritt, och utelämnat ritas ingenting: varje annan fråga i verktyget har
   * inga fakta att visa, och en tom lista hade lagt ett tomrum i dem alla.
   */
  facts?: Array<{ label: string; value: string }>;
  /**
   * En mening från en människa, ovanför fakta (berättelse 130).
   *
   * Johan 19/9, om att ta över en guide någon skrivit en anteckning på: *"om
   * någon skriver så lär man inte bara ta över"*. Tre klockslag från ett
   * system säger vad som hänt; *Inte klar — juristen ska läsa
   * resultattexterna* säger varför det spelar roll, och det är det som gör
   * valet begripligt.
   *
   * Överst, för den läses först och färgar allt under den. Citatet står i sin
   * egen form — kursivt, med en linje i kanten — för orden är någon annans och
   * ska inte läsas som rutans egna.
   *
   * Valfritt som fakta: utan citat ritas ingenting.
   */
  quote?: { title: string; text: string };
  confirmLabel: string;
  cancelLabel?: string;
  /**
   * How the affirmative is dressed.
   *
   * `danger` — filled red — only where the act risks a significant loss of
   * work that cannot be had back, judged per act and not by its verb (Astra
   * 30/9, GRAFISK-PROFIL *Destruktiv huvudhandling*): discarding a draft,
   * replacing the guide, removing a version, restoring over unsaved work.
   * Removing the start node is a removal but the editor can undo it, so it is
   * `normal`.
   *
   * `normal` is the default. It was `danger` until 30/9, and a caller that
   * said nothing got the red — *Gör till startnod* among them. Not everything
   * worth asking about destroys something: publishing a version changes what
   * a visitor sees, which is worth a question, but a red button on it would
   * call it a hazard, and a tool that shouts at ordinary acts teaches people
   * to click through everything it says. Every caller says its tone anyway
   * (`confirmation-dialog-callers.test.ts`), so the choice stands where the
   * act is.
   */
  tone?: "danger" | "normal";
  /**
   * Bara bekräfta-knappen — en ruta som meddelar i stället för att fråga.
   *
   * Sätts aldrig direkt; `acknowledge()` är dörren, och den finns för att en
   * anropare som bara vill säga något inte ska behöva låtsas ställa en fråga
   * och sedan kasta svaret.
   *
   * **Varför inte en egen komponent** (129:s skärning, punkt 2, mätt 19/9):
   * den hade varit samma `<dialog>`, samma skal, samma fokusregler och samma
   * K11-försiktighet med namn ur en värds session — allt utom en knapp. Det
   * som skiljer är att avbryt-knappen inte ritas och att fokus går till den
   * enda knapp som finns. Två komponenter som skiljer sig på det är två
   * komponenter som glider isär på allt det andra.
   *
   * Knappen göms med `hidden` och inte med `display`, och den tål det: skalets
   * `button`-regel (`_dialog-shell.scss`) sätter ingen `display`, så
   * användaragentens `[hidden]` vinner. Mätt som ruta och inte som flagga
   * (PRAXIS 36) i rökprovet.
   */
  sole?: boolean;
}

/** Vad en ruta som bara meddelar behöver — se `acknowledge()`. */
export interface AcknowledgeOptions {
  title: string;
  message: ConfirmationText;
  /** Ordet på den enda knappen. */
  okLabel: string;
  quote?: { title: string; text: string };
  facts?: Array<{ label: string; value: string }>;
}

export class ConfirmationDialog extends HTMLElement {
  private readonly root = this.attachShadow({ mode: "open" });
  private resolveConfirmation: ((confirmed: boolean) => void) | null = null;
  private returnFocusTo: HTMLElement | null = null;
  private uiLocale: string = SOURCE_LOCALE;

  /** Lokaliserad chrome-text i editorns UI-språk. */
  private text(key: string, params?: Record<string, string | number>): string {
    const resolved = t(key, this.uiLocale);
    return params ? interpolate(resolved, params) : resolved;
  }

  set editorLocale(value: string) {
    if (value === this.uiLocale) return;
    this.uiLocale = value;
    // The chrome is only placeholders, always overwritten in confirm(); the
    // current label is set from there, so no re-render is needed here.
  }

  connectedCallback(): void {
    this.root.innerHTML = `
      <style>${styles}</style>
      <dialog aria-labelledby="confirmation-title" aria-describedby="confirmation-message">
        <form method="dialog">
          <h2 id="confirmation-title" data-title></h2>
          <figure class="confirmation-dialog__quote" data-quote hidden>
            <figcaption data-quote-title></figcaption>
            <blockquote data-quote-text></blockquote>
          </figure>
          <dl class="confirmation-dialog__facts" data-facts hidden></dl>
          <p id="confirmation-message" data-message></p>
          <div class="confirmation-dialog__actions">
            <button type="button" data-action="cancel">${this.text("editor.dialogs.confirmation.cancel")}</button>
            <button type="button" class="confirmation-dialog__confirm" data-action="confirm">
              ${this.text("editor.dialogs.confirmation.confirm")}
            </button>
          </div>
        </form>
      </dialog>
    `;

    this.root
      .querySelector<HTMLButtonElement>('[data-action="cancel"]')
      ?.addEventListener("click", () => this.finish(false));

    this.root
      .querySelector<HTMLButtonElement>('[data-action="confirm"]')
      ?.addEventListener("click", () => this.finish(true));

    this.getDialog()?.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.finish(false);
    });

    }

  /**
   * En ruta som meddelar: en mening, en knapp.
   *
   * Berättelse 129:s skärning (Johan 19/9): den vars lås togs över mötte en rad
   * med två val mitt i ett avbrott hen inte bett om. Det som behövdes var ett
   * besked — *Anna Andersson tog över guiden* — och en väg vidare. Ett val
   * förutsätter att man förstått vad som hänt; ett besked är det som gör att
   * man förstår.
   *
   * Löftet infrias när knappen trycks **eller** när Esc stänger rutan: det
   * finns inget val att göra, så båda vägarna ut är samma väg.
   */
  async acknowledge(options: AcknowledgeOptions): Promise<void> {
    await this.confirm({
      title: options.title,
      message: options.message,
      quote: options.quote,
      facts: options.facts,
      confirmLabel: options.okLabel,
      tone: "normal",
      sole: true,
    });
  }

  confirm(options: ConfirmationOptions): Promise<boolean> {
    if (this.resolveConfirmation) {
      this.finish(false);
    }

    const dialog = this.getDialog();
    const title = this.root.querySelector<HTMLElement>("[data-title]");
    const message = this.root.querySelector<HTMLElement>("[data-message]");
    const cancelButton = this.root.querySelector<HTMLButtonElement>(
      '[data-action="cancel"]'
    );
    const confirmButton = this.root.querySelector<HTMLButtonElement>(
      '[data-action="confirm"]'
    );

    if (!dialog || !title || !message || !cancelButton || !confirmButton) {
      return Promise.resolve(false);
    }

    title.textContent = options.title;
    this.renderMessage(message, options.message);
    this.renderQuote(options.quote ?? null);
    this.renderFacts(options.facts ?? []);
    cancelButton.textContent =
      options.cancelLabel ?? this.text("editor.dialogs.confirmation.cancel");
    /*
     * En ruta som meddelar har ingen väg som inte är den enda knappen. Se
     * `sole` i `ConfirmationOptions` för varför den göms i stället för att
     * ritas avstängd: en avstängd knapp är en fråga om varför som ingen svarar
     * på.
     */
    cancelButton.hidden = options.sole === true;
    confirmButton.textContent = options.confirmLabel;
    confirmButton.dataset.tone = options.tone ?? "normal";
    this.returnFocusTo = this.getDeepActiveElement();

    /*
     * Ingen fråga från ett element som inte står i dokumentet.
     *
     * Det var det som fällde CI: ett test river ned DOM:en i sitt `afterEach`,
     * ett pågående importflöde återupptas efteråt och öppnar en dialog som inte
     * längre finns någonstans. `showModal()` kastar — "The element is not in a
     * Document" — felet slipper ut ur filväljarens `change`, och en körning där
     * varenda test passerar avslutar ändå med 1.
     *
     * `false` och inte ett kast: den som frågade får samma svar som om någon
     * tryckt Avbryt, vilket är sanningen — frågan kunde inte ställas, alltså
     * blev den inte besvarad med ja.
     */
    if (!this.isConnected) {
      return Promise.resolve(false);
    }

    /*
     * Stängd först, om den mot förmodan står öppen.
     *
     * `showModal()` kastar på en dialog som redan är öppen — och i CI slapp det
     * felet ut ur importflödet och fällde hela körningen trots att varenda test
     * passerade: `ConfirmationDialog.confirm` → `handleGraphImportRequest` →
     * filväljarens `change`, utan någon som fångade.
     *
     * Reproducerat genom att sätta `open` utan att gå via `showModal`, vilket är
     * det tillstånd meddelandet klagar på ("already open as a non-modal dialog").
     * Vad som försätter den där i CI vet jag inte — men en fråga som inte går
     * att ställa för att den förra inte städats undan är fel oavsett orsak.
     *
     * Den väntande frågan besvaras med `false` innan den nya ställs. Att bara
     * stänga hade lämnat ett löfte som aldrig infrias, alltså en anropare som
     * väntar för evigt på ett svar ingen kommer ge.
     */
    if (dialog.open) {
      this.finish(false);
      dialog.close();
    }

    dialog.showModal();
    /*
     * Fokus på *Avbryt*, för den här dialogen finns för det som inte går att
     * ta tillbaka — utom när det inte finns något att avbryta: då är den enda
     * knappen också den enda platsen fokus kan stå.
     */
    (options.sole === true ? confirmButton : cancelButton).focus();

    return new Promise<boolean>((resolve) => {
      this.resolveConfirmation = resolve;
    });
  }

  /** Meningen, som text eller som text–framhävt–text. Se `ConfirmationText`. */
  private renderMessage(target: HTMLElement, text: ConfirmationText): void {
    if (typeof text === "string") {
      target.textContent = text;
      return;
    }

    target.replaceChildren(
      ...text.map((part) => {
        if (typeof part === "string") {
          return document.createTextNode(part);
        }

        const strong = document.createElement("strong");

        strong.textContent = part.strong;

        return strong;
      }),
    );
  }

  /**
   * Raderna, byggda som element och inte som HTML.
   *
   * Värdena kommer från en värd — ett namn ur en session, en tid ur ett svar —
   * och en sträng som blir markup är en sträng någon en dag kan styra
   * (K11). `textContent` är hela skyddet, och det kostar ingenting här.
   */
  /**
   * Citatet, byggt som element och aldrig som markup.
   *
   * Orden kommer ur en värds session — någon skrev dem i ett fält — och en
   * sträng som blir markup är en sträng någon en dag kan styra (K11). Samma
   * regel som fakta nedan, och av samma skäl.
   *
   * `figure`/`blockquote` och inte två `p`: det ÄR ett citat med en
   * källhänvisning, och en skärmläsare som säger *citat* säger något sant om
   * vems ord det är.
   */
  private renderQuote(quote: { title: string; text: string } | null): void {
    const box = this.root.querySelector<HTMLElement>("[data-quote]");
    const title = this.root.querySelector<HTMLElement>("[data-quote-title]");
    const text = this.root.querySelector<HTMLElement>("[data-quote-text]");

    if (!box || !title || !text) {
      return;
    }

    box.hidden = quote === null || quote.text === "";

    if (!quote || quote.text === "") {
      title.textContent = "";
      text.textContent = "";
      return;
    }

    title.textContent = quote.title;
    text.textContent = quote.text;
  }

  private renderFacts(facts: Array<{ label: string; value: string }>): void {
    const list = this.root.querySelector<HTMLElement>("[data-facts]");

    if (!list) {
      return;
    }

    list.replaceChildren();
    list.hidden = facts.length === 0;

    for (const fact of facts) {
      const label = document.createElement("dt");
      const value = document.createElement("dd");

      label.textContent = fact.label;
      value.textContent = fact.value;
      list.append(label, value);
    }
  }

  private finish(confirmed: boolean): void {
    const resolve = this.resolveConfirmation;
    const returnFocusTo = this.returnFocusTo;

    this.resolveConfirmation = null;
    this.returnFocusTo = null;

    if (this.getDialog()?.open) {
      this.getDialog()?.close();
    }

    resolve?.(confirmed);
    returnFocusTo?.focus();
  }

  private getDialog(): HTMLDialogElement | null {
    return this.root.querySelector<HTMLDialogElement>("dialog");
  }

  private getDeepActiveElement(): HTMLElement | null {
    let activeElement: Element | null = document.activeElement;

    while (
      activeElement instanceof HTMLElement &&
      activeElement.shadowRoot?.activeElement
    ) {
      activeElement = activeElement.shadowRoot.activeElement;
    }

    return activeElement instanceof HTMLElement ? activeElement : null;
  }
}

if (!customElements.get("confirmation-dialog")) {
  customElements.define("confirmation-dialog", ConfirmationDialog);
}

declare global {
  interface HTMLElementTagNameMap {
    "confirmation-dialog": ConfirmationDialog;
  }
}
