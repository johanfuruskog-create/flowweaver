import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import "../../../viewer/node-types/default-node-types";
import "./guide-editor";
import type { EditorToolbar } from "../editor-toolbar/editor-toolbar";
import type { FlowNode } from "../flow-node/flow-node";
import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function mountEditor(): {
  editor: GuideEditor;
  nodeEditor: NodeEditor;
  viewport: HTMLElement;
} {
  const editor = document.createElement("guide-editor") as GuideEditor;
  // Opt in: the default is readonly, and this test builds.
  editor.setAttribute("mode", "administrator");
  document.body.append(editor);
  editor.graph = {
    startNodeId: "fraga",
    nodes: [
      { id: "fraga", type: "text-question", position: { x: 160, y: 140 }, data: { title: "Fråga", variableName: "svar" } },
      { id: "resultat", type: "result", position: { x: 560, y: 200 }, data: { title: "Klart" } },
    ],
    connections: [],
  };

  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(
    ".node-editor__viewport"
  );
  if (!nodeEditor || !viewport) {
    throw new Error("Kunde inte hitta node-editor.");
  }
  return { editor, nodeEditor, viewport };
}

function nodeElement(nodeEditor: NodeEditor, id: string): FlowNode {
  const element = Array.from(
    nodeEditor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
  ).find((node) => node.nodeData?.id === id);
  if (!element) throw new Error(`Noden ${id} saknas.`);
  return element;
}

