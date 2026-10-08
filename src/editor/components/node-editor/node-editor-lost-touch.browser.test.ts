import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "./node-editor";
import { scrollSettled } from "../../../testing/scroll-settled";

/**
 * The way back, pressed by a finger on a browser that never sends the click.
 *
 * ## Measured on the device, not guessed
 *
 * Five presses on an iPad, logged from the tablet itself: `pointerdown` and
 * `pointerup` every time with `isTrusted` true, sixty to a hundred milliseconds
 * apart, the finger moving a handful of pixels — and no `click` at all, five
 * times out of five. Nothing in the editor calls `preventDefault`, there are no
 * touch listeners anywhere in it, and the pages carry a proper
 * `width=device-width`. The same button works with a mouse, here and there.
 *
 * The difference from the node buttons, which do work on that device, is where
 * they sit: those are inside the canvas viewport and inherit its
 * `touch-action: none`, while this one is outside and inherited `auto` — so
 * WebKit holds the tap while it decides whether a double-tap-to-zoom is
 * beginning. Hence `touch-action: manipulation` in the stylesheet, and this
 * second route in case that diagnosis at a distance is wrong.
 *
 * ## What these tests can and cannot show
 *
 * They cannot reproduce the suppression: every engine this suite runs on sends
 * the click. What they can hold is the contract the fix rests on — a tap works
 * without a click, a click still works without a tap, and the two together fire
 * once rather than twice.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function lostCanvas(): Promise<{
  nodeEditor: NodeEditor;
  viewport: HTMLElement;
  button: HTMLButtonElement;
}> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 900px; height: 800px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "n0",
    nodes: Array.from({ length: 4 }, (_, index) => ({
      id: `n${index}`,
      type: "text-question",
      position: { x: index * 260, y: 0 },
      data: { title: `Nod ${index}`, variableName: `v${index}` },
    })),
    connections: [],
  } as never;

  await settle();
  await settle();

  const nodeEditor = editor.shadowRoot!.querySelector<NodeEditor>("node-editor")!;
  const viewport = nodeEditor.shadowRoot!.querySelector<HTMLElement>(
    ".node-editor__viewport",
  )!;

  viewport.scrollTop += 3000;
  viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
  await settle(400);

  const button = nodeEditor.shadowRoot!.querySelector<HTMLButtonElement>("[data-lost]")!;

  return { nodeEditor, viewport, button };
}

const onScreen = (nodeEditor: NodeEditor, viewport: HTMLElement): number => {
  const view = viewport.getBoundingClientRect();

  return [...nodeEditor.shadowRoot!.querySelectorAll<HTMLElement>("flow-node")].filter(
    (node) => {
      const rect = node.getBoundingClientRect();

      return (
        rect.right > view.left &&
        rect.left < view.right &&
        rect.bottom > view.top &&
        rect.top < view.bottom
      );
    },
  ).length;
};

/** A finger landing and lifting, with no click after it — which is the whole point. */
function tap(button: HTMLElement, drift = 0): void {
  const box = button.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const at = (type: string, dx: number) =>
    button.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        composed: true,
        pointerType: "touch",
        pointerId: 9,
        clientX: x + dx,
        clientY: y,
      }),
    );

  at("pointerdown", 0);
  at("pointerup", drift);
}

describe("a tap that is never followed by a click", () => {
  test("still brings the guide back", async () => {
    const { nodeEditor, viewport, button } = await lostCanvas();

    expect(onScreen(nodeEditor, viewport), "guiden syns fortfarande").toBe(0);

    tap(button);
    await settle();
    await scrollSettled(viewport);

    expect(onScreen(nodeEditor, viewport), "guiden kom inte fram").toBeGreaterThan(0);
  });

  test("but a finger that slid away does not count as a press", async () => {
    /*
     * Otherwise the button becomes a place where a pan happens to end, and the
     * canvas jumps because somebody's finger lifted in the wrong spot.
     */
    const { nodeEditor, viewport, button } = await lostCanvas();

    tap(button, 60);
    await settle();

    expect(onScreen(nodeEditor, viewport)).toBe(0);
  });
});

describe("a browser that sends both", () => {
  test("acts once, not twice", async () => {
    /*
     * Counted, not inferred from where the view ended up. The first version
     * compared the scroll before and after the second press and passed with the
     * dedupe deliberately removed — of course it did: once the nearest node is
     * centred, centring on the nearest node again moves nothing at all. The test
     * was measuring an idempotent operation and calling it proof.
     */
    const { nodeEditor, button } = await lostCanvas();
    const real = nodeEditor.centerNodeById.bind(nodeEditor);
    let calls = 0;

    nodeEditor.centerNodeById = (id: string): boolean => {
      calls += 1;

      return real(id);
    };

    tap(button);
    button.click();
    await settle();

    expect(calls, `centreringen kördes ${calls} gånger`).toBe(1);
  });

  test("and a genuinely separate press later is not swallowed", async () => {
    // The window that suppresses the compatibility click must not suppress the
    // next real press, which is why it is short rather than generous.
    const { nodeEditor, button } = await lostCanvas();
    const real = nodeEditor.centerNodeById.bind(nodeEditor);
    let calls = 0;

    nodeEditor.centerNodeById = (id: string): boolean => {
      calls += 1;

      return real(id);
    };

    tap(button);
    await settle(800);
    tap(button);
    await settle();

    expect(calls, `centreringen kördes ${calls} gånger`).toBe(2);
  });
});

describe("the mouse route is untouched", () => {
  test("a click with no pointer events at all still works", async () => {
    const { nodeEditor, viewport, button } = await lostCanvas();

    button.click();
    await settle();
    await scrollSettled(viewport);

    expect(onScreen(nodeEditor, viewport)).toBeGreaterThan(0);
  });
});

describe("the gesture the stylesheet allows", () => {
  test("the button does not wait for a double-tap to be ruled out", async () => {
    /*
     * `auto` is what it inherited, and what the measurement points at: WebKit
     * holds a tap on an `auto` element while it decides whether a
     * double-tap-to-zoom is starting, and the click is lost in that wait.
     */
    const { button } = await lostCanvas();

    expect(getComputedStyle(button).touchAction).toBe("manipulation");
  });
});
