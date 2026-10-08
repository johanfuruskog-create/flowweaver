import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "./node-editor";

/**
 * Two fingers zoom the graph, not the page.
 *
 * ## The fault this is written from
 *
 * Reported from an iPad: pinching zoomed the whole page. Nothing here claimed
 * the gesture, so the browser's own took it, and the canvas's zoom was reachable
 * only from the menu.
 *
 * The fix has two halves and neither works alone. `touch-action: pan-x pan-y` on
 * the viewport keeps native panning — which is how a finger moves around a large
 * graph — while declining the browser's pinch, so the events reach us at all.
 * This is the other half: turning them into `setZoom` around the midpoint
 * between the fingers, which is where a person expects a pinch to zoom towards.
 *
 * ## Why exactly two
 *
 * One pointer is a pan, a node being dragged or a connection being drawn, and a
 * third is somebody resting a hand on the glass. Acting on anything but a clean
 * pair would take gestures away from the things that already own them.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function canvas(): Promise<{ nodeEditor: NodeEditor; viewport: HTMLElement }> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1000px; height: 700px;";
  document.body.append(editor);
  /*
   * Nodes *and* connections. The redraw count below observes the connection
   * group, and an earlier version of this helper built a graph with no
   * connections at all — so the observer counted rebuilds of nothing and read
   * zero whether the redraw was deferred or not. Third time today a test
   * measured its own setup rather than the code.
   */
  editor.graph = {
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "text-question", position: { x: 60, y: 60 }, data: { title: "Ett", variableName: "a" } },
      { id: "q2", type: "text-question", position: { x: 460, y: 60 }, data: { title: "Två", variableName: "b" } },
      { id: "q3", type: "text-question", position: { x: 860, y: 60 }, data: { title: "Tre", variableName: "c" } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q1", portId: "continue" }, to: { nodeId: "q2", portId: "input" } },
      { id: "c2", from: { nodeId: "q2", portId: "continue" }, to: { nodeId: "q3", portId: "input" } },
    ],
  } as never;

  await settle();
  await settle();

  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(
    ".node-editor__viewport",
  );

  if (!nodeEditor || !viewport) throw new Error("node-editor saknas.");

  return { nodeEditor, viewport };
}

const scale = (nodeEditor: NodeEditor): number =>
  new DOMMatrix(
    getComputedStyle(
      nodeEditor.shadowRoot!.querySelector<HTMLElement>(".node-editor__scaled")!,
    ).transform,
  ).a;

const finger = (
  viewport: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup",
  id: number,
  x: number,
  y = 300,
): void => {
  viewport.dispatchEvent(
    new PointerEvent(type, {
      pointerId: id,
      pointerType: "touch",
      clientX: x,
      clientY: y,
      bubbles: true,
      composed: true,
      cancelable: true,
    }),
  );
};

describe("a pinch", () => {
  test("spreading apart zooms in", async () => {
    const { nodeEditor, viewport } = await canvas();
    const before = scale(nodeEditor);

    finger(viewport, "pointerdown", 1, 400, 300);
    finger(viewport, "pointerdown", 2, 500, 300);
    finger(viewport, "pointermove", 2, 700, 300);
    await settle();

    expect(scale(nodeEditor)).toBeGreaterThan(before);
  });

  test("closing together zooms out", async () => {
    const { nodeEditor, viewport } = await canvas();
    const before = scale(nodeEditor);

    finger(viewport, "pointerdown", 1, 300, 300);
    finger(viewport, "pointerdown", 2, 700, 300);
    finger(viewport, "pointermove", 2, 400, 300);
    await settle();

    expect(scale(nodeEditor)).toBeLessThan(before);
  });
});

describe("what is left alone", () => {
  test("one finger does not zoom", async () => {
    // It is a pan, a node being dragged, or a connection being drawn.
    const { nodeEditor, viewport } = await canvas();
    const before = scale(nodeEditor);

    finger(viewport, "pointerdown", 1, 400, 300);
    finger(viewport, "pointermove", 1, 600, 420);
    await settle();

    expect(scale(nodeEditor)).toBe(before);
  });

  test("and a mouse is not a pinch", async () => {
    const { nodeEditor, viewport } = await canvas();
    const before = scale(nodeEditor);

    viewport.dispatchEvent(
      new PointerEvent("pointerdown", { pointerId: 1, pointerType: "mouse", clientX: 400, clientY: 300, bubbles: true, composed: true }),
    );
    viewport.dispatchEvent(
      new PointerEvent("pointerdown", { pointerId: 2, pointerType: "mouse", clientX: 500, clientY: 300, bubbles: true, composed: true }),
    );
    viewport.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 2, pointerType: "mouse", clientX: 700, clientY: 300, bubbles: true, composed: true }),
    );
    await settle();

    expect(scale(nodeEditor)).toBe(before);
  });

  test("lifting one finger ends the gesture rather than jumping", async () => {
    /*
     * With one finger left there is no distance to compare, so the next pair
     * must start over. Keeping the old distance would make putting a second
     * finger back down snap the zoom to whatever the gap happened to be.
     */
    const { nodeEditor, viewport } = await canvas();

    finger(viewport, "pointerdown", 1, 400, 300);
    finger(viewport, "pointerdown", 2, 500, 300);
    finger(viewport, "pointermove", 2, 700, 300);
    await settle();

    const afterFirst = scale(nodeEditor);

    finger(viewport, "pointerup", 2, 700, 300);
    finger(viewport, "pointermove", 1, 420, 300);
    await settle();

    expect(scale(nodeEditor)).toBe(afterFirst);
  });
});

