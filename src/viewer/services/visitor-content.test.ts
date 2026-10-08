import { describe, expect, test } from "vitest";

import { visitorContent } from "./visitor-content";

import type { Connection, FlowNodeData, GraphData } from "../types/graph";

/**
 * What a visitor would get, with the workspace left out (story 124, criterion
 * 16).
 *
 * ## The fault this is written from
 *
 * Johan, 17/9: dragging a node across the canvas lit *Opublicerade ändringar*.
 * It is true that something was saved — the working copy holds the new
 * coordinates — and it is false that anybody's answer to the guide would come
 * out differently. The mark is read as *is what I changed out there yet?*, so
 * it has to be measured on the thing that goes out there.
 *
 * The three cases below are the story's, and they are the whole contract of
 * this function: a move does not count, a change to content does, and putting
 * the content back counts as putting it back even when the drawing has moved
 * since.
 */

const node = (over: Partial<FlowNodeData> = {}): FlowNodeData => ({
  id: "q1",
  type: "question",
  position: { x: 100, y: 100 },
  data: {
    title: "Bor du i kommunen?",
    variableName: "bor",
    options: [
      { id: "ja", label: "Ja", value: "ja" },
      { id: "nej", label: "Nej", value: "nej" },
    ],
  },
  ...over,
});

const other = (over: Partial<FlowNodeData> = {}): FlowNodeData => ({
  id: "r1",
  type: "result",
  position: { x: 400, y: 100 },
  data: { title: "Du kan söka" },
  ...over,
});

const link: Connection = {
  id: "c1",
  from: { nodeId: "q1", portId: "ja" },
  to: { nodeId: "r1", portId: "in" },
};

const guide = (over: Partial<GraphData> = {}): GraphData =>
  ({
    startNodeId: "q1",
    nodes: [node(), other()],
    connections: [link],
    meta: { id: "g-1", name: { sv: "Bygglov" } },
    ...over,
  }) as GraphData;

/** What the page's mark actually compares: the content as one string. */
const same = (left: GraphData, right: GraphData): boolean =>
  JSON.stringify(visitorContent(left)) === JSON.stringify(visitorContent(right));

describe("det besökaren ser, skilt från arbetsytan", () => {
  test("(a) en nod som bara flyttas ändrar ingenting för besökaren", () => {
    const flyttad = guide({
      nodes: [node({ position: { x: 900, y: 40 } }), other({ position: { x: 20, y: 500 } })],
    });

    expect(same(guide(), flyttad), "koordinater är arbetsytans, inte guidens").toBe(true);
  });

  /*
   * Fem ändringar, en per sort som berättelsen räknar upp. Var och en för sig,
   * för en kontroll som prövar dem tillsammans går grön så fort en av dem
   * fungerar.
   */
  describe("(b) det besökaren märker räknas", () => {
    test("innehållet", () => {
      const ändrad = guide({
        nodes: [node({ data: { ...node().data, title: "Bor du i Sundsvall?" } }), other()],
      });

      expect(same(guide(), ändrad)).toBe(false);
    });

    test("ett svarsalternativ", () => {
      const ändrad = guide({
        nodes: [
          node({
            data: {
              ...node().data,
              options: [
                { id: "ja", label: "Ja", value: "ja" },
                { id: "nej", label: "Nej, jag bor i en annan kommun", value: "nej" },
              ],
            },
          }),
          other(),
        ],
      });

      expect(same(guide(), ändrad)).toBe(false);
    });

    test("ett villkor", () => {
      const ändrad = guide({
        nodes: [
          node(),
          other({
            visibility: {
              match: "all",
              conditions: [{ id: "v1", variableName: "bor", operator: "equals", value: "ja" }],
            },
          }),
        ],
      });

      expect(same(guide(), ändrad)).toBe(false);
    });

    test("en koppling", () => {
      const ändrad = guide({ connections: [{ ...link, from: { nodeId: "q1", portId: "nej" } }] });

      expect(same(guide(), ändrad)).toBe(false);
    });

    test("startnoden", () => {
      expect(same(guide(), guide({ startNodeId: "r1" }))).toBe(false);
    });
  });

  test("(c) allt återställt räknas som återställt, även om ritningen flyttat sig", () => {
    const tillbaka = guide({
      nodes: [node({ position: { x: 12, y: 980 } }), other({ position: { x: 640, y: 33 } })],
      connections: [{ ...link, color: "rule" }],
    });

    expect(
      same(guide(), tillbaka),
      "samma frågor, samma svar, samma vägar — bara flyttade och färgade",
    ).toBe(true);
  });

  /*
   * Lagringens egna stämplar är inte heller något någon skrivit. De hörde till
   * sidan förut, och två ställen som svarar på *vad räknas som en ändring* är
   * ett ställe för mycket.
   */
  test("lagringens stämplar räknas inte som en ändring", () => {
    const fryst = guide({
      meta: { ...guide().meta, versionId: "v-7", updatedAt: "2026-09-17T10:00:00.000Z" },
    });

    expect(same(guide(), fryst)).toBe(true);
    expect(visitorContent(guide()).meta?.id, "guidens identitet är kvar").toBe("g-1");
  });

  /*
   * Sidlayouten ser besökaren. Den heter `layout` precis som arbetsytan pratar
   * om layout, och det är hela skälet att den står här: en funktion som skalar
   * bort "layout" på ordet skalar bort halva sidan.
   */
  test("sidans egen layout hör till besökaren", () => {
    const bredare = guide({
      nodes: [node({ layout: { columnSpan: 6 } }), other()],
    });

    expect(same(guide(), bredare), "kolumnbredden är något besökaren ser").toBe(false);
  });
});
