import { describe, expect, test } from "vitest";

import { CURRENT_GRAPH_VERSION, migrateGraph } from "./graph-migrations";

/**
 * Version 10 — kodens del heter `value`, som uppslagstjänsten alltid kallat den.
 *
 * En sak hade två namn. En uppslagstjänst svarar `{ value, label }` — det är
 * `docs/UPPSLAG-KONTRAKT.md`, och det är vad en värd skriver mot — men fältet
 * lagrade samma sträng under `code`, så ett villkor läste `land.code` medan
 * tjänsten som producerat den kallade den `value`. Bytet skedde tyst inuti
 * `lookup-field`.
 *
 * Johan: *"Då är det bättre med label value."* Priset är den här migreringen,
 * för v9 hann ut.
 */

const migrera = (nodes: unknown[], version = 9): Record<string, unknown> =>
  migrateGraph(
    { version, startNodeId: "q", nodes, connections: [] } as unknown as Record<string, unknown>,
    version,
  ).graph as unknown as Record<string, unknown>;

const nod = (extra: Record<string, unknown> = {}) => ({
  id: "q",
  type: "autocomplete-question",
  position: { x: 0, y: 0 },
  data: { variableName: "land", source: "codelist", codeListId: "countries", ...extra },
});

const regel = (variableName: string, extra: Record<string, unknown> = {}) => ({
  id: "regel",
  type: "rule",
  position: { x: 200, y: 0 },
  data: { cases: [{ id: "c", match: "all", conditions: [{ variableName, operator: "equals", value: "DK" }] }] },
  ...extra,
});

const data = (graph: Record<string, unknown>, id: string): Record<string, unknown> =>
  ((graph.nodes as Array<Record<string, unknown>>).find((one) => one.id === id)!.data) as Record<string, unknown>;

const villkorsvariabel = (graph: Record<string, unknown>): string =>
  ((data(graph, "regel").cases as Array<{ conditions: Array<{ variableName: string }> }>)[0]!
    .conditions[0]!.variableName);

describe("villkoren", () => {
  test("land.code blir land.value", () => {
    expect(villkorsvariabel(migrera([nod(), regel("land.code")]))).toBe("land.value");
  });

  test("och ett sidfälts synlighet följer med", () => {
    /*
     * Villkor bor på två ställen: reglernas fall i `data.cases` och ett
     * sidfälts synlighet på NODEN. v9 missade det andra först, och testet som
     * skulle fånga det la synligheten i `data` — så båda var överens om samma
     * felaktiga antagande.
     */
    const graph = migrera([
      nod(),
      { id: "falt", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "s",
        visibility: { match: "all", conditions: [{ variableName: "land.code", operator: "equals", value: "DK" }] },
        data: { title: "Fält" } },
    ]);
    const falt = (graph.nodes as Array<Record<string, unknown>>).find((one) => one.id === "falt")!;

    expect(
      (falt.visibility as { conditions: Array<{ variableName: string }> }).conditions[0]!.variableName,
    ).toBe("land.value");
  });
});

describe("mallarna", () => {
  test("{{land.code}} skrivs om", () => {
    const graph = migrera([
      nod(),
      { id: "res", type: "result", position: { x: 0, y: 0 }, data: { description: "Koden är {{land.code}}." } },
    ]);

    expect(data(graph, "res").description).toBe("Koden är {{land.value}}.");
  });

  test("med eller utan mellanrum i klamrarna", () => {
    const graph = migrera([
      nod(),
      { id: "res", type: "result", position: { x: 0, y: 0 }, data: { description: "{{ land.code }}" } },
    ]);

    expect(data(graph, "res").description).toBe("{{land.value}}");
  });
});

describe("vad den lämnar i fred", () => {
  test("en variabel som bara SLUTAR på .code rörs inte", () => {
    /*
     * Migreringen bygger sin lista ur noderna i stället för att byta varje
     * namn som slutar på `.code`. Ett blint byte hade träffat en variabel
     * någon döpt så med flit — och en migrering som gissar gissar till slut
     * fel.
     */
    const graph = migrera([
      nod(),
      regel("annat.code"),
    ]);

    expect(villkorsvariabel(graph)).toBe("annat.code");
  });

  test("och en nodtyp utan kod ger ingen omskrivning", () => {
    const graph = migrera([
      { id: "q", type: "text-question", position: { x: 0, y: 0 }, data: { variableName: "land" } },
      regel("land.code"),
    ]);

    expect(villkorsvariabel(graph)).toBe("land.code");
  });

  test("en graf vars nodes inte är en lista lämnas orörd", () => {
    // Samma försiktighet som v9: en migrering lagar inte trasig indata, för då
    // slutar formatkontrollen säga vad som är fel.
    const trasig = migrateGraph(
      { version: 9, nodes: "inte en lista" } as unknown as Record<string, unknown>,
      9,
    ).graph as unknown as Record<string, unknown>;

    expect(trasig.nodes).toBe("inte en lista");
  });
});

describe("hela vägen", () => {
  test("en v8-graf passerar v9 och landar i v10", () => {
    /*
     * v8 hade koden som en variabel bredvid (`codeVariableName`). v9 gjorde
     * den till `land.code`, v10 döper den till `land.value`. Att hoppa över
     * v9 hade lämnat de grafer som redan ligger som v9 utanför.
     */
    const graph = migrera([
      { ...nod(), data: { ...nod().data, codeVariableName: "landskod" } },
      regel("landskod"),
    ], 8);

    expect(villkorsvariabel(graph)).toBe("land.value");
    expect(graph.version).toBe(CURRENT_GRAPH_VERSION);
  });
});
