import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { FlowNode } from "../flow-node/flow-node";
import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "./node-editor";

/**
 * The menu button on a node — the way in for a finger.
 *
 * ## Why a button and not a long press
 *
 * A long press was the obvious answer and the wrong one. iPadOS Safari answers a
 * long press with its own callout, so ours would be fighting the platform for
 * the same gesture; and a gesture nobody is told about has to be guessed. A
 * visible button is learned by looking at it, works with finger, mouse and
 * keyboard alike, and needs no gesture recognition to fight the drag handle it
 * sits inside.
 *
 * `Shift+F10` and `ContextMenu` already cover the keyboard — see
 * `node-editor-context-menu-keyboard.browser.test.ts`. This covers everyone
 * holding a tablet.
 *
 * ## What is worth testing hardest
 *
 * That it is **absent** in a read-only canvas. The menu holds nothing but
 * commands that change the graph, so a button there would open an empty box —
 * and a control that is present and inert is the fault this codebase keeps
 * finding. Left out of the markup rather than disabled or hidden, because a
 * hidden control is still in the accessibility tree.
 *
 * And that pressing it does not **move** the node. It sits inside the drag
 * handle, so without stopping the pointer the press that opens the menu also
 * starts a drag.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 60));

function mount(mode = "administrator"): { nodeEditor: NodeEditor } {
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

  if (!nodeEditor) throw new Error("node-editor saknas.");

  return { nodeEditor };
}

const nodeFor = (nodeEditor: NodeEditor, id: string): FlowNode =>
  Array.from(nodeEditor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []).find(
    (node) => node.nodeData?.id === id,
  )!;

const buttonFor = (nodeEditor: NodeEditor, id: string): HTMLButtonElement | null =>
  nodeFor(nodeEditor, id)?.shadowRoot?.querySelector<HTMLButtonElement>("[data-node-menu]") ?? null;

const menuIsOpen = (nodeEditor: NodeEditor): boolean =>
  Boolean(nodeEditor.shadowRoot?.querySelector('[data-action="duplicate-node"]'));

describe("the button", () => {
  test("is there on a canvas that may be changed", () => {
    expect(buttonFor(mount().nodeEditor, "q1")).toBeTruthy();
  });

  test("and is visible without anything being pressed first", async () => {
    /*
     * It was hidden until the node was selected, on the reasoning that thirty
     * nodes would be thirty buttons. That traded discoverability for tidiness —
     * and discoverability is the entire reason the button exists, since
     * right-click is not something people try on a canvas they do not know.
     *
     * Hiding it behind a gesture you have to know about reintroduced the fault
     * it was built to fix: two presses where one is enough, and the first with
     * no visible reason for it.
     */
    const { nodeEditor } = mount();

    await settle();

    expect(getComputedStyle(buttonFor(nodeEditor, "q1")!).display).not.toBe("none");
    expect(getComputedStyle(buttonFor(nodeEditor, "q2")!).display).not.toBe("none");
  });

  test("in the node's header, beside its title", async () => {
    const { nodeEditor } = mount();

    await settle();

    expect(buttonFor(nodeEditor, "q1")!.closest(".flow-node__header")).toBeTruthy();
  });

  test("says what it opens, not what it looks like", () => {
    // "Tre punkter" tells a screen reader's user nothing about what happens.
    const label = buttonFor(mount().nodeEditor, "q1")?.getAttribute("aria-label");

    expect(label).toBe("Åtgärder för noden");
  });

  test("announces that it opens a menu", () => {
    expect(buttonFor(mount().nodeEditor, "q1")?.getAttribute("aria-haspopup")).toBe("menu");
  });
});

describe("on a canvas that may not be changed", () => {
  test("there is no button at all", () => {
    /*
     * Not disabled and not hidden. The menu offers only changes, so here it
     * would open an empty box — and hiding it with CSS would leave it in the
     * accessibility tree for somebody to find and press.
     */
    expect(buttonFor(mount("readonly").nodeEditor, "q1")).toBeNull();
  });
});

describe("where the menu lands", () => {
  test("inside the canvas, where somebody can see it", async () => {
    /*
     * The fault every other test in this file walked past. Asking whether the
     * menu *exists* passed while it was being opened some eight hundred pixels
     * off-screen: a node's data position is not what the menu layer counts from,
     * since the node layer is shifted by the workspace origin and the menu layer
     * is not. On the glass it looked like a dead button.
     *
     * So the assertion is about the rectangle, not the markup.
     */
    const { nodeEditor } = mount();

    await settle();
    buttonFor(nodeEditor, "q1")?.click();
    await settle();

    const menu = nodeEditor.shadowRoot!.querySelector<HTMLElement>(
      ".node-editor__connection-menu",
    )!;
    const viewport = nodeEditor.shadowRoot!.querySelector<HTMLElement>(
      ".node-editor__viewport",
    )!;
    const box = menu.getBoundingClientRect();
    const within = viewport.getBoundingClientRect();

    expect(box.width, "menyn har ingen storlek").toBeGreaterThan(0);
    expect(box.left, `menyn ligger på ${Math.round(box.left)}`).toBeGreaterThanOrEqual(
      within.left - 1,
    );
    expect(box.top, `menyn ligger på ${Math.round(box.top)}`).toBeGreaterThanOrEqual(
      within.top - 1,
    );
    expect(box.left).toBeLessThanOrEqual(within.right);
    expect(box.top).toBeLessThanOrEqual(within.bottom);
  });
});

