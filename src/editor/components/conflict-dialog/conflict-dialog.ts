import styles from "./conflict-dialog.scss?inline";

import { SOURCE_LOCALE } from "../../../viewer/core/localized-text";
import { interpolate, t } from "../../localization/editor-ui-strings";
import { possessive } from "../../localization/possessive";

/**
 * `<conflict-dialog>` — två har ändrat guiden, och något måste väljas
 * (berättelse 129).
 *
 * ## Varför det blev en ruta och inte raden det var
 *
 * Berättelse 127 sa det i en rad: *Nisse Hult sparade 22:51 — ladda om för att
 * se ändringarna.* Raden var sann och hjälpte inte. Den sa inte att en
 * omladdning kastar det man själv skrivit, den gick att missa i en editor full
 * av annat, och den lämnade valet åt den som redan var avbruten.
 *
 * En modal ruta är rätt form för precis det: ett beslut som inte kan skjutas
 * upp, med konsekvensen av varje väg skriven under sin knapp.
 *
 * ## Varför Slå ihop ändringar är det fyllda valet
 *
 * Johan 18/9: *"Kommer det bli tydligt?"* Tre val med konsekvenser är vad en
 * ovan användare fryser inför. Så ett av dem är fyllt och tar fokus, och det
 * är det som **inte förlorar något**.
 *
 * Till 19/9 var det *Ladda om*: kopian låg i webbläsaren innan rutan ens
 * visades, så ingenting gick förlorat — det fick bara hämtas tillbaka för
 * hand efteråt. Sedan berättelse 131 finns ett val som är bättre på samma
 * fråga: **Slå ihop ändringar** behåller båda arbetena utan att någon behöver
 * hämta något, kräver noll val när de två rört olika saker (vilket är det
 * vanliga), och fryser dessutom båda kopiorna i historiken först.
 *
 * **Och *Behåll mina ändringar* är borta** (Johan 19/9: *"om vi gör diffen,
 * vad rekommenderar du då?"*). Det var samma sak som *Min* på varje rad i
 * sammanslagningen, fast utan att se vad man skriver över — och ett val som
 * gör mindre än ett annat ska inte stå bredvid det.
 *
 * ## Vad den inte gör
 *
 * Den laddar inte om, den slår inte ihop något, den sparar ingenting och den
 * vet ingenting om en värd. Den svarar med ett ord, och sidan äger vad ordet
 * betyder — samma delning som `publish-dialog`. Det är därför 131 kunde byta
 * ut ett av valen utan att röra en rad logik här: valen är en lista.
 *
 * Dräkten är `styles/_dialog-shell.scss`, som varje annan dialog i verktyget.
 * Det finns ingen tredje fokusfälla i den här kodbasen och ingen anledning
 * till en.
 */

/** Vad den som läste rutan valde. `"cancel"` också när Escape stängde den. */
export type ConflictChoice = "merge" | "reload" | "cancel";

export interface ConflictRequest {
  /** Vem som hann före. Tom hos en värd som inte vet vem — då namnges ingen. */
  name: string;
  /** När den andres sparning skedde, som klockan visar den. */
  clock: string;
  /** När mina egna osparade ändringar började — sista lyckade sparningen. */
  since: string;
}

export class ConflictDialog extends HTMLElement {
  private readonly root = this.attachShadow({ mode: "open" });
  private resolveChoice: ((choice: ConflictChoice) => void) | null = null;
  private returnFocusTo: HTMLElement | null = null;
  private uiLocale: string = SOURCE_LOCALE;

  /** Verktygets eget språk, som varje annan komponents. */
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
      <dialog aria-labelledby="conflict-title" aria-describedby="conflict-body">
        <form method="dialog">
          <!-- Rubriken tar fokus när rutan öppnas (tabindex -1, så den lämnar
               tabbordningen efteråt). Vad som hänt är det första att läsa, och
               en skärmläsare som landar på en knapp har fått veta ingenting. -->
          <h2 id="conflict-title" data-title tabindex="-1"></h2>
          <p id="conflict-body" data-body></p>

