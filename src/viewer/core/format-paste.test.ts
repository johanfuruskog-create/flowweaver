import { afterEach, describe, expect, test } from "vitest";

import "./default-formats";
import { registerFormat, unregisterFormat } from "./format-registry";
import { findInPasted } from "./format-validators";

/**
 * Finding the value inside something pasted.
 *
 * ## Why paste is not typing
 *
 * Typing arrives a character at a time and a label can never appear. A paste is
 * a whole string, and people paste the line rather than the value —
 * `Personnummer: 19800223-7538` out of an email, `NI: AB123456C` out of a letter
 * — because that is how copying works.
 *
 * For a shape of nothing but digits the label falls away on its own: letters
 * have no slot. For a **mixed** shape they do have one, and `NI` is two perfectly
 * good letters, so `NI: AB123456C` came out as `NI 12 34 56 C` — a wrong number
 * rather than a refused one, which is the worse of the two.
 *
 * ## What decides
 *
 * The format's own `validate`, which is the one thing a shape cannot answer.
 * Windows the width of the pattern are tried from the end backwards, because a
 * label stands before its value in every real paste.
 *
 * Where a format cannot judge authenticity — a template's mask has a shape and
 * no opinion — nothing is found and the paste is shaped as before. A guess would
 * be worse than the label it was guessing away.
 */

const NI = /^[ABCEGHJ-PRSTW-Z][ABCEGHJ-NPRSTW-Z]\d{6}[A-D]$/;

afterEach(() => {
  unregisterFormat("ni");
  unregisterFormat("shape-only");
});

const registerNi = (): void =>
  registerFormat("ni", {
    label: "National Insurance number",
    pattern: "AA ## ## ## A",
    canonical: (value) => value.replace(/[\s-]/g, "").toUpperCase(),
    validate: (value) =>
      NI.test(value.replace(/[\s-]/g, "").toUpperCase()) ? null : "validation.format.ni",
  });

describe("en etikett framför numret", () => {
  test("hittas och kastas, för en blandad form", () => {
    registerNi();

    expect(findInPasted("ni", undefined, "NI: AB123456C")).toEqual({
      outcome: "one",
      value: "AB123456C",
    });
  });

  test("även när etiketten är ett helt ord", () => {
    registerNi();

    expect(findInPasted("ni", undefined, "National Insurance AB123456C")).toEqual({
      outcome: "one",
      value: "AB123456C",
    });
  });
});

describe("när det inte finns något att hitta", () => {
  test("säger den ifrån i stället för att gissa", () => {
    registerNi();

    expect(findInPasted("ni", undefined, "QQ: ZZ999999Z"), "gissade ändå").toEqual({
      outcome: "none",
    });
  });

  test("och rör inte en inklistring som redan är numret", () => {
    // Nothing longer than the shape: there is no label to strip.
    registerNi();

    expect(findInPasted("ni", undefined, "AB123456C")).toEqual({ outcome: "none" });
  });
});

describe("en form utan omdöme", () => {
  test("letar inte, eftersom den inte kan avgöra vad som är äkta", () => {
    /*
     * A template's own mask shapes and validates nothing. Searching with no test
     * would mean picking whichever window happened to fit — the wrong number,
     * confidently.
     */
    registerFormat("shape-only", { label: "Bara form", pattern: "AA-###" });

    expect(findInPasted("shape-only", undefined, "REF ab123")).toEqual({ outcome: "none" });
  });
});

describe("två nummer i samma inklistring", () => {
  test("väljer inget, eftersom vi inte vet vilket som menades", () => {
    /*
     * The direction of the search used to decide this silently: from the end it
     * took the last, from the front the first, and neither is a rule — a label
     * stands before its value in `NI: AB123456C` and after it in
     * `AB123456C (utgången)`. Refusing is the only answer that is not a guess —
     * and `many` is its own answer, because when it shared a `null` with
     * "nothing found" the caller shaped the first twelve digits anyway.
     */
    registerNi();

    expect(
      findInPasted("ni", undefined, "AB123456C eller CB654321A"),
      "valde ett av två",
    ).toEqual({ outcome: "many" });
  });
});
