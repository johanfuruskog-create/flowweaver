import { describe, expect, test } from "vitest";

import { LookupService } from "./lookup-service";
import { registerCodeList } from "../code-lists/code-list-registry";
import { navetCountryCodes } from "../code-lists/navet-country-codes";

import type { FlowNodeData } from "../types/graph";

/**
 * A field that offers a bundled code list.
 *
 * ## Why this is a third source and not a replacement
 *
 * `docs/UPPSLAG-KONTRAKT.md` says FlowWeaver should know nothing about anybody's
 * source, and that stays right whenever the value is sent onward: the code has
 * to match the system receiving it, and we do not know which that is. Skatteverket
 * publishes ISO 3166-1 alpha-2 **plus** four codes ISO does not have, so a guide
 * feeding a Swedish case system and one feeding a European service want
 * different lists of the same countries.
 *
 * The bundled list is for the other case — a guide that branches internally and
 * never sends the value anywhere. There, requiring a service would be absurd.
 *
 * ## Why synonyms are asserted here
 *
 * They are the reason the list is worth having in this shape rather than as a
 * flat pair of columns. The official name and the one somebody types are not the
 * same word: the list says *Belarus* and half the country says Vitryssland. A
 * field that finds nothing for what a person actually calls the place reads as
 * broken, not as strict, and that is what GOV.UK found when they built this
 * field for passport applications.
 */

registerCodeList(navetCountryCodes);

/**
 * A field pointed at a list, the way the editor will configure one.
 *
 * It carries `mockItems` as well, and that is deliberate: a field can have had
 * its own list before somebody pointed it at a code list, and the two must not
 * blend. Without something in there, "an unknown list gives nothing" would pass
 * on a version that quietly falls back to the field's own — the answer would be
 * empty either way, for the wrong reason. Checked by mutation.
 */
const field = (codeListId: string): FlowNodeData =>
  ({
    id: "n",
    type: "autocomplete-question",
    position: { x: 0, y: 0 },
    data: {
      source: "codelist",
      codeListId,
      minChars: 2,
      mockItems: [{ id: "x", label: { sv: "Sverige (egen lista)" }, value: "EGEN" }],
    },
  }) as unknown as FlowNodeData;

const search = (node: FlowNodeData, term: string) =>
  LookupService.search(node, term, "sv");

describe("searching a bundled code list", () => {
  test("finds a country and hands back the code that gets stored", async () => {
    const { items } = await search(field("navet-country-codes"), "sver");

    // The code list answers, not the field's own list, which also matches here.
    expect(items[0]).toEqual({ value: "SE", label: "Sverige" });
    expect(items.map((one) => one.value)).not.toContain("EGEN");
  });

  test("ignores case and diacritics, so 'oster' finds Österrike", async () => {
    const { items } = await search(field("navet-country-codes"), "osterrike");

    expect(items.map((one) => one.value)).toContain("AT");
  });

  test("finds the four codes ISO does not have", async () => {
    const { items } = await search(field("navet-country-codes"), "statsl");

    // The case the whole bundled list exists for: a guide about permits that
    // cannot say "stateless" is broken for the people it is written for.
    //
    // It comes back marked, and that is the whole of story 062 arriving here:
    // stateless is not a country you can hold as well, so the control replaces
    // rather than letting the answer become a contradiction.
    expect(items).toEqual([{ value: "XS", label: "Statslös", exclusive: true }]);
  });

  test("matches on the code itself, for whoever knows it", async () => {
    const { items } = await search(field("navet-country-codes"), "XS");

    expect(items.map((one) => one.value)).toContain("XS");
  });

  test("an unknown list gives nothing rather than another list's answers", async () => {
    const { items, error } = await search(field("finns-inte"), "sverige");

    // Empty is a fault somebody sees while building the guide. Falling back to
    // some other list would be a wrong answer that looks right.
    expect(items).toEqual([]);
    expect(error).toBeNull();
  });

  test("respects the field's minimum before searching at all", async () => {
    const { items } = await search(field("navet-country-codes"), "s");

    expect(items).toEqual([]);
  });
});

describe("synonyms", () => {
  test("find a country under the name people actually use", async () => {
    registerCodeList({
      id: "prov-synonymer",
      standard: "iso-3166-1-alpha-2",
      label: { sv: "Prov" },
      version: "",
      published: "2026-08-15",
      source: "Testet självt",
      items: [
        {
          value: "BY",
          label: { sv: "Belarus" },
          synonyms: [{ sv: "Vitryssland" }],
        },
      ],
    });

    const { items } = await search(field("prov-synonymer"), "vitryss");

    // What is stored is still the code; the synonym is a way in, not a value.
    expect(items).toEqual([{ value: "BY", label: "Belarus" }]);
  });

  test("are not handed back as if they were the country's name", async () => {
    const { items } = await search(field("prov-synonymer"), "belarus");

    expect(items[0]?.label).toBe("Belarus");
  });
});
