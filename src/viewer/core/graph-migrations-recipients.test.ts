import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { CURRENT_GRAPH_VERSION, migrateGraph } from "./graph-migrations";

import type { GraphData } from "../types/graph";

/**
 * Story 056 — v7 → v8: mottagaren blir en lista.
 *
 * En felanmälan om en lampa vid en lekplats gäller gatukontoret OCH
 * parkförvaltningen; en handläggare vill ha kopia utan att äga ärendet. Ett
 * enskilt `recipientId` räckte inte, och det är precis den sortens singulära
 * antagande praxis 25 handlar om.
 *
 * Gamla guider ska passera oskadda: id:t blir en lista med ett element, och
 * inget annat rörs. Tomt eller saknat id blir en tom lista, inte `[""]` — en
 * lista med ett tomt värde vore ett osynligt fel som hälsokontrollen inte
 * kunde skilja från ett verkligt val.
 */

const v7 = (data: Record<string, unknown>): Record<string, unknown> => ({
  version: 7,
  startNodeId: "in",
  nodes: [{ id: "in", type: "submit-result", position: { x: 0, y: 0 }, data }],
  connections: [],
}) as unknown as Record<string, unknown>;

/** `migrateGraph` tar och ger lösa objekt — testet läser noden ur resultatet. */
const nodeIn = (result: { graph?: unknown; nodes?: unknown }): Record<string, unknown> => {
  const graph = (result as { graph?: GraphData }).graph ?? (result as unknown as GraphData);

  return graph.nodes[0]!.data as unknown as Record<string, unknown>;
};

describe("mottagaren blir en lista", () => {
  test("ett id blir en lista med det id:t", () => {
    const graph = migrateGraph(v7({ recipientId: "gatukontoret" }), 7);

    expect(nodeIn(graph).recipientIds).toEqual(["gatukontoret"]);
  });

  test("och det gamla fältet står kvar, för kontraktet lovar det", () => {
    // Värdsystem läser `recipientId` i dag — se docs/INLAMNING-KONTRAKT.md.
    const graph = migrateGraph(v7({ recipientId: "gatukontoret" }), 7);

    expect(nodeIn(graph).recipientId).toBe("gatukontoret");
  });

  test("tomt id blir en tom lista, inte en lista med tomhet", () => {
    const graph = migrateGraph(v7({ recipientId: "" }), 7);

    expect(nodeIn(graph).recipientIds).toEqual([]);
  });

  test("kopiemottagarna börjar som en tom lista", () => {
    const graph = migrateGraph(v7({ recipientId: "kundcenter" }), 7);

    expect(nodeIn(graph).copyRecipientIds).toEqual([]);
  });

  test("en lista som redan finns behålls — en ostämplad graf går hela kedjan", () => {
    /*
     * Exempelguiderna i src/data/ bär ingen version och skrivs i dagens form,
     * med `recipientIds` och utan `recipientId`. Migreringen byggde listan ur
     * det singulära fältet och skrev över den befintliga med `[]` — Beställ
     * blanketter lämnades in utan mottagare (mätt på Prova-sidan 5/9 2026).
     */
    const graph = migrateGraph(v7({ recipientIds: ["kundcenter"], copyRecipientIds: ["gatukontoret"] }), 7);

    expect(nodeIn(graph).recipientIds).toEqual(["kundcenter"]);
    expect(nodeIn(graph).copyRecipientIds).toEqual(["gatukontoret"]);
  });

  test("och e-postresultatet migreras likadant", () => {
    // Samma fält, samma katalog — den nod som föll ur v6→v7 hör hemma här med.
    const graph = migrateGraph({
      version: 7,
      startNodeId: "e",
      nodes: [{ id: "e", type: "email-result", position: { x: 0, y: 0 }, data: { recipientId: "@visitor" } }],
      connections: [],
    } as unknown as Record<string, unknown>, 7);

    expect(nodeIn(graph).recipientIds).toEqual(["@visitor"]);
  });

  test("och grafen kommer ut på den aktuella versionen", () => {
    /*
     * Stod som `CURRENT_GRAPH_VERSION === 8` och fick flyttas varje gång en ny
     * migrering skrevs. Den sa heller ingenting eget: att höja versionen utan
     * att lägga till en migrering fångas redan av `migrateGraph`, som vägrar
     * med "No migration for version X".
     *
     * Det som är värt att pröva är att en gammal graf faktiskt tas hela vägen.
     */
    const result = migrateGraph({
      version: 7,
      startNodeId: null,
      nodes: [],
      connections: [],
    } as unknown as Record<string, unknown>, 7);

    expect(result.graph.version).toBe(CURRENT_GRAPH_VERSION);
  });
});
