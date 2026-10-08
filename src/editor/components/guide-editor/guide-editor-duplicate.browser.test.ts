import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import "../../../viewer/node-types/default-node-types";
import "./guide-editor";
import type { FlowNode } from "../flow-node/flow-node";
import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function mount(): { editor: GuideEditor; nodeEditor: NodeEditor; viewport: HTMLElement } {
  const editor = document.createElement("guide-editor") as GuideEditor;
  // Opt in: the default is readonly, and this test builds.
  editor.setAttribute("mode", "administrator");
  document.body.append(editor);
  editor.graph = {
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "text-question", position: { x: 0, y: 0 }, data: { title: "Fråga", variableName: "a" } },
    ],
    connections: [],
  };
  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(".node-editor__viewport");
  if (!nodeEditor || !viewport) throw new Error("node-editor saknas.");
  return { editor, nodeEditor, viewport };
}

describe("guide-editor duplicering", () => {
  test("Ctrl+D duplicerar den markerade noden och markerar klonen", () => {
    const { nodeEditor, viewport } = mount();
    nodeEditor.selectNodeById("q1");

    viewport.dispatchEvent(new KeyboardEvent("keydown", {
      key: "d", ctrlKey: true, bubbles: true, composed: true,
    }));

    const nodes = nodeEditor.getData().nodes;
    expect(nodes).toHaveLength(2);
    const clone = nodes.find((node) => node.id !== "q1");
    // Klonen har eget id men samma innehåll, förskjuten position.
    expect(clone?.type).toBe("text-question");
    expect(clone?.position).toEqual({ x: 40, y: 40 });
    // The clone is not the start node.
    expect(nodeEditor.getData().startNodeId).toBe("q1");
  });

  test("duplicerar via kontextmenyn", async () => {
    const { nodeEditor } = mount();
    const target = Array.from(
      nodeEditor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === "q1");
    const clickable = target?.shadowRoot?.querySelector<HTMLElement>(".flow-node");
    if (!clickable) throw new Error("Noden saknas.");

    const rect = clickable.getBoundingClientRect();
    clickable.dispatchEvent(new MouseEvent("contextmenu", {
      clientX: rect.left + 10, clientY: rect.top + 10, bubbles: true, composed: true,
    }));

    const duplicateButton = nodeEditor.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="duplicate-node"]'
    );
    if (!duplicateButton) throw new Error("Duplicera-knappen saknas.");
    await userEvent.click(duplicateButton);

    expect(nodeEditor.getData().nodes).toHaveLength(2);
  });
});
