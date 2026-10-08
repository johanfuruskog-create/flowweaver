import { describe, expect, test } from "vitest";

import { getCodeLists, registerCodeList, getCodeList } from "./code-list-registry";
import { navetCountryCodes } from "./navet-country-codes";

import type { CodeList } from "./code-list-registry";

/**
 * What a bundled code list must hold true.
 *
 * ## Why this is worth a test at all
 *
 * The list is a **copy of somebody else's document**, generated out of a PDF by
 * `tools/extract-navet.mjs`. Two things go wrong with copies: the extraction
 * silently loses rows, and the source publishes a new version while ours stands
 * still. Neither shows up as a crash. The first shows up as a country somebody
 * cannot pick, months later, reported by the one person it applied to.
 *
 * So the count is asserted. 204 is not a magic number — it is how many code
 * cells the source document has, counted in the column rather than guessed, and
 * a change to it is either a new version or a broken reader. Both are things
 * somebody should have to look at.
 *
 * ## The four that are not ISO
 *
 * They are named individually because they are the reason a generic ISO package
 * cannot be used here, and the reason is easy to lose. A guide about permits or
 * benefits that cannot express **stateless** is broken for exactly the people it
 * exists for.
 */

registerCodeList(navetCountryCodes);

describe("the NAVET country list", () => {
  test("carries every code in the source, once", () => {
    // 204 code cells counted in the source's own code column.
    expect(navetCountryCodes.items).toHaveLength(204);

    const codes = navetCountryCodes.items.map((item) => item.value);

    expect(new Set(codes).size).toBe(codes.length);
  });

  test("says what it is a copy of, and of which version", () => {
    // Without these a drifted copy is indistinguishable from a current one.
    expect(navetCountryCodes.version).toBe("2.1");
    expect(navetCountryCodes.published).toBe("2025-11-05");
    expect(navetCountryCodes.source).toContain("Skatteverket");
    expect(navetCountryCodes.sourceUrl).toMatch(/^https:\/\//);
  });

  test("holds the four codes ISO does not have", () => {
    const found = new Map(
      navetCountryCodes.items.map((item) => [item.value, item.label.sv]),
    );

    expect(found.get("XO")).toBe("Okänt land");
    expect(found.get("XS")).toBe("Statslös");
    expect(found.get("ZZ")).toBe("Under utredning");
    expect(found.get("XU")).toBe("Upphört land");
  });

  test("keeps the source's spelling wherever we publish another", () => {
    const changed = navetCountryCodes.items.filter((item) => item.sourceLabel);

    // One, and it is a typo in the source document: two `a` glyphs, 4.92pt
    // apart, which is a character step at that size. Correcting it silently
    // would make this a copy of nothing in particular.
    expect(changed).toHaveLength(1);
    expect(changed[0]?.value).toBe("VG");
    expect(changed[0]?.label.sv).toBe("Brittiska Jungfruöarna");
    expect(changed[0]?.sourceLabel).toBe("Brittiska Jungfruöaarna");
  });

  test("reads as alpha-2 throughout, which is what it claims to be", () => {
    expect(navetCountryCodes.standard).toBe("iso-3166-1-alpha-2");

    const wrong = navetCountryCodes.items.filter(
      (item) => !/^[A-Z]{2}$/.test(item.value),
    );

    expect(wrong).toEqual([]);
  });

  test("names every country in both languages", () => {
    /*
     * The failure this is written from: the English example page offered Swedish
     * labels, so "Sweden" found nothing and "Sverige" found Sverige. A list that
     * is complete in one language and silent in another does not announce it —
     * it just returns no suggestions to whoever is reading the other one.
     */
    const missing = navetCountryCodes.items.filter(
      (item) =>
        !item.label.sv?.trim() ||
        !item.label.en?.trim() ||
        // CLDR hands back the code itself for anything it does not know, and a
        // country called "XK" is worse than a missing one, because it looks like
        // an answer.
        item.label.en === item.value,
    );

    expect(missing).toEqual([]);
  });

  test("says where each language's names come from", () => {
    // The codes and the labels do not share an authority: Skatteverket publishes
    // no English at all. Somebody reading this in a year should not have to
    // guess which half they are looking at.
    expect(navetCountryCodes.labelSources?.sv).toContain("Skatteverket");
    expect(navetCountryCodes.labelSources?.en).toContain("CLDR");
  });

  test("uses names a person would pick, not the ones a lawyer would write", () => {
    const byCode = new Map(
      navetCountryCodes.items.map((item) => [item.value, item.label.en]),
    );

    /*
     * ISO's own English short names were the obvious source and the wrong one:
     * "United States of America (the)", "Korea (the Republic of)". They are
     * correct and nobody scrolls to them. These four are the ones that differ,
     * so they are the ones that catch a switch back to ISO.
     */
    expect(byCode.get("US")).toBe("United States");
    expect(byCode.get("GB")).toBe("United Kingdom");
    expect(byCode.get("KR")).toBe("South Korea");
    expect(byCode.get("NL")).toBe("Netherlands");
  });

  test("keeps Swedish as Skatteverket wrote it, not as CLDR would", () => {
    const byCode = new Map(
      navetCountryCodes.items.map((item) => [item.value, item.label.sv]),
    );

    // CLDR answers "Kongo-Kinshasa" and "USA" here. For Swedish public sector
    // the authority is Skatteverket, and the two genuinely disagree.
    expect(byCode.get("CD")).toBe("Demokratiska republiken Kongo");
    expect(byCode.get("US")).toBe("USA");
  });

  test("translates the four non-ISO codes itself, since CLDR cannot", () => {
    const byCode = new Map(
      navetCountryCodes.items.map((item) => [item.value, item.label.en]),
    );

    // ZZ is the one that matters: CLDR says "Unknown Region" and Skatteverket
    // means a case being looked into. Taking CLDR's word would have put a wrong
    // translation in front of somebody.
    expect(byCode.get("ZZ")).toBe("Under investigation");
    expect(byCode.get("XS")).toBe("Stateless");
    expect(byCode.get("XO")).toBe("Unknown country");
    expect(byCode.get("XU")).toBe("Ceased country");
  });
});

describe("the registry", () => {
  test("hands back a list by its id and null for one it has never heard of", () => {
    expect(getCodeList("navet-country-codes")?.id).toBe("navet-country-codes");
    expect(getCodeList("finns-inte")).toBeNull();
  });

  test("takes a second list of the same countries under another standard", () => {
    /*
     * The point of the `standard` field, exercised rather than asserted.
     *
     * Two lists may name the same places and disagree entirely about what to
     * store — `SE` against `SWE` against `752`. Nothing about the first list may
     * make the second a fork of it, or the format has failed at the one job it
     * was given.
     */
    const alpha3: CodeList = {
      id: "prov-alpha-3",
      standard: "iso-3166-1-alpha-3",
      label: { sv: "Prov" },
      version: "",
      published: "2026-08-15",
      source: "Testet självt",
      items: [{ value: "SWE", label: { sv: "Sverige" } }],
    };

    registerCodeList(alpha3);

    expect(getCodeList("prov-alpha-3")?.items[0]?.value).toBe("SWE");
    expect(getCodeList("navet-country-codes")?.items.find((i) => i.label.sv === "Sverige")?.value).toBe("SE");
    expect(getCodeLists().length).toBeGreaterThan(1);
  });
});
