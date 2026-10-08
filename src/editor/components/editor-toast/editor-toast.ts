import styles from "./editor-toast.scss?inline";

import { SOURCE_LOCALE } from "../../../viewer/core/localized-text";
import { interpolate, t } from "../../localization/editor-ui-strings";

export type ToastType = "success" | "error" | "info";

export interface ToastOptions {
  message: string;
  type: ToastType;
  duration?: number;
}

export class EditorToast extends HTMLElement {
  private readonly root = this.attachShadow({ mode: "open" });
  private timeoutId: number | null = null;
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

  show(options: ToastOptions): void {
    this.hide();

    const toast = this.root.querySelector<HTMLElement>("[data-toast]");
    const message = this.root.querySelector<HTMLElement>("[data-message]");

    if (!toast || !message) {
      return;
    }

    message.textContent = options.message;
    toast.dataset.type = options.type;
    toast.setAttribute("role", options.type === "error" ? "alert" : "status");
    toast.setAttribute(
      "aria-live",
      options.type === "error" ? "assertive" : "polite"
    );
    toast.hidden = false;

    const duration = options.duration ?? (options.type === "error" ? 0 : 4000);

    if (duration > 0) {
      this.timeoutId = window.setTimeout(() => this.hide(), duration);
    }
  }

  hide(): void {
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    const toast = this.root.querySelector<HTMLElement>("[data-toast]");

    if (toast) {
      toast.hidden = true;
    }
  }

  private render(): void {
    this.root.innerHTML = `
      <style>${styles}</style>
      <section data-toast hidden>
        <span class="editor-toast__icon" aria-hidden="true"></span>
        <p data-message></p>
        <button type="button" aria-label="${this.text("editor.toast.closeAria")}">×</button>
      </section>
    `;

    this.root
      .querySelector<HTMLButtonElement>("button")
      ?.addEventListener("click", () => this.hide());
  }
}

if (!customElements.get("editor-toast")) {
  customElements.define("editor-toast", EditorToast);
}

declare global {
  interface HTMLElementTagNameMap {
    "editor-toast": EditorToast;
  }
}
