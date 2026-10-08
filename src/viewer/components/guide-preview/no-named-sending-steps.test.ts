import { describe, expect, it } from "vitest";
import source from "./guide-preview.ts?raw";

/*
 * Story 147, criterion 5: the viewer draws the sending steps through
 * registered renderers and never names them. The day a branch on
 * `"submit-result"` or `"email-result"` comes back here, the boundary has
 * moved back too — this is the grep the story asked for, kept as a test.
 * Comments are stripped first: a comment may well explain the history.
 */
describe("guide-preview does not name the full version's steps", () => {
  it("has no literal submit-result or email-result", () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:(])\/\/.*$/gm, "$1");
    expect(code).not.toMatch(/["'`]submit-result["'`]/);
    expect(code).not.toMatch(/["'`]email-result["'`]/);
  });
});
