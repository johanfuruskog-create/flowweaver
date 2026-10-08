import { describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";

import { BUNDLED_GRAPHS } from "./bundled-graphs";

import {
  CURRENT_GRAPH_VERSION,
  migrateGraph,
} from "../viewer/core/graph-migrations";

import type { GraphData } from "../viewer/types/graph";

/**
 * The bundled example graphs must already be in the current format.
 *
 * Guides that arrive as *files* are migrated on import, and the chain is
 * guarded: raising CURRENT_GRAPH_VERSION without adding a migration fails a
 * test. These graphs are TypeScript literals and never pass through import, so
 * they slip straight past that guard.
 *
 * That is not hypothetical. Migration v3→v4 (story 001) turned the Page's
 * built-in fields into real child nodes, and the renderer stopped reading the
 * old keys. The mortgage example kept them, so its page "Om dig och bostaden"
 * rendered a heading, a Continue button and **nothing to fill in** — two
 * required fields, name and municipality, silently gone.
 *
 * Running the whole chain over each graph and requiring that nothing changes is
 * the general guard. Any future migration that would rewrite an example fails
 * here, on the migration's own terms, without anyone having to remember.
 */

/** The parts a migration may not silently rewrite under a shipped example. */
function structure(graph: GraphData): unknown {
  return {
    startNodeId: graph.startNodeId,
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      template: node.template,
      parentPageId: node.parentPageId,
      order: node.order,
    })),
    connections: graph.connections.map((connection) => connection.id).sort(),
    nodeTemplates: graph.settings?.nodeTemplates,
  };
}

const GRAPHS = BUNDLED_GRAPHS;

describe("the bundled examples are in the current format", () => {
  test("there are examples to check", () => {
    expect(GRAPHS.length).toBeGreaterThan(5);
  });

  /**
   * The general guard: running the whole chain must not change the graph's
   * *structure*.
   *
   * Structure, not the whole object. v1→v2 and v2→v3 turn bare strings into
   * { sv: text } maps, and a bare string is a supported shape that renders
   * correctly — normalising it is not a defect. What must never happen is a
   * migration that would add nodes, retype them or re-parent them, because that
   * means the shipped example is a shape the renderer no longer reads.
   */
  test.each(GRAPHS)("%s is structurally unchanged by the chain", (_, graph) => {
    const { graph: migrated } = migrateGraph(
      JSON.parse(JSON.stringify(graph)) as Record<string, unknown>,
      1,
    );

    expect(structure(migrated as unknown as GraphData)).toEqual(structure(graph));
  });

  test.each(GRAPHS)("%s carries no version older than the current", (_, graph) => {
    const version = (graph as { version?: number }).version;

    expect(version === undefined || version === CURRENT_GRAPH_VERSION).toBe(true);
  });
});

describe("every page has something to fill in", () => {
  // The specific symptom the general guard would have caught: a page whose
  // fields live in keys nothing renders any more.
  const pages = GRAPHS.flatMap(([name, graph]) =>
    graph.nodes
      .filter((node) => node.type === "page")
      .map((node) => [`${name}/${node.id}`, node, graph] as const),
  );

  test("there are pages to check", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  test.each(pages)("%s has child nodes, not legacy keys", (_, page, graph) => {
    const children = graph.nodes.filter((node) => node.parentPageId === page.id);
    const legacyKeys = Object.keys(page.data).filter((key) =>
      /^(first|second)(Label|VariableName|Placeholder|Required)$/.test(key),
    );

    expect({ children: children.length > 0, legacyKeys }).toEqual({
      children: true,
      legacyKeys: [],
    });
  });
});