describe("the other half of the fix", () => {
  test("the canvas declines the browser's gestures entirely", async () => {
    /*
     * `pan-x pan-y` was the first answer: it kept native panning while declining
     * the browser's pinch. That made the pinch a scale while the browser did the
     * translating — two mechanisms for one gesture, able to disagree.
     *
     * A two-point similarity transform has to own both, so the canvas declines
     * everything and panning is written out with a glide of its own. The cost is
     * real and was weighed: the browser's inertia and rubber-banding were free
     * and are now ours to maintain.
     */
    const { viewport } = await canvas();

    expect(getComputedStyle(viewport).touchAction).toBe("none");
  });
});

describe("panning with one finger", () => {
  test("drags the canvas the way the finger goes", async () => {
    const { nodeEditor, viewport } = await canvas();

    viewport.scrollLeft = 400;
    viewport.scrollTop = 300;

    finger(viewport, "pointerdown", 1, 500, 300);
    finger(viewport, "pointermove", 1, 420, 300);
    await settle();

    // The finger went left, so the content follows and the scroll goes right.
    expect(viewport.scrollLeft).toBeGreaterThan(400);
    expect(nodeEditor).toBeTruthy();
  });

  test("and keeps gliding after a flick", async () => {
    /*
     * The one thing native scrolling gave for free. Without it a flick stops
     * dead under the finger, which reads as a canvas that is stuck to the glass.
     */
    const { viewport } = await canvas();

    viewport.scrollLeft = 800;

    finger(viewport, "pointerdown", 1, 600, 300);

    for (let step = 1; step <= 6; step += 1) {
      finger(viewport, "pointermove", 1, 600 - step * 30);
    }

    finger(viewport, "pointerup", 1, 420);

    const atRelease = viewport.scrollLeft;

    await settle(200);

    expect(viewport.scrollLeft, "canvasen gled inte vidare").toBeGreaterThan(atRelease);
  });

  test("a resting finger does not move the canvas", async () => {
    /*
     * The fault the tool caught after the glide was fixed: `rörelse 1 1 1 1 1 1
     * 1 1` with the geometry untouched, and it kept going. A fingertip on glass
     * wanders about a pixel a frame, and the canvas crept along with it — because
     * taking the gesture over inherited none of the browser's slop, so panning
     * began on the very first pixel.
     */
    const { viewport } = await canvas();

    viewport.scrollLeft = 900;

    finger(viewport, "pointerdown", 1, 600);

    // Eight frames of a hand trying to hold still.
    for (let frame = 0; frame < 8; frame += 1) {
      finger(viewport, "pointermove", 1, 600 + (frame % 2 === 0 ? 1 : -1));
      await settle(16);
    }

    expect(viewport.scrollLeft, "canvasen kröp med ett vilande finger").toBe(900);
  });

  test("but the movement past the threshold counts, and only that", async () => {
    /*
     * Twelve pixels of finger with eight of slop is four pixels of canvas. The
     * two ways to get this wrong sit either side of that number: swallowing the
     * whole move gives nought, which a single large event — a coalesced batch, a
     * slow frame — makes very visible, and starting from where the finger landed
     * gives twelve, throwing the canvas the eight pixels nobody meant.
     */
    const { viewport } = await canvas();

    viewport.scrollLeft = 900;

    finger(viewport, "pointerdown", 1, 600);
    finger(viewport, "pointermove", 1, 588);
    await settle(16);

    expect(viewport.scrollLeft - 900, "fingret gick 12 px, tröskeln är 8").toBe(4);

    const afterCrossing = viewport.scrollLeft;

    finger(viewport, "pointermove", 1, 568);
    await settle(16);

    expect(viewport.scrollLeft - afterCrossing, "efter tröskeln följer den fingret").toBe(20);
  });

  test("and the glide ends rather than seeping away", async () => {
    /*
     * Measured on an iPad: the readout showed `-1 -1 -1 -1 -1 -1 -1 -1`, one
     * pixel a frame with the geometry untouched. That is the tail of a glide
     * whose stopping threshold was 0.05 px/ms — 0.8px a frame — so the canvas
     * crept for about a second after every pan and would not sit still.
     *
     * Counted as frames that moved, not as a duration: a slow machine makes a
     * timing assertion flaky, while the number of frames is the thing being
     * complained about.
     */
    const { viewport } = await canvas();

    viewport.scrollLeft = 900;

    finger(viewport, "pointerdown", 1, 600);

    for (let step = 1; step <= 6; step += 1) {
      finger(viewport, "pointermove", 1, 600 - step * 30);
    }

    finger(viewport, "pointerup", 1, 420);

    let frames = 0;
    let previous = viewport.scrollLeft;

    for (let frame = 0; frame < 120; frame += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      if (viewport.scrollLeft !== previous) {
        frames += 1;
        previous = viewport.scrollLeft;
      }
    }

    expect(frames, `${frames} bildrutor rörelse efter släpp`).toBeLessThan(45);
  });

  test("and a slow drag does not glide at all", async () => {
    /*
     * The other half of the same complaint. Letting go at the end of a careful
     * drag should leave the canvas exactly where it was put — a glide there is
     * the canvas refusing to sit still, not momentum.
     *
     * Real time between the moves, because the speed is measured over the gap
     * between them: fired back to back, synthetic events land in the same
     * millisecond and every drag looks like a flick.
     */
    const { viewport } = await canvas();

    viewport.scrollLeft = 900;

    finger(viewport, "pointerdown", 1, 600);

    for (let step = 1; step <= 5; step += 1) {
      finger(viewport, "pointermove", 1, 600 - step * 2);
      await settle(40);
    }

    finger(viewport, "pointerup", 1, 590);

    const atRelease = viewport.scrollLeft;

    await settle(300);

    expect(viewport.scrollLeft, "canvasen gled efter en långsam dragning").toBe(
      atRelease,
    );
  });

  test("but a second finger hands the gesture over, and it moves once", async () => {
    /*
     * Two fingers moved in parallel keep their distance, so the scale holds and
     * the transform is pure translation — by exactly what the fingers did.
     *
     * What this does *not* prove is the hand-off. Removing it measures the same
     * 60px, because `setZoom` assigns the scroll rather than adding to it, so
     * anything the pan handler wrote is overwritten. The hand-off earns its keep
     * elsewhere: without it the pan keeps accumulating velocity during a pinch
     * and the canvas glides away when the fingers come off. Written down rather
     * than dressed up as something measured here.
     */
    const { viewport } = await canvas();

    viewport.scrollLeft = 600;

    const before = viewport.scrollLeft;

    finger(viewport, "pointerdown", 1, 400);
    finger(viewport, "pointerdown", 2, 600);
    finger(viewport, "pointermove", 1, 340);
    finger(viewport, "pointermove", 2, 540);
    await settle();

    const moved = viewport.scrollLeft - before;

    // The pair travelled 60px, so the canvas travels 60 — not 120.
    // The pair travelled 60px, so the canvas travels 60 — not 120.
    expect(moved, `canvasen flyttade ${Math.round(moved)} px`).toBeGreaterThan(40);
    expect(moved, `canvasen flyttade ${Math.round(moved)} px`).toBeLessThan(80);
  });
});

