import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "./node-editor";

/**
 * Opening the canvas menu without a pointer.
 *
 * ## The fault this is written from
 *
 * Johan opened the editor on an iPad and could not reach the menu. Measured
 * rather than guessed: the only trigger was the `contextmenu` DOM event, and
 * iPadOS Safari never fires it for a long press — it shows the system callout
 * instead. So on a tablet the menu did not exist.
 *
 * The tablet only made it visible. The same held for anyone at a desk without a
 * mouse, which makes it **K3**: *"varje interaktiv funktion ska gå att nå från
 * tangentbordet"*, EN 301 549, and not a nicety.
 *
 * ## Why it mattered so much
 *
 * Five of the menu's seven commands exist nowhere else. Delete and duplicate
 * have keys of their own; **set start node, show routes, detach template, remove
 * connection and connection colour do not**, and following `set-start-node` to
 * its only sender confirmed it. Unreachable menu meant unreachable features.
 *
 * ## Two keys
 *
 * `ContextMenu` is the dedicated one. `Shift+F10` is the equivalent every
 * platform has honoured for far longer, and the one that exists on a laptop with
 * no menu key — which is most of them.
 *
 * ## What this does not fix
 *
 * The menu for a **connection**. A connection still cannot be selected without a
 * pointer, which is the gap `docs/KRAV.md` already records for creating and
 * removing them. Opening a menu for something you cannot select would have been
 * a fix in name only.
 */

afterEach(() => document.body.replaceChildren());

function mount(mode = "administrator"): { nodeEditor: NodeEditor; viewport: HTMLElement } {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", mode);
  document.body.append(editor);
  editor.graph = {
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "text-question", position: { x: 0, y: 0 }, data: { title: "Fråga", variableName: "a" } },
      { id: "q2", type: "text-question", position: { x: 240, y: 0 }, data: { title: "Andra", variableName: "b" } },
    ],
    connections: [],
  };

  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(".node-editor__viewport");

  if (!nodeEditor || !viewport) throw new Error("node-editor saknas.");

  return { nodeEditor, viewport };
}

const press = (viewport: HTMLElement, key: string, shiftKey = false): boolean =>
  viewport.dispatchEvent(
    new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, composed: true, cancelable: true }),
  );

const menu = (nodeEditor: NodeEditor): HTMLElement | null =>
  nodeEditor.shadowRoot?.querySelector<HTMLElement>('[data-action="duplicate-node"]') ?? null;

describe("the menu key", () => {
  test("opens the menu for the selected node", () => {
    const { nodeEditor, viewport } = mount();

    nodeEditor.selectNodeById("q1");
    press(viewport, "ContextMenu");

    expect(menu(nodeEditor)).toBeTruthy();
  });

  test("Shift+F10 does the same, for keyboards without a menu key", () => {
    const { nodeEditor, viewport } = mount();

    nodeEditor.selectNodeById("q1");
    press(viewport, "F10", true);

    expect(menu(nodeEditor)).toBeTruthy();
  });

  test("F10 on its own is left alone", () => {
    // It belongs to the browser. Only the shifted pair means "menu".
    const { nodeEditor, viewport } = mount();

    nodeEditor.selectNodeById("q1");
    press(viewport, "F10");

    expect(menu(nodeEditor)).toBeNull();
  });
});

describe("what it opens on", () => {
  test("the node that is selected, not the first one", async () => {
    /*
     * Asserted by what the command *does*, not by what the markup says. The
     * first version of this read an attribute off the button and compared it to
     * "q1" — and both candidate attributes were absent, so it compared
     * `undefined` and passed no matter which node the menu belonged to.
     *
     * Opening the right menu on the wrong node is the failure worth catching:
     * every command in it would then rewrite something nobody pointed at.
     */
    const { nodeEditor, viewport } = mount();

    nodeEditor.selectNodeById("q2");
    press(viewport, "ContextMenu");

    nodeEditor.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-action="set-start-node"]')
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(nodeEditor.getData().startNodeId).toBe("q2");
  });

  test("nothing at all when nothing is selected", () => {
    /*
     * And the key is not swallowed either — with no selection the browser's own
     * menu should still open, which is what not calling `preventDefault` leaves
     * intact.
     */
    const { nodeEditor, viewport } = mount();
    const notPrevented = press(viewport, "ContextMenu");

    expect(menu(nodeEditor)).toBeNull();
    expect(notPrevented).toBe(true);
  });
});

describe("when the editor may not be changed", () => {
  test("the menu stays shut", () => {
    // The menu offers only things that change the graph, which is the same rule
    // the pointer path has always followed.
    const { nodeEditor, viewport } = mount("readonly");

    nodeEditor.selectNodeById("q1");
    press(viewport, "ContextMenu");

    expect(menu(nodeEditor)).toBeNull();
  });
});
