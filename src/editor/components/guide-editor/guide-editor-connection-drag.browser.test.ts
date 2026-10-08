import { afterEach, describe, expect, test, vi } from "vitest";
import "../../../viewer/node-types/default-node-types";
import "./guide-editor";
import type { FlowNode } from "../flow-node/flow-node";
import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

// Speglar AUTO_PAN_DWELL_MS i node-editor (privat konstant där).
const AUTO_PAN_DWELL_MS = 200;

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

// A regression net ahead of the zoom work: these tests verify that the
// client-to-canvas conversion (port centres, snapping, auto-pan) computes
// correctly in pixels, so the coordinate refactoring and the zoom factor cannot
// break silently.

function mountEditor() {
  const editor = document.createElement("guide-editor") as GuideEditor;
  // Opt in: the default is readonly, and this test builds.
  editor.setAttribute("mode", "administrator");
  document.body.append(editor);
  editor.graph = {
    startNodeId: "fraga",
    nodes: [
      { id: "fraga", type: "text-question", position: { x: 120, y: 120 }, data: { title: "Fråga", variableName: "svar" } },
      { id: "resultat", type: "result", position: { x: 560, y: 160 }, data: { title: "Klart" } },
    ],
    connections: [],
  };

  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  const shadow = nodeEditor?.shadowRoot;
  const workspace = shadow?.querySelector<HTMLElement>(".node-editor__workspace");
  const viewport = shadow?.querySelector<HTMLElement>(".node-editor__viewport");
  const nodes = Array.from(shadow?.querySelectorAll<FlowNode>("flow-node") ?? []);
  const questionNode = nodes.find((node) => node.nodeData?.id === "fraga");
  const output = questionNode?.getPortElement("output", "continue");
  const input = nodes
    .find((node) => node.nodeData?.id === "resultat")
    ?.getPortElement("input", "input");
  const preview = shadow?.querySelector<SVGPathElement>(".node-editor__connection--preview");
  if (!nodeEditor || !workspace || !viewport || !questionNode || !output || !input || !preview) {
    throw new Error("Kopplingskontrollerna saknas.");
  }

  return { editor, nodeEditor, workspace, viewport, questionNode, output, input, preview };
}

/** Elementets mitt i både klient- och canvas-koordinater. */
function portCenter(element: HTMLElement, workspace: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const workspaceRect = workspace.getBoundingClientRect();
  return {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
    x: rect.left - workspaceRect.left + rect.width / 2,
    y: rect.top - workspaceRect.top + rect.height / 2,
  };
}

function parseCurve(path: SVGPathElement) {
  const d = path.getAttribute("d") ?? "";
  const start = /^M (-?[\d.]+) (-?[\d.]+) C/.exec(d);
  const end = /,\s*(-?[\d.]+) (-?[\d.]+)$/.exec(d);
  if (!start || !end) throw new Error(`Oväntad förhandskurva: "${d}"`);
  return {
    start: { x: Number.parseFloat(start[1]), y: Number.parseFloat(start[2]) },
    end: { x: Number.parseFloat(end[1]), y: Number.parseFloat(end[2]) },
  };
}

