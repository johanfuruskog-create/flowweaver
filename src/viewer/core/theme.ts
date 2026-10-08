/**
 * Light/dark theme. Dark mode is a pure token swap (see tokens.scss). Without an
 * explicit choice, the OS setting applies.
 *
 * ## The library stores nothing
 *
 * *Applying* a theme is rendering, and we own that. *Remembering* a choice is
 * storage, and the host owns that — just like the guide and the node templates
 * (K6d). The toggle therefore applies directly and announces with
 * `theme-change`; what happens next is the host system's call.
 *
 * The choice used to be written to `localStorage` here. The consequence was that
 * the library took space in the host's storage without asking, and a host with a
 * theme setting of its own ended up with two truths pulling in different
 * directions.
 */

export type ThemeChoice = "light" | "dark";

/** Applies a theme to the document. Without a choice the OS setting applies again. */
export function applyTheme(choice: ThemeChoice | null): void {
  if (choice) {
    document.documentElement.dataset.theme = choice;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

/** Is dark mode active right now (an explicit choice or the OS)? */
export function isDarkActive(): boolean {
  const attr = document.documentElement.dataset.theme;
  if (attr === "dark") return true;
  if (attr === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Toggles the theme, applies it and returns the new choice.
 *
 * Saves nothing. Whoever toggles fires `theme-change` so the host finds out.
 */
export function toggleTheme(): ThemeChoice {
  const next: ThemeChoice = isDarkActive() ? "light" : "dark";
  applyTheme(next);
  return next;
}

/**
 * Announces that the theme changed. Bubbles out of the shadow root so a host can
 * listen on the element or on the document.
 */
export function announceThemeChange(source: EventTarget, theme: ThemeChoice): void {
  source.dispatchEvent(
    new CustomEvent<{ theme: ThemeChoice }>("theme-change", {
      detail: { theme },
      bubbles: true,
      composed: true,
    })
  );
}
