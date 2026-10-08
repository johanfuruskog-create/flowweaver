/**
 * Which build is running: the commit, `+ändringar` when the tree held
 * uncommitted work, and when it was built — `791f62ff 2026-09-26T09:12:03.412Z`.
 *
 * Filled in by `scripts/build-id.ts` at every build; the placeholder stands
 * in the dev server and the test suite, where nothing is built. Read through
 * `GuideEditor.buildId`, so a page asks the editor module that is actually
 * running rather than a file that may be cached apart from it.
 */
const STAMP: string = "__FW_BUILD_ID__";

export const BUILD_ID = STAMP.startsWith("__") ? "ingen byggstämpel (utvecklingsserver)" : STAMP;
