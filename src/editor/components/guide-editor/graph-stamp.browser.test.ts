import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import { CURRENT_GRAPH_VERSION, readGraphVersion } from "../../../viewer/core/graph-migrations";
import { importGraphJson } from "../../core/graph-io";

import type { GuideEditor } from "./guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * What the editor hands out says which format it is in.
 *
 * ## The hazard, traced rather than assumed
 *
 * `getData()` returned no `version`. Measured, it dropped the field whatever
 * came in — no version, v3, or the current one all came out undefined. That is
 * deliberate for the graph the editor keeps in memory: a version carried
 * internally leaks into everything that compares graphs, the undo history
 * included, and the comment in `migrateIncoming` says so.
 *
 * But `getData()` is the boundary, not the interior, and what crosses it gets
 * stored. The SiteVision module does exactly that — `store.update(id,
 * editor.getData())` and `publishToField(editor.getData())`, both through
 * `JSON.stringify`. So a guide reached a file with no statement of its format.
 *
 * Coming back in, the two paths differ:
 *
 * - As an **object**, `migrateIncoming` assumes a missing version means v3, not
 *   v1, precisely so a modern graph is not put through the guessing migrations.
 * - As **JSON**, `readGraphVersion` says v1 — right for a genuinely old file,
 *   wrong for something the editor wrote yesterday — and the v1→v3 migrations
 *   cannot tell old data from new. They rewrite text the editor had just
 *   written.
 *
 * A file store stores JSON. That is the path this closes.
 *
 * ## Why stamping here and not internally
 *
 * `getData()` builds a fresh object to hand out; the graph the editor works on
 * is untouched. The rule the codebase already follows — stamp on the way out,
 * migrate on the way in — is kept, and the interior stays comparable.
 */

afterEach(() => document.body.replaceChildren());

const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

const guide = (): GraphData =>
  ({
    startNodeId: "fraga",
    settings: { sourceLocale: "sv" },
    nodes: [
      {
        id: "fraga",
        type: "question",
        position: { x: 40, y: 40 },
        data: {
          title: { sv: "Har du tandvärk?" },
          options: [{ id: "ja", label: { sv: "Ja" }, value: "ja" }],
        },
      },
      { id: "klar", type: "result", position: { x: 400, y: 40 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "fraga", portId: "ja" }, to: { nodeId: "klar", portId: "input" } },
    ],
  }) as unknown as GraphData;

async function mount(graph: GraphData = guide()): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1000px; height: 600px;";
  document.body.append(editor);
  editor.graph = graph;
  await settle();
  await settle();

  return editor;
}

describe("getData()", () => {
  test("says which format the guide is in", async () => {
    const editor = await mount();

    expect((editor.getData() as { version?: number }).version).toBe(CURRENT_GRAPH_VERSION);
  });

  test("survives the trip a host actually makes it take", async () => {
    const editor = await mount();

    // JSON.stringify, a file, JSON.parse — the file store's whole journey.
    const stored = JSON.stringify(editor.getData());

    expect(readGraphVersion(JSON.parse(stored))).toBe(CURRENT_GRAPH_VERSION);
  });

  test("comes back through import as the same guide", async () => {
    const editor = await mount();
    const stored = JSON.stringify(editor.getData());
    const back = importGraphJson(stored);

    expect(back.success).toBe(true);

    if (!back.success) return;

    // Read as v1, the guessing migrations run on text the editor just wrote.
    // What comes back has to be what went in.
    expect(back.graph.nodes).toHaveLength(2);
    expect(back.graph.connections).toHaveLength(1);
    expect(back.graph.nodes[0]?.data.title).toEqual({ sv: "Har du tandvärk?" });
  });

  test("stamps the current version even when an older one came in", async () => {
    const editor = await mount({ ...guide(), version: 3 } as unknown as GraphData);

    // The content was lifted on the way in, so the stamp on the way out is the
    // format it is actually in now — not the one it arrived as.
    expect((editor.getData() as { version?: number }).version).toBe(CURRENT_GRAPH_VERSION);
  });
});

describe("the graph the editor works on", () => {
  test("is not stamped, so comparisons still work", async () => {
    const editor = await mount();

    /*
     * The reason the version was stripped in the first place. Undo compares
     * graphs, and a field that differs between two otherwise identical states
     * makes every comparison falsely positive. Stamping belongs at the boundary.
     */
    const internal = (editor as unknown as { graphData: { version?: number } }).graphData;

    expect(internal.version).toBeUndefined();
  });
});
