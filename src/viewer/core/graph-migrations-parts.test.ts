import { describe, expect, test } from "vitest";

import { migrateGraph } from "./graph-migrations";

/**
 * Version 9: en del av ett svar slutar vara en variabel bredvid det.
 *
 * `landskod` fanns för att ett villkor bara kunde namnge en hel variabel. Nu
 * kan det namnge en del — `land.value` — och då är den andra variabeln bara ett
 * duplikat som kan glida isär.
 *
 * Migreringen skriver om **villkoren och mallarna**, inte svaren: svar lagras
 * inte i en graf. En guide som öppnas efter uppgraderingen ska förgrena likadant
 * som innan, utan att någon rört den.
 */

const migrera = (nodes: unknown[]): Record<string, unknown>[] =>
  migrateGraph(
    { version: 8, startNodeId: null, nodes, connections: [] } as unknown as Record<string, unknown>,
    8,
  ).graph.nodes as Record<string, unknown>[];

const uppslag = {
  id: "q",
  type: "autocomplete-question",
  data: { variableName: "land", codeVariableName: "landskod", source: "codelist" },
};

const regel = (variableName: string) => ({
  id: "r",
  type: "rule",
  data: {
    cases: [
      { id: "c", label: "Norden", match: "any", conditions: [{ id: "x", variableName, operator: "one-of", value: "SE,DK" }] },
    ],
  },
});

const data = (nodes: Record<string, unknown>[], id: string): Record<string, unknown> =>
  nodes.find((one) => one.id === id)!.data as Record<string, unknown>;

const villkorsvariabel = (nodes: Record<string, unknown>[]): string =>
  ((data(nodes, "r").cases as Array<{ conditions: Array<{ variableName: string }> }>)[0]!
    .conditions[0]!.variableName);

describe("kodvariabeln blir en del", () => {
  test("villkoret pekar på delen", () => {
    expect(villkorsvariabel(migrera([uppslag, regel("landskod")]))).toBe("land.value");
  });

  test("och nodens kodvariabel är borta, för ingenting läser den", () => {
    expect(data(migrera([uppslag]), "q").codeVariableName).toBeUndefined();
  });

  test("ett villkor på etiketten rörs inte", () => {
    // `land` är fortfarande `land`. Bara delen har bytt adress.
    expect(villkorsvariabel(migrera([uppslag, regel("land")]))).toBe("land");
  });

  test("och ett villkor på något ingen nod producerar lämnas i fred", () => {
    /*
     * Det var redan trasigt, och att skriva om det hade gömt saken för
     * hälsokontrollen — som är det enda som berättar för redaktören.
     */
    expect(villkorsvariabel(migrera([uppslag, regel("hittepa")]))).toBe("hittepa");
  });
});

describe("kartans och filens sidovariabler", () => {
  test("platsGeo blir plats.geo", () => {
    const nodes = migrera([
      { id: "q", type: "map-question", data: { variableName: "plats" } },
      regel("platsGeo"),
    ]);

    expect(villkorsvariabel(nodes)).toBe("plats.geo");
  });

  test("och fotoMarkeringar blir foto.markings", () => {
    const nodes = migrera([
      { id: "q", type: "file-question", data: { variableName: "foto" } },
      regel("fotoMarkeringar"),
    ]);

    expect(villkorsvariabel(nodes)).toBe("foto.markings");
  });
});

describe("mallar och sidvillkor", () => {
  test("en platshållare skrivs om", () => {
    const nodes = migrera([
      uppslag,
      { id: "res", type: "result", data: { description: "Din kod är {{landskod}}." } },
    ]);

    expect(data(nodes, "res").description).toBe("Din kod är {{land.value}}.");
  });

  test("med eller utan mellanrum i klamrarna", () => {
    const nodes = migrera([
      uppslag,
      { id: "res", type: "result", data: { description: "{{ landskod }}" } },
    ]);

    expect(data(nodes, "res").description).toBe("{{land.value}}");
  });

  test("men ett namn som bara INNEHÅLLER variabeln lämnas", () => {
    /*
     * `{{landskoden}}` är inte `{{landskod}}`. En sträng-ersättning hade tagit
     * den också och lämnat `{{land.codeen}}`, vilket ingen hade märkt förrän
     * en mall visade fel.
     */
    const nodes = migrera([
      uppslag,
      { id: "res", type: "result", data: { description: "{{landskoden}}" } },
    ]);

    expect(data(nodes, "res").description).toBe("{{landskoden}}");
  });

  test("och ett sidfälts synlighetsvillkor följer med", () => {
    /*
     * `visibility` bor på NODEN, inte i `node.data`.
     *
     * Testet la den i `data` först, och migreringen letade bara där — så båda
     * var överens om samma felaktiga antagande och testet var grönt medan
     * verkliga guiders synlighetsvillkor aldrig skrevs om. Precis den fällan
     * "ett test måste ha setts falla" finns för: det föll aldrig, för det gick
     * en annan väg än buggen.
     */
    const nodes = migrera([
      uppslag,
      {
        id: "f",
        type: "text-question",
        visibility: { match: "all", conditions: [{ id: "v", variableName: "landskod", operator: "equals", value: "SE" }] },
        data: { variableName: "extra" },
      },
    ]);
    const nod = nodes.find((one) => one.id === "f")!;

    expect(
      (nod.visibility as { conditions: Array<{ variableName: string }> }).conditions[0]!.variableName,
    ).toBe("land.value");
  });
});
