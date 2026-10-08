import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

/**
 * What the browser is allowed to do with a finger on the canvas.
 *
 * ## The fault this is written from
 *
 * Reported from an iPad: dragging a new connection panned the canvas at the same
 * time, so the line could never be aimed anywhere.
 *
 * The cause is not in any listener. `.node-editor__viewport` has
 * `overflow: auto`, so panning is the browser's own scrolling — it begins before
 * a listener is consulted, and neither `preventDefault` on `pointerdown` nor
 * `stopPropagation` stops it. Those govern events; this is a gesture the browser
 * owns. Only `touch-action` declines it.
 *
 * `.flow-node__header` has carried `touch-action: none` all along, which is
 * exactly why dragging a *node* worked on a tablet while dragging a *connection*
 * did not. The ports never had it.
 *
 * ## Why this is asserted on the computed style
 *
 * Because there is nothing else to observe: a headless browser will not start a
 * native scroll for a synthetic pointer sequence, so a test driving events would
 * pass whether or not the declaration is there. The declaration *is* the fix, so
 * the declaration is what gets checked.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 80));

async function canvas(): Promise<NodeEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1000px; height: 600px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "text-question", position: { x: 40, y: 40 }, data: { title: "Ett", variableName: "a" } },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");

  if (!nodeEditor) throw new Error("node-editor saknas.");

  return nodeEditor;
}

const partsOf = async (): Promise<ShadowRoot> =>
  (await canvas()).shadowRoot!.querySelector("flow-node")!.shadowRoot!;

describe("dragging from a port", () => {
  test("the browser does not get to scroll instead", async () => {
    const port = (await partsOf()).querySelector<HTMLElement>(".flow-node__port")!;

    expect(getComputedStyle(port).touchAction).toBe("none");
  });
});

describe("dragging a node", () => {
  test("the same, on the handle you grab it by", async () => {
    // This one was already right. It is asserted beside the other so the pair
    // cannot drift apart — a finger has to behave the same on both.
    const header = (await partsOf()).querySelector<HTMLElement>(".flow-node__header")!;

    expect(getComputedStyle(header).touchAction).toBe("none");
  });
});

describe("swiping past the edge of the canvas", () => {
  test("the gesture stays in the canvas", async () => {
    /*
     * This did **not** fix what it was added for, and the note is the point.
     *
     * The guess was that a downward swipe in fullscreen on an iPad exited
     * because the canvas hit its scroll limit and the gesture chained out to the
     * page. Tried on the device: it still exits. So the chaining is not the
     * cause — most likely it is iPadOS's own exit gesture, which no CSS declines
     * and no listener sees.
     *
     * The declaration stays because it is right on its own terms: a scrollable
     * surface should not scroll the page behind it when it runs out. `contain`
     * rather than `none`, since `none` also removes the rubber-band inside, and
     * that is part of how a surface feels under a finger.
     */
    const editor = document.createElement("guide-editor") as GuideEditor;

    editor.setAttribute("mode", "administrator");
    editor.style.cssText = "display: block; width: 1000px; height: 600px;";
    document.body.append(editor);
    editor.graph = { startNodeId: "q1", nodes: [], connections: [] } as never;
    await settle();

    const viewport = editor.shadowRoot!
      .querySelector("node-editor")!
      .shadowRoot!.querySelector<HTMLElement>(".node-editor__viewport")!;

    expect(getComputedStyle(viewport).overscrollBehavior).toBe("contain");
  });
});

describe("i läsläge", () => {
  /*
   * Johans iPad 1/9, på en sida vars editor saknar `mode` (= läsläge):
   * panelen sa "guiden går inte att ändra här", menyerna var borta — och
   * ett drag flyttade ändå noden från (0,0) till (120,80) med två
   * ändringshändelser på köpet. Mätt, inte anat. Ett läsläge som ändrar
   * grafen är en lögn i två steg. Berättelse 063.
   */
  test("flyttar ett drag inte noden, och ingen ändring rapporteras", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Inget `mode`: standarden är läsläge, precis som exempelsidan.
    editor.style.cssText = "display: block; width: 1000px; height: 600px;";
    document.body.append(editor);
    editor.graph = {
      startNodeId: "q1",
      nodes: [
        { id: "q1", type: "text-question", position: { x: 40, y: 40 }, data: { title: "Ett", variableName: "a" } },
      ],
      connections: [],
    } as never;
    await settle();
    await settle();

    let changes = 0;
    editor.addEventListener("graph-changed", () => changes++);

    const nodeEditor = editor.shadowRoot!.querySelector<NodeEditor>("node-editor")!;
    const header = nodeEditor.shadowRoot!.querySelector("flow-node")!.shadowRoot!.querySelector<HTMLElement>(".flow-node__header")!;
    const r0 = header.getBoundingClientRect();
    const x = r0.x + 40;
    const y = r0.y + r0.height / 2;
    const at = (cx: number, cy: number): PointerEventInit => ({
      bubbles: true, composed: true, clientX: cx, clientY: cy, pointerId: 1, pointerType: "touch", isPrimary: true, button: 0, buttons: 1,
    });

    header.dispatchEvent(new PointerEvent("pointerdown", at(x, y)));
    for (let i = 1; i <= 8; i += 1) {
      const e = at(x + i * 15, y + i * 10);
      window.dispatchEvent(new PointerEvent("pointermove", e));
      header.dispatchEvent(new PointerEvent("pointermove", e));
    }
    header.dispatchEvent(new PointerEvent("pointerup", at(x + 120, y + 80)));
    window.dispatchEvent(new PointerEvent("pointerup", at(x + 120, y + 80)));
    await settle();
    await settle();

    const after = (editor.getData().nodes.find((one) => one.id === "q1") as { position: { x: number; y: number } }).position;

    expect(after, "noden flyttades i läsläge").toEqual({ x: 40, y: 40 });
    expect(changes, "läsläget rapporterade en ändring").toBe(0);
  });
});
