import { expect } from "vitest";

/**
 * A cursor we draw ourselves (src/editor/styles/_cursors.scss): the image
 * first, the system keyword last as the fallback. Checked on the computed
 * value, so a rule that still says the bare keyword — the white system cursor
 * on Johan's Windows — fails here, and so does one that lost its fallback.
 */
export function expectDrawnCursor(element: Element, keyword: string, where: string): void {
  const cursor = getComputedStyle(element).cursor;

  expect(cursor.startsWith('url("data:image/svg+xml'), `${where}: ${cursor.slice(0, 40)}`).toBe(true);
  expect(cursor.endsWith(`, ${keyword}`), `${where}: slutar på ${keyword}`).toBe(true);
}