function centerOf(element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

describe("guide-editor zoom", () => {
  test("keeps the point under the pointer still when zooming towards it", () => {
    const { nodeEditor } = mountEditor();
    const target = nodeElement(nodeEditor, "resultat");

    const before = centerOf(target);
    const widthBefore = target.getBoundingClientRect().width;
    // Zooma in mot nodens mitt – den ska ligga kvar under samma klientpunkt.
    nodeEditor.setZoom(1.4, before.x, before.y);
    const after = centerOf(target);

    expect(after.x).toBeCloseTo(before.x, 0);
    expect(after.y).toBeCloseTo(before.y, 0);
    expect(nodeEditor.getZoom()).toBeCloseTo(1.4, 5);
    // Noden ska faktiskt ha ritats 1,4× större (zoomen tog effekt).
    expect(target.getBoundingClientRect().width).toBeCloseTo(widthBefore * 1.4, 0);
  });

  test("keeps the pivot still when zooming out near the canvas's top-left corner", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "fraga",
      nodes: [
        // A negative position so the node is in view once scrolled to the edge.
        { id: "fraga", type: "text-question", position: { x: -600, y: -300 }, data: { title: "Fråga", variableName: "svar" } },
      ],
      connections: [],
    };
    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(
      ".node-editor__viewport"
    );
    if (!nodeEditor || !viewport) throw new Error("node-editor saknas.");

    // Scrolla till canvasens övre vänstra kant.
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;

    const target = nodeElement(nodeEditor, "fraga");
    const before = centerOf(target);
    // Zoom out with the pivot on the node (right of the left edge): the target
    // scroll used to want to go negative and was clamped, so the pivot drifted.
    nodeEditor.setZoom(0.5, before.x, before.y);
    const after = centerOf(target);

    expect(after.x).toBeCloseTo(before.x, 0);
    expect(after.y).toBeCloseTo(before.y, 0);
  });

  test("clamps the zoom level to the range", () => {
    const { nodeEditor } = mountEditor();

    nodeEditor.setZoom(9);
    expect(nodeEditor.getZoom()).toBeCloseTo(1.5, 5);

    nodeEditor.setZoom(0.01);
    expect(nodeEditor.getZoom()).toBeCloseTo(0.25, 5);
  });

  test("moves a node in canvas px even though the view is zoomed out", () => {
    const { nodeEditor } = mountEditor();
    nodeEditor.setZoom(0.5);

    const target = nodeElement(nodeEditor, "resultat");
    const handle = target.shadowRoot?.querySelector<HTMLElement>("[data-drag-handle]");
    const viewport = nodeEditor.shadowRoot?.querySelector<HTMLElement>(
      ".node-editor__viewport"
    );
    if (!handle || !viewport) throw new Error("Draghandtaget saknas.");

    vi.spyOn(viewport, "setPointerCapture").mockImplementation(() => undefined);
    vi.spyOn(viewport, "hasPointerCapture").mockReturnValue(true);
    vi.spyOn(viewport, "releasePointerCapture").mockImplementation(() => undefined);

    const startX = nodeEditor.getData().nodes.find((node) => node.id === "resultat")!.position.x;
    const handleRect = handle.getBoundingClientRect();
    handle.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 91, button: 0,
      clientX: handleRect.left + 10, clientY: handleRect.top + 10,
      bubbles: true, composed: true,
    }));
    // 60 klient-px åt höger vid zoom 0,5 ⇒ 120 canvas-px.
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 91, clientX: handleRect.left + 70, clientY: handleRect.top + 10,
    }));
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 91 }));

    const endX = nodeEditor.getData().nodes.find((node) => node.id === "resultat")!.position.x;
    expect(endX - startX).toBeCloseTo(120, 0);
  });

  test("the node keeps following the pointer when zooming mid-drag", () => {
    const { nodeEditor, viewport } = mountEditor();
    const target = nodeElement(nodeEditor, "resultat");
    const handle = target.shadowRoot?.querySelector<HTMLElement>("[data-drag-handle]");
    if (!handle) throw new Error("Draghandtaget saknas.");

    vi.spyOn(viewport, "setPointerCapture").mockImplementation(() => undefined);
    vi.spyOn(viewport, "hasPointerCapture").mockReturnValue(true);
    vi.spyOn(viewport, "releasePointerCapture").mockImplementation(() => undefined);

    const handleRect = handle.getBoundingClientRect();
    const grabX = handleRect.left + 10;
    const grabY = handleRect.top + 10;
    handle.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 95, button: 0, clientX: grabX, clientY: grabY,
      bubbles: true, composed: true,
    }));

    // Zooma in mot pekaren mitt i draget.
    viewport.dispatchEvent(new WheelEvent("wheel", {
      deltaY: -100, ctrlKey: true, clientX: grabX, clientY: grabY,
      bubbles: true, composed: true, cancelable: true,
    }));
    const zoom = nodeEditor.getZoom();
    expect(zoom).toBeGreaterThan(1);

    const startX = nodeEditor.getData().nodes.find((n) => n.id === "resultat")!.position.x;
    // Move the pointer 60 client px; the node should follow 60 / zoom canvas px.
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 95, clientX: grabX + 60, clientY: grabY,
    }));
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 95 }));

    const endX = nodeEditor.getData().nodes.find((n) => n.id === "resultat")!.position.x;
    // ≤1px tolerans: moveNode avrundar positionen till heltal.
    expect(Math.abs(endX - startX - 60 / zoom)).toBeLessThanOrEqual(1);
  });

  test("zooms towards the pointer on Ctrl+scroll and emits zoom-changed", () => {
    const { editor, nodeEditor, viewport } = mountEditor();
    const events: number[] = [];
    editor.shadowRoot?.addEventListener("zoom-changed", (event) => {
      events.push((event as CustomEvent<number>).detail);
    });

    const target = nodeElement(nodeEditor, "resultat");
    const before = centerOf(target);
    const wheel = new WheelEvent("wheel", {
      deltaY: -100, ctrlKey: true,
      clientX: before.x, clientY: before.y,
      bubbles: true, composed: true, cancelable: true,
    });
    viewport.dispatchEvent(wheel);

    expect(wheel.defaultPrevented).toBe(true);
    expect(nodeEditor.getZoom()).toBeGreaterThan(1);
    expect(events.at(-1)).toBeCloseTo(nodeEditor.getZoom(), 5);
    const after = centerOf(target);
    expect(after.x).toBeCloseTo(before.x, 0);
    expect(after.y).toBeCloseTo(before.y, 0);
  });

  test("Ctrl + sidled-scroll utan vertikal delta zoomar inte", () => {
    const { nodeEditor, viewport } = mountEditor();
    const wheel = new WheelEvent("wheel", {
      deltaX: -100, deltaY: 0, ctrlKey: true,
      clientX: 200, clientY: 200,
      bubbles: true, composed: true, cancelable: true,
    });
    viewport.dispatchEvent(wheel);

    expect(nodeEditor.getZoom()).toBe(1);
  });

  test("vanlig scroll utan Ctrl zoomar inte", () => {
    const { nodeEditor, viewport } = mountEditor();
    const wheel = new WheelEvent("wheel", {
      deltaY: -100, clientX: 200, clientY: 200,
      bubbles: true, composed: true, cancelable: true,
    });
    viewport.dispatchEvent(wheel);

    expect(wheel.defaultPrevented).toBe(false);
    expect(nodeEditor.getZoom()).toBe(1);
  });

  test("zoom keys are ignored when focus is in an editable field", () => {
    const { nodeEditor, viewport } = mountEditor();
    nodeEditor.setZoom(1.3);

    // Simulera ett framtida inline-textfält på canvasen.
    const input = document.createElement("input");
    viewport.append(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "0", bubbles: true }));
    expect(nodeEditor.getZoom()).toBeCloseTo(1.3, 5);

    // But from the canvas itself the key must still work.
    viewport.dispatchEvent(new KeyboardEvent("keydown", { key: "0", bubbles: true }));
    expect(nodeEditor.getZoom()).toBe(1);
  });

  test("renders the context menu at screen scale whatever the zoom", () => {
    const { nodeEditor } = mountEditor();
    nodeEditor.setZoom(0.4);

    const target = nodeElement(nodeEditor, "resultat");
    const clickable = target.shadowRoot?.querySelector<HTMLElement>(".flow-node");
    if (!clickable) throw new Error("Noden saknas.");

    const rect = clickable.getBoundingClientRect();
    clickable.dispatchEvent(new MouseEvent("contextmenu", {
      clientX: rect.left + 10, clientY: rect.top + 10, bubbles: true, composed: true,
    }));

    const menu = nodeEditor.shadowRoot?.querySelector<HTMLElement>(
      ".node-editor__connection-menu"
    );
    if (!menu) throw new Error("Kontextmenyn ritades inte.");

    // offsetWidth is the layout width (unaffected by transforms); rect.width is
    // the visual width (scaled). They match only when the net scale is 1, that
    // is, when the menu is drawn at screen size despite the layer being zoomed
    // out.
    expect(menu.offsetWidth).toBeGreaterThan(0);
    expect(menu.getBoundingClientRect().width).toBeCloseTo(menu.offsetWidth, 0);
  });

  test("zooms out so a spread-out graph fits the view", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    /*
     * 2400, inte 2600 (29/9): provet mäter att anpassningen zoomar ut och
     * att båda noderna hamnar innanför — inte var zoomgolvet går. Vid 2600
     * låg grafen exakt på golvet (0,25) i 1280-fönstret med 380-panelen:
     * 710 px noder i 710 px vy. När sidopanelen blev
     * `clamp(380px, 30%, 440px)` fick vyn 706 px och noderna stack ut 2 px
     * på var sida — golvet, inte anpassningen, hade fällt provet. Med 2400
     * ryms grafen på golvet med marginal i varje rimlig vy.
     */
    editor.graph = {
      startNodeId: "a",
      nodes: [
        { id: "a", type: "text-question", position: { x: 0, y: 0 }, data: { title: "A", variableName: "a" } },
        { id: "b", type: "result", position: { x: 2400, y: 1500 }, data: { title: "B" } },
      ],
      connections: [],
    };
    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(
      ".node-editor__viewport"
    );
    if (!nodeEditor || !viewport) throw new Error("node-editor saknas.");

    expect(nodeEditor.fitToContent(true)).toBe(true);

    // The graph is much wider than the view: the zoom must have decreased.
    expect(nodeEditor.getZoom()).toBeLessThan(1);

    // And both nodes must fit within the viewport's frame.
    const viewportRect = viewport.getBoundingClientRect();
    for (const id of ["a", "b"]) {
      const rect = nodeElement(nodeEditor, id).getBoundingClientRect();
      expect(rect.left).toBeGreaterThanOrEqual(viewportRect.left - 1);
      expect(rect.right).toBeLessThanOrEqual(viewportRect.right + 1);
      expect(rect.top).toBeGreaterThanOrEqual(viewportRect.top - 1);
      expect(rect.bottom).toBeLessThanOrEqual(viewportRect.bottom + 1);
    }
  });

  test("does not zoom in past 100% for a small graph", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "solo",
      nodes: [
        { id: "solo", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart" } },
      ],
      connections: [],
    };
    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    if (!nodeEditor) throw new Error("node-editor saknas.");

    // En ensam nod skulle rymmas långt över 100 % – capen håller den på 1.
    nodeEditor.fitToContent(true);
    expect(nodeEditor.getZoom()).toBe(1);
  });

  test("styr zoomen via Visa-menyns knappar", async () => {
    const { editor, nodeEditor } = mountEditor();
    const toolbar = editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
    const trigger = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-menu-trigger="view"]'
    );
    if (!toolbar || !trigger) throw new Error("Visa-menyn saknas.");

    const click = async (action: string): Promise<void> => {
      await userEvent.click(trigger);
      const button = toolbar.shadowRoot?.querySelector<HTMLButtonElement>(
        `[data-action="${action}"]`
      );
      if (!button) throw new Error(`Knappen ${action} saknas.`);
      await userEvent.click(button);
    };

    await click("zoom-in");
    expect(nodeEditor.getZoom()).toBeGreaterThan(1);

    await click("zoom-reset");
    expect(nodeEditor.getZoom()).toBe(1);

    await click("zoom-out");
    expect(nodeEditor.getZoom()).toBeLessThan(1);
  });
});
