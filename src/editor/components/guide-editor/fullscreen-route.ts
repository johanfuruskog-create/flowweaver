/**
 * Which fullscreen the editor reaches for — a rule, in a file of its own.
 *
 * ## Ours, unless only the platform's can do the job
 *
 * The platform's does give something ours cannot: on a tablet it hides the
 * browser's own bar, and inside a frame it is the *only* thing that escapes — `position: fixed` is relative to the frame's viewport, so ours would
 * fill an iframe and call six hundred pixels fullscreen. Sitevision puts the
 * editor in a frame, so that case is not hypothetical.
 *
 * ## And let ours catch the fall
 *
 * On iPadOS a downward swipe still leaves the platform's fullscreen. Measured on
 * the device: `touch-action: none` moved it from firing during the drag to firing
 * on release, but a downward swipe is how somebody pans, so it happens. The
 * editor listens for that and turns ours on, rather than snapping back to its
 * ordinary size mid-work.
 *
 * ## And tried on the device, which settled it
 *
 * Both ways round, in that order. Taking the platform's everywhere reads well and
 * is worse to use: on an iPad you get the bar back on your first downward pan,
 * and — the part that decided it — the button then could not get you out again,
 * because after the fallback we were in ours while the check still asked about
 * the platform's. Two modes, one button, and a person stuck between them.
 *
 * So: ours, unless we are in a frame, which ours cannot escape. Sitevision keeps
 * its real fullscreen; everywhere else keeps a mode with no gesture to fight.
 *
 * ## Why it is a rule rather than a branch in the handler
 *
 * Because it could not be tested where it was used. `window.top` is not
 * configurable, so the un-framed case cannot be faked — and the test runner is
 * itself an iframe, so left alone every test exercises the framed branch and
 * none the other.
 */
export interface FullscreenSituation {
  /**
   * `document.fullscreenEnabled` — false when the platform's fullscreen is
   * unavailable, an iframe without `allow="fullscreen"` included.
   */
  enabled: boolean;
  /** Whether the editor is inside a frame at all. */
  framed: boolean;
}

export function needsPlatformFullscreen({
  enabled,
  framed,
}: FullscreenSituation): boolean {
  return enabled && framed;
}
