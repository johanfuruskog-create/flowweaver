import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "./node-editor";

/**
 * The canvas gives back the room it stopped needing.
 *
 * ## The fault this is written from
 *
 * Reported as the position going missing after a while, so that the minimap was
 * the only way back. Measured on the device: `ensureWorkspaceBuffer` had grown
 * the workspace to 4400×3000 with the origin at 2600,1500, and on another run
 * 5200×4600, from a start of 2000×1400.
 *
 * The instrumented build settled it. Every growth event was the buffer's — the
 * pivot maths in `setZoom` never grew at all — and the view does not jump when
 * it happens, because the scroll is compensated by exactly the amount the origin
 * moved.
 *
 * So it was never a jump. `workspaceGeometry` was assigned in three places and
 * two of them only ever added: the world kept getting bigger while the guide did
 * not, until there was far more empty space to get lost in than canvas worth
 * looking at.
 *
 * ## Why it trims in whole steps
 *
 * Trimming to the exact minimum would leave the edge precisely where the buffer
 * wants room, and the next pan would grow it straight back. A canvas that
 * breathes on every gesture is worse than one that is a little too big.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function canvas(): Promise<{ nodeEditor: NodeEditor; viewport: HTMLElement }> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 900px; height: 600px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "n0",
    nodes: Array.from({ length: 6 }, (_, index) => ({
      id: `n${index}`,
      type: "text-question",
      position: { x: (index % 3) * 280, y: Math.floor(index / 3) * 220 },
      data: { title: `Nod ${index}`, variableName: `v${index}` },
    })),
    connections: [],
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

const size = (nodeEditor: NodeEditor): number => {
  const workspace = nodeEditor.shadowRoot!.querySelector<HTMLElement>(
    ".node-editor__workspace",
  )!;

  return parseFloat(getComputedStyle(workspace).width);
};

/** Scrolls hard at one edge, which is what makes the buffer grow. */
async function pushAtTheEdge(viewport: HTMLElement): Promise<void> {
  viewport.scrollLeft = 0;
  viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
  await settle(30);
}

describe("after the canvas has grown", () => {
  test("it comes back down once things settle", async () => {
    const { nodeEditor, viewport } = await canvas();
    const before = size(nodeEditor);

    for (let round = 0; round < 6; round += 1) {
      await pushAtTheEdge(viewport);
    }

    const grown = size(nodeEditor);

    /*
     * Back towards the guide first. Sitting at the edge the room is *not* spare
     * — it is the room being used — and an earlier version of this test waited
     * there and then complained that nothing shrank. The canvas was right.
     */
    viewport.scrollLeft = grown / 2;
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await settle(60);

    // Wait past the trim's own delay, then let it run.
    await settle(400);
    await settle();

    const after = size(nodeEditor);

    expect(grown, "ytan växte inte, så det finns inget att pröva").toBeGreaterThan(
      before,
    );
    expect(after, `${Math.round(grown)} -> ${Math.round(after)}`).toBeLessThan(grown);
  });

  test("but never so far that a node falls outside it", async () => {
    /*
     * The trim keeps every node and the current view inside, plus the buffer.
     * Reclaiming space somebody is looking at would be the same fault in the
     * other direction.
     */
    const { nodeEditor, viewport } = await canvas();

    for (let round = 0; round < 6; round += 1) {
      await pushAtTheEdge(viewport);
    }

    viewport.scrollLeft = size(nodeEditor) / 2;
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await settle(60);
    await settle(400);
    await settle();

    const workspace = nodeEditor.shadowRoot!.querySelector<HTMLElement>(
      ".node-editor__workspace",
    )!;
    const box = workspace.getBoundingClientRect();

    nodeEditor.shadowRoot!.querySelectorAll("flow-node").forEach((node) => {
      const rect = node.getBoundingClientRect();

      expect(rect.left).toBeGreaterThanOrEqual(box.left - 1);
      expect(rect.top).toBeGreaterThanOrEqual(box.top - 1);
    });
  });
});

