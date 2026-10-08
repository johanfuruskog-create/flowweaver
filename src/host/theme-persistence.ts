import { applyTheme, type ThemeChoice } from "../viewer/core/theme";

/**
 * The demo pages' storage of the theme choice.
 *
 * This is the **host's** code, not the library's: the library applies the theme
 * and announces that it changed, and this file decides the memory lives in the
 * browser. Another host might just as well put it in a user profile.
 *
 * The file never reaches the package — it is imported only by the pages under
 * `src/`, not by `src/entries/*`.
 */

const STORAGE_KEY = "flowweaver:theme";

function saved(): ThemeChoice | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

/** The document's current choice, or null when the OS setting applies. */
export function currentTheme(): ThemeChoice | null {
  const value = document.documentElement.dataset.theme;
  return value === "dark" || value === "light" ? value : null;
}

/** Runs `fn` on every theme change on the page, and once immediately with the current one. */
export function onThemeChange(fn: (theme: ThemeChoice | null) => void): void {
  fn(currentTheme());

  document.addEventListener("theme-change", (event) => {
    fn((event as CustomEvent<{ theme: ThemeChoice }>).detail.theme);
  });
}

/** Applies a saved choice and remembers future changes. */
export function initTheme(): void {
  applyTheme(saved());

  document.addEventListener("theme-change", (event) => {
    const { theme } = (event as CustomEvent<{ theme: ThemeChoice }>).detail;

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* private mode — the choice still holds for the session */
    }
  });
}
