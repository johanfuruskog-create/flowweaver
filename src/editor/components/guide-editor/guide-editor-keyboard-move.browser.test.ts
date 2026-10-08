import { afterEach, describe, expect, test } from "vitest";
import "../../../viewer/node-types/default-node-types";
import "./guide-editor";
import type { FlowNode } from "../flow-node/flow-node";
import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

afterEach(() => {
  document.body.replaceChildren();
});

function mountEditor(): { editor: GuideEditor; nodeEditor: NodeEditor } {
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
  if (!nodeEditor) throw new Error("Kunde inte hitta node-editor.");
  return { editor, nodeEditor };
}

function nodeElement(nodeEditor: NodeEditor, id: string): FlowNode {
  const element = Array.from(
    nodeEditor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
  ).find((node) => node.nodeData?.id === id);
  if (!element) throw new Error(`Noden ${id} saknas.`);
  return element;
}

function article(node: FlowNode): HTMLElement {
  const el = node.shadowRoot?.querySelector<HTMLElement>(".flow-node");
  if (!el) throw new Error("Nodens artikel saknas.");
  return el;
}

function press(target: HTMLElement, key: string, shiftKey = false): void {
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, composed: true })
  );
}

describe("guide-editor tangentbordsflytt", () => {
  test("the node is focusable and has an accessible name", () => {
    const { nodeEditor } = mountEditor();
    const el = article(nodeElement(nodeEditor, "resultat"));

    /*
     * `-1`, not `0`, and that is the point: focusable, but not a tab stop.
     *
     * Only the node being worked on is in the tab order — see
     * `node-editor-tab-stops` for why. Focus still reaches every node, by arrow
     * or by click, which is what this asserts by actually focusing it.
     */
    expect(el.getAttribute("tabindex")).toBe("-1");
    el.focus();
    expect((el.getRootNode() as ShadowRoot).activeElement).toBe(el);
    expect(el.getAttribute("role")).toBe("group");
    expect(el.getAttribute("aria-label")).toContain("Klart");
  });

  /*
   * An arrow moves the node once it has been picked up, and not before.
   *
   * It used to move on the first press, which meant there was no way to travel
   * between nodes with the keyboard at all — the only thing an arrow could do
   * was shove whatever happened to have focus. Enter picks the node up, the
   * arrows then place it, and Escape puts it down. Travelling is what an arrow
   * does the rest of the time, which is guarded in
   * `node-editor-keyboard-navigation`.
   */
  test("an arrow key moves the node once it is selected (Shift gives a larger step)", () => {
    const { nodeEditor } = mountEditor();
    const node = nodeElement(nodeEditor, "resultat");
    expect(node.style.left).toBe("560px");

    press(article(node), "Enter");

    press(article(node), "ArrowRight");
    expect(node.style.left).toBe("570px");

    press(article(node), "ArrowDown", true);
    expect(node.style.top).toBe("250px");
  });

  test("a run of arrow-key moves can be undone in one step", () => {
    const { editor, nodeEditor } = mountEditor();
    const node = nodeElement(nodeEditor, "resultat");

    press(article(node), "Enter");
    press(article(node), "ArrowRight");
    press(article(node), "ArrowRight");
    press(article(node), "ArrowRight");
    expect(node.selected).toBe(true);
    expect(node.style.left).toBe("590px");

    editor.undo();
    expect(nodeElement(nodeEditor, "resultat").style.left).toBe("560px");
  });

  test("Enter on a focused node selects it", () => {
    const { nodeEditor } = mountEditor();
    const fraga = nodeElement(nodeEditor, "fraga");

    expect(fraga.selected).toBe(false);
    press(article(fraga), "Enter");
    expect(nodeElement(nodeEditor, "fraga").selected).toBe(true);
  });
});
