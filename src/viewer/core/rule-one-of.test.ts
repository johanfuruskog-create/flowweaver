import { describe, expect, test } from "vitest";

import { evaluateCondition } from "./rule-evaluator";

import type { RuleCondition } from "../types/graph";

/**
 * "Är någon av" — one condition where twenty-seven used to be needed.
 *
 * ## Why this exists
 *
 * Nobody branches per country. They branch on **membership**: EU, EEA, the
 * Nordics, outside. That was already expressible — one case, `match: "any"`,
 * twenty-seven `equals` conditions — and nobody would author it by hand. The
 * code lists that ship with the product are half a feature without this.
 *
 * ## The separator, and why it is not configurable
 *
 * A comma. Codes in the lists we ship are alphanumeric — `SE`, `1880`, `XS` —
 * so a comma can never be part of one, and a list somebody types reads the way
 * they would say it. Spaces around the entries are ignored, because a person
 * writing `SE, DK, FI` has written what they meant.
 *
 * ## What it deliberately does not do
 *
 * Numbers. `one-of` compares text, so `07` does not match `7`. The numeric
 * operators exist for quantities and this one is for identity — a code is
 * compared, never counted, and a code list's values are strings by contract.
 */

const one = (value: string, operator: RuleCondition["operator"] = "one-of"): RuleCondition => ({
  id: "c",
  variableName: "landskod",
  operator,
  value,
});

const matches = (condition: RuleCondition, answer: string): boolean => {
  const result = evaluateCondition(condition, answer);

  return result.success && result.matches;
};

describe("är någon av", () => {
  test("matches any of the listed values", () => {
    const nordic = one("SE,DK,FI,NO,IS");

    expect(matches(nordic, "SE")).toBe(true);
    expect(matches(nordic, "IS")).toBe(true);
    expect(matches(nordic, "DE")).toBe(false);
  });

  test("ignores the spaces a person writes around the commas", () => {
    expect(matches(one("SE, DK , FI"), "DK")).toBe(true);
  });

  test("matches a single value, so it is not only for lists", () => {
    expect(matches(one("XS"), "XS")).toBe(true);
    expect(matches(one("XS"), "SE")).toBe(false);
  });

  test("an empty entry matches nothing rather than everything", () => {
    /*
     * `"SE,,DK"` and a trailing comma are what a half-finished edit looks like.
     * Matching an empty answer against the empty entry would make the case true
     * for anybody who had not answered — the widest possible branch, arrived at
     * by a typo.
     */
    expect(matches(one("SE,,DK"), "")).toBe(false);
    expect(matches(one("SE,"), "")).toBe(false);
    expect(matches(one(""), "")).toBe(false);
  });

  test("compares text, not numbers", () => {
    // A municipality code is "0180" and not 180. The numeric operators are for
    // quantities; this one is for identity.
    expect(matches(one("0180,1480"), "0180")).toBe(true);
    expect(matches(one("0180,1480"), "180")).toBe(false);
  });

  test("is case-sensitive, because a code is", () => {
    // Codes come from a list, not from typing, so leniency here would only hide
    // a guide that stores something other than what its list offers.
    expect(matches(one("SE,DK"), "se")).toBe(false);
  });

  test("says so when it does not match, rather than failing", () => {
    // `success: false` means "this condition could not be judged" and makes the
    // whole case indeterminate. A miss is a judgement, not a failure.
    const result = evaluateCondition(one("SE,DK"), "DE");

    expect(result.success).toBe(true);
    expect(result.success && result.matches).toBe(false);
  });
});

describe("är inte någon av", () => {
  test("is the exact negation", () => {
    const outside = one("SE,DK,FI,NO,IS", "not-one-of");

    expect(matches(outside, "DE")).toBe(true);
    expect(matches(outside, "SE")).toBe(false);
  });

  test("an unanswered variable is not in the list, so it is outside it", () => {
    /*
     * Worth stating rather than discovering. "Not one of the Nordics" is true
     * for somebody who has not answered, which is right — they are not in the
     * list — and it is exactly the case where a guide should have asked first.
     * The health check's business, not this one's.
     */
    expect(matches(one("SE,DK", "not-one-of"), "")).toBe(true);
  });
});

/**
 * Flera svar i samma variabel — det som gör medborgarskap till en lista.
 *
 * ## Varför den här saknades
 *
 * Ett flervärt svar lagras radbrytningsseparerat: `"SE\nDE"`. `one-of` jämförde
 * hela strängen mot listan, så en regel på ett flervalssvar matchade
 * ingenting — tyst, och alltid till förmån för standardgrenen. Hittat när
 * medborgarskapsguiden skulle fråga *vilka* medborgarskap någon har i stället
 * för vilket. Dubbelt medborgarskap är vanligt, och ett formulär som bara
 * rymmer ett är fel för precis de personer frågan handlar om.
 *
 * ## Varför "någon av" och inte "alla"
 *
 * För att det är vad man frågar. *Har du EU-medborgarskap* är sant för den som
 * har ett svenskt och ett turkiskt. `not-one-of` blir dess spegel — sant först
 * när INGET av svaren finns i listan — vilket är den enda läsning som gör
 * "varken eller" uttryckbart.
 *
 * Ett svar med ett enda värde är en lista med ett element, så allt som redan
 * fanns beter sig exakt som förut.
 */
describe("ett svar som är flera", () => {
  test("matchar när något av svaren finns i listan", () => {
    expect(matches(one("SE,DK,FI,NO,IS"), "DE\nSE")).toBe(true);
  });

  test("och inte när inget av dem gör det", () => {
    expect(matches(one("SE,DK,FI,NO,IS"), "DE\nTR")).toBe(false);
  });

  test("not-one-of är sant först när inget av svaren finns i listan", () => {
    expect(matches(one("SE,DK,FI,NO,IS", "not-one-of"), "DE\nTR")).toBe(true);
    expect(matches(one("SE,DK,FI,NO,IS", "not-one-of"), "DE\nSE")).toBe(false);
  });

  test("ett ensamt svar beter sig som förut", () => {
    expect(matches(one("SE,DK"), "SE")).toBe(true);
    expect(matches(one("SE,DK"), "DE")).toBe(false);
  });

  test("och tomma rader räknas inte som ett svar", () => {
    // Samma skäl som den tomma posten i listan: ett halvfärdigt svar ska inte
    // göra en gren sann för alla som inte svarat.
    expect(matches(one("SE,DK"), "\n\n")).toBe(false);
    expect(matches(one("SE,DK", "not-one-of"), "\n\n")).toBe(true);
  });
});
