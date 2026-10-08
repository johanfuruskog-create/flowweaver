/**
 * Waits until a viewport has stopped scrolling.
 *
 * The canvas's deliberate centrings — the run's step-to-step pan, "Visa
 * startnoden", "Tillbaka till guiden" — glide since 1/10 2026
 * (`centerViewportAt(…, { smooth: true })`), so a test that reads the scroll
 * position straight after the call reads a frame in the middle of the ride.
 * Eight tests did, on exactly the same pixel values two runs in a row
 * (Per, 1/10) — not load, a ride.
 *
 * Settled means: the position has not moved for three consecutive checks
 * (`still` × `every` ms). That also returns promptly when nothing scrolled at
 * all, which a bare `scrollend` listener never would. `limit` caps the wait.
 */
export async function scrollSettled(
  viewport: Element,
  { every = 50, still = 3, limit = 2000 }: { every?: number; still?: number; limit?: number } = {},
): Promise<void> {
  const started = Date.now();
  let last = `${viewport.scrollLeft},${viewport.scrollTop}`;
  let quiet = 0;

  while (quiet < still && Date.now() - started < limit) {
    await new Promise<void>((resolve) => setTimeout(resolve, every));
    const now = `${viewport.scrollLeft},${viewport.scrollTop}`;
    quiet = now === last ? quiet + 1 : 0;
    last = now;
  }
}
