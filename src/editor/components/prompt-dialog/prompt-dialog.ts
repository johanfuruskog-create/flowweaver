import styles from "./prompt-dialog.scss?inline";

import { SOURCE_LOCALE } from "../../../viewer/core/localized-text";
import { t } from "../../localization/editor-ui-strings";

/**
 * `<prompt-dialog>` — asks for a word, and gives back what was written.
 *
 * ## Why it is not the confirmation dialog with a field in it
 *
 * They are different controls. One asks *shall I go ahead*, and the answer is
 * yes or no. The other asks *what shall it be called*, and the answer is a
 * word — with a field to type it in, a cursor that belongs there, and a Return
 * key that means submit.
 *
 * Putting a hidden input inside the confirmation made one element do two jobs
 * and branch on which it was doing. What the two share is not behaviour but
 * **appearance**, and that lives in `styles/_dialog-shell.scss`: the same box,
 * the same backdrop, the same buttons in the same corner. Change how a dialog
 * looks in one place, and keep two controls that each do one thing.
 *
 * ## Why `window.prompt` is not enough
 *
 * It is a box the browser draws, in its own words, with its own buttons, in a
 * place the page does not choose. Two ways of asking inside one tool shows up
 * as two different-looking questions, and the one nobody designed always looks
 * like a mistake.
 */
export interface PromptOptions {
  title: string;
  /** Above the field, saying what the word is for rather than repeating it. */
  label: string;
  /** Optional, for when the answer has a consequence worth stating. */
  message?: string;
  value?: string;
  placeholder?: string;
  confirmLabel: string;
  cancelLabel?: string;
}

export class PromptDialog extends HTMLElement {
  private readonly root = this.attachShadow({ mode: "open" });
  private resolveAnswer: ((answer: string | null) => void) | null = null;
  private returnFocusTo: HTMLElement | null = null;
  private uiLocale: string = SOURCE_LOCALE;

  /** The tool's own language, like every other component's. */
  set editorLocale(value: string) {
    this.uiLocale = value;
  }

