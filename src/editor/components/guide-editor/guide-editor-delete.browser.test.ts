import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import "../../../viewer/node-types/default-node-types";
import "./guide-editor";
import type { ConfirmationDialog } from "../confirmation-dialog/confirmation-dialog";
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
      { id: "q1", type: "text-question", position: { x: 0, y: 0 }, data: { title: "Start", variableName: "a" } },
      { id: "q2", type: "text-question", position: { x: 360, y: 0 }, data: { title: "Andra", variableName: "b" } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q1", portId: "continue" }, to: { nodeId: "q2", portId: "input" } },
    ],
  };
  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(".node-editor__viewport");
  if (!nodeEditor || !viewport) throw new Error("node-editor saknas.");
  return { editor, nodeEditor, viewport };
}

const pressDelete = (target: EventTarget): void => {
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true, composed: true }));
};

describe("guide-editor radering med tangent", () => {
  test("Delete tar bort den markerade noden", () => {
    const { nodeEditor, viewport } = mount();
    nodeEditor.selectNodeById("q2");

    pressDelete(viewport);

    expect(nodeEditor.getData().nodes.some((node) => node.id === "q2")).toBe(false);
  });

  test("Delete tar bort den markerade kopplingen", () => {
    const { nodeEditor, viewport } = mount();
    const hitPath = nodeEditor.shadowRoot?.querySelector<SVGPathElement>(
      '.node-editor__connection-hit[data-connection-id="c1"]'
    );
    if (!hitPath) throw new Error("Kopplingen saknas.");
    hitPath.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));

    pressDelete(viewport);

    expect(nodeEditor.getData().connections).toHaveLength(0);
    // Noderna är kvar.
    expect(nodeEditor.getData().nodes).toHaveLength(2);
  });

  test("Delete on the start node asks for confirmation before removing", async () => {
    const { editor, nodeEditor, viewport } = mount();
    nodeEditor.selectNodeById("q1");

    pressDelete(viewport);

    // Noden finns kvar tills man bekräftat.
    expect(nodeEditor.getData().nodes.some((node) => node.id === "q1")).toBe(true);
    const confirmation = editor.shadowRoot?.querySelector<ConfirmationDialog>("confirmation-dialog");
    const confirmButton = confirmation?.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="confirm"]'
    );
    if (!confirmButton) throw new Error("Bekräftelsedialogen saknas.");

    await userEvent.click(confirmButton);
    expect(nodeEditor.getData().nodes.some((node) => node.id === "q1")).toBe(false);
  });

  test("Delete is ignored when focus is in an editable field", () => {
    const { nodeEditor, viewport } = mount();
    nodeEditor.selectNodeById("q2");

    const input = document.createElement("input");
    viewport.append(input);
    pressDelete(input);

    expect(nodeEditor.getData().nodes.some((node) => node.id === "q2")).toBe(true);
  });

  test("Escape deselects (so a following Delete does not remove the node)", () => {
    const { nodeEditor, viewport } = mount();
    nodeEditor.selectNodeById("q2");

    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true })
    );
    pressDelete(viewport);

    // Markeringen är rensad, så Delete gör inget.
    expect(nodeEditor.getData().nodes.some((node) => node.id === "q2")).toBe(true);
  });
});
