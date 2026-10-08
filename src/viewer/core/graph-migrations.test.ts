import { describe, expect, test } from "vitest";

import legacyGuideV1 from "./__fixtures__/legacy-guide-v1.json";

import {
  CURRENT_GRAPH_VERSION,
  graphMigrations,
  migrateGraph,
  readGraphVersion,
  stampGraphVersion,
  validateMigrationChain,
} from "./graph-migrations";
import type { GraphMigration } from "./graph-migrations";

describe("graf-migreringar", () => {
  test("the real chain is unbroken up to CURRENT_GRAPH_VERSION", () => {
    // If anyone raises CURRENT without adding a migration, this fails. It is
    // the gate that makes migration unavoidable, not a reminder.
    expect(validateMigrationChain()).toEqual([]);
    expect(graphMigrations.every((migration) => migration.to <= CURRENT_GRAPH_VERSION)).toBe(true);
  });

  /*
   * Berättelse 123, kriterium 1: `meta.id` är hela poängen med `serviceId`,
   * så det måste överleva den riktiga kedjan från en gammal graf precis som
   * ett svar eller en variabel gör. Ingen migrering rör `meta` i dag — inget
   * skäl att en framtida borde få göra det tyst.
   */
  test("an old graph's meta.id survives the real migration chain unchanged", () => {
    const old = { ...legacyGuideV1, meta: { id: "gammalt-id" } };

    const result = migrateGraph(old, readGraphVersion(old));

    expect((result.graph as { meta?: { id?: string } }).meta?.id).toBe("gammalt-id");
  });

  // A graph the chain has never invented an id for should not come out with one.
  test("an old graph without meta does not gain one from migrating", () => {
    const result = migrateGraph(legacyGuideV1, readGraphVersion(legacyGuideV1));

    expect((result.graph as { meta?: unknown }).meta).toBeUndefined();
  });

  test("reads the content version, a missing one counts as legacy v1", () => {
    expect(readGraphVersion({ version: 3 })).toBe(3);
    expect(readGraphVersion({})).toBe(1);
    expect(readGraphVersion({ version: "2" })).toBe(1);
    expect(readGraphVersion({ version: 0 })).toBe(1);
    expect(readGraphVersion(null)).toBe(1);
  });

  test("stamps the current version before serialisation", () => {
    expect(stampGraphVersion({ startNodeId: null })).toEqual({
      version: CURRENT_GRAPH_VERSION,
      startNodeId: null,
    });
  });

  const chain: GraphMigration[] = [
    { to: 2, description: "v2", migrate: (g) => ({ ...g, steps: [...(g.steps as number[]), 2] }) },
    { to: 3, description: "v3", migrate: (g) => ({ ...g, steps: [...(g.steps as number[]), 3] }) },
  ];

  test("runs migrations in order from the version upwards", () => {
    const result = migrateGraph({ steps: [] }, 1, chain, 3);
    expect(result.applied).toEqual([2, 3]);
    expect(result.graph.steps).toEqual([2, 3]);
    expect(result.graph.version).toBe(3);
    expect(result.toVersion).toBe(3);
  });

  test("skips migrations already applied", () => {
    const result = migrateGraph({ steps: [] }, 2, chain, 3);
    expect(result.applied).toEqual([3]);
    expect(result.graph.steps).toEqual([3]);
  });

  test("an already-current graph is untouched (only stamped)", () => {
    const result = migrateGraph({ steps: [] }, 3, chain, 3);
    expect(result.applied).toEqual([]);
    expect(result.graph.steps).toEqual([]);
    expect(result.graph.version).toBe(3);
  });

  test("v7: en ren variabelmottagare blir besökarvalet — en fritextadress kan inte översättas och lämnas åt hälsokontrollen", () => {
    const result = migrateGraph(
      {
        nodes: [
          { id: "a", type: "email-result", data: { to: "{{email}}" } },
          { id: "b", type: "email-result", data: { to: "intern@example.se" } },
          { id: "c", type: "email-result", data: { to: "" } },
          { id: "d", type: "result", data: { to: "irrelevant" } },
        ],
      },
      6,
    );

    const nodes = result.graph.nodes as Array<{ data: Record<string, unknown> }>;

    expect(nodes[0]!.data).toMatchObject({ recipientId: "@visitor", visitorVariable: "email" });
    expect("to" in nodes[0]!.data).toBe(false);
    // Adress→id går inte att räkna ut i klienten; guiden fortsätter fungera
    // och hälsokontrollen flaggar den för ompekning.
    expect(nodes[1]!.data.to).toBe("intern@example.se");
    expect("to" in nodes[2]!.data).toBe(false);
    // Andra nodtypers "to" är inte mottagare.
    expect(nodes[3]!.data.to).toBe("irrelevant");
  });

  test("validateMigrationChain catches gaps, duplicates and overshoot", () => {
    // Gap: current=3 but no migration for 2 (a migration forgotten on a raise).
    expect(
      validateMigrationChain([{ to: 3, description: "", migrate: (g) => g }], 3)
    ).toContainEqual({
      message:
        "No migration for version 2. Did you raise CURRENT_GRAPH_VERSION without adding one?",
    });

    // Dubblett.
    expect(
      validateMigrationChain(
        [
          { to: 2, description: "", migrate: (g) => g },
          { to: 2, description: "", migrate: (g) => g },
        ],
        2
      )
    ).toContainEqual({ message: "Duplicate migration for version 2." });

    // Overshoot: a migration beyond current.
    expect(
      validateMigrationChain([{ to: 2, description: "", migrate: (g) => g }], 1)
    ).toContainEqual({
      message: "Migration to=2 exceeds CURRENT_GRAPH_VERSION (1).",
    });
  });
});
