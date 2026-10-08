/**
 * The part of the page an element's nearest scrolling ancestor shows, cut by
 * the visual viewport — the window when nothing scrolls. Walks out through
 * shadow roots: the formula's plus menu and the condition row's field picker
 * both live in the properties panel's.
 *
 * Shared because both surfaces open inside the panel and must fit what shows
 * of it: the plus menu sizes its height to the band (rich-text-field,
 * `fitMenuHeight`), the field picker also chooses a side from it (story 143,
 * point 9). The visual viewport is what makes it right on the iPad with the
 * keyboard up — the band that actually shows, not the layout viewport.
 */
export function visibleBand(element: Element): { top: number; bottom: number } {
  const viewport = window.visualViewport;
  let top = viewport ? viewport.offsetTop : 0;
  let bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
  let node: Node | null = element;

  while (node) {
    node = (node as Element).parentElement ?? ((node.getRootNode() as ShadowRoot).host ?? null);
    if (node instanceof HTMLElement && /(auto|scroll)/.test(getComputedStyle(node).overflowY)) {
      const box = node.getBoundingClientRect();

      top = Math.max(top, box.top);
      bottom = Math.min(bottom, box.bottom);
      break;
    }
  }

  return { top, bottom };
}