describe("anchoring", () => {
  test("the menu opens at the button, not at a corner of the node", async () => {
    /*
     * The button is what was pressed, so it is where the menu belongs — beside
     * the finger rather than at an edge it may be nowhere near. On a wide node
     * those are far apart, which is what makes this worth asserting.
     */
    const { nodeEditor } = mount();

    await settle();

    const button = buttonFor(nodeEditor, "q1")!;

    button.click();
    await settle();

    /*
     * Both measured *after* the click. Opening the menu may scroll the canvas to
     * bring it inside, and that moves the button too — comparing a rectangle
     * taken before against one taken after made this fail by 519px on a menu
     * that was sitting exactly where it should.
     */
    const anchor = button.getBoundingClientRect();
    const box = nodeEditor
      .shadowRoot!.querySelector<HTMLElement>(".node-editor__connection-menu")!
      .getBoundingClientRect();

    // Beside the button rather than at the node's left edge, which sits a whole
    // node's width away.
    expect(Math.abs(box.left - anchor.left)).toBeLessThan(40);
  });

  test("and is brought inside when it would open past an edge", async () => {
    /*
     * Near the right or bottom of a small canvas the anchor leaves no room, and
     * the menu is then present, correct and half outside. The canvas slides
     * instead of the menu moving, so the menu stays attached to its button.
     */
    const editor = document.createElement("guide-editor") as GuideEditor;

    editor.setAttribute("mode", "administrator");
    editor.style.cssText = "display: block; width: 420px; height: 360px;";
    document.body.append(editor);
    editor.graph = {
      startNodeId: "q1",
      nodes: [
        { id: "q1", type: "text-question", position: { x: 900, y: 700 }, data: { title: "Långt bort", variableName: "a" } },
      ],
      connections: [],
    } as never;

    await settle();
    await settle();

    const nodeEditor = editor.shadowRoot!.querySelector<NodeEditor>("node-editor")!;

    nodeEditor.selectNodeById("q1");
    await settle();
    buttonFor(nodeEditor, "q1")?.click();
    await settle();

    const menu = nodeEditor.shadowRoot!.querySelector<HTMLElement>(
      ".node-editor__connection-menu",
    )!;
    const viewport = nodeEditor.shadowRoot!.querySelector<HTMLElement>(
      ".node-editor__viewport",
    )!;
    const box = menu.getBoundingClientRect();
    const within = viewport.getBoundingClientRect();

    expect(box.right, `menyns högerkant ${Math.round(box.right)}`).toBeLessThanOrEqual(
      within.right + 1,
    );
    expect(box.bottom, `menyns underkant ${Math.round(box.bottom)}`).toBeLessThanOrEqual(
      within.bottom + 1,
    );
  });
});

describe("pressing it", () => {
  test("opens the menu", async () => {
    const { nodeEditor } = mount();

    buttonFor(nodeEditor, "q1")?.click();
    await settle();

    expect(menuIsOpen(nodeEditor)).toBe(true);
  });

  test("opens the menu for its own node, not whichever was selected before", async () => {
    const { nodeEditor } = mount();

    nodeEditor.selectNodeById("q1");
    buttonFor(nodeEditor, "q2")?.click();
    await settle();

    nodeEditor.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-action="set-start-node"]')
      ?.click();
    await settle();

    // Checked by what the command does. A menu that belonged to the wrong node
    // would rewrite something nobody pointed at.
    expect(nodeEditor.getData().startNodeId).toBe("q2");
  });

  test("does not move the node", async () => {
    /*
     * The button sits inside the drag handle. Without stopping the pointer, the
     * press that opens the menu also begins a drag, and the node ends up a few
     * pixels from where somebody left it — every single time they use it.
     */
    const { nodeEditor } = mount();
    const before = nodeEditor.getData().nodes.find((node) => node.id === "q1")?.position;
    const button = buttonFor(nodeEditor, "q1")!;

    button.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, composed: true, clientX: 10, clientY: 10 }),
    );
    button.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, composed: true, clientX: 60, clientY: 40 }),
    );
    button.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, composed: true }));
    await settle();

    expect(nodeEditor.getData().nodes.find((node) => node.id === "q1")?.position).toEqual(before);
  });
});
