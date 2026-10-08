import { describe, expect, test } from "vitest";

import { validateFormat } from "./format-validators";

/**
 * The parts of a personal identity number that arithmetic alone does not catch.
 *
 * ## Why this was written
 *
 * The question was whether to take a dependency for this. Measuring our own
 * validator first said more than the answer would have: it did Luhn over ten
 * digits and nothing else, so the date was never looked at. February the 31st
 * was refused, but by luck — those particular check digits happened not to add
 * up. `9902310003` does add up, and went straight through.
 *
 * Ten zeros went through too. Luhn is happy with them; a person is not.
 *
 * ## Samordningsnummer
 *
 * A co-ordination number is the same shape with sixty added to the day, and it
 * is what somebody has who does not have a personal number — newly arrived, or
 * working here without being registered. Refusing it is not strictness, it is a
 * form that turns away exactly the people it was most likely written for. The
 * same shape as `XS` for stateless in the country list.
 *
 * ## Why not a library
 *
 * The arithmetic is fifteen lines and already written. What the libraries are
 * worth is this list of cases — so the cases were taken and the dependency was
 * not: every resident downloads the viewer, including for guides that never ask
 * for a personal number, and a package is code we do not control running on
 * somebody's municipal page.
 */

const ok = (value: string) => validateFormat("personnummer", undefined, value) === null;

describe("what has always worked", () => {
  test("accepts both the twelve- and ten-digit forms", () => {
    expect(ok("19900101-0017")).toBe(true);
    expect(ok("900101-0017")).toBe(true);
    expect(ok("9001010017")).toBe(true);
  });

  test("refuses a number whose check digit does not add up", () => {
    expect(ok("900101-0018")).toBe(false);
  });
});

describe("dates that do not exist", () => {
  test("refuses the 31st of February even when the arithmetic agrees", () => {
    // The one that went through. Luhn-valid and not a day.
    expect(ok("9902310003")).toBe(false);
  });

  test("refuses the 30th of February, month 13 and day zero", () => {
    expect(ok("9902300004")).toBe(false);
    expect(ok("9913010006")).toBe(false);
    expect(ok("9900000002")).toBe(false);
  });

  test("refuses the 31st of a thirty-day month", () => {
    expect(ok("9904310001")).toBe(false);
    expect(ok("9906310009")).toBe(false);
  });

  test("still accepts the 29th of February in a leap year", () => {
    // 2000 was one. Refusing a real birthday is the worse mistake of the two.
    //
    // The check digit is computed, not invented: my first two fixtures here
    // were made up, failed Luhn, and made the tests fail for a reason that had
    // nothing to do with dates.
    expect(ok("0002290005")).toBe(true);
  });
});

describe("samordningsnummer", () => {
  test("is accepted, because the people who have one exist", () => {
    // The day is the real day plus sixty: the 1st becomes 61.
    expect(ok("9001610006")).toBe(true);
  });

  test("is refused when its day is impossible even after subtracting sixty", () => {
    // Day 92 is the 32nd, which is no more a day than the 32nd was.
    expect(ok("9900920001")).toBe(false);
  });
});

describe("ten zeros", () => {
  test("are not a personal number, whatever Luhn says", () => {
    // Luhn is content with them, and they are the first thing anybody types to
    // see whether a field is checking at all.
    expect(ok("0000000000")).toBe(false);
  });
});