describe("guide-editor kopplingsdrag", () => {
  test("draws the preview curve from the exit port's centre", () => {
    const { workspace, output, preview } = mountEditor();
    const from = portCenter(output, workspace);

    output.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 71, button: 0, clientX: from.clientX, clientY: from.clientY,
      bubbles: true, composed: true,
    }));

    expect(preview.dataset.visible).toBe("true");
    const curve = parseCurve(preview);
    expect(curve.start.x).toBeCloseTo(from.x, 0);
    expect(curve.start.y).toBeCloseTo(from.y, 0);
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 71 }));
  });

  test("follows the pointer without snapping far from entrance ports", () => {
    const { workspace, output, preview } = mountEditor();
    const from = portCenter(output, workspace);
    const workspaceRect = workspace.getBoundingClientRect();

    output.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 72, button: 0, clientX: from.clientX, clientY: from.clientY,
      bubbles: true, composed: true,
    }));
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 72, clientX: from.clientX + 90, clientY: from.clientY + 60,
    }));

    const curve = parseCurve(preview);
    expect(curve.end.x).toBeCloseTo(from.clientX + 90 - workspaceRect.left, 0);
    expect(curve.end.y).toBeCloseTo(from.clientY + 60 - workspaceRect.top, 0);
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 72 }));
  });

  test("snaps to the nearest entrance port and creates the connection on release", () => {
    const { nodeEditor, workspace, output, input, preview } = mountEditor();
    const from = portCenter(output, workspace);
    const to = portCenter(input, workspace);

    output.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 73, button: 0, clientX: from.clientX, clientY: from.clientY,
      bubbles: true, composed: true,
    }));
    // 20 px från portens mitt — inom snappavståndet 35 px.
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 73, clientX: to.clientX - 20, clientY: to.clientY + 4,
    }));

    const curve = parseCurve(preview);
    expect(curve.end.x).toBeCloseTo(to.x, 0);
    expect(curve.end.y).toBeCloseTo(to.y, 0);

    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 73 }));
    expect(nodeEditor.getData().connections).toEqual([
      expect.objectContaining({
        from: { nodeId: "fraga", portId: "continue" },
        to: { nodeId: "resultat", portId: "input" },
      }),
    ]);
    expect(preview.dataset.visible).toBe("false");
  });

  test("a release far from an entrance port cancels with no connection", () => {
    const { nodeEditor, output, workspace, preview } = mountEditor();
    const from = portCenter(output, workspace);

    output.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 74, button: 0, clientX: from.clientX, clientY: from.clientY,
      bubbles: true, composed: true,
    }));
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 74, clientX: from.clientX + 120, clientY: from.clientY + 160,
    }));
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 74 }));

    expect(nodeEditor.getData().connections).toHaveLength(0);
    expect(preview.dataset.visible).toBe("false");
  });

  test("a release straight onto an entrance port creates the connection", () => {
    const { nodeEditor, workspace, output, input } = mountEditor();
    const from = portCenter(output, workspace);

    output.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 75, button: 0, clientX: from.clientX, clientY: from.clientY,
      bubbles: true, composed: true,
    }));
    input.dispatchEvent(new PointerEvent("pointerup", {
      pointerId: 75, bubbles: true, composed: true,
    }));

    expect(nodeEditor.getData().connections).toEqual([
      expect.objectContaining({
        from: { nodeId: "fraga", portId: "continue" },
        to: { nodeId: "resultat", portId: "input" },
      }),
    ]);
  });

  test("a release onto an exit port cancels the connection", () => {
    const { nodeEditor, workspace, output, preview } = mountEditor();
    const from = portCenter(output, workspace);

    output.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 76, button: 0, clientX: from.clientX, clientY: from.clientY,
      bubbles: true, composed: true,
    }));
    output.dispatchEvent(new PointerEvent("pointerup", {
      pointerId: 76, bubbles: true, composed: true,
    }));

    expect(nodeEditor.getData().connections).toHaveLength(0);
    expect(preview.dataset.visible).toBe("false");
  });

  test("auto-pans the viewport when a node lingers and moves towards the edge", () => {
    const { viewport, questionNode } = mountEditor();
    const handle = questionNode.shadowRoot?.querySelector<HTMLElement>("[data-drag-handle]");
    if (!handle) throw new Error("Draghandtaget saknas.");

    vi.spyOn(viewport, "setPointerCapture").mockImplementation(() => undefined);
    vi.spyOn(viewport, "hasPointerCapture").mockReturnValue(true);
    vi.spyOn(viewport, "releasePointerCapture").mockImplementation(() => undefined);
    let clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => clock);

    const handleRect = handle.getBoundingClientRect();
    handle.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 77, button: 0,
      clientX: handleRect.left + 10, clientY: handleRect.top + 10,
      bubbles: true, composed: true,
    }));

    const viewportRect = viewport.getBoundingClientRect();
    const edgeY = viewportRect.top + viewportRect.height / 2;
    // Armera auto-pan genom att först dra i viewportens inre.
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 77,
      clientX: viewportRect.left + viewportRect.width / 2,
      clientY: edgeY,
    }));
    // Kliv in i kantzonen: startar fördröjningen, panorerar inte än.
    window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 77, clientX: viewportRect.right - 50, clientY: edgeY }));
    const before = viewport.scrollLeft;

    // Rörelse mot kanten men innan fördröjningen passerat: fortfarande ingen pan.
    clock = 50;
    window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 77, clientX: viewportRect.right - 30, clientY: edgeY }));
    expect(viewport.scrollLeft).toBe(before);

    // After the delay and one more movement towards the edge, it pans.
    clock = AUTO_PAN_DWELL_MS + 50;
    window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 77, clientX: viewportRect.right - 10, clientY: edgeY }));

    expect(viewport.scrollLeft).toBeGreaterThan(before);
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 77 }));
  });

  test("does not pan while the pointer lingers but does not move towards the edge", () => {
    const { viewport, questionNode } = mountEditor();
    const handle = questionNode.shadowRoot?.querySelector<HTMLElement>("[data-drag-handle]");
    if (!handle) throw new Error("Draghandtaget saknas.");

    vi.spyOn(viewport, "setPointerCapture").mockImplementation(() => undefined);
    vi.spyOn(viewport, "hasPointerCapture").mockReturnValue(true);
    vi.spyOn(viewport, "releasePointerCapture").mockImplementation(() => undefined);
    let clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => clock);

    const handleRect = handle.getBoundingClientRect();
    handle.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 88, button: 0,
      clientX: handleRect.left + 10, clientY: handleRect.top + 10,
      bubbles: true, composed: true,
    }));

    const viewportRect = viewport.getBoundingClientRect();
    const edgeY = viewportRect.top + viewportRect.height / 2;
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 88, clientX: viewportRect.left + viewportRect.width / 2, clientY: edgeY,
    }));
    window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 88, clientX: viewportRect.right - 10, clientY: edgeY }));
    const before = viewport.scrollLeft;

    // The delay has passed, but the pointer now moves inwards (away from the edge).
    clock = AUTO_PAN_DWELL_MS + 100;
    window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 88, clientX: viewportRect.right - 40, clientY: edgeY }));

    expect(viewport.scrollLeft).toBe(before);
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 88 }));
  });

  test("a palette drag does not auto-pan until the pointer has reached the viewport's interior", () => {
    const { editor, nodeEditor, viewport } = mountEditor();
    const palette = editor.shadowRoot?.querySelector("node-palette");
    const paletteButton = palette?.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-node-type="number-question"]'
    );
    if (!paletteButton) throw new Error("Palettknappen saknas.");

    vi.spyOn(viewport, "setPointerCapture").mockImplementation(() => undefined);
    vi.spyOn(viewport, "hasPointerCapture").mockReturnValue(true);
    vi.spyOn(viewport, "releasePointerCapture").mockImplementation(() => undefined);
    let clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => clock);

    // Panning shows as existing content moving on screen. (scrollLeft will not
    // do as a measure: the workspace's growth compensates the scroll without the
    // view moving. The element is fetched fresh because renderNodes replaces the
    // flow-node elements when the palette node is created.)
    const contentX = (): number => {
      const element = Array.from(
        nodeEditor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
      ).find((node) => node.nodeData?.id === "fraga");
      if (!element) throw new Error("Frågenoden saknas.");
      return element.getBoundingClientRect().left;
    };

    const buttonRect = paletteButton.getBoundingClientRect();
    paletteButton.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 78, button: 0,
      clientX: buttonRect.left + 10, clientY: buttonRect.top + 10,
      bubbles: true, composed: true,
    }));

    const viewportRect = viewport.getBoundingClientRect();
    const centerY = viewportRect.top + viewportRect.height / 2;
    const before = contentX();

    // In i viewporten via kantzonen — där palettdrag alltid börjar.
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 78, clientX: viewportRect.left + 20, clientY: centerY,
    }));
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 78, clientX: viewportRect.left + 40, clientY: centerY,
    }));
    expect(contentX()).toBe(before);

    // Once inside the interior the panning is armed. It then requires the
    // pointer to have lingered in the edge zone and to be moving towards the
    // edge before it engages.
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 78, clientX: viewportRect.left + viewportRect.width / 2, clientY: centerY,
    }));
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 78, clientX: viewportRect.right - 50, clientY: centerY,
    }));
    clock = AUTO_PAN_DWELL_MS + 50;
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 78, clientX: viewportRect.right - 10, clientY: centerY,
    }));
    expect(contentX()).toBeLessThan(before);
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 78 }));
  });
});
