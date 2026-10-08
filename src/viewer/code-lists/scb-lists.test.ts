import { describe, expect, test } from "vitest";

import { codeListFault } from "./code-list-registry";
import { scbCounties } from "./scb-counties";
import { scbMunicipalities } from "./scb-municipalities";
import { navetCountryCodes } from "./navet-country-codes";

/**
 * SCB's counties and municipalities, and the synonyms their country list gave.
 *
 * ## Why two lists and not one
 *
 * A municipality's code begins with its county's — `0114` sits in `01` — so one
 * list could serve both. It would work only because SCB happened to design the
 * codes that way, and a guide asking "which county" would carry 290 entries to
 * offer 21.
 *
 * ## What SCB's country list was actually good for
 *
 * Not as a list. It has no `SE`, no stateless, its names are sorted for a
 * printed index — *"Arabemiraten, Förenade"* — and some of them are in English.
 * Skatteverket's list serves folkbokföring, which is about people, and that is
 * the one to offer.
 *
 * But where two Swedish authorities disagree about a country's name, the other
 * one's is a name Swedes also use — from a source rather than invented by us.
 * That is where the synonyms come from, and it is why "Vitryssland" now finds
 * Belarus.
 */

describe("SCB's regional lists", () => {
  test("hold every county and every municipality, once", () => {
    expect(scbCounties.items).toHaveLength(21);
    expect(scbMunicipalities.items).toHaveLength(290);

    for (const list of [scbCounties, scbMunicipalities]) {
      const codes = list.items.map((item) => item.value);

      expect(new Set(codes).size).toBe(codes.length);
    }
  });

  test("use SCB's own codes and say so", () => {
    // `custom`, because four digits for a municipality is SCB's scheme and not
    // an ISO standard. Claiming otherwise would invite comparison with a list
    // that means something else by the same number.
    expect(scbCounties.standard).toBe("custom");
    expect(scbMunicipalities.standard).toBe("custom");
    expect(scbCounties.source).toContain("SCB");
    expect(scbMunicipalities.version).toBe("2026");
  });

  test("shape their codes the way the source does", () => {
    expect(scbCounties.items.every((item) => /^\d{2}$/.test(item.value))).toBe(true);
    expect(scbMunicipalities.items.every((item) => /^\d{4}$/.test(item.value))).toBe(true);
  });

  test("every municipality sits in a county that exists", () => {
    const counties = new Set(scbCounties.items.map((item) => item.value));
    const orphans = scbMunicipalities.items.filter(
      (item) => !counties.has(item.value.slice(0, 2)),
    );

    expect(orphans).toEqual([]);
  });

  test("name a few places somebody would recognise", () => {
    const byCode = new Map(scbMunicipalities.items.map((item) => [item.value, item.label.sv]));

    // Without this the count could be right and the names shifted by a row.
    expect(byCode.get("0180")).toBe("Stockholms kommun");
    expect(byCode.get("1480")).toBe("Göteborgs kommun");
    expect(byCode.get("2584")).toBe("Kiruna kommun");
  });

  test("carry the full names, which no rule could have given", () => {
    // Johan 6/9: "Ansökan går till Umeå" sounds like a town. The full names
    // come from Wikidata (tools/extract-scb.mjs says why): with an s, without,
    // Falun's own stem, and the one label the tool overrides.
    const byCode = new Map(scbMunicipalities.items.map((item) => [item.value, item.label.sv]));

    expect(byCode.get("0860")).toBe("Hultsfreds kommun");
    expect(byCode.get("2480")).toBe("Umeå kommun");
    expect(byCode.get("2080")).toBe("Falu kommun");
    expect(byCode.get("0980")).toBe("Gotlands kommun");
  });

  test("pass the same validation a host's list has to", () => {
    expect(codeListFault(scbCounties)).toBeNull();
    expect(codeListFault(scbMunicipalities)).toBeNull();
  });
});

describe("the synonyms SCB's country names gave", () => {
  const synonymsOf = (code: string): string[] =>
    navetCountryCodes.items
      .find((item) => item.value === code)
      ?.synonyms?.map((one) => one.sv ?? "") ?? [];

  test("let somebody type the name they use", () => {
    // The case that started this: the list says Belarus, half the country says
    // Vitryssland, and a field that finds nothing reads as broken.
    expect(synonymsOf("BY")).toContain("Vitryssland");
    expect(synonymsOf("MM")).toContain("Burma");
    expect(synonymsOf("TL")).toContain("Timor-Leste");
  });

  test("cover the spellings people reach for", () => {
    expect(synonymsOf("MX")).toContain("Mexico");
    expect(synonymsOf("UA")).toContain("Ukraine");
    expect(synonymsOf("YE")).toContain("Yemen");
  });

  test("are not the same words in another order", () => {
    /*
     * SCB sorts for a printed index, so "Arabemiraten, Förenade" and
     * "Jungfruöarna, Brittiska" came through on the first run. Each of those
     * words is already inside the label, and the field matches on substrings —
     * so they were noise, and the rule now drops any form whose words the label
     * already has.
     */
    expect(synonymsOf("AE")).toEqual([]);
    expect(synonymsOf("VG")).toEqual([]);
    expect(synonymsOf("CD")).toEqual([]);
  });

  test("exist at all, in a number somebody could have counted", () => {
    const withSynonyms = navetCountryCodes.items.filter((item) => item.synonyms?.length);

    // Nineteen of the twenty-seven names the two authorities disagree about.
    // A change here means SCB published a new file or the rule changed, and
    // both are things to look at rather than to absorb.
    expect(withSynonyms).toHaveLength(19);
  });
});
