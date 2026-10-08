import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./node-editor";

import type { NodeEditor } from "./node-editor";
import type { FlowNodeData, GraphData } from "../../../viewer/types/graph";

afterEach(() => {
  document.body.replaceChildren();
});

function graf(): GraphData {
  return {
    startNodeId: "q1",
    nodes: [
      {
        id: "q1",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: "Fråga 1",
          variableName: "a",
          options: [{ id: "q1-ja", label: "Ja", value: "ja" }],
        },
      },
    ],
    connections: [],
  };
}

function montera(): NodeEditor {
  const editor = document.createElement("node-editor") as NodeEditor;
  // Opt in: the default is readonly, and this test builds.
  editor.editorMode = "administrator";
  editor.style.cssText = "display: block; width: 600px; height: 400px;";
  document.body.append(editor);
  editor.graph = graf();
  return editor;
}

function nyNod(): FlowNodeData {
  return {
    id: "ny",
    type: "question",
    position: { x: 0, y: 0 },
    data: {
      title: "Ny fråga",
      variableName: "",
      options: [{ id: "ny-ja", label: "Ja", value: "ja" }],
    },
  } as FlowNodeData;
}

function skugga(editor: NodeEditor): HTMLElement | null {
  return (
    editor.shadowRoot?.querySelector<HTMLElement>(".node-editor__drag-ghost") ??
    null
  );
}

/** Canvasens synliga yta i klientkoordinater. */
function vy(editor: NodeEditor): DOMRect {
  const viewport = editor.shadowRoot?.querySelector<HTMLElement>(
    ".node-editor__viewport",
  );

  if (!viewport) {
    throw new Error("Viewporten finns inte.");
  }

  return viewport.getBoundingClientRect();
}

function flytta(x: number, y: number): void {
  window.dispatchEvent(
    new PointerEvent("pointermove", {
      pointerId: 1,
      clientX: x,
      clientY: y,
      bubbles: true,
    }),
  );
}

function drop(x: number, y: number): void {
  window.dispatchEvent(
    new PointerEvent("pointerup", {
      pointerId: 1,
      clientX: x,
      clientY: y,
      bubbles: true,
    }),
  );
}

describe("dragging from the palette", () => {
  // The canvas has overflow: hidden. As long as the pointer remains over the
  // palette the node lies mostly outside the visible area and is clipped —
  // measured at 39 of 240 px. The ghost is the only thing saying you are
  // dragging something out.
  test("a ghost follows the pointer while the node is clipped", () => {
    const editor = montera();
    const rect = vy(editor);

    editor.startPaletteDrag(nyNod(), {
      pointerId: 1,
      clientX: rect.left - 40,
      clientY: rect.top + 30,
    });

    const ghost = skugga(editor);

    expect(ghost).not.toBeNull();
    expect(ghost?.hidden).toBe(false);
    expect(ghost?.textContent).toBe("Ny fråga");
  });

  test("the ghost is hidden when the pointer is inside the canvas", () => {
    const editor = montera();
    const rect = vy(editor);

    editor.startPaletteDrag(nyNod(), {
      pointerId: 1,
      clientX: rect.left - 40,
      clientY: rect.top + 30,
    });

    flytta(rect.left + 200, rect.top + 120);

    expect(skugga(editor)?.hidden).toBe(true);
  });

  // The node is added to the graph already on pointer down. Without the undo,
  // every brush against the palette became a node, placed wherever the drag
  // happened to end and mostly clipped by the canvas edge.
  test("a drop outside the canvas undoes the whole drag", () => {
    const editor = montera();
    const rect = vy(editor);

    expect(editor.graph.nodes).toHaveLength(1);

    editor.startPaletteDrag(nyNod(), {
      pointerId: 1,
      clientX: rect.left - 40,
      clientY: rect.top + 30,
    });

    expect(editor.graph.nodes).toHaveLength(2);

    // A drag always moves the pointer. Without movement it is a click, and then
    // nothing is undone — see `lastPointer`.
    flytta(rect.left - 60, rect.top + 50);
    drop(rect.left - 60, rect.top + 50);

    expect(editor.graph.nodes).toHaveLength(1);
    expect(editor.graph.nodes.map((node) => node.id)).toEqual(["q1"]);
    expect(skugga(editor)).toBeNull();
  });

  // Without movement it is a click on the palette, not a drag. The click has a
  // path of its own that places the node somewhere visible, and that must not be
  // undone.
  test("a drop without the pointer having moved undoes nothing", () => {
    const editor = montera();
    const rect = vy(editor);

    editor.startPaletteDrag(nyNod(), {
      pointerId: 1,
      clientX: rect.left - 40,
      clientY: rect.top + 30,
    });

    drop(rect.left - 40, rect.top + 30);

    expect(editor.graph.nodes).toHaveLength(2);
  });

  test("a drop inside the canvas keeps the node", () => {
    const editor = montera();
    const rect = vy(editor);

    editor.startPaletteDrag(nyNod(), {
      pointerId: 1,
      clientX: rect.left - 40,
      clientY: rect.top + 30,
    });

    flytta(rect.left + 200, rect.top + 120);
    drop(rect.left + 200, rect.top + 120);

    expect(editor.graph.nodes).toHaveLength(2);
    expect(skugga(editor)).toBeNull();
  });
});