  connectedCallback(): void {
    this.root.innerHTML = `
      <style>${styles}</style>
      <dialog aria-labelledby="prompt-title">
        <form method="dialog">
          <h2 id="prompt-title" data-title></h2>
          <p data-message hidden></p>
          <label data-field>
            <span data-label></span>
            <input type="text" data-input>
          </label>
          <div class="prompt-dialog__choices" data-choices hidden></div>
          <div class="prompt-dialog__actions">
            <button type="button" data-action="cancel"></button>
            <button type="button" class="prompt-dialog__confirm" data-action="confirm"></button>
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

    /*
     * Return answers the question. A form with one field where Return does
     * nothing is a form people press twice and then re-read to find what they
     * did wrong.
     */
    this.root
      .querySelector<HTMLInputElement>("[data-input]")
      ?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this.finish(true);
        }
      });

    this.getDialog()?.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.finish(false);
    });
  }

  /**
   * Asks, and resolves with the answer — or `null` for a refusal.
   *
   * An empty answer is a refusal too: somebody who clears the field and presses
   * the button has said *no name*, and a thing called nothing is a thing nobody
   * can point at.
   */
  ask(options: PromptOptions): Promise<string | null> {
    if (this.resolveAnswer) {
      this.finish(false);
    }

    const dialog = this.getDialog();
    const title = this.root.querySelector<HTMLElement>("[data-title]");
    const message = this.root.querySelector<HTMLElement>("[data-message]");
    const label = this.root.querySelector<HTMLElement>("[data-label]");
    const input = this.root.querySelector<HTMLInputElement>("[data-input]");
    const cancel = this.root.querySelector<HTMLButtonElement>('[data-action="cancel"]');
    const confirm = this.root.querySelector<HTMLButtonElement>('[data-action="confirm"]');

    if (!dialog || !title || !message || !label || !input || !cancel || !confirm) {
      return Promise.resolve(null);
    }

    title.textContent = options.title;
    message.textContent = options.message ?? "";
    message.hidden = !options.message;
    label.textContent = options.label;
    input.value = options.value ?? "";
    input.placeholder = options.placeholder ?? "";
    cancel.textContent =
      options.cancelLabel ?? t("editor.dialogs.confirmation.cancel", this.uiLocale);
    confirm.textContent = options.confirmLabel;
    this.returnFocusTo = this.getDeepActiveElement();

    dialog.showModal();

    // The field, not a button: the question is what to type, and the cursor
    // belongs where the answer goes.
    input.focus();
    input.select();

    return new Promise<string | null>((resolve) => {
      this.resolveAnswer = resolve;
    });
  }

  /**
   * Asks with a fixed set of answers instead of a field — story 034's page
   * choice. A native dialog gives the focus trap and Escape for free, and a
   * button per choice is the whole keyboard story: Tab, Enter, done. Resolves
   * with the chosen id, or null when the person backs out.
   */
  choose(options: {
    title: string;
    message?: string;
    choices: Array<{ id: string; label: string }>;
    cancelLabel?: string;
  }): Promise<string | null> {
    if (this.resolveAnswer) {
      this.finish(false);
    }

    const dialog = this.getDialog();
    const title = this.root.querySelector<HTMLElement>("[data-title]");
    const message = this.root.querySelector<HTMLElement>("[data-message]");
    const field = this.root.querySelector<HTMLElement>("[data-field]");
    const choices = this.root.querySelector<HTMLElement>("[data-choices]");
    const cancel = this.root.querySelector<HTMLButtonElement>('[data-action="cancel"]');
    const confirm = this.root.querySelector<HTMLButtonElement>('[data-action="confirm"]');

    if (!dialog || !title || !message || !field || !choices || !cancel || !confirm) {
      return Promise.resolve(null);
    }

    title.textContent = options.title;
    message.textContent = options.message ?? "";
    message.hidden = !options.message;
    field.hidden = true;
    confirm.hidden = true;
    choices.hidden = false;
    cancel.textContent =
      options.cancelLabel ?? t("editor.dialogs.confirmation.cancel", this.uiLocale);

    choices.replaceChildren(
      ...options.choices.map((choice) => {
        const button = document.createElement("button");

        button.type = "button";
        button.textContent = choice.label;
        button.addEventListener("click", () => this.finishChoice(choice.id));

        return button;
      }),
    );

    this.returnFocusTo = this.getDeepActiveElement();
    dialog.showModal();
    choices.querySelector("button")?.focus();

    return new Promise<string | null>((resolve) => {
      this.resolveAnswer = resolve;
    });
  }

  /** Ett val stänger som ett svar; avbryt går genom `finish(false)` som allt annat. */
  private finishChoice(id: string): void {
    const resolve = this.resolveAnswer;

    this.resolveAnswer = null;
    this.restoreAskMode();
    this.getDialog()?.close();
    this.returnFocusTo?.focus();
    this.returnFocusTo = null;
    resolve?.(id);
  }

  /** Fältläget är förvalet; valläget städar efter sig så nästa ask() är orört. */
  private restoreAskMode(): void {
    const field = this.root.querySelector<HTMLElement>("[data-field]");
    const choices = this.root.querySelector<HTMLElement>("[data-choices]");
    const confirm = this.root.querySelector<HTMLButtonElement>('[data-action="confirm"]');

    if (field) field.hidden = false;
    if (confirm) confirm.hidden = false;
    if (choices) {
      choices.hidden = true;
      choices.replaceChildren();
    }
  }

  private finish(confirmed: boolean): void {
    this.restoreAskMode();

    const resolve = this.resolveAnswer;
    const returnFocusTo = this.returnFocusTo;
    const answer =
      this.root.querySelector<HTMLInputElement>("[data-input]")?.value.trim() ?? "";

    this.resolveAnswer = null;
    this.returnFocusTo = null;

    if (this.getDialog()?.open) {
      this.getDialog()?.close();
    }

    resolve?.(confirmed && answer ? answer : null);
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

if (!customElements.get("prompt-dialog")) {
  customElements.define("prompt-dialog", PromptDialog);
}
