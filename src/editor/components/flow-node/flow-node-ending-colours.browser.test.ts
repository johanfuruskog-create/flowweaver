// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { withPro } from "../../../testing/optional-pro";
const PRO = await withPro("index.ts");
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";
import { getNodeTypes, isEndingNodeType } from "../../../viewer/node-types/node-type-registry";

import type { FlowNode } from "./flow-node";
import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

/**
 * Green means the guide ends here.
 *
 * The header colour is the family signal: content indigo, logic purple,
 * endings green. Which types end the guide is declared once, in the node
 * contract (`endsGuide`), and every place that paints a node reads it —
 * the canvas used to keep its own list and coloured two of three endings,
 * so a submission stood indigo next to a green result (Johan, trailer
 * still 9/9). Review is the step before sending and has a way onward:
 * it keeps the step colour (Johan 9/9: green symbolises an ending).
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 80));

const endings = getNodeTypes().map(({ type }) => type).filter(isEndingNodeType);

async function canvas(): Promise<NodeEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 700px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "text-question", position: { x: 40, y: 40 }, data: { title: "Fråga", variableName: "a" } },
      { id: "review", type: "review", position: { x: 340, y: 40 }, data: { title: "Granska" } },
      ...endings.map((type, index) => ({
        id: type, type, position: { x: 40 + 300 * (index + 2), y: 40 }, data: { title: `Slut ${index}` },
      })),
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");

  if (!nodeEditor) throw new Error("node-editor saknas.");

  return nodeEditor;
}

const headerColour = (nodeEditor: NodeEditor, id: string): string => {
  const node = Array.from(nodeEditor.shadowRoot!.querySelectorAll<FlowNode>("flow-node"))
    .find((one) => one.nodeData?.id === id);
  const header = node?.shadowRoot?.querySelector(".flow-node__header");

  if (!header) throw new Error(`${id} saknar huvud.`);

  return getComputedStyle(header).backgroundColor;
};

describe("green means the guide ends here", () => {
  test.runIf(PRO)("the three built-in endings are declared, review is not", () => {
    expect(endings.sort()).toEqual(["email-result", "result", "submit-result"]);
  });

  test("every ending wears the result node's header colour; review keeps the step colour", async () => {
    const nodeEditor = await canvas();
    const step = headerColour(nodeEditor, "q1");
    const ending = headerColour(nodeEditor, "result");

    expect(ending).not.toBe(step);

    for (const type of endings) {
      expect(headerColour(nodeEditor, type), type).toBe(ending);
    }

    expect(headerColour(nodeEditor, "review")).toBe(step);
  });
});
