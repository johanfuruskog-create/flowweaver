import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "./node-editor";

/**
 * The handle on a connection — the way into its menu.
 *
 * ## What was actually missing
 *
 * Not selection. `pointerdown` on the line has always selected a connection, and
 * a tap *is* a pointerdown, so a tablet got that far on its own. What it could
 * not do was reach the menu, because that hung on `contextmenu` — which iPadOS
 * Safari never fires for a long press.
 *
 * Nor creating connections: `Enter` on an output port announces "Koppla från",
 * and `Enter` on an input port completes it. `docs/KRAV.md` said otherwise and
 * was out of date; measuring it was what turned a rebuild into a much smaller
 * change.
 *
 * So this is one button, doing the one missing step.
 *
 * ## Visibility and reachability are the same fact
 *
 * The first stylesheet hid the handle with `display: none` and revealed it on
 * `:hover` or `:focus-visible` — which can never fire, because a `display: none`
 * element cannot be hovered and is not in the tab order. It would have shipped a
 * tab stop nobody could see or reach.
 *
 * So both are driven by the same two states: the connection is selected, or its
 * source node holds the canvas's single tab stop. Visible exactly when
 * focusable.
 *
 * ## Why the source node's tab group
 *
 * Because forty connections would otherwise be forty tab stops. The canvas keeps
 * one node tabbable at a time and its ports with it; the lines it owns join the
 * same group, so the cost of tabbing never grows with the graph.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 80));

function mount(mode = "administrator"): NodeEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", mode);
  document.body.append(editor);
  editor.graph = {
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "text-question", position: { x: 0, y: 0 }, data: { title: "Första", variableName: "a" } },
      { id: "q2", type: "text-question", position: { x: 300, y: 0 }, data: { title: "Andra", variableName: "b" } },
      { id: "r", type: "result", position: { x: 600, y: 0 }, data: { title: "Klart" } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q1", portId: "continue" }, to: { nodeId: "q2", portId: "input" } },
      { id: "c2", from: { nodeId: "q2", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  };

  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");

  if (!nodeEditor) throw new Error("node-editor saknas.");

  return nodeEditor;
}

/*
 * Moves the canvas's single tab stop the way a person does.
 *
 * `selectNodeById` does not: the tab stop follows **focus**, not selection, and
 * a click moves it only because clicking also focuses. Driving the API alone
 * left the stop on the start node, and the first version of these tests passed
 * anyway — because the start node happened to be the one they asked about.
 */
const focusNode = async (nodeEditor: NodeEditor, id: string): Promise<void> => {
  /*
   * Real focus, not a dispatched `focusin`. The synthetic event moves the tab
   * stop — that listener only reads the event — but it does not make
   * `:focus-within` true, and the handles' visibility asks exactly that. A test
   * that fakes focus would have gone on passing while the thing a person sees
   * stayed broken.
   */
  Array.from(nodeEditor.shadowRoot?.querySelectorAll("flow-node") ?? [])
    .find((node) => (node as { nodeId?: string }).nodeId === id)
    ?.shadowRoot?.querySelector<HTMLElement>(".flow-node")
    ?.focus();
  await settle();
};

const handle = (nodeEditor: NodeEditor, id: string): HTMLButtonElement | null =>
  nodeEditor.shadowRoot?.querySelector<HTMLButtonElement>(
    `.node-editor__connection-handle[data-connection-id="${id}"]`,
  ) ?? null;

const menuIsOpen = (nodeEditor: NodeEditor): boolean =>
  Boolean(nodeEditor.shadowRoot?.querySelector('[data-action="remove-connection"]'));

describe("the handle", () => {
  test("there is one per connection", async () => {
    const nodeEditor = mount();

    await settle();

    expect(handle(nodeEditor, "c1")).toBeTruthy();
    expect(handle(nodeEditor, "c2")).toBeTruthy();
  });

  test("names both ends, because \"connection\" alone says nothing", async () => {
    const nodeEditor = mount();

    await settle();

    const label = handle(nodeEditor, "c1")?.getAttribute("aria-label") ?? "";

    expect(label).toMatch(/Andra/);
  });

  test("announces that it opens a menu", async () => {
    const nodeEditor = mount();

    await settle();

    expect(handle(nodeEditor, "c1")?.getAttribute("aria-haspopup")).toBe("menu");
  });
});

describe("pressing it", () => {
  test("opens the connection's menu", async () => {
    const nodeEditor = mount();

    await settle();
    handle(nodeEditor, "c1")?.click();
    await settle();

    expect(menuIsOpen(nodeEditor)).toBe(true);
  });

  test("and the menu removes that connection, not another", async () => {
    // Checked by what it does. A menu opened against the wrong id would delete
    // a line nobody pointed at, which is the failure worth catching.
    const nodeEditor = mount();

    await settle();
    handle(nodeEditor, "c2")?.click();
    await settle();

    nodeEditor.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-action="remove-connection"]')
      ?.click();
    await settle();

    const left = nodeEditor.getData().connections.map((connection) => connection.id);

    expect(left).toEqual(["c1"]);
  });
});

