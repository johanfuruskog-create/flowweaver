import { afterEach, describe, expect, test, vi } from "vitest";
import "../../../viewer/node-types/default-node-types";
import "./guide-editor";
import type { FlowNode } from "../flow-node/flow-node";
import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("guide-editor: empty state", () => {
  test("shows help text on an empty canvas and hides it once a node exists", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = { startNodeId: null, nodes: [], connections: [] };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const empty = nodeEditor?.shadowRoot?.querySelector<HTMLElement>("[data-empty]");
    if (!nodeEditor || !empty) throw new Error("Tomt-tillståndet saknas.");

    expect(empty.hidden).toBe(false);
    expect(empty.textContent).toContain("Dra ut din första nod");

    editor.graph = {
      startNodeId: "q",
      nodes: [{ id: "q", type: "text-question", position: { x: 0, y: 0 }, data: { title: "Fråga", variableName: "x" } }],
      connections: [],
    };
    const emptyAfter = editor.shadowRoot
      ?.querySelector<NodeEditor>("node-editor")
      ?.shadowRoot?.querySelector<HTMLElement>("[data-empty]");
    expect(emptyAfter?.hidden).toBe(true);
  });
});

describe("guide-editor: security", () => {
  test("the context menu does not inject script from a rigged node id", () => {
    const payloadId = 'x"><img src=x onerror="window.__xss=1">';
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    // Set directly (bypassing import validation) to test the sink itself.
    editor.graph = {
      startNodeId: payloadId,
      nodes: [
        { id: payloadId, type: "text-question", position: { x: 0, y: 0 }, data: { title: "Nod", variableName: "x" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const target = Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === payloadId);
    const clickable = target?.shadowRoot?.querySelector<HTMLElement>(".flow-node");
    if (!nodeEditor || !clickable) throw new Error("Noden saknas.");

    const rect = clickable.getBoundingClientRect();
    clickable.dispatchEvent(new MouseEvent("contextmenu", {
      clientX: rect.left + 10, clientY: rect.top + 10, bubbles: true, composed: true,
    }));

    const menuLayer = nodeEditor.shadowRoot?.querySelector(
      ".node-editor__connection-menu-layer"
    );
    const removeButton = nodeEditor.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="remove-node"]'
    );

    // Ingen <img> (eller annan tagg) fick injiceras från id:t.
    expect(menuLayer?.querySelector("img")).toBeNull();
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
    // But the menu works: the button exists and points at the right (decoded) id.
    expect(removeButton).not.toBeNull();
    expect(removeButton?.dataset.targetId).toBe(payloadId);
  });
});
