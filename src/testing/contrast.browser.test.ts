import { describe, expect, test } from "vitest";

import { kontrast, tillRgba } from "./contrast";

/**
 * The measuring tool is checked against known values before it is allowed to
 * judge anyone else's code. A measurement nobody verified is a claim, not a
 * measurement.
 */
describe("the contrast measurement", () => {
  test.each([
    ["svart på vitt", "#000000", "#ffffff", 21],
    ["vitt på vitt", "#ffffff", "#ffffff", 1],
    ["WCAG-gränsen för normal text", "#767676", "#ffffff", 4.54],
    // Recomputed by hand: L(#101828) = 0.00917 -> 1.05/0.05917.
    ["appens text på appens yta", "#101828", "#ffffff", 17.75],
  ])("%s", (_namn, fg, bg, väntat) => {
    expect(kontrast(tillRgba(fg), tillRgba(bg))).toBeCloseTo(väntat, 1);
  });

  // The browser knows the formats the code actually uses; our own regex would not.
  test.each([
    ["hex", "#4f46e5", [79, 70, 229]],
    ["rgb", "rgb(79, 70, 229)", [79, 70, 229]],
    ["color-mix", "color-mix(in oklab, #ffffff 50%, #000000)", [99, 99, 99]],
  ])("%s går att läsa", (_namn, färg, väntat) => {
    expect(tillRgba(färg).slice(0, 3).map(Math.round)).toEqual(väntat);
  });

  test("an invalid colour is not contaminated by the previous measurement", () => {
    tillRgba("#ff0000");

    expect(tillRgba("inte-en-färg").slice(0, 3)).toEqual([0, 0, 0]);
  });

  /*
   * `transparent` is `background-color`'s initial value — every element that
   * never got one of its own has it. QA found (13/9) that `kontrast()` read
   * `tillRgba("transparent")` (`[0, 0, 0, 0]`) as if it were opaque black,
   * because it only ever looked at R, G and B: a fully see-through surface
   * scored the same as the darkest possible one, and against a light track
   * that is a confidently wrong high number, not a low one — the worst kind
   * of error, because it looks like a pass.
   *
   * `kontrast()` refuses instead of guessing: composing the real colour
   * needs to know what is BEHIND the transparent layer, and a function with
   * no access to the DOM cannot know that (`effektivBakgrund` is the one
   * that does, by walking up and blending — its own result always carries
   * alpha 1, which is why callers that go through it are never the ones
   * throwing here). The one deliberately transparent token drawn as
   * something real, `--fw-focus-ring` (`rgb(79 70 229 / 35%)`), is not
   * measured by anything today; the day it is, whoever writes that call
   * composes it against its real backdrop on purpose, rather than this
   * function guessing for them.
   */
  test("en genomskinlig färg vägras — den mäts inte som helsvart", () => {
    expect(() => kontrast(tillRgba("transparent"), tillRgba("#ffffff"))).toThrow();
  });

  test("en halvgenomskinlig färg (fokusringen) vägras också", () => {
    expect(() =>
      kontrast(tillRgba("rgb(79 70 229 / 35%)"), tillRgba("#ffffff")),
    ).toThrow();
  });
});