describe("what the trim must not take", () => {
  test("room the nodes are standing in, even when the view is elsewhere", async () => {
    /*
     * The view's own bounds cover the nodes whenever somebody is looking at
     * them, which let a mutation ignoring the nodes entirely walk past the
     * earlier tests. So the view is parked far away first: from there, only the
     * node bounds stand between the trim and the guide.
     */
    const { nodeEditor, viewport } = await canvas();

    for (let round = 0; round < 6; round += 1) {
      await pushAtTheEdge(viewport);
    }

    viewport.scrollLeft = size(nodeEditor) - viewport.clientWidth;
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await settle(60);
    await settle(400);
    await settle();

    const workspace = nodeEditor.shadowRoot!.querySelector<HTMLElement>(
      ".node-editor__workspace",
    )!;
    const box = workspace.getBoundingClientRect();

    nodeEditor.shadowRoot!.querySelectorAll("flow-node").forEach((node) => {
      const rect = node.getBoundingClientRect();

      expect(rect.left, "en nod hamnade utanför arbetsytan").toBeGreaterThanOrEqual(
        box.left - 1,
      );
      expect(rect.right).toBeLessThanOrEqual(box.right + 1);
    });
  });

  test("and it settles rather than looping", async () => {
    /*
     * That growth and trim do not take turns: once things are still, the size
     * stops changing.
     *
     * What this does **not** prove is the whole-step rule. A mutation trimming
     * to the exact minimum passes it, because oscillation needs somebody to keep
     * panning at an edge and a single nudge is not that. The whole steps are a
     * judgement about churn — trimming to the exact minimum leaves the edge
     * where the buffer wants room, so the next pan grows it straight back — and
     * the judgement is written down here rather than dressed up as something
     * measured.
     */
    const { nodeEditor, viewport } = await canvas();

    for (let round = 0; round < 6; round += 1) {
      await pushAtTheEdge(viewport);
    }

    viewport.scrollLeft = size(nodeEditor) / 2;
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await settle(60);
    await settle(400);

    const settled = size(nodeEditor);

    // A nudge, then long enough for another trim or growth to have happened.
    viewport.scrollLeft += 40;
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await settle(400);
    await settle(400);

    expect(size(nodeEditor), `${settled} -> ${size(nodeEditor)}`).toBe(settled);
  });
});

describe("a menu that has been closed", () => {
  test("does not keep the canvas from ever shrinking again", async () => {
    /*
     * Johan's question, and worth a test rather than a reading of the code: the
     * trim stands down while a menu is open, so if that state ever stuck the
     * canvas would quietly stop giving room back and nothing would say so.
     *
     * Measured: no menu at rest, present while open, gone again on close — and
     * the trim runs afterwards, 7600 down to 4400.
     */
    const { nodeEditor, viewport } = await canvas();
    const node = nodeEditor.shadowRoot!.querySelector("flow-node")!;
    const button = node.shadowRoot!.querySelector<HTMLElement>("[data-node-menu]")!;

    button.click();
    await settle();

    expect(
      nodeEditor.shadowRoot!.querySelector(".node-editor__connection-menu"),
      "menyn öppnades inte, så testet prövar ingenting",
    ).toBeTruthy();

    button.click();
    await settle();

    for (let round = 0; round < 6; round += 1) {
      await pushAtTheEdge(viewport);
    }

    const grown = size(nodeEditor);

    viewport.scrollLeft = grown / 2;
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await settle(60);
    await settle(400);

    expect(size(nodeEditor), `${grown} -> ${size(nodeEditor)}`).toBeLessThan(grown);
  });
});

describe("zooming all the way out", () => {
  test("leaves the guide on screen", async () => {
    /*
     * Reported from an iPad: zoom out too far and the canvas goes blank. Measured
     * before the fix, a hard pinch left **0 of 6** nodes on screen, with the node
     * layer's origin pushed from 700 to 3900 — the guide a screenful below the
     * view, on an empty canvas.
     *
     * The cause was the buffer measuring the viewport in base units. At a quarter
     * zoom a 600px view claims to span 2400 of them, so it is always "near the
     * edge" and every pinch outwards added 800px steps that stayed. The trim
     * could not give them back, because that enormous view is itself something it
     * has to keep inside.
     *
     * The view now asks for room only on an axis where it does not already span
     * the content and its buffer. Zoomed in, where the room is real, nothing
     * changes.
     */
    const { nodeEditor, viewport } = await canvas();
    const finger = (
      type: "pointerdown" | "pointermove" | "pointerup",
      id: number,
      x: number,
    ): void => {
      viewport.dispatchEvent(
        new PointerEvent(type, {
          pointerId: id,
          pointerType: "touch",
          clientX: x,
          clientY: 300,
          bubbles: true,
          composed: true,
          cancelable: true,
        }),
      );
    };

    finger("pointerdown", 1, 300);
    finger("pointerdown", 2, 700);

    for (let step = 1; step <= 12; step += 1) {
      finger("pointermove", 2, 700 - step * 30);
      await settle(20);
    }

    finger("pointerup", 1, 300);
    finger("pointerup", 2, 340);
    await settle(400);

    const view = viewport.getBoundingClientRect();
    const onScreen = [
      ...nodeEditor.shadowRoot!.querySelectorAll<HTMLElement>("flow-node"),
    ].filter((node) => {
      const rect = node.getBoundingClientRect();

      return (
        rect.right > view.left &&
        rect.left < view.right &&
        rect.bottom > view.top &&
        rect.top < view.bottom
      );
    });

    expect(onScreen.length, "noderna hamnade utanför skärmen").toBeGreaterThan(0);
  });
});
