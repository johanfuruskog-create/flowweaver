import tokens from "./tokens.scss?inline";

/**
 * Puts the library's tokens into the document, once.
 *
 * Doing this ourselves is only harmless now that the selectors are scoped to our
 * own tags: the rules cannot reach the host's page. Were everything still on
 * `:root` this would be an intrusion — we would have repainted their scrollbars
 * and form controls.
 *
 * The consequence is that `tokens.css` is no longer needed for the components to
 * look right. The file remains in the package for anyone who wants to read the
 * values or override them, but a consumer who only loads the bundle gets the
 * right appearance.
 *
 * Idempotent: several entries on the same page share one `<style>`.
 */
export function applyTokens(): void {
  const ID = "flowweaver-tokens";

  if (typeof document === "undefined" || document.getElementById(ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = ID;
  style.textContent = tokens;
  document.head.append(style);
}
