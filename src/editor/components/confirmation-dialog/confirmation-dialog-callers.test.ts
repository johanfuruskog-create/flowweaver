import { describe, expect, test } from "vitest";

/**
 * Every confirmation says its tone (B3, Astra 30/9): red only where the act
 * risks losing work that cannot be had back, judged per act and not by its
 * verb; the ordinary accent everywhere else. The component's default is the
 * accent, so a caller that says nothing is never red — and this makes
 * every caller say it, so the choice is visible where the act is.
 *
 * The classification, one line per caller, is in the B3 report and under
 * *Destruktiv huvudhandling* in GRAFISK-PROFIL. Measured before: eleven of
 * the eighteen calls said nothing and were red by default, among them *Gör
 * till startnod*. (The B3 report said nine of fourteen; recounted with this
 * file's own reading in B3b, 30/9.)
 *
 * Eighteen call sites, ten red and eight accent. Two of the accent ones are
 * not a question about an act: `acknowledge()` is the one-button notice, and
 * the design-ground page shows the dialog as a sample. That leaves sixteen
 * confirmations — ten red, six accent.
 */

// The Sitevision module is ours and calls the element directly, so it is read too.
const SOURCES = import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts", "../../../../integrations/*/src/**/*.js"], {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

/** Each `.confirm({ … })` call, its object literal cut at the matching brace. */
function calls(source: string): string[] {
  const found: string[] = [];
  let at = source.indexOf(".confirm({");
  while (at !== -1) {
    let depth = 0;
    let end = at + ".confirm(".length;
    for (; end < source.length; end += 1) {
      if (source[end] === "{") depth += 1;
      if (source[end] === "}") depth -= 1;
      if (depth === 0) break;
    }
    found.push(source.slice(at, end + 1));
    at = source.indexOf(".confirm({", end);
  }
  return found;
}

describe("bekräftelsedialogens anropare", () => {
  const all = Object.entries(SOURCES).flatMap(([file, source]) => calls(source).map((call) => ({ file, call })));

  test("det finns anrop att pröva", () => {
    // The site and the Sitevision module stay in the working repo; the open
    // FlowWeaver has the library's own calls (5, measured in the export 6/10).
    const whole = Object.keys(SOURCES).some((file) => file.includes("/site/"));
    expect(all.length).toBeGreaterThanOrEqual(whole ? 18 : 5);
    if (whole) {
      expect(all.some(({ file }) => file.includes("integrations/")), "Sitevision-modulen läses").toBe(true);
    }
  });

  test("varje anrop säger sin ton", () => {
    const silent = all.filter(({ call }) => !/\btone:/.test(call)).map(({ file, call }) => `${file}: ${call.split("\n")[1]?.trim()}`);
    expect(silent).toEqual([]);
  });
});
