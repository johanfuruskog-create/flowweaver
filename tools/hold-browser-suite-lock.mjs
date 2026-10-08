/**
 * The `tools/browser-suite-lock.mjs` lock, for the Playwright scripts under
 * `e2e/` that launch Chromium directly.
 *
 * ## Why this exists
 *
 * The lock arms itself for `vitest run --project browser` through that
 * project's `globalSetup` (`vitest.config.ts`) — but a raw script such as
 * `smoke:guide-storage` never goes through vitest, so it never took the lock
 * at all. It was taken by hand around each such run instead (QA, 18/9), which
 * works only as long as somebody remembers to.
 *
 * ## Why `process.on("exit", …)` and not a `try`/`finally` in each script
 *
 * `teardown()` is synchronous (`rmSync`), so it is safe to run from Node's
 * `exit` event — which fires on every path a process leaves by: falling off
 * the end, an explicit `process.exit()`, or an uncaught exception. Several of
 * these scripts call `process.exit()` from more than one place, and one has
 * already been seen to end via an uncaught exception from a broken
 * `page.evaluate` rather than a clean return (QA, 17/9) — a `finally` around
 * the script's own body would miss both. `exit` does not.
 *
 * A held lock that is never released blocks every browser suite on the
 * machine, not just this one — worse than the leaked dev-server ports that
 * prompted this file, so it is the one failure mode this cannot allow.
 */
import { setup, teardown } from "./browser-suite-lock.mjs";

export async function holdBrowserSuiteLock() {
  await setup();
  process.on("exit", teardown);
}
