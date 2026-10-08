import { describe, expect, test } from "vitest";

import { maskGrouped, ungroup } from "./format-validators";

/**
 * An amount is grouped and read back in the language it is shown in.
 *
 * ## The fault
 *
 * Two copies of the same job. `maskThousands` carried the rule that decides
 * this — *a character may act as the decimal mark unless it is this language's
 * group separator* — and `maskGrouped`, written later and wired into the
 * viewer, did not. Swedish survived by luck: its group separator is a
 * non-breaking space, which is filtered out anyway. English and German did not,
 * because their group separators are exactly `,` and `.`.
 *
 * Measured in English, typing `12345` one key at a time: the field shows
 * `1,234` after four digits; the fifth re-masks the raw string `1,2345`, the
 * comma is read as a decimal mark, and the field — and `data-canonical` with it
 * — becomes `1.2345`. Wrong by a factor of ten thousand, with no validation
 * error, because `1.2345` is a perfectly good number.
 *
 * `ungroup` had no locale at all, which is worse: it decides what is **stored**.
 * A stored `1234567` rendered in an English guide as `1,234,567` was rewritten
 * to `1.234567` on mount, before anybody touched the field.
 *
 * ## Why these cases
 *
 * `600,5` is the pair that makes the rule visible: in English it is six hundred
 * thousand and five typed badly, in Swedish it is six hundred point five. Same
 * input, two right answers, and only the locale can tell them apart.
 */

/** Non-breaking space — what Swedish groups with, and what `Intl` hands out. */
const NBSP = " ";

describe("what the language says a separator means", () => {
  test("a comma groups in English, so it never becomes a decimal mark", () => {
    expect(maskGrouped("600,0000", 8, "en").value).toBe("6,000,000");
  });

  test("and the same input means different things in the two languages", () => {
    expect(maskGrouped("600,5", 5, "en").value).toBe("6,005");
    expect(maskGrouped("600,5", 5, "sv").value).toBe(`600,5`);
  });

  test("a period still marks decimals in Swedish, where the keypad offers one", () => {
    expect(maskGrouped("600.5", 5, "sv").value).toBe("600,5");
  });

  test("typing digit by digit never turns a group separator into a decimal", () => {
    /*
     * The measured sequence. The fifth keystroke is where it broke: the field
     * held `1,234`, and re-masking read its own comma as a decimal mark.
     */
    expect(maskGrouped("1234", 4, "en").value).toBe("1,234");
    expect(maskGrouped("1,2345", 6, "en").value).toBe("12,345");
  });
});

describe("what gets stored", () => {
  test("an English amount keeps its digits", () => {
    expect(ungroup("600,000", "en")).toBe("600000");
  });

  test("including one that arrived already grouped, before anybody typed", () => {
    // The mount case: a stored value rendered grouped, then read straight back.
    expect(ungroup("1,234,567", "en")).toBe("1234567");
  });

  test("a Swedish amount keeps its digits too", () => {
    expect(ungroup(`600${NBSP}000`, "sv")).toBe("600000");
  });

  test("and a real decimal survives, in either language", () => {
    /*
     * Stored form is unchanged by all of this: bare digits with a period for
     * the decimal, which is what `Number` reads and what the engine has always
     * been handed.
     */
    expect(ungroup("600,5", "sv")).toBe("600.5");
    expect(ungroup("6,000.5", "en")).toBe("6000.5");
  });

  test("a negative amount keeps its sign", () => {
    expect(ungroup("-1,500", "en")).toBe("-1500");
  });
});