describe("pinching in and back out", () => {
  test("leaves the guide exactly where it was", async () => {
    /*
     * The fault the measuring tool finally pinned down, from an iPad: the canvas
     * went blank and stayed blank. The readout said origin 1800,26300 with the
     * guide twelve thousand pixels below the view.
     *
     * It was not drift. The zoom returned to exactly 1.000 and the guide had
     * moved 1600px in a *single* pinch, then stayed put — which is precisely how
     * far the workspace origin had grown during that pinch.
     *
     * The anchor was the problem. It was kept in workspace coordinates, and the
     * buffer can grow the workspace mid-gesture; growing the low side moves the
     * origin, so the point captured at the start referred to somewhere else in
     * the guide by the end. It is kept in the guide's own coordinates now, which
     * the origin cannot move.
     *
     * Three round trips, because a fault that compounds and one that happens once
     * look the same after a single pass.
     */
    const { nodeEditor, viewport } = await canvas();

    const where = (): string => {
      const view = viewport.getBoundingClientRect();
      const boxes = [
        ...nodeEditor.shadowRoot!.querySelectorAll<HTMLElement>("flow-node"),
      ].map((node) => node.getBoundingClientRect());

      return `${Math.round(Math.min(...boxes.map((box) => box.left)) - view.left)},${Math.round(
        Math.min(...boxes.map((box) => box.top)) - view.top,
      )}`;
    };

    const before = where();

    for (let round = 0; round < 3; round += 1) {
      finger(viewport, "pointerdown", 1, 300);
      finger(viewport, "pointerdown", 2, 700);

      for (let step = 1; step <= 10; step += 1) {
        finger(viewport, "pointermove", 2, 700 - step * 35);
        await settle(10);
      }

      for (let step = 9; step >= 0; step -= 1) {
        finger(viewport, "pointermove", 2, 700 - step * 35);
        await settle(10);
      }

      finger(viewport, "pointerup", 1, 300);
      finger(viewport, "pointerup", 2, 700);
      await settle(40);
    }

    expect(where(), "guiden hamnade inte tillbaka").toBe(before);
  });
});
