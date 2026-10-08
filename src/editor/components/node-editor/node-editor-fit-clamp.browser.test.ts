import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "./node-editor";
import { scrollSettled } from "../../../testing/scroll-settled";

/**
 * Getting back to a guide that sits left of, and above, the workspace origin.
 *
 * ## What this does and does not establish
 *
 * It asserts that both routes back — the fit and the way back — actually put a
 * node on screen from the far corner of a grown workspace. It does **not**
 * discriminate between the two orderings described below: swapping
 * `fitToContent` back to assigning the scroll before asking for room leaves
 * every assertion here green. Said plainly, because a test file that implies a
 * guard it does not provide is worse than no file.
 *
 * ## The fault it was written for, which is still a hypothesis
 *
 * Reported from an iPad as the way back "doing nothing at all" — literally, the
 * view did not move. The Guide menu's "Visa startnod" worked on the same device
 * in the same state, and the one structural difference is the order of two
 * calls:
 *
 *     centerViewportAt:  ask the buffer for room, then assign the scroll
 *     fitToContent:      assign the scroll, then ask the buffer for room
 *
 * With the second order a target left of the workspace clamps to zero, the
 * buffer reads that zero as a view sitting politely at the edge, grows one step
 * and compensates the scroll by exactly that step — leaving the view where it
 * began, with every part having done what it was told. That is not a guess about
 * mechanism: `centerViewportAt` carries a comment describing precisely this,
 * written when it broke the full-screen path. `fitToContent` never got the fix,
 * and neither did the second implementation I wrote while hunting the fault.
 *
 * Five attempts to reproduce the clamp in a browser failed — ordinary graphs in
 * wide viewports, narrow viewports, negative coordinates, the far corner. The
 * buffer keeps every node at least `workspaceBuffer` inside the workspace, which
 * may be exactly why it stays out of reach here. So the fix is reasoned from a
 * documented, previously-observed failure rather than from a red test, and this
 * file is honest about being a regression net rather than the proof.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function canvas(): Promise<{ nodeEditor: NodeEditor; viewport: HTMLElement }> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 800px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "n0",
    nodes: Array.from({ length: 8 }, (_, index) => ({
      id: `n${index}`,
      type: "text-question",
      position: { x: -1400 + (index % 4) * 320, y: -900 + Math.floor(index / 4) * 260 },
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

describe("fitting to a guide that sits left of and above the origin", () => {
  test("the view actually moves, instead of growing and compensating itself still", async () => {
    const { nodeEditor, viewport } = await canvas();

    // Out to the far corner, which is where the target goes negative.
    viewport.scrollLeft = viewport.scrollWidth;
    viewport.scrollTop = viewport.scrollHeight;
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await settle(400);

    expect(onScreen(nodeEditor, viewport), "guiden syns fortfarande").toBe(0);

    const before = { x: viewport.scrollLeft, y: viewport.scrollTop };

    expect(nodeEditor.fitToContent(true)).toBe(true);
    await settle();

    /*
     * Asserted on the guide rather than on the scroll. The broken version *did*
     * change `scrollLeft` — it grew the workspace and compensated — so a test
     * that only asked whether the number moved would have passed while the
     * screen stayed blank.
     */
    expect(
      onScreen(nodeEditor, viewport),
      `guiden kom inte fram; scroll ${Math.round(before.x)},${Math.round(before.y)} → ${Math.round(viewport.scrollLeft)},${Math.round(viewport.scrollTop)}`,
    ).toBeGreaterThan(0);
  });

  test("and the way back gets there too", async () => {
    const { nodeEditor, viewport } = await canvas();

    viewport.scrollLeft = viewport.scrollWidth;
    viewport.scrollTop = viewport.scrollHeight;
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await settle(400);

    const button = nodeEditor.shadowRoot!.querySelector<HTMLButtonElement>("[data-lost]")!;

    expect(button.hidden, "vägen tillbaka visades aldrig").toBe(false);
    button.click();
    await settle();
    await scrollSettled(viewport);

    expect(onScreen(nodeEditor, viewport), "guiden kom inte fram").toBeGreaterThan(0);
  });
});
