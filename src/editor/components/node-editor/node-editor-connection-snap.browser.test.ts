import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { FlowNode } from "../flow-node/flow-node";
import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "./node-editor";

/**
 * How close a dropped line has to be before it takes hold.
 *
 * ## The fault this is written from
 *
 * Reported from an iPad, right after dragging itself was fixed: the line could
 * be drawn but would not attach. Measured first — a drag released exactly on the
 * port connected with both a mouse and a finger, so nothing was broken about the
 * mechanism, and the problem was how near you had to be.
 *
 * Two things were wrong with that, and one of them had it backwards.
 *
 * **The radius ignored the zoom.** All geometry in the canvas is in canvas px,
 * so a fixed radius of 35 shrinks *on screen* as the view zooms out — and
 * zooming out to see the whole guide is exactly when somebody reaches across it
 * to join two nodes. At 0.5 the target was half the size it felt at 1, precisely
 * when it needed to be no smaller.
 *
 * **A finger is not a mouse.** A fingertip covers around 40 px and hides the
 * port it is aiming at, so the person is placing something they cannot see. The
 * pointer type now travels with the drag, so this is decided per gesture rather
 * than guessed from a media query about the device.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 80));

async function canvas(): Promise<NodeEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1200px; height: 800px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "text-question", position: { x: 40, y: 40 }, data: { title: "Ett", variableName: "a" } },
      { id: "q2", type: "text-question", position: { x: 420, y: 40 }, data: { title: "Två", variableName: "b" } },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");

  if (!nodeEditor) throw new Error("node-editor saknas.");

  return nodeEditor;
}

/** Drags from q1's output and lets go `offset` px short of q2's input. */
async function dragShortBy(
  nodeEditor: NodeEditor,
  offset: number,
  pointerType: string,
): Promise<number> {
  const nodes = Array.from(nodeEditor.shadowRoot!.querySelectorAll<FlowNode>("flow-node"));
  const from = nodes.find((node) => node.nodeData?.id === "q1")!;
  const to = nodes.find((node) => node.nodeData?.id === "q2")!;
  const out = from.shadowRoot!.querySelector<HTMLElement>(".flow-node__port--output")!;
  const input = to.shadowRoot!.querySelector<HTMLElement>(".flow-node__port--input")!;
  const a = out.getBoundingClientRect();
  const b = input.getBoundingClientRect();
  const shared = { pointerId: 7, pointerType, bubbles: true, composed: true, cancelable: true };
  const end = { clientX: b.x + b.width / 2 - offset, clientY: b.y + b.height / 2 };

  out.dispatchEvent(
    new PointerEvent("pointerdown", { ...shared, clientX: a.x + a.width / 2, clientY: a.y + a.height / 2 }),
  );
  await settle();
  window.dispatchEvent(new PointerEvent("pointermove", { ...shared, ...end }));
  await settle();
  window.dispatchEvent(new PointerEvent("pointerup", { ...shared, ...end }));
  await settle();

  return nodeEditor.getData().connections.length;
}

describe("a mouse", () => {
  test("connects when it lands on the port", async () => {
    expect(await dragShortBy(await canvas(), 0, "mouse")).toBe(1);
  });

  test("and still connects a little short of it", async () => {
    expect(await dragShortBy(await canvas(), 25, "mouse")).toBe(1);
  });

  test("but not from far away, or every drag would land somewhere", async () => {
    expect(await dragShortBy(await canvas(), 120, "mouse")).toBe(0);
  });
});

describe("a finger", () => {
  test("gets the room a fingertip needs", async () => {
    /*
     * 50 px short is a miss for a mouse and a hit for a finger — which is the
     * whole point. The fingertip is covering the port at that distance, so the
     * person cannot see what they are aiming at.
     */
    expect(await dragShortBy(await canvas(), 50, "touch")).toBe(1);
    expect(await dragShortBy(await canvas(), 50, "mouse")).toBe(0);
  });

  test("but not unlimited room either", async () => {
    expect(await dragShortBy(await canvas(), 120, "touch")).toBe(0);
  });
});

