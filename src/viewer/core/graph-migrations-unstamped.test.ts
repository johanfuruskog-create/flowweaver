import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";

import {
  CURRENT_GRAPH_VERSION,
  migrateGraph,
  readGraphVersion,
} from "./graph-migrations";
import { housingScreeningExampleGraph } from "../../data/housing-screening-example-graph";
import { serviceCallExampleGraph } from "../../data/service-call-example-graph";

import type { GraphData } from "../types/graph";

/**
 * A current guide with no version stamp survives the whole chain.
 *
 * ## Why this is not hypothetical
 *
 * `getData()` returns `{ startNodeId, nodes, connections, settings }` and no
 * `version` — the stamp is added by `exportGraphJson`, on the way out to a
 * file. A host that persists what `getData()` gives it therefore stores an
 * **unstamped** graph, and `readGraphVersion` reads a missing stamp as legacy
 * v1. Setting that graph back on the element runs every migration from 1 to
 * today, on data that is already current.
 *
 * That is exactly what the SiteVision module does, and what the file-storage
 * example does after it. It works — so this pins it.
 *
 * ## What it protects against
 *
 * A future migration that transforms a shape which also exists in the current
 * format. Such a migration would be correct for the version it targets and
 * would quietly rewrite every stored guide, on load, in every installation
 * that persists graphs this way. The failure would look like guides changing
 * by themselves.
 *
 * There is a gate for an already-stamped graph ("an already-current graph is
 * untouched"). This is the other half: the same claim for the graphs hosts
 * actually store.
 */

const GUIDES: ReadonlyArray<readonly [string, GraphData]> = [
  ["housing-screening", housingScreeningExampleGraph],
  ["service-call", serviceCallExampleGraph],
];

/** What a host stores: the editor's data, with no stamp on it. */
function asStored(graph: GraphData): Record<string, unknown> {
  const { startNodeId, nodes, connections, settings } = graph as GraphData & {
    settings?: unknown;
  };

  return structuredClone({ startNodeId, nodes, connections, settings });
}

describe("a stored guide carries no version stamp", () => {
  test("which reads as legacy v1, not as current", () => {
    expect(readGraphVersion(asStored(housingScreeningExampleGraph))).toBe(1);
    expect(CURRENT_GRAPH_VERSION).toBeGreaterThan(1);
  });

  /*
   * It is **not** a no-op, and that is the finding this file exists for.
   *
   * Replaying the chain localizes bare strings that a later version made
   * translatable: a unit typed as "kr" comes back as `{ sv: "kr" }`. Nothing is
   * lost — it resolves to "kr" in every language, through the guide's own
   * source — but a stored guide does change shape the first time it is loaded,
   * without anyone editing it.
   *
   * Harmless here. The reason to pin it is the next migration: one that
   * transforms a shape which also exists in the current format would rewrite
   * every stored guide on load, in every installation, and look like guides
   * changing by themselves.
   */
  test.each(GUIDES)("%s keeps every value through the chain", (_name, graph) => {
    const stored = asStored(graph);
    const migrated = migrateGraph(structuredClone(stored), 1).graph as Record<
      string,
      unknown
    >;

    expect(migrated.version).toBe(CURRENT_GRAPH_VERSION);

    // The structure a guide is: which nodes, of what type, wired how.
    const shapeOf = (value: Record<string, unknown>): unknown => ({
      startNodeId: value.startNodeId,
      nodes: (value.nodes as Array<Record<string, unknown>>).map((node) => ({
        id: node.id,
        type: node.type,
        variableName: (node.data as Record<string, unknown>)?.variableName,
      })),
      connections: value.connections,
    });

    expect(shapeOf(migrated)).toEqual(shapeOf(stored));
  });

  test("a bare unit becomes a localized one, and only that", () => {
    const stored = asStored(serviceCallExampleGraph);
    const migrated = migrateGraph(structuredClone(stored), 1).graph as {
      nodes: Array<{ id: string; data: Record<string, unknown> }>;
    };

    const before = (stored.nodes as Array<{ id: string; data: Record<string, unknown> }>)
      .find((node) => node.id === "income")!.data.unit;
    const after = migrated.nodes.find((node) => node.id === "income")!.data.unit;

    expect({ before, after }).toEqual({ before: "kr", after: { sv: "kr" } });
  });

  // Running it twice is what actually happens: a guide is loaded, saved back
  // unstamped, and loaded again. A migration that is not idempotent would drift
  // a little on every open, which is the hardest kind of fault to notice.
  test.each(GUIDES)("%s is stable when it happens twice", (_name, graph) => {
    const once = migrateGraph(asStored(graph), 1).graph;
    const twice = migrateGraph(structuredClone(once), 1).graph;

    expect(twice).toEqual(once);
  });
});
