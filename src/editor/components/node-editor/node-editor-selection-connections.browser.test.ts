import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "./node-editor";

/**
 * A selected node's own connections — Uppdrag 23/9, Del A punkt 5.
 *
 * The ring on a selected node already exists ([data-selected] on flow-node).
 * This adds its in- and out-edges: the same `--selected` treatment a directly
 * clicked connection already gets (thicker, `--fw-primary-strong`), reusing
 * the existing class rather than a new one. Never the shown route's green
 * (`--connection--highlighted`, `--fw-success`) — that colour answers "what
 * leads here" in the prove pane, and a selection marking a node is not an
 * answer to anything.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function canvas(): Promise<{ editor: GuideEditor; nodeEditor: NodeEditor }> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1200px; height: 800px;";
  document.body.append(editor);
  editor.graph = {
    // "before" is the start node on purpose: a start node has no input port
    // of its own (nothing can lead into where a guide begins), so "middle" —
    // the node this test selects — needs to sit one step further in to have
    // both an in- and an out-edge to check.
    startNodeId: "before",
    nodes: [
      { id: "before", type: "text-question", position: { x: 0, y: 0 }, data: { title: "Före", variableName: "before" } },
      { id: "middle", type: "text-question", position: { x: 320, y: 0 }, data: { title: "Mitten", variableName: "middle" } },
      { id: "after", type: "text-question", position: { x: 640, y: 0 }, data: { title: "Efter", variableName: "after" } },
      { id: "unrelated-a", type: "text-question", position: { x: 320, y: 300 }, data: { title: "Obesläktad A", variableName: "a" } },
      { id: "unrelated-b", type: "text-question", position: { x: 640, y: 300 }, data: { title: "Obesläktad B", variableName: "b" } },
    ],
    connections: [
      // In- and out-edges of "middle" — must get the selected treatment.
      { id: "in", from: { nodeId: "before", portId: "continue" }, to: { nodeId: "middle", portId: "input" } },
      { id: "out", from: { nodeId: "middle", portId: "continue" }, to: { nodeId: "after", portId: "input" } },
      // Untouched by the selection — must not.
      { id: "elsewhere", from: { nodeId: "unrelated-a", portId: "continue" }, to: { nodeId: "unrelated-b", portId: "input" } },
    ],
  } as never;

  await settle();
  await settle();

  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  if (!nodeEditor) throw new Error("node-editor saknas.");

  return { editor, nodeEditor };
}

function pathFor(nodeEditor: NodeEditor, connectionId: string): SVGPathElement {
  const path = nodeEditor.shadowRoot!.querySelector<SVGPathElement>(
    `path.node-editor__connection[data-connection-id="${connectionId}"]`,
  );
  if (!path) throw new Error(`kopplingen ${connectionId} saknas.`);
  return path;
}

describe("vald nods kopplingar", () => {
  test("bär --selected på båda sina egna, aldrig på en obesläktad", async () => {
    const { nodeEditor } = await canvas();

    nodeEditor.selectNodeById("middle");
    await settle();

    expect(pathFor(nodeEditor, "in").classList.contains("node-editor__connection--selected")).toBe(true);
    expect(pathFor(nodeEditor, "out").classList.contains("node-editor__connection--selected")).toBe(true);
    expect(pathFor(nodeEditor, "elsewhere").classList.contains("node-editor__connection--selected")).toBe(false);

    // Aldrig den gröna vägen-hit-klassen för en vanlig markering.
    expect(pathFor(nodeEditor, "in").classList.contains("node-editor__connection--highlighted")).toBe(false);
    expect(pathFor(nodeEditor, "out").classList.contains("node-editor__connection--highlighted")).toBe(false);
  });

  test("markeringen är tjockare, aldrig grön", async () => {
    const { nodeEditor } = await canvas();

    const beforeSelection = getComputedStyle(pathFor(nodeEditor, "in")).strokeWidth;

    nodeEditor.selectNodeById("middle");
    await settle();

    const afterSelection = getComputedStyle(pathFor(nodeEditor, "in"));

    expect(parseFloat(afterSelection.strokeWidth)).toBeGreaterThan(parseFloat(beforeSelection));
    // rgb(22, 163, 74) is --fw-success (the prove pane's green, see
    // tokens.scss) — the selected stroke must never resolve to it.
    expect(afterSelection.stroke).not.toBe("rgb(22, 163, 74)");
  });

  test("avmarkera tar bort klassen igen", async () => {
    const { nodeEditor } = await canvas();

    nodeEditor.selectNodeById("middle");
    await settle();
    expect(pathFor(nodeEditor, "in").classList.contains("node-editor__connection--selected")).toBe(true);

    nodeEditor.selectNodeById(null);
    await settle();

    expect(pathFor(nodeEditor, "in").classList.contains("node-editor__connection--selected")).toBe(false);
    expect(pathFor(nodeEditor, "out").classList.contains("node-editor__connection--selected")).toBe(false);
  });
});
