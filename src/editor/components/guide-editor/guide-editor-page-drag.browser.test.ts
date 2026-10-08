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

describe("guide-editor Page drag", () => {
  test("moves the Page surface and children continuously with the Page", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: { title: "Kontakt" } },
        { id: "field", type: "text-question", parentPageId: "page", order: 0, layout: { columnSpan: 12 }, position: { x: 0, y: 0 }, data: { title: "Namn" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(".node-editor__viewport");
    const nodes = Array.from(nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []);
    const page = nodes.find((node) => node.nodeData?.id === "page");
    const field = nodes.find((node) => node.nodeData?.id === "field");
    const surface = nodeEditor?.shadowRoot?.querySelector<HTMLElement>('[data-page-id="page"]');
    const handle = page?.shadowRoot?.querySelector<HTMLElement>("[data-drag-handle]");
    if (!viewport || !page || !field || !surface || !handle) throw new Error("Page drag controls missing.");

    vi.spyOn(viewport, "setPointerCapture").mockImplementation(() => undefined);
    vi.spyOn(viewport, "hasPointerCapture").mockReturnValue(true);
    vi.spyOn(viewport, "releasePointerCapture").mockImplementation(() => undefined);
    const rect = handle.getBoundingClientRect();
    const elements = [page, surface, field];
    const before = elements.map((element) => ({
      left: Number.parseFloat(element.style.left),
      top: Number.parseFloat(element.style.top),
    }));

    handle.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 31, button: 0, clientX: rect.left + 10, clientY: rect.top + 10,
      bubbles: true, composed: true,
    }));
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 31, clientX: rect.left + 70, clientY: rect.top + 50,
    }));

    const deltas = elements.map((element, index) => ({
      left: Number.parseFloat(element.style.left) - before[index].left,
      top: Number.parseFloat(element.style.top) - before[index].top,
    }));
    expect(deltas[0].left).not.toBe(0);
    expect(deltas[0].top).not.toBe(0);
    expect(deltas[1]).toEqual(deltas[0]);
    expect(deltas[2]).toEqual(deltas[0]);
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 31 }));
  });

  test("drags a node out of the palette onto the canvas", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = { startNodeId: null, nodes: [], connections: [] };

    const palette = editor.shadowRoot?.querySelector("node-palette");
    const paletteButton = palette?.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-node-type="number-question"]'
    );
    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(".node-editor__viewport");
    if (!paletteButton || !nodeEditor || !viewport) throw new Error("Palettknappen saknas.");

    vi.spyOn(viewport, "setPointerCapture").mockImplementation(() => undefined);
    vi.spyOn(viewport, "hasPointerCapture").mockReturnValue(true);
    vi.spyOn(viewport, "releasePointerCapture").mockImplementation(() => undefined);

    const rect = paletteButton.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const dropX = viewportRect.left + 400;
    const dropY = viewportRect.top + 200;

    paletteButton.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 61, button: 0, clientX: rect.left + 10, clientY: rect.top + 10,
      bubbles: true, composed: true,
    }));
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 61, clientX: dropX, clientY: dropY,
    }));
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 61 }));

    const nodes = nodeEditor.getData().nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.type).toBe("number-question");
    expect(nodes[0]?.parentPageId).toBeUndefined();

    // Ett efterföljande klick-event får inte skapa en dubblett.
    paletteButton.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(nodeEditor.getData().nodes).toHaveLength(1);
  });

  test("the palette offers a subheading only once the guide has a page", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    const palette = editor.shadowRoot?.querySelector("node-palette");
    const heading = () =>
      palette?.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-node-type="page-heading"]'
      );

    // Without a page there is no page child in the palette (nothing to put it in).
    editor.graph = { startNodeId: null, nodes: [], connections: [] };
    expect(heading()).toBeNull();

    // Once a page is added, the subheading appears.
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: { title: "Sida" } },
      ],
      connections: [],
    };
    expect(heading()).not.toBeNull();
  });

  test("snaps back a subheading dragged out of its page", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: { title: "Sida" } },
        { id: "heading", type: "page-heading", parentPageId: "page", order: 0, position: { x: 0, y: 0 }, data: { title: "Rubrik" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(".node-editor__viewport");
    const heading = Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === "heading");
    const handle = heading?.shadowRoot?.querySelector<HTMLElement>("[data-drag-handle]");
    if (!nodeEditor || !viewport || !handle) throw new Error("Textnoden saknas.");

    vi.spyOn(viewport, "setPointerCapture").mockImplementation(() => undefined);
    vi.spyOn(viewport, "hasPointerCapture").mockReturnValue(true);
    vi.spyOn(viewport, "releasePointerCapture").mockImplementation(() => undefined);

    const handleRect = handle.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    handle.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 63, button: 0, clientX: handleRect.left + 10, clientY: handleRect.top + 10,
      bubbles: true, composed: true,
    }));
    // Drag far away from the page and drop on empty canvas.
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 63, clientX: viewportRect.right - 20, clientY: viewportRect.bottom - 20,
    }));
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 63 }));

    // The subheading remains and still belongs to the page.
    const node = nodeEditor.getData().nodes.find((candidate) => candidate.id === "heading");
    expect(node).toBeDefined();
    expect(node?.parentPageId).toBe("page");
  });

  test("the palette offers a blank row only once the guide has a page", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    const palette = editor.shadowRoot?.querySelector("node-palette");
    const spacer = () =>
      palette?.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-node-type="page-spacer"]'
      );

    editor.graph = { startNodeId: null, nodes: [], connections: [] };
    expect(spacer()).toBeNull();

    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: { title: "Sida" } },
      ],
      connections: [],
    };
    expect(spacer()).not.toBeNull();
  });

  test("drags a node from the palette straight into a Page", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: { title: "Kontakt" } },
        { id: "field", type: "text-question", parentPageId: "page", order: 0, layout: { columnSpan: 12 }, position: { x: 0, y: 0 }, data: { title: "Namn" } },
      ],
      connections: [],
    };

    const palette = editor.shadowRoot?.querySelector("node-palette");
    const paletteButton = palette?.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-node-type="number-question"]'
    );
    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(".node-editor__viewport");
    const fieldElement = Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === "field");
    if (!paletteButton || !nodeEditor || !viewport || !fieldElement) {
      throw new Error("Palettknappen saknas.");
    }

    vi.spyOn(viewport, "setPointerCapture").mockImplementation(() => undefined);
    vi.spyOn(viewport, "hasPointerCapture").mockReturnValue(true);
    vi.spyOn(viewport, "releasePointerCapture").mockImplementation(() => undefined);

    // Släpp mitt över det befintliga fältets rad i sidan.
    const rect = paletteButton.getBoundingClientRect();
    const fieldRect = fieldElement.getBoundingClientRect();

    paletteButton.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 62, button: 0, clientX: rect.left + 10, clientY: rect.top + 10,
      bubbles: true, composed: true,
    }));
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 62,
      clientX: fieldRect.left + fieldRect.width / 2,
      clientY: fieldRect.top + fieldRect.height / 2,
    }));
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 62 }));

    const created = nodeEditor.getData().nodes.find(
      (node) => node.type === "number-question" && node.id !== "field"
    );
    expect(created?.parentPageId).toBe("page");
  });

  test("lifts a field out of the page when dropped outside", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: { title: "Kontakt" } },
        { id: "field", type: "text-question", parentPageId: "page", order: 0, layout: { columnSpan: 12 }, position: { x: 0, y: 0 }, data: { title: "Namn" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(".node-editor__viewport");
    const field = Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === "field");
    const handle = field?.shadowRoot?.querySelector<HTMLElement>("[data-drag-handle]");
    if (!viewport || !field || !handle) throw new Error("Fältets draghandtag saknas.");

    vi.spyOn(viewport, "setPointerCapture").mockImplementation(() => undefined);
    vi.spyOn(viewport, "hasPointerCapture").mockReturnValue(true);
    vi.spyOn(viewport, "releasePointerCapture").mockImplementation(() => undefined);
    const rect = handle.getBoundingClientRect();

    handle.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 41, button: 0, clientX: rect.left + 10, clientY: rect.top + 10,
      bubbles: true, composed: true,
    }));
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 41, clientX: rect.left + 900, clientY: rect.top + 10,
    }));
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 41 }));

    const movedField = nodeEditor?.getData().nodes.find((node) => node.id === "field");
    expect(movedField?.parentPageId).toBeUndefined();
    expect(movedField?.order).toBeUndefined();
  });

  test("reorders fields by dragging within the page", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: { title: "Kontakt" } },
        { id: "first", type: "text-question", parentPageId: "page", order: 0, layout: { columnSpan: 12 }, position: { x: 0, y: 0 }, data: { title: "Namn" } },
        { id: "second", type: "text-question", parentPageId: "page", order: 1, layout: { columnSpan: 12 }, position: { x: 0, y: 0 }, data: { title: "E-post" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(".node-editor__viewport");
    const first = Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === "first");
    const handle = first?.shadowRoot?.querySelector<HTMLElement>("[data-drag-handle]");
    if (!viewport || !first || !handle) throw new Error("Fältets draghandtag saknas.");

    vi.spyOn(viewport, "setPointerCapture").mockImplementation(() => undefined);
    vi.spyOn(viewport, "hasPointerCapture").mockReturnValue(true);
    vi.spyOn(viewport, "releasePointerCapture").mockImplementation(() => undefined);
    const rect = handle.getBoundingClientRect();

    handle.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 42, button: 0, clientX: rect.left + 10, clientY: rect.top + 10,
      bubbles: true, composed: true,
    }));
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 42, clientX: rect.left + 10, clientY: rect.top + 140,
    }));
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 42 }));

    const nodes = nodeEditor?.getData().nodes;
    expect(nodes?.find((node) => node.id === "first")?.order).toBe(1);
    expect(nodes?.find((node) => node.id === "second")?.order).toBe(0);
    expect(nodes?.find((node) => node.id === "first")?.parentPageId).toBe("page");
  });

  test("moves a field to a new row of its own by dragging it downwards", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: { title: "Kontakt" } },
        { id: "left", type: "text-question", parentPageId: "page", order: 0, layout: { columnSpan: 6 }, position: { x: 0, y: 0 }, data: { title: "Namn" } },
        { id: "right", type: "text-question", parentPageId: "page", order: 1, layout: { columnSpan: 6 }, position: { x: 0, y: 0 }, data: { title: "E-post" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(".node-editor__viewport");
    const right = Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === "right");
    const handle = right?.shadowRoot?.querySelector<HTMLElement>("[data-drag-handle]");
    if (!viewport || !right || !handle) throw new Error("Fältets draghandtag saknas.");

    vi.spyOn(viewport, "setPointerCapture").mockImplementation(() => undefined);
    vi.spyOn(viewport, "hasPointerCapture").mockReturnValue(true);
    vi.spyOn(viewport, "releasePointerCapture").mockImplementation(() => undefined);
    const rect = handle.getBoundingClientRect();

    handle.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 43, button: 0, clientX: rect.left + 10, clientY: rect.top + 10,
      bubbles: true, composed: true,
    }));
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 43, clientX: rect.left + 10, clientY: rect.top + 140,
    }));

    // The page area grows during the drag so the new row fits.
    const surface = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(
      '.node-editor__page-surface[data-page-id="page"]'
    );
    const pageNode = Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === "page");
    // 212 (the field area's top: the page's text block ends at 192, plus 20)
    // + 91 + 19 + 91 (two measured rows) + 24 of bottom padding. Every number
    // is measured rather than assumed, so they move when the nodes' content
    // does.
    expect(surface?.style.height).toBe("437px");
    expect(pageNode?.style.getPropertyValue("--page-height")).toBe("437px");

    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 43 }));

    const moved = nodeEditor?.getData().nodes.find((node) => node.id === "right");
    expect(moved?.parentPageId).toBe("page");
    expect(moved?.layout).toEqual({ columnSpan: 6, breakBefore: true });
    expect(moved?.order).toBe(1);
  });

  test("lets the last field take the middle slot when the middle field is dragged to a new row", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: { title: "Kontakt" } },
        { id: "a", type: "text-question", parentPageId: "page", order: 0, layout: { columnSpan: 4 }, position: { x: 0, y: 0 }, data: { title: "Förnamn" } },
        { id: "b", type: "text-question", parentPageId: "page", order: 1, layout: { columnSpan: 4 }, position: { x: 0, y: 0 }, data: { title: "Efternamn" } },
        { id: "c", type: "text-question", parentPageId: "page", order: 2, layout: { columnSpan: 4 }, position: { x: 0, y: 0 }, data: { title: "E-post" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(".node-editor__viewport");
    const findNode = (id: string) => Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === id);
    const middle = findNode("b");
    const handle = middle?.shadowRoot?.querySelector<HTMLElement>("[data-drag-handle]");
    if (!viewport || !middle || !handle) throw new Error("Dragkontroller saknas.");

    vi.spyOn(viewport, "setPointerCapture").mockImplementation(() => undefined);
    vi.spyOn(viewport, "hasPointerCapture").mockReturnValue(true);
    vi.spyOn(viewport, "releasePointerCapture").mockImplementation(() => undefined);
    const rect = handle.getBoundingClientRect();

    handle.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 47, button: 0, clientX: rect.left + 10, clientY: rect.top + 10,
      bubbles: true, composed: true,
    }));
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 47, clientX: rect.left + 10, clientY: rect.top + 140,
    }));
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 47 }));

    // A och C stannar på rad 1 (C tar mittenplatsen), B får en egen rad under.
    const nodes = nodeEditor?.getData().nodes;
    expect(nodes?.find((node) => node.id === "a")?.order).toBe(0);
    expect(nodes?.find((node) => node.id === "c")?.order).toBe(1);
    expect(nodes?.find((node) => node.id === "b")?.order).toBe(2);
    expect(nodes?.find((node) => node.id === "b")?.layout?.breakBefore).toBe(true);
    expect(findNode("a")?.style.top).toBe("292px");
    expect(findNode("c")?.style.top).toBe("292px");
    expect(findNode("b")?.style.top).toBe("402px");
    // C has moved into the middle slot (column 2), not stayed furthest right.
    expect(findNode("a")?.style.left).toBe("120px");
    expect(findNode("c")?.style.left?.startsWith("330.66")).toBe(true);
  });

  test("leaves the siblings in place when you merely grab a field with a line break", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: { title: "Kontakt" } },
        { id: "a", type: "text-question", parentPageId: "page", order: 0, layout: { columnSpan: 4 }, position: { x: 0, y: 0 }, data: { title: "Förnamn" } },
        { id: "b", type: "text-question", parentPageId: "page", order: 1, layout: { columnSpan: 4, breakBefore: true }, position: { x: 0, y: 0 }, data: { title: "Efternamn" } },
        { id: "c", type: "text-question", parentPageId: "page", order: 2, layout: { columnSpan: 4 }, position: { x: 0, y: 0 }, data: { title: "Smeknamn" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(".node-editor__viewport");
    const findNode = (id: string) => Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === id);
    const middle = findNode("b");
    const third = findNode("c");
    const handle = middle?.shadowRoot?.querySelector<HTMLElement>("[data-drag-handle]");
    if (!viewport || !middle || !third || !handle) throw new Error("Dragkontroller saknas.");

    const thirdBefore = { left: third.style.left, top: third.style.top };

    vi.spyOn(viewport, "setPointerCapture").mockImplementation(() => undefined);
    vi.spyOn(viewport, "hasPointerCapture").mockReturnValue(true);
    vi.spyOn(viewport, "releasePointerCapture").mockImplementation(() => undefined);
    const rect = handle.getBoundingClientRect();

    // Bara greppa fältet — flytta inte pekaren.
    handle.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 48, button: 0, clientX: rect.left + 10, clientY: rect.top + 10,
      bubbles: true, composed: true,
    }));

    // The third field must stay beside it, not be previewed upwards.
    expect(third.style.left).toBe(thirdBefore.left);
    expect(third.style.top).toBe(thirdBefore.top);

    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 48 }));

    // A drop without a move is a no-op: order and line break unchanged.
    const nodes = nodeEditor?.getData().nodes;
    expect(nodes?.find((node) => node.id === "a")?.order).toBe(0);
    expect(nodes?.find((node) => node.id === "b")?.order).toBe(1);
    expect(nodes?.find((node) => node.id === "c")?.order).toBe(2);
    expect(nodes?.find((node) => node.id === "b")?.layout?.breakBefore).toBe(true);
    expect(findNode("c")?.style.top).toBe(thirdBefore.top);
  });

  test("FLIP-animates the dropped field into its slot", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: { title: "Kontakt" } },
        { id: "first", type: "text-question", parentPageId: "page", order: 0, layout: { columnSpan: 12 }, position: { x: 0, y: 0 }, data: { title: "Namn" } },
        { id: "second", type: "text-question", parentPageId: "page", order: 1, layout: { columnSpan: 12 }, position: { x: 0, y: 0 }, data: { title: "E-post" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(".node-editor__viewport");
    const findNode = (id: string) => Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === id);
    const first = findNode("first");
    const handle = first?.shadowRoot?.querySelector<HTMLElement>("[data-drag-handle]");
    if (!viewport || !first || !handle) throw new Error("Dragkontroller saknas.");

    vi.spyOn(viewport, "setPointerCapture").mockImplementation(() => undefined);
    vi.spyOn(viewport, "hasPointerCapture").mockReturnValue(true);
    vi.spyOn(viewport, "releasePointerCapture").mockImplementation(() => undefined);
    const rect = handle.getBoundingClientRect();

    handle.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 50, button: 0, clientX: rect.left + 10, clientY: rect.top + 10,
      bubbles: true, composed: true,
    }));
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 50, clientX: rect.left + 30, clientY: rect.top + 150,
    }));
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 50 }));

    // Immediately after the drop: the element sits in its slot but is visually
    // offset to the drop point via a transform (the FLIP start).
    const dropped = findNode("first");
    expect(dropped?.style.top).toBe("402px");
    expect(dropped?.style.transform).toContain("translate");

    // Efter animationens startbildruta rensas transformen och glidningen sker.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(dropped?.style.transform).toBe("");
    expect(dropped?.hasAttribute("data-settling")).toBe(true);

    // Cleaned up once the animation finishes.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(dropped?.hasAttribute("data-settling")).toBe(false);
  });

  test("lets the next field inherit the line break when the row start is dragged away", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: { title: "Kontakt" } },
        { id: "a", type: "text-question", parentPageId: "page", order: 0, layout: { columnSpan: 4 }, position: { x: 0, y: 0 }, data: { title: "Förnamn" } },
        { id: "b", type: "text-question", parentPageId: "page", order: 1, layout: { columnSpan: 4, breakBefore: true }, position: { x: 0, y: 0 }, data: { title: "Efternamn" } },
        { id: "c", type: "text-question", parentPageId: "page", order: 2, layout: { columnSpan: 4 }, position: { x: 0, y: 0 }, data: { title: "Smeknamn" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(".node-editor__viewport");
    const findNode = (id: string) => Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === id);
    const middle = findNode("b");
    const handle = middle?.shadowRoot?.querySelector<HTMLElement>("[data-drag-handle]");
    if (!viewport || !middle || !handle) throw new Error("Dragkontroller saknas.");

    vi.spyOn(viewport, "setPointerCapture").mockImplementation(() => undefined);
    vi.spyOn(viewport, "hasPointerCapture").mockReturnValue(true);
    vi.spyOn(viewport, "releasePointerCapture").mockImplementation(() => undefined);
    const rect = handle.getBoundingClientRect();

    // Dra radstarten (Efternamn) nedåt till en egen ny rad.
    handle.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 49, button: 0, clientX: rect.left + 10, clientY: rect.top + 10,
      bubbles: true, composed: true,
    }));
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 49, clientX: rect.left + 10, clientY: rect.top + 140,
    }));

    // Already during the drag the preview shows the truth: Smeknamn stays on row
    // 2 and does not jump up to row 1.
    expect(findNode("c")?.style.top).toBe("402px");
    expect(findNode("c")?.style.left).toBe("120px");

    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 49 }));

    // Smeknamn inherits the line break and remains the row start on row 2;
    // Efternamn gets a row of its own below.
    const nodes = nodeEditor?.getData().nodes;
    expect(nodes?.find((node) => node.id === "c")?.order).toBe(1);
    expect(nodes?.find((node) => node.id === "c")?.layout?.breakBefore).toBe(true);
    expect(nodes?.find((node) => node.id === "b")?.order).toBe(2);
    expect(nodes?.find((node) => node.id === "b")?.layout?.breakBefore).toBe(true);
    expect(findNode("a")?.style.top).toBe("292px");
    expect(findNode("c")?.style.top).toBe("402px");
    expect(findNode("b")?.style.top).toBe("512px");
  });

  test("does not shrink the page during a drag and reflows the siblings smoothly", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: { title: "Kontakt" } },
        { id: "first", type: "text-question", parentPageId: "page", order: 0, layout: { columnSpan: 6 }, position: { x: 0, y: 0 }, data: { title: "Namn" } },
        { id: "second", type: "text-question", parentPageId: "page", order: 1, layout: { columnSpan: 6, breakBefore: true }, position: { x: 0, y: 0 }, data: { title: "E-post" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(".node-editor__viewport");
    const findNode = (id: string) => Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === id);
    const surface = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(
      '.node-editor__page-surface[data-page-id="page"]'
    );
    const second = findNode("second");
    const handle = second?.shadowRoot?.querySelector<HTMLElement>("[data-drag-handle]");
    if (!viewport || !second || !handle || !surface) throw new Error("Dragkontroller saknas.");

    // Two rows to begin with (see the arithmetic above).
    expect(surface.style.height).toBe("437px");

    vi.spyOn(viewport, "setPointerCapture").mockImplementation(() => undefined);
    vi.spyOn(viewport, "hasPointerCapture").mockReturnValue(true);
    vi.spyOn(viewport, "releasePointerCapture").mockImplementation(() => undefined);
    const rect = handle.getBoundingClientRect();

    handle.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: 46, button: 0, clientX: rect.left + 10, clientY: rect.top + 10,
      bubbles: true, composed: true,
    }));
    window.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 46, clientX: rect.left + 10, clientY: rect.top - 120,
    }));

    // The height does not shrink while the drag runs, even though the target gives only one row.
    expect(surface.style.height).toBe("437px");
    // The sibling is previewed into its future slot with the transition state active.
    const first = findNode("first");
    expect(first?.hasAttribute("data-reflowing")).toBe(true);
    expect(first?.style.top).toBe("292px");

    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 46 }));

    // The height animates on release: starting from the shown value …
    const surfaceAfter = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(
      '.node-editor__page-surface[data-page-id="page"]'
    );
    expect(surfaceAfter?.style.height).toBe("437px");

    // … och landar på slutvärdet efter animationens startbildruta.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(surfaceAfter?.style.height).toBe("347px");
    expect(findNode("first")?.style.top).toBe("292px");
    expect(findNode("second")?.style.top).toBe("292px");
    expect(
      nodeEditor?.getData().nodes.find((node) => node.id === "second")?.layout?.breakBefore
    ).toBe(false);
  });

  test("keeps the field's width after a trip out of and back into the page", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: { title: "Kontakt" } },
        { id: "field", type: "text-question", parentPageId: "page", order: 0, layout: { columnSpan: 6 }, position: { x: 0, y: 0 }, data: { title: "Namn" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(".node-editor__viewport");
    const findField = () => Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === "field");
    if (!viewport) throw new Error("Viewport saknas.");

    vi.spyOn(viewport, "setPointerCapture").mockImplementation(() => undefined);
    vi.spyOn(viewport, "hasPointerCapture").mockReturnValue(true);
    vi.spyOn(viewport, "releasePointerCapture").mockImplementation(() => undefined);

    const drag = (pointerId: number, deltaX: number, deltaY: number) => {
      const handle = findField()?.shadowRoot?.querySelector<HTMLElement>("[data-drag-handle]");
      if (!handle) throw new Error("Fältets draghandtag saknas.");
      const rect = handle.getBoundingClientRect();
      handle.dispatchEvent(new PointerEvent("pointerdown", {
        pointerId, button: 0, clientX: rect.left + 10, clientY: rect.top + 10,
        bubbles: true, composed: true,
      }));
      window.dispatchEvent(new PointerEvent("pointermove", {
        pointerId, clientX: rect.left + 10 + deltaX, clientY: rect.top + 10 + deltaY,
      }));
      window.dispatchEvent(new PointerEvent("pointerup", { pointerId }));
    };

    drag(44, 900, 0);
    expect(nodeEditor?.getData().nodes.find((node) => node.id === "field")?.parentPageId)
      .toBeUndefined();

    drag(45, -900, 0);
    const returned = nodeEditor?.getData().nodes.find((node) => node.id === "field");
    expect(returned?.parentPageId).toBe("page");
    expect(returned?.layout?.columnSpan).toBe(6);
  });
});
