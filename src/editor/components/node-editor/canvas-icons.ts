/**
 * The canvas zoom bar's four icons (Uppdrag 29/9, Del A; Astra §1).
 *
 * Until 29/9 the bar drew its actions as characters — `−`, `+`, `⊡` and `⛶`
 * — and a character is the font's drawing, not ours: its weight, size and
 * even whether it exists at all follow whichever font the host happens to
 * have. Astra: *"ritade ikoner ur projektet, inte bokstäver eller
 * Unicode-tecken med beroende av typsnitt."*
 *
 * Drawn in the editor's line-icon manner, the one the text field's tool row
 * already uses (`rich-text-field.ts`, `ICONS`): a 24 grid, `currentColor`
 * strokes, round caps, width 2 — one weight for all four, so no icon reads
 * heavier than its neighbour. The colour comes from the button
 * (`--fw-text-secondary`), never from here, so a host's token overrides
 * reach the glyphs too.
 *
 * "Show the whole flow" had no icon in the project to reuse, so it is drawn
 * as Astra describes it: frame corners with two small nodes inside. The
 * fullscreen icon is the same corners with nothing inside — the pair reads as
 * "fit what is inside the frame" and "make the frame the screen".
 *
 * `aria-hidden`: every button carries its name in `aria-label`.
 */
const icon = (paths: string): string =>
  `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

export const CANVAS_ICONS = {
  zoomOut: icon('<path d="M5 12h14"/>'),
  zoomIn: icon('<path d="M12 5v14M5 12h14"/>'),
  fit: icon(
    '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/>' +
      '<rect x="7" y="7.5" width="6" height="4.5" rx="1"/><rect x="11" y="12" width="6" height="4.5" rx="1"/>',
  ),
  fullscreen: icon(
    '<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>',
  ),
} as const;
