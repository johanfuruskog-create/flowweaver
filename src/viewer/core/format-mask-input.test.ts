import { describe, expect, test } from "vitest";

import "./default-formats";
import { maskFormat, maskWithPattern } from "./format-validators";

/**
 * A shaped field takes what the shape allows, and nothing else.
 *
 * ## The fault
 *
 * The mask kept every letter and digit, then dropped the ones that did not fit
 * from inside the loop that was placing them — with a stale index. The result
 * was not a rejection but a reordering:
 *
 *     "abc"                          → "b"
 *     "Anna Andersson"               → "naneso"
 *     "Personnummer: 19800223-7538"  → "esnumr19-8002"
 *
 * The third is the one that matters. Copying a personnummer out of an email
 * brings the label with it — that is how people paste — and what came back bore
 * no resemblance to what was in the clipboard. Nothing on screen explained it.
 *
 * ## The rule
 *
 * Johan's: a field with a settled shape should accept only what validation would
 * allow. A pattern of nothing but `#` has no room for a letter, so a letter is
 * not a character in the wrong slot — it has no slot at all, and is dropped
 * before placing begins.
 *
 * It also makes something that already worked principled rather than accidental:
 * `19800223 7538` shaped correctly before, but only because a space happened to
 * survive the old filter.
 */

describe("det som klistras in", () => {
  test("tappar sin etikett och behåller numret", () => {
    expect(maskFormat("personnummer", "Personnummer: 19800223-7538", 27).value).toBe(
      "19800223-7538",
    );
  });

  test("och ett mellanslag i stället för ett streck duger", () => {
    expect(maskFormat("personnummer", "19800223 7538", 13).value).toBe("19800223-7538");
  });
});

describe("det som inte hör hemma i formen", () => {
  test("syns inte alls, i stället för att kastas om", () => {
    /*
     * Nothing, rather than something wrong. A field that answers "naneso" to a
     * name has told the person their input was understood and rewritten; an
     * empty one has told them it was not accepted, which is the truth.
     */
    expect(maskFormat("personnummer", "Anna Andersson", 14).value).toBe("");
    expect(maskFormat("personnummer", "har inget", 9).value).toBe("");
    expect(maskFormat("personnummer", "abc", 3).value).toBe("");
  });

  test("och siffrorna bland skräpet överlever", () => {
    expect(maskFormat("personnummer", "DE 1980-02-23", 13).value).toBe("19800223");
  });
});

describe("en form som har plats för bokstäver", () => {
  test("släpper in dem, eftersom mönstret säger så", () => {
    /*
     * The filter asks the pattern, not a fixed idea of what a field holds. A
     * shape with `A` slots keeps its letters — otherwise this fix would have
     * broken every identifier that is not a number.
     */
    expect(maskWithPattern("AA-###", "ab123", 5).value).toBe("ab-123");
    expect(maskWithPattern("AA-###", "12ab345", 7).value).toBe("ab-345");
  });
});
