/*
 * Design tokens in the browser tests.
 *
 * The library sets its tokens on its own tags, one step down from `:root`. The
 * tests often mount individual parts — a `flow-node` without its `guide-editor`
 * — and those would then lack the variables, making colour-dependent
 * measurements meaningless.
 *
 * The opt-in class on `<body>` is the same route a host takes to dress a whole
 * area. The tests therefore do what a host does, not something of their own.
 */
import "../viewer/styles/tokens.scss";

document.body.classList.add("flowweaver-scope");

/*
 * A forced typeface, for the font matrix (`npm run fonts:matrix`, the reason
 * is in `tools/fonts-matrix.mjs`). Unset in an ordinary run, and then nothing
 * below happens.
 *
 * It points `--fw-font` somewhere else the way a host would: a rule on the
 * library's own tags, which beats the token's zero-specificity `:where()`.
 * Every tag in the token scope is named, because each of them sets the token
 * again on itself — a `guide-preview` inside a `guide-editor` would otherwise
 * go back to `system-ui`. And `body` reads the token, as our own site does
 * (`src/site/style.scss`): parts mounted on their own (a `flow-node`, the
 * version list) set no font of their own, so without it they would stand in
 * the browser's default serif in every run of the matrix, and the matrix could
 * not vary them.
 *
 * That the typeface really reaches the components is measured, not assumed:
 * `src/testing/forced-font.browser.test.ts`, first in the matrix's list.
 */
const forcedFont = import.meta.env.VITE_FW_FONT as string | undefined;
if (forcedFont) {
  const style = document.createElement("style");
  style.textContent = `
    guide-editor, guide-preview, guide-versions, .flowweaver-scope { --fw-font: ${forcedFont}; }
    body { font-family: var(--fw-font); }
  `;
  document.head.append(style);
}
