import { describe, expect, test } from "vitest";

// Nodtyperna måste vara registrerade: variabellistan läser vad en typ säger
// att den lagrar, och utan registret finns ingen variabel att känna igen.
import "../../viewer/node-types/default-node-types";

import { GuideHealthService } from "./guide-health-service";

import type { GraphData } from "../../viewer/types/graph";

/**
 * Berättelse 134, kriterium 7 — ett villkor som aldrig kan bli sant.
 *
 * Kontrollen fanns inte för fältets *visas om* heller, så den byggdes för
 * båda: samma två fel, samma ord, en kod per nivå så att listan kan säga
 * vilken det gäller.
 */

const guide = (nodes: unknown[]): GraphData =>
  ({
    version: 8,
    startNodeId: "allergi",
    settings: { sourceLocale: "sv", locales: ["sv"] },
    nodes,
    connections: [
      { id: "k1", from: { nodeId: "allergi", portId: "a1" }, to: { nodeId: "sidan", portId: "in" } },
      { id: "k2", from: { nodeId: "allergi", portId: "a2" }, to: { nodeId: "sidan", portId: "in" } },
    ],
  }) as unknown as GraphData;

const allergi = {
  id: "allergi",
  type: "question",
  position: { x: 0, y: 0 },
  data: {
    title: { sv: "Allergier" },
    variableName: "allergi",
    options: [
      { id: "a1", label: { sv: "Nötter" }, value: "notter" },
      { id: "a2", label: { sv: "Inga" }, value: "inga" },
    ],
  },
};

const sidan = { id: "sidan", type: "page", position: { x: 400, y: 0 }, data: { title: { sv: "Maten" } } };

const meny = (visibility: unknown) => ({
  id: "meny",
  type: "question",
  parentPageId: "sidan",
  order: 1,
  position: { x: 0, y: 0 },
  data: {
    title: { sv: "Meny" },
    variableName: "meny",
    options: [
      { id: "veg", label: { sv: "Vegetariskt" }, value: "veg" },
      { id: "curry", label: { sv: "Nötcurry" }, value: "curry", visibility },
    ],
  },
});

const issues = (graph: GraphData, code: string) =>
  GuideHealthService.analyze(graph).filter((issue) => issue.code === code);

describe("134 kriterium 7 — ett villkor som aldrig kan bli sant", () => {
  test("kriterium 7: option-never-visible när variabeln inte är svarad före frågan", () => {
    const graph = guide([
      allergi,
      sidan,
      meny({
        match: "all",
        conditions: [{ id: "c", variableName: "kvitto", operator: "equals", value: "ja" }],
      }),
      {
        id: "senare",
        type: "question",
        position: { x: 900, y: 0 },
        data: {
          title: { sv: "Vill du ha kvitto?" },
          variableName: "kvitto",
          options: [{ id: "k1", label: { sv: "Ja" }, value: "ja" }],
        },
      },
    ]);

    const found = issues(graph, "option-never-visible");

    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe("warning");
    expect(found[0]?.nodeId).toBe("meny");
    expect(found[0]?.message).toContain("Nötcurry");
    expect(found[0]?.message).toContain("kvitto");
  });

  test("kriterium 7: option-never-visible när värdet inte finns bland variabelns alternativ", () => {
    const graph = guide([
      allergi,
      sidan,
      meny({
        match: "all",
        conditions: [{ id: "c", variableName: "allergi", operator: "not-equals", value: "nötter" }],
      }),
    ]);

    const found = issues(graph, "option-never-visible");

    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain("nötter");
  });

  test("kriterium 7: ett villkor som håller ger ingen varning", () => {
    const graph = guide([
      allergi,
      sidan,
      meny({
        match: "all",
        conditions: [{ id: "c", variableName: "allergi", operator: "not-one-of", value: "notter" }],
      }),
    ]);

    expect(issues(graph, "option-never-visible")).toEqual([]);
  });

  test("kriterium 7: samma kontroll på fältets visas om", () => {
    const graph = guide([
      allergi,
      sidan,
      {
        ...meny(undefined),
        visibility: {
          match: "all",
          conditions: [{ id: "c", variableName: "allergi", operator: "equals", value: "mjolk" }],
        },
      },
    ]);

    const found = issues(graph, "field-never-visible");

    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe("warning");
    expect(found[0]?.message).toContain("mjolk");
  });
});
