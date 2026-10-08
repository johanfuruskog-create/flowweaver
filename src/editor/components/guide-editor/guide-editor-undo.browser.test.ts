import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import "../../../viewer/node-types/default-node-types";
import "./guide-editor";
import type { EditorToolbar } from "../editor-toolbar/editor-toolbar";
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

const key = (target: EventTarget, init: KeyboardEventInit): void => {
  target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, composed: true, ...init }));
};

describe("guide-editor: undo/redo", () => {
  test("Ctrl+Z undoes and Ctrl+Y redoes a change", () => {
    const { nodeEditor, viewport } = mount();
    nodeEditor.selectNodeById("q1");

    // Duplicera → 2 noder.
    key(viewport, { key: "d", ctrlKey: true });
    expect(nodeEditor.getData().nodes).toHaveLength(2);

    // Ångra → tillbaka till 1.
    key(viewport, { key: "z", ctrlKey: true });
    expect(nodeEditor.getData().nodes).toHaveLength(1);
    expect(nodeEditor.getData().nodes[0]?.id).toBe("q1");

    // Gör om → 2 igen.
    key(viewport, { key: "y", ctrlKey: true });
    expect(nodeEditor.getData().nodes).toHaveLength(2);
  });

  test("undoes a removal", () => {
    const { nodeEditor, viewport } = mount();
    nodeEditor.selectNodeById("q1");
    nodeEditor.duplicateNodeById("q1");
    const cloneId = nodeEditor.getData().nodes.find((node) => node.id !== "q1")!.id;

    nodeEditor.selectNodeById(cloneId);
    key(viewport, { key: "Delete" });
    expect(nodeEditor.getData().nodes).toHaveLength(1);

    key(viewport, { key: "z", ctrlKey: true });
    expect(nodeEditor.getData().nodes.some((node) => node.id === cloneId)).toBe(true);
  });

  test("Ctrl+Z in a text field does not touch the graph", () => {
    const { nodeEditor, viewport } = mount();
    nodeEditor.selectNodeById("q1");
    nodeEditor.duplicateNodeById("q1");
    expect(nodeEditor.getData().nodes).toHaveLength(2);

    const input = document.createElement("input");
    viewport.append(input);
    key(input, { key: "z", ctrlKey: true });

    // Grafen är oförändrad – webbläsarens textångra fick händelsen.
    expect(nodeEditor.getData().nodes).toHaveLength(2);
  });

  test("enables the toolbar's Undo button after a change", async () => {
    const { editor, nodeEditor } = mount();
    const toolbar = editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
    const undoButton = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="undo"]'
    );
    if (!toolbar || !undoButton) throw new Error("Ångra-knappen saknas.");

    // Inaktiv från början.
    expect(undoButton.disabled).toBe(true);

    nodeEditor.selectNodeById("q1");
    nodeEditor.duplicateNodeById("q1");
    expect(undoButton.disabled).toBe(false);

    // Klick på knappen ångrar.
    const trigger = toolbar.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-menu-trigger="edit"]'
    );
    if (!trigger) throw new Error("Redigera-menyn saknas.");
    await userEvent.click(trigger);
    await userEvent.click(undoButton);
    expect(nodeEditor.getData().nodes).toHaveLength(1);
  });
});
