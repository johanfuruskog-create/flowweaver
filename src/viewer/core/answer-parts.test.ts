import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";

import { GuideTraversalEngine } from "./guide-traversal-engine";

import type { GraphData } from "../types/graph";

/**
 * Ett svar med delar, i stället för en variabel bredvid en annan.
 *
 * ## Vad som var fel med två variabler
 *
 * Ett uppslag lagrade etiketten i `land` och koden i `landskod`. Kartan
 * lagrade namnet i `plats` och geometrin i `platsGeo`. Filen lade sina
 * markeringar i `fotoMarkeringar`. Tre gånger samma sak: **en del av ett svar
 * fick en egen variabel**, och de hölls i takt av ordningen de skrevs i.
 *
 * Johans fråga var den rätta: `land` är etiketten, e-tjänsten behöver koden —
 * varför genereras två? Svaret var att ett villkor bara kunde namnge en hel
 * variabel. Nu kan det namnge en del (`land.code`), och då finns ingen
 * anledning kvar.
 *
 * ## Varför det inte bara är städning
 *
 * Två variabler kan glida isär. Ett värde med delar kan det inte. Skillnaden
 * märks först den dag en post försvinner på ena sidan, och då läser en regel
 * fel lands kod utan att något ser trasigt ut.
 */

const graf = (): GraphData => ({
  version: 9,
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "autocomplete-question",
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Land" },
        variableName: "land",
        source: "codelist",
        codeListId: "navet-country-codes",
        minChars: 2,
      },
    },
    {
      id: "regel",
      type: "rule",
      position: { x: 300, y: 0 },
      data: {
        title: { sv: "Var?" },
        fallbackLabel: "Utanför",
        cases: [
          {
            id: "norden",
            label: "Norden",
            match: "any",
            conditions: [
              { id: "c", variableName: "land.code", operator: "one-of", value: "SE,DK,NO" },
            ],
          },
        ],
      },
    },
    { id: "inne", type: "result", position: { x: 600, y: 0 }, data: { title: { sv: "Norden" } } },
    { id: "ute", type: "result", position: { x: 600, y: 200 }, data: { title: { sv: "Utanför" } } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "regel", portId: "input" } },
    { id: "c2", from: { nodeId: "regel", portId: "norden" }, to: { nodeId: "inne", portId: "input" } },
    { id: "c3", from: { nodeId: "regel", portId: "default" }, to: { nodeId: "ute", portId: "input" } },
  ],
}) as unknown as GraphData;

const svara = (svar: unknown): string => {
  const motor = new GuideTraversalEngine(structuredClone(graf()));
  const result = motor.answerValue(svar as never);

  return result.success ? result.node.id : `fel: ${result.error?.code}`;
};

describe("ett villkor på en del av ett svar", () => {
  test("hittar rätt gren genom koden", () => {
    expect(svara({ label: "Danmark", code: "DK" })).toBe("inne");
  });

  test("och rätt gren när koden inte är med i listan", () => {
    expect(svara({ label: "Tyskland", code: "DE" })).toBe("ute");
  });

  test("etiketten avgör ingenting", () => {
    /*
     * Hela skälet att koden lagras: etiketten är översatt, koden är det inte.
     * En regel som råkade träffa på namnet skulle sluta fungera den dag någon
     * läser guiden på engelska.
     */
    expect(svara({ label: "Denmark", code: "DK" })).toBe("inne");
  });

  test("och ett svar utan delen faller till standardgrenen", () => {
    expect(svara({ label: "Danmark" })).toBe("ute");
  });
});

describe("svaret som lagras", () => {
  test("är ett värde med delar, inte två variabler", () => {
    const motor = new GuideTraversalEngine(structuredClone(graf()));

    motor.answerValue({ label: "Danmark", code: "DK" } as never);

    expect(motor.getAnswers()).toEqual({ land: { label: "Danmark", code: "DK" } });
  });
});
