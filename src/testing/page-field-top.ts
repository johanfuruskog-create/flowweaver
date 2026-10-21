/**
 * Where a page node's field area starts, measured off the drawn page.
 *
 * The page tests used to pin it: `268px` for a page with neither title nor
 * description, `292px` with a title, `320px` with both. Those were the
 * measurement on Linux, where `--fw-font` (`system-ui`) resolves to one
 * typeface; on macOS it resolves to SF, whose line box is about 0.8 px taller,
 * and the text block's bottom crossed a rounding boundary. Measured 9/10 2026
 * on the Mac: 168.2 → 169.0, 192.0 → 192.8 and 220.3 → 221.1 px; forcing Arial
 * gave the Linux values back exactly. Ten tests went red on a field one pixel
 * lower, with nothing wrong on the page.
 *
 * So the base comes from the page itself, by the rule the editor follows (the
 * text block's bottom, its content padding below it, plus a 20 px gap, rounded
 * to whole pixels — `getPageContentTop` in `node-editor.ts`), and what the
 * tests are about — rows, order, the page growing — stays exact on top of it.
 * The rule is measured independently here, so a field area that drifted away
 * from the text still fails.
 *
 * Read at zoom 1, which is what the tests mount at.
 */
const PAGE_INTRO_GAP = 20;

export function pageFieldTop(page: HTMLElement): number {
  const root = page.shadowRoot;
  const intro =
    root?.querySelector<HTMLElement>(".flow-node__structure") ??
    root?.querySelector<HTMLElement>(".flow-node__content");
  if (!intro) throw new Error("The page node has no text block to measure.");

  const content = intro.closest<HTMLElement>(".flow-node__content");
  const padding =
    content && content !== intro
      ? Number.parseFloat(getComputedStyle(content).paddingBottom) || 0
      : 0;
  const bottom =
    intro.getBoundingClientRect().bottom - page.getBoundingClientRect().top + padding;
  return Math.round(bottom + PAGE_INTRO_GAP);
}

/**
 * How tall a row of fields is, by the editor's rule: its tallest field's
 * border box, rounded (`recordNodeHeight` in `node-editor.ts`).
 *
 * The tests wrote `91`. That is a one-line text field in DejaVu Sans, Arial
 * and SF; in WenQuanYi Zen Hei, whose line box is taller, the same field is
 * 93, and seven page tests went red in the font matrix (9/10 2026) with the
 * rows stacked exactly by the rule. `offsetHeight`, not the client rect:
 * like the editor's `ResizeObserver` it ignores transforms, and a field being
 * dragged or settling carries one.
 */
export function pageRowHeight(...fields: (HTMLElement | undefined)[]): number {
  return Math.max(
    ...fields.map((field) => {
      if (!field) throw new Error("A field in the row was not drawn.");
      return field.offsetHeight;
    }),
  );
}
