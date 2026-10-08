import styles from "./guide-preview-dialog.scss?inline";

import "../../../viewer/components/guide-preview/guide-preview";

import { SOURCE_LOCALE } from "../../../viewer/core/localized-text";
import { interpolate, t } from "../../localization/editor-ui-strings";
import type { GuidePreview } from "../../../viewer/components/guide-preview/guide-preview";
import type { GraphData } from "../../../viewer/types/graph";

export class GuidePreviewDialog extends HTMLElement {
  private readonly root = this.attachShadow({ mode: "open" });
  private returnFocusTo: HTMLElement | null = null;
  /*
   * Sant när dialogen visar ETT steg i sin riktiga storlek, falskt när den kör
   * guiden från början. Fältet, och inte bara ett attribut på visaren, för att
   * `render()` ritas om när editorns språk byts och läget måste överleva det.
   */
  private still = false;
  private uiLocale: string = SOURCE_LOCALE;

  /** Lokaliserad chrome-text i editorns UI-språk. */
  private text(key: string, params?: Record<string, string | number>): string {
    const resolved = t(key, this.uiLocale);
    return params ? interpolate(resolved, params) : resolved;
  }

  set editorLocale(value: string) {
    if (value === this.uiLocale) return;
    this.uiLocale = value;
    this.render();
  }

  connectedCallback(): void {
    this.render();
  }

  setAnswerDisplay(value: "current" | "history"): void {
    this.getPreview()?.setAttribute("answer-display", value);
  }

  /**
   * Öppnar guiden — från början, eller vid en nod.
   *
   * `note` är en rad från den som öppnar, visad ovanför guiden. Den finns för
   * publiceringsdialogen (berättelse 125), som hoppar hit vid en nod och måste
   * kunna säga att tidigare frågor inte är besvarade. Meningen bor hos den som
   * vet varför den behövs, inte här: samma rad på två ställen är samma rad som
   * snart säger två olika saker.
   */
  open(graph: GraphData, nodeId?: string, locale?: string, note?: string): void {
    const dialog = this.getDialog();
    const preview = this.getPreview();

    if (!dialog || !preview) {
      return;
    }

    if (locale) {
      preview.activeLocale = locale;
    }
    /*
     * Läget FÖRE grafen, för det är tilldelningen som ritar. Satt efteråt
     * ärvde andra öppningen den förstas navigering: dialogen är en och samma,
     * och attributet ensamt ritar inte om något. Hittat av testet som öppnar
     * två gånger — ett fel bara den som klickar två gånger ser.
     *
     * Ett steg eller hela guiden är samma dialog, och skillnaden är den
     * `nodeId` som redan avgör var den börjar. Inget nytt argument behövs:
     * "Visa i full storlek" pekar på den valda noden; utan nod körs guiden —
     * en väg som sedan 1/9 saknar knapp (provet på arbetsytan tog över).
     */
    this.still = Boolean(nodeId);
    this.applyStill();

    preview.graph = graph;

    if (nodeId) {
      preview.showNode(nodeId);
    }

    const opener = this.root.querySelector<HTMLElement>("[data-note]");

    if (opener) {
      opener.textContent = note ?? "";
      opener.hidden = !note;
    }

    this.returnFocusTo = this.getDeepActiveElement();

    if (!dialog.open) {
      dialog.showModal();
    }

    this.root
      .querySelector<HTMLButtonElement>('[data-action="close"]')
      ?.focus();
  }

  close(): void {
    const dialog = this.getDialog();
    const returnFocusTo = this.returnFocusTo;

    this.returnFocusTo = null;

    if (dialog?.open) {
      dialog.close();
    }

    returnFocusTo?.focus();
  }

  private render(): void {
    this.root.innerHTML = `
      <style>${styles}</style>
      <dialog aria-labelledby="guide-preview-title">
        <div class="guide-preview-dialog__header">
          <h2 id="guide-preview-title">${this.text("editor.dialogs.guidePreview.title")}</h2>
          <button type="button" data-action="close" aria-label="${this.text("editor.dialogs.guidePreview.closeAria")}">
            ×
          </button>
        </div>
        <div class="guide-preview-dialog__content">
          <p class="guide-preview-dialog__note" data-note role="status" hidden></p>
          <guide-preview></guide-preview>
          <p class="guide-preview-dialog__still" hidden>
            ${this.text("editor.dialogs.guidePreview.stillNote", {
              run: this.text("editor.toolbar.proveGuide"),
            })}
          </p>
        </div>
      </dialog>
    `;

    this.root
      .querySelector<HTMLButtonElement>('[data-action="close"]')
      ?.addEventListener("click", () => this.close());

    this.applyStill();

    this.getDialog()?.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.close();
    });
  }

  /** Speglar läget i DOM:en: visaren slutar rita navigering, raden träder in. */
  private applyStill(): void {
    this.getPreview()?.toggleAttribute("no-navigation", this.still);

    const note = this.root.querySelector<HTMLElement>(".guide-preview-dialog__still");

    if (note) note.hidden = !this.still;
  }

  private getDialog(): HTMLDialogElement | null {
    return this.root.querySelector<HTMLDialogElement>("dialog");
  }

  private getPreview(): GuidePreview | null {
    return this.root.querySelector<GuidePreview>("guide-preview");
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

if (!customElements.get("guide-preview-dialog")) {
  customElements.define("guide-preview-dialog", GuidePreviewDialog);
}

declare global {
  interface HTMLElementTagNameMap {
    "guide-preview-dialog": GuidePreviewDialog;
  }
}