          <div class="conflict-dialog__choices">
            <!-- Förstahandsvalet först och fyllt. Ordningen är läsordningen:
                 det som inte förlorar något står överst. Sedan 131 är det
                 *Slå ihop ändringar*, som behåller bådas arbete. -->
            <button type="button" class="conflict-dialog__choice conflict-dialog__choice--primary" data-choice="merge">
              <span class="conflict-dialog__label" data-merge></span>
              <span class="conflict-dialog__note" data-merge-note></span>
            </button>

            <button type="button" class="conflict-dialog__choice" data-choice="reload">
              <span class="conflict-dialog__label" data-reload></span>
              <span class="conflict-dialog__note" data-reload-note></span>
            </button>

            <button type="button" class="conflict-dialog__choice" data-choice="cancel">
              <span class="conflict-dialog__label" data-cancel></span>
              <span class="conflict-dialog__note" data-cancel-note></span>
            </button>
          </div>
        </form>
      </dialog>
    `;

    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-choice]")) {
      button.addEventListener("click", () =>
        this.finish((button.dataset.choice ?? "cancel") as ConflictChoice),
      );
    }

    /*
     * Escape är *Avbryt* och ingenting annat.
     *
     * Ett val som gjordes genom att stänga rutan får aldrig vara det som
     * skriver eller kastar något: den som tryckte Escape har inte valt, och
     * *Avbryt* är precis det — sidan slutar spara och frågan står kvar att
     * öppna igen.
     */
    this.getDialog()?.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.finish("cancel");
    });
  }

  /** Öppnar, och svarar med det som valdes. */
  ask(request: ConflictRequest): Promise<ConflictChoice> {
    if (this.resolveChoice) {
      this.finish("cancel");
    }

    const dialog = this.getDialog();

    if (!dialog || !this.isConnected) {
      /*
       * Samma svar som `confirmation-dialog` ger på en fråga som inte kan
       * ställas: ingenting valdes, alltså *Avbryt*. Ett kast här hade sluppit
       * ut ur en autospar-återanrop och fällt en hel körning.
       */
      return Promise.resolve("cancel");
    }

    this.returnFocusTo = this.getDeepActiveElement();
    this.render(request);

    if (dialog.open) {
      dialog.close();
    }

    dialog.showModal();
    this.root.querySelector<HTMLElement>("[data-title]")?.focus();

    return new Promise<ConflictChoice>((resolve) => {
      this.resolveChoice = resolve;
    });
  }

  private render(request: ConflictRequest): void {
    const named = request.name !== "";

    this.setText(
      "[data-title]",
      named
        ? this.text("editor.conflict.title", { name: request.name, clock: request.clock })
        : this.text("editor.conflict.titleUnknown", { clock: request.clock }),
    );
    this.setText("[data-body]", this.text("editor.conflict.body"));
    this.setText("[data-merge]", this.text("editor.conflict.merge"));
    this.setText("[data-merge-note]", this.text("editor.conflict.mergeNote"));
    this.setText(
      "[data-reload]",
      named
        ? this.text("editor.conflict.reload", {
            owner: possessive(request.name, this.uiLocale),
          })
        : this.text("editor.conflict.reloadUnknown"),
    );
    this.setText(
      "[data-reload-note]",
      this.text("editor.conflict.reloadNote", { clock: request.since }),
    );
    this.setText("[data-cancel]", this.text("editor.conflict.cancel"));
    this.setText("[data-cancel-note]", this.text("editor.conflict.cancelNote"));
  }

  private setText(selector: string, value: string): void {
    const element = this.root.querySelector<HTMLElement>(selector);

    if (element) {
      element.textContent = value;
    }
  }

  private finish(choice: ConflictChoice): void {
    const resolve = this.resolveChoice;
    const returnFocusTo = this.returnFocusTo;

    this.resolveChoice = null;
    this.returnFocusTo = null;

    if (this.getDialog()?.open) {
      this.getDialog()?.close();
    }

    resolve?.(choice);
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

if (!customElements.get("conflict-dialog")) {
  customElements.define("conflict-dialog", ConflictDialog);
}

declare global {
  interface HTMLElementTagNameMap {
    "conflict-dialog": ConflictDialog;
  }
}
