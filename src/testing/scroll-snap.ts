/*
 * How far a scroll offset the canvas sets can land from where it was set, per
 * engine.
 *
 * Chromium and WebKit keep a whole-pixel `scrollLeft` as set — the canvas
 * rounds every instant scroll (`scrollViewport` in `node-editor.ts`), so they
 * read back exactly what was written. Firefox snaps the offset again to its
 * own grid of device pixels, and the result need not be whole. Measured 10/10
 * in Firefox 151 on the canvas: `scrollLeft = 900` reads 900, `scrollLeft -= 4`
 * reads 895.55, `scrollLeft = 903.6` reads 903.33. Under half a pixel, either
 * way. Whatever moves with the canvas then stands a fraction off the pixel.
 * So a test that expects the canvas at an exact offset, a node not to move at
 * all, or a hit exactly on the line between two targets, allows half a pixel
 * in Firefox — and nothing anywhere else:
 * there every comparison is exactly the one the test made before this file.
 */
const firefox = /Firefox\//.test(navigator.userAgent);

/** Half a pixel in Firefox, nothing elsewhere. */
export const SCROLL_SNAP = firefox ? 0.5 : 0;
