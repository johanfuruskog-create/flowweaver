import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";
import type { ConfirmationDialog } from "../confirmation-dialog/confirmation-dialog";
import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

/**
 * The editor's four confirmations, classified by consequence (B3, Astra 30/9):
 * *Gör till startnod* removes connections and *Ta bort startnod* removes a
 * node — both undoable in the editor's history, so the ordinary accent.
 * *Återställ guide* and *Ersätt guiden* replace the whole guide and say
 * themselves that it cannot be undone, so they keep the red.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function mount(): { editor: GuideEditor; nodeEditor: NodeEditor; viewport: HTMLElement } {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.setAttribute("mode", "administrator");
  document.body.append(editor);
  editor.graph = {
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "text-question", position: { x: 0, y: 0 }, data: { title: "Start", variableName: "a" } },
      { id: "q2", type: "text-question", position: { x: 360, y: 0 }, data: { title: "Andra", variableName: "b" } },
    ],
    connections: [{ id: "c1", from: { nodeId: "q1", portId: "continue" }, to: { nodeId: "q2", portId: "input" } }],
  };
  const nodeEditor = editor.shadowRoot!.querySelector<NodeEditor>("node-editor")!;
  const viewport = nodeEditor.shadowRoot!.querySelector<HTMLElement>(".node-editor__viewport")!;
  return { editor, nodeEditor, viewport };
}

const dialogOf = (editor: GuideEditor) =>
  editor.shadowRoot!.querySelector<ConfirmationDialog>("confirmation-dialog")!.shadowRoot!;
const toneOf = (editor: GuideEditor) =>
  dialogOf(editor).querySelector<HTMLButtonElement>('[data-action="confirm"]')!.dataset.tone;

describe("editorns bekräftelser, bedömda per handling", () => {
  test("Ta bort startnod: vanlig accent — och borttagningen går att ångra", async () => {
    const { editor, nodeEditor, viewport } = mount();
    nodeEditor.selectNodeById("q1");
    viewport.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true, composed: true }));
    await settle();

    expect(toneOf(editor)).toBe("normal");
    await userEvent.click(dialogOf(editor).querySelector<HTMLButtonElement>('[data-action="confirm"]')!);
    expect(nodeEditor.getData().nodes.some((node) => node.id === "q1")).toBe(false);

    viewport.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, composed: true }));
    expect(nodeEditor.getData().nodes.some((node) => node.id === "q1"), "ångrad").toBe(true);
  });

  test("Gör till startnod: vanlig accent", async () => {
    const { editor } = mount();
    editor.shadowRoot!.querySelector("node-editor")!.dispatchEvent(
      new CustomEvent("start-node-change-intent", { detail: { nodeId: "q2" }, bubbles: true, composed: true }),
    );
    await settle();
    expect(toneOf(editor)).toBe("normal");
  });

  test("Återställ guide: röd — den ersätter guiden och går inte att ångra", async () => {
    const { editor } = mount();
    editor.shadowRoot!.querySelector("node-editor")!.dispatchEvent(
      new CustomEvent("graph-reset-intent", { bubbles: true, composed: true }),
    );
    await settle();
    expect(toneOf(editor)).toBe("danger");
  });
});
