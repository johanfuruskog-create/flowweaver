import { describe, expect, test } from "vitest";

import { LookupService } from "./lookup-service";
import { registerCodeList, unregisterCodeList } from "../code-lists/code-list-registry";
import { navetCountryCodes } from "../code-lists/navet-country-codes";

import type { FlowNodeData } from "../types/graph";

/**
 * Att flaggan tar sig hela vägen ut till kontrollen — berättelse 062.
 *
 * ## Varför alla tre källorna prövas här
 *
 * Mätt 31/8 innan något skrevs: `tolka` filtrerar men bygger inte om
 * posterna, så tjänstesvarets okända fält gick redan igenom av sig självt.
 * `frånKodlista` och `frånMock` bygger nya objekt med `.map()` och släppte
 * allt de inte nämnde:
 *
 *     CODELIST -> [{"value":"XS","label":"Statslös"}]
 *     MOCK     -> [{"value":"XS","label":"Statslös"}]
 *     TOLKA    -> [{"value":"XS","label":"Statslös","exclusive":true}]
 *
 * Två av tre vägar tappade den alltså, och den tredje var redan hel. Det är
 * skälet att de står bredvid varandra i en fil: det är EN fråga — når flaggan
 * fram? — och tre svar som lätt glider isär.
 */

registerCodeList(navetCountryCodes);

const node = (data: Record<string, unknown>): FlowNodeData =>
  ({
    id: "n",
    type: "multi-autocomplete-question",
    position: { x: 0, y: 0 },
    data: { minChars: 2, ...data },
  }) as unknown as FlowNodeData;

describe("flaggan från en kodlista", () => {
  test("följer med posten ut", async () => {
    const { items } = await LookupService.search(
      node({ source: "codelist", codeListId: "navet-country-codes" }),
      "statsl",
      "sv",
    );

    expect(items).toEqual([{ value: "XS", label: "Statslös", exclusive: true }]);
  });

  test("sätts inte på ett vanligt land", async () => {
    const { items } = await LookupService.search(
      node({ source: "codelist", codeListId: "navet-country-codes" }),
      "sverige",
      "sv",
    );

    expect(items[0]).toEqual({ value: "SE", label: "Sverige" });
  });
});

describe("flaggan från fältets egen lista", () => {
  test("följer med posten ut", async () => {
    const { items } = await LookupService.search(
      node({
        source: "mock",
        mockItems: [
          { id: "a", label: "Danmark", value: "DK" },
          { id: "b", label: "Statslös", value: "XS", exclusive: true },
        ],
      }),
      "statsl",
      "sv",
    );

    expect(items).toEqual([{ value: "XS", label: "Statslös", exclusive: true }]);
  });
});

describe("flaggan från en tjänst", () => {
  test("går igenom kontraktets tolkning", () => {
    const result = LookupService.tolka({
      version: 1,
      items: [{ value: "XS", label: "Statslös", exclusive: true }],
    });

    expect(result.items[0]?.exclusive).toBe(true);
  });

  test("ett svar utan den avvisas inte — fältet är valfritt", () => {
    const result = LookupService.tolka({
      version: 1,
      items: [{ value: "SE", label: "Sverige" }],
    });

    expect(result.error).toBeNull();
    expect(result.items[0]?.exclusive).toBeUndefined();
  });
});

describe("en lista utan flaggor", () => {
  test("ger poster utan fältet alls, inte med det falskt", async () => {
    registerCodeList({
      id: "prov-utan-flaggor",
      standard: "custom",
      label: { sv: "Prov" },
      version: "",
      published: "2026-08-31",
      source: "Testet självt",
      items: [{ value: "DK", label: { sv: "Danmark" } }],
    });

    const { items } = await LookupService.search(
      node({ source: "codelist", codeListId: "prov-utan-flaggor" }),
      "danmark",
      "sv",
    );

    expect(Object.hasOwn(items[0]!, "exclusive")).toBe(false);
    unregisterCodeList("prov-utan-flaggor");
  });
});
