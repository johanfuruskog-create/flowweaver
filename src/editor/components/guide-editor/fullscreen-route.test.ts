import { describe, expect, test } from "vitest";

import { needsPlatformFullscreen } from "./fullscreen-route";

/**
 * Which fullscreen the editor reaches for.
 *
 * **The platform's whenever it is offered.** On a tablet it hides the browser's
 * own bar, which is a real piece of screen; inside a frame it is the only thing
 * that escapes, and Sitevision puts the editor in a frame.
 *
 * **Ours catches the fall.** On iPadOS a downward swipe still leaves the
 * platform's fullscreen — measured on the device, on release rather than during
 * the drag — and a downward swipe is how somebody pans. The editor turns ours on
 * when that happens instead of snapping back mid-work, which is what makes
 * reaching for the platform's affordable at all.
 *
 * An earlier version took the platform's *only* inside a frame, on the grounds
 * that it offered nothing elsewhere. That was wrong twice: it does offer
 * something, and once the fall is caught the gesture costs a mode change rather
 * than a mess. The rule is kept as a rule so the reasoning has somewhere to live
 * — and because `window.top` is not configurable and the test runner is itself an
 * iframe, so this cannot be asked in place.
 */

describe("inside a frame", () => {
  test("takes the platform's, which is the only thing that escapes", () => {
    expect(needsPlatformFullscreen({ enabled: true, framed: true })).toBe(true);
  });
});

describe("on an ordinary page", () => {
  test("takes ours, even though the platform would allow it", () => {
    /*
     * Tried both ways on an iPad, and this is the way that survived use. The
     * platform's gives the browser's bar back on the first downward pan — and
     * worse, the button could then not get you out, because after the fallback
     * we were in ours while the check still asked about the platform's.
     */
    expect(needsPlatformFullscreen({ enabled: true, framed: false })).toBe(false);
  });
});

describe("when it does not", () => {
  test("ours, inside a frame that was never given permission", () => {
    // An iframe without `allow="fullscreen"`. Ours fills what there is.
    expect(needsPlatformFullscreen({ enabled: false, framed: true })).toBe(false);
  });

  test("and ours on an ordinary page that refuses too", () => {
    expect(needsPlatformFullscreen({ enabled: false, framed: false })).toBe(false);
  });
});