describe("reachability", () => {
  test("only the current node's lines are in the tab order", async () => {
    /*
     * The whole reason this rides in a node's tab group. Forty connections would
     * otherwise be forty tab stops in a row, which is the problem the canvas
     * already solved for nodes and their ports.
     */
    const nodeEditor = mount();

    await focusNode(nodeEditor, "q1");

    expect(handle(nodeEditor, "c1")?.tabIndex).toBe(0);
    expect(handle(nodeEditor, "c2")?.tabIndex).toBe(-1);
  });

  test("and it moves when the current node moves", async () => {
    const nodeEditor = mount();

    await focusNode(nodeEditor, "q1");
    await focusNode(nodeEditor, "q2");

    expect(handle(nodeEditor, "c2")?.tabIndex).toBe(0);
  });

  test("both ends count, so the line you arrived on is reachable too", async () => {
    /*
     * Outgoing only was the first version and it read as asymmetric: standing on
     * a node you could reach what leaves it but not what arrives, which is often
     * the line worth removing. q2 sits between c1 and c2, so focusing it should
     * reach both.
     *
     * The test above used to assert that c1 became unreachable here. It was
     * asserting the asymmetry rather than anything worth keeping.
     */
    const nodeEditor = mount();

    await focusNode(nodeEditor, "q2");

    expect(handle(nodeEditor, "c1")?.tabIndex, "linjen in").toBe(0);
    expect(handle(nodeEditor, "c2")?.tabIndex, "linjen ut").toBe(0);
    expect(getComputedStyle(handle(nodeEditor, "c1")!).display).not.toBe("none");
  });

  test("a focused node's own line is both visible and tabbable", async () => {
    /*
     * The two have to agree wherever somebody actually is. Hiding with
     * `display: none` and revealing on `:focus-visible` cannot work — a hidden
     * element is not focusable — so an earlier version would have been a tab
     * stop nobody could see.
     */
    const nodeEditor = mount();

    await focusNode(nodeEditor, "q1");

    const reachable = handle(nodeEditor, "c1")!;
    const not = handle(nodeEditor, "c2")!;

    expect(reachable.hasAttribute("data-show")).toBe(true);
    expect(getComputedStyle(reachable).display).not.toBe("none");
    expect(not.hasAttribute("data-show")).toBe(false);
  });

  test("the handle keeps showing once focus has moved onto it", async () => {
    /*
     * Tab from the node's last port lands on the handle — and focus then sits
     * on the handle, not inside the node. The rule "shown while the node is
     * focused" turned false on the very frame the handle was reached, hid it
     * with `display: none`, and the browser dropped focus to the body. Measured
     * in film 5 (`e2e/demo/no-mouse.mjs`, 7/9): Tab from *Utgång: Nej* went to
     * nothing, and the next Tab left the canvas.
     */
    const nodeEditor = mount();

    await focusNode(nodeEditor, "q1");
    handle(nodeEditor, "c1")!.focus();
    await settle();

    expect(handle(nodeEditor, "c1")!.hasAttribute("data-show")).toBe(true);
    expect(nodeEditor.shadowRoot?.activeElement).toBe(handle(nodeEditor, "c1"));
  });

  test("a selected connection shows its handle even from another node", async () => {
    // The touch route: a tap on the line selects it, and the handle is the step
    // that was missing afterwards.
    const nodeEditor = mount();

    await focusNode(nodeEditor, "q1");
    handle(nodeEditor, "c2")?.click();
    await settle();

    expect(getComputedStyle(handle(nodeEditor, "c2")!).display).not.toBe("none");
  });
});

describe("before anybody has done anything", () => {
  test("no handle is on screen", async () => {
    /*
     * Reported from an iPad: two dots floating on a canvas with nothing
     * selected, and the panel still saying "select a node".
     *
     * It was the ordinary state, not an odd one. Visibility hung on the tab
     * stop, and `makeCurrent(null)` runs on every redraw and falls back to the
     * start node — so opening any guide put handles on that node's outgoing
     * lines. The tab stop is state nobody can see, so nothing on screen
     * explained them.
     */
    const nodeEditor = mount();

    await settle();

    expect(getComputedStyle(handle(nodeEditor, "c1")!).display).toBe("none");
    expect(getComputedStyle(handle(nodeEditor, "c2")!).display).toBe("none");
  });

  test("and selecting a node does not bring its lines out either", async () => {
    /*
     * It used to. Reported as feeling like a bug, and hard to argue with: a node
     * with a Yes and a No then showed two handles nobody asked for, and the
     * direct way to a line is to press the line.
     *
     * Tapping is not the same as tabbing, though — see the reachability tests
     * below, where keyboard focus still brings them out, because a handle that
     * cannot be seen cannot be focused either.
     */
    const nodeEditor = mount();

    nodeEditor.selectNodeById("q1");
    await settle();

    expect(getComputedStyle(handle(nodeEditor, "c1")!).display).toBe("none");
    expect(getComputedStyle(handle(nodeEditor, "c2")!).display).toBe("none");
  });

  test("but pressing the line itself does", async () => {
    // The direct path, and the one a finger takes: a press on the line selects
    // it, and its handle is the step that was missing afterwards.
    const nodeEditor = mount();

    await settle();
    nodeEditor.shadowRoot!
      .querySelector<SVGPathElement>('path[data-connection-id="c1"]')!
      .dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, composed: true, pointerId: 1 }),
      );
    await settle();

    expect(getComputedStyle(handle(nodeEditor, "c1")!).display).not.toBe("none");
  });
});

describe("on a canvas that may not be changed", () => {
  test("there are no handles at all", async () => {
    // The menu holds only commands that change the graph, so a handle here would
    // open an empty box.
    const nodeEditor = mount("readonly");

    await settle();

    expect(handle(nodeEditor, "c1")).toBeNull();
  });
});
