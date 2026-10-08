import { describe, expect, test } from "vitest";

import {
  registerCodeList,
  unregisterCodeList,
  getCodeList,
  codeListFault,
} from "./code-list-registry";
import { navetCountryCodes } from "./navet-country-codes";
import { scbCounties } from "./scb-counties";
import { scbMunicipalities } from "./scb-municipalities";

import type { CodeList } from "./code-list-registry";

/**
 * A list is something you add, not something everybody carries.
 *
 * ## The measurement behind this
 *
 * The country list costs 3,4 kB gzip, measured by building the bundles with and
 * without it. That is affordable, and bundling it was still the wrong default:
 * every resident downloads the **viewer**, in every guide, whether or not it
 * asks about countries. Municipality codes are 290 entries and SNI codes some
 * eight hundred, so a bundle that grows with every list anybody might want is a
 * bundle nobody can defend.
 *
 * So nothing is registered by default. `registerCodeList` takes plain data, the
 * lists ship as JSON beside the bundles, and a host registers what they use —
 * the same seam as the language packs, which is a seam a host already knows.
 *
 * ## Why the JSON is compared against the module
 *
 * Both come out of one run of `tools/extract-navet.mjs`, and the reason is that
 * a host fetching a file which disagrees with the module we test against is the
 * worst of both. This asserts they still agree, which is the thing a separate
 * generation step would break silently.
 */

const json = (await import("../../../public/code-lists/navet-country-codes.json", {
  with: { type: "json" },
})) as { default: CodeList };
const counties = (await import("../../../public/code-lists/scb-counties.json", {
  with: { type: "json" },
})) as { default: CodeList };
const municipalities = (await import("../../../public/code-lists/scb-municipalities.json", {
  with: { type: "json" },
})) as { default: CodeList };

describe("the distributed JSON", () => {
  test("says the same thing as the module we test against", () => {
    expect(json.default.id).toBe(navetCountryCodes.id);
    expect(json.default.version).toBe(navetCountryCodes.version);
    expect(json.default.items).toHaveLength(navetCountryCodes.items.length);

    const fromJson = new Map(json.default.items.map((i) => [i.value, i.label.sv]));
    const fromModule = new Map(navetCountryCodes.items.map((i) => [i.value, i.label.sv]));

    expect([...fromJson.entries()].sort()).toEqual([...fromModule.entries()].sort());
  });

  test("registers as it stands, without anything of ours in between", () => {
    // What a host does: fetch the file, hand over what came back.
    registerCodeList(json.default);

    expect(getCodeList("navet-country-codes")?.items).toHaveLength(204);

    unregisterCodeList("navet-country-codes");
    expect(getCodeList("navet-country-codes")).toBeNull();
  });
});

describe("every distributed list", () => {
  const all: Array<[string, CodeList, CodeList]> = [
    ["länder", json.default, navetCountryCodes],
    ["län", counties.default, scbCounties],
    ["kommuner", municipalities.default, scbMunicipalities],
  ];

  test.each(all)("%s: the JSON and the module agree", (_name, fromJson, fromModule) => {
    expect(fromJson.id).toBe(fromModule.id);
    expect(fromJson.version).toBe(fromModule.version);
    expect(fromJson.items).toHaveLength(fromModule.items.length);

    /*
     * Flaggan är MED i jämförelsen.
     *
     * Den låg utanför när den skrevs: raden jämförde `value=label.sv` ensamt,
     * så en post märkt `exclusive` i modulen och omärkt i JSON:en — eller
     * tvärtom — hade passerat tyst, och en värd som hämtar filen hade fått en
     * annan regel än den vi testar mot. Precis det silen den här filen finns
     * för att stänga.
     */
    const pairs = (list: CodeList) =>
      list.items
        .map((item) => `${item.value}=${item.label.sv}${item.exclusive ? " ensam" : ""}`)
        .sort();

    expect(pairs(fromJson)).toEqual(pairs(fromModule));
  });

  test("marks the four codes that cannot be held with any other", () => {
    const ensamma = (list: CodeList) =>
      list.items.filter((item) => item.exclusive === true).map((item) => item.value).sort();

    // Skatteverkets fyra egna: statslös, okänt land, under utredning, upphört
    // land. Ingen av dem är ett land man kan ha DESSUTOM. Berättelse 062.
    expect(ensamma(navetCountryCodes)).toEqual(["XO", "XS", "XU", "ZZ"]);
    expect(ensamma(json.default)).toEqual(["XO", "XS", "XU", "ZZ"]);
  });

  test.each(all)("%s: registers as it stands", (_name, fromJson) => {
    registerCodeList(fromJson);
    expect(getCodeList(fromJson.id)?.items.length).toBe(fromJson.items.length);
    unregisterCodeList(fromJson.id);
  });
});

describe("a list that is not a list", () => {
  /*
   * The quiet failure is the dangerous one. A list that registers with no items
   * gives a field that finds nothing, which looks exactly like a search that
   * found nothing — and somebody debugs their spelling for an hour.
   */
  const fel: Array<[string, unknown, string]> = [
    ["ingenting", null, "inte ett objekt"],
    ["en sträng", "navet", "inte ett objekt"],
    ["utan id", { standard: "custom", items: [{ value: "SE", label: { sv: "Sverige" } }] }, "saknar id"],
    ["utan poster", { id: "tom", standard: "custom", items: [] }, "har inga poster"],
    [
      "utan känd standard",
      { id: "x", standard: "hittepå", items: [{ value: "SE", label: { sv: "Sverige" } }] },
      "saknar en känd standard",
    ],
    [
      "post utan värde",
      { id: "x", standard: "custom", items: [{ value: "", label: { sv: "Sverige" } }] },
      "saknar värde",
    ],
    [
      "post utan etikett på något språk",
      { id: "x", standard: "custom", items: [{ value: "SE", label: { sv: "  " } }] },
      "ingen etikett",
    ],
  ];

  test.each(fel)("%s is refused by name", (_name, bad, says) => {
    expect(codeListFault(bad)).toContain(says);
    expect(() => registerCodeList(bad as CodeList)).toThrow(/går inte att registrera/);
  });

  test("a sound list passes, so the check is not simply refusing everything", () => {
    expect(codeListFault(navetCountryCodes)).toBeNull();
  });
});
