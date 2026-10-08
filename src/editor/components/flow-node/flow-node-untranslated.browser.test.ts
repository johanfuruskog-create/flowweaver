import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { FlowNode } from "./flow-node";
import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

/**
 * The untranslated mark lives where problems live.
 *
 * It used to be a text chip floating in the header — "Saknar översättning" in
 * full — which ate the header's width on every untranslated node (Johan's eye,
 * on the English films: a guide injected with a Swedish source turns the whole
 * canvas into chips). The health marker already solved this exact problem for
 * validation: a fixed-size marker in the header, the reason in the marker's
 * name and in the node's own accessible name. The translation gap now rides
 * the same convention: compact for the eye, spelled out for the screen reader.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 80));

async function canvas(): Promise<NodeEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1000px; height: 700px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "text-question", position: { x: 80, y: 80 }, data: { title: "Ett", variableName: "a" } },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");

  if (!nodeEditor) throw new Error("node-editor saknas.");

  return nodeEditor;
}

const nodeOf = (nodeEditor: NodeEditor, id: string): FlowNode =>
  Array.from(nodeEditor.shadowRoot!.querySelectorAll<FlowNode>("flow-node"))
    .find((node) => node.nodeData?.id === id)!;

async function untranslated(nodeEditor: NodeEditor): Promise<FlowNode> {
  nodeEditor.untranslatedNodeIds = ["q1"];
  await settle();
  return nodeOf(nodeEditor, "q1");
}

describe("a node missing its translation", () => {
  test("carries a compact marker in the header, named for a screen reader", async () => {
    const node = await untranslated(await canvas());
    const marker = node.shadowRoot!.querySelector(".flow-node__translation");

    expect(marker).toBeTruthy();
    expect(marker!.getAttribute("aria-label")).toBe("Saknar översättning");
    expect(marker!.getAttribute("title")).toBe("Saknar översättning");
  });

  test("says so in the node's own accessible name, like a health problem does", async () => {
    const node = await untranslated(await canvas());
    const wrapper = node.shadowRoot!.querySelector(".flow-node");

    expect(wrapper!.getAttribute("aria-label")).toContain("Saknar översättning");
  });

  test("no longer floats the message as a text chip in the header", async () => {
    const node = await untranslated(await canvas());
    const header = node.shadowRoot!.querySelector(".flow-node__header")!;
    const after = getComputedStyle(header, "::after").content;

    expect(after === "none" || after === "normal" || after === '""').toBe(true);
  });

  test("loses marker and name both when the translation arrives", async () => {
    const nodeEditor = await canvas();
    await untranslated(nodeEditor);

    nodeEditor.untranslatedNodeIds = [];
    await settle();

    // Looked up anew: the canvas may redraw the element, and the test's
    // question is about the node on the canvas, not a held reference.
    const node = nodeOf(nodeEditor, "q1");

    expect(node.shadowRoot!.querySelector(".flow-node__translation")).toBeNull();
    expect(
      node.shadowRoot!.querySelector(".flow-node")!.getAttribute("aria-label"),
    ).not.toContain("Saknar översättning");
  });
});