describe("when the browser keeps the pointer on the port it started from", () => {
  /*
   * What actually happens with a finger, and the reason a drag could never
   * attach on a tablet however carefully it was aimed.
   *
   * A touch `pointerdown` gives the element **implicit pointer capture**, so
   * every later event for that finger goes to the output port rather than to
   * what is under it. The release therefore arrived as "let go on an output" —
   * which the canvas cancelled outright — and `stopPropagation` on the port
   * meant the window listener never saw it either. A mouse takes no implicit
   * capture, so a mouse never met any of this.
   *
   * The capture is released now, and the release path no longer cancels when a
   * target is in range. This drives the case the fix is for: the whole sequence
   * delivered to the source port, as a browser holding capture would.
   */
  test("the drop still lands on the port the line was resting on", async () => {
    const nodeEditor = await canvas();
    const nodes = Array.from(nodeEditor.shadowRoot!.querySelectorAll<FlowNode>("flow-node"));
    const from = nodes.find((node) => node.nodeData?.id === "q1")!;
    const to = nodes.find((node) => node.nodeData?.id === "q2")!;
    const out = from.shadowRoot!.querySelector<HTMLElement>(".flow-node__port--output")!;
    const input = to.shadowRoot!.querySelector<HTMLElement>(".flow-node__port--input")!;
    const a = out.getBoundingClientRect();
    const b = input.getBoundingClientRect();
    const shared = { pointerId: 9, pointerType: "touch", bubbles: true, composed: true, cancelable: true };
    const over = { clientX: b.x + b.width / 2, clientY: b.y + b.height / 2 };

    out.dispatchEvent(
      new PointerEvent("pointerdown", { ...shared, clientX: a.x + a.width / 2, clientY: a.y + a.height / 2 }),
    );
    await settle();
    window.dispatchEvent(new PointerEvent("pointermove", { ...shared, ...over }));
    await settle();

    // The release, delivered to the source port — which is where a captured
    // pointer sends it, and where it used to be thrown away.
    out.dispatchEvent(new PointerEvent("pointerup", { ...shared, ...over }));
    await settle();

    expect(nodeEditor.getData().connections).toHaveLength(1);
  });

  test("and a release with nothing in range is still a cancellation", async () => {
    // Otherwise letting go in empty space would join whatever was nearest, which
    // is how a drag stops being something you can back out of.
    const nodeEditor = await canvas();
    const from = Array.from(nodeEditor.shadowRoot!.querySelectorAll<FlowNode>("flow-node"))
      .find((node) => node.nodeData?.id === "q1")!;
    const out = from.shadowRoot!.querySelector<HTMLElement>(".flow-node__port--output")!;
    const a = out.getBoundingClientRect();
    const shared = { pointerId: 9, pointerType: "touch", bubbles: true, composed: true, cancelable: true };

    out.dispatchEvent(
      new PointerEvent("pointerdown", { ...shared, clientX: a.x + a.width / 2, clientY: a.y + a.height / 2 }),
    );
    await settle();
    window.dispatchEvent(new PointerEvent("pointermove", { ...shared, clientX: a.x + 400, clientY: a.y + 300 }));
    await settle();
    out.dispatchEvent(new PointerEvent("pointerup", { ...shared, clientX: a.x + 400, clientY: a.y + 300 }));
    await settle();

    expect(nodeEditor.getData().connections).toHaveLength(0);

    /*
     * And the drag is actually over, not merely fruitless. Asserting only the
     * connection count let a mutation through that skipped the cleanup: no line
     * was created either way, but the preview stayed on screen and the canvas
     * went on believing a drag was in progress.
     */
    const preview = nodeEditor.shadowRoot!.querySelector<SVGPathElement>(
      ".node-editor__connection--preview",
    )!;

    expect(preview.dataset.visible).not.toBe("true");
  });
});

describe("zoomed out", () => {
  test("the target keeps the size it has on screen", async () => {
    /*
     * The fault that had it backwards. The radius is in canvas px, so without
     * dividing by the zoom it shrinks on screen exactly as somebody zooms out to
     * see the whole guide — which is when they are most likely to be dragging a
     * line across it.
     *
     * The zoom is asserted before the drag, and that is not ceremony: the first
     * version pressed the key once, landed at 0.91, and the difference the test
     * exists for did not bite. A mutation removing the division passed it.
     *
     * At half scale a drop 50 client px short is 100 canvas px away. A finger's
     * radius is 60 canvas px at zoom 1 — too short — and 120 once divided, which
     * is the same 60 px on screen it always was.
     */
    const nodeEditor = await canvas();
    const viewport = nodeEditor.shadowRoot!.querySelector<HTMLElement>(
      ".node-editor__viewport",
    )!;
    const scaled = nodeEditor.shadowRoot!.querySelector<HTMLElement>(
      ".node-editor__scaled",
    )!;

    viewport.focus();

    for (let press = 0; press < 7; press += 1) {
      viewport.dispatchEvent(
        new KeyboardEvent("keydown", { key: "-", bubbles: true, composed: true }),
      );
      await settle();
    }

    const zoom = new DOMMatrix(getComputedStyle(scaled).transform).a;

    expect(zoom, "zoomen måste ner till ungefär halva").toBeLessThan(0.6);
    expect(await dragShortBy(nodeEditor, 50, "touch")).toBe(1);
  });
});
