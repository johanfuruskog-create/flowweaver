import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";

import { migrateIncoming } from "./accepted-graph";
import { migrateGraph } from "./graph-migrations";

import type { GraphData } from "../types/graph";

/**
 * The migration chain, run twice, must change nothing the second time.
 *
 * ## The promise this gate makes measurable
 *
 * The object door assumes a versionless graph is v3 and runs the later
 * migrations on it — every time it passes. `viewer2.graph = viewer1.graph`,
 * undo, a host persisting `getData()`: all of them send graphs through the
 * chain again. The guard used to be a comment in `accepted-graph.ts` — "raise
 * the constant when a migration is added that is not safe to run on a modern
 * graph" — and a comment fells nobody. This gate does: add a migration that
 * rewrites already-migrated data and every graph below turns red.
 *
 * ## Why the graphs are discovered, not listed
 *
 * A hand-kept list stops growing the day after it is written — the earlier
 * version of this claim covered two guides out of sixteen. Discovery sweeps
 * whatever `src/data/` ships and every serialised fixture. And because a glob
 * that quietly stops matching makes every claim over it vacuously true, the
 * count has a floor.
 */

const dataModules = import.meta.glob(["../../data/*graph*.ts", "!**/*.test.ts"], {
  eager: true,
});
const fixtureFiles = import.meta.glob("./__fixtures__/*.json", { eager: true });

function looksLikeGraph(value: unknown): value is GraphData {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { startNodeId?: unknown }).startNodeId === "string" &&
    Array.isArray((value as { nodes?: unknown }).nodes)
  );
}

const GRAPHS: Array<readonly [string, GraphData]> = [
  ...Object.entries(dataModules).flatMap(([file, mod]) =>
    Object.entries(mod as Record<string, unknown>)
      .filter((entry): entry is [string, GraphData] => looksLikeGraph(entry[1]))
      .map(([name, graph]) => [`${file} › ${name}`, graph] as const),
  ),
  ...Object.entries(fixtureFiles).flatMap(([file, mod]) => {
    const graph = (mod as { default?: unknown }).default;

    return looksLikeGraph(graph) ? [[file, graph] as const] : [];
  }),
];

describe("the migration chain is idempotent", () => {
  test("over every graph the repo ships — 16 today", () => {
    expect(GRAPHS.length).toBeGreaterThan(14);
  });

  /*
   * Through the real door, because that is the pass that actually repeats: the
   * door strips the version on the way in, so the *second* arrival is always
   * the assumed-version chain on modern data.
   */
  test.each(GRAPHS)("%s survives the door twice", (_name, graph) => {
    const first = migrateIncoming(structuredClone(graph));

    expect(first.ok, !first.ok ? first.message : "").toBe(true);

    if (!first.ok) {
      return;
    }

    const second = migrateIncoming(structuredClone(first.graph));

    expect(second.ok).toBe(true);

    if (second.ok) {
      expect(second.graph).toEqual(first.graph);
    }
  });

  /*
   * And the whole chain from legacy v1, which is what a host that persists
   * `getData()` replays on every load: the stamp is added on export to file,
   * so a stored graph reads as v1. The guessing migrations run here too — the
   * ones that cannot tell old data from new — so this is the stricter half.
   */
  test.each(GRAPHS)("%s is stable through the full chain", (_name, graph) => {
    const { version: _version, ...stored } = graph as GraphData & {
      version?: number;
    };
    const once = migrateGraph(structuredClone(stored) as Record<string, unknown>, 1).graph;
    const twice = migrateGraph(structuredClone(once) as Record<string, unknown>, 1).graph;

    expect(twice).toEqual(once);
  });
});
