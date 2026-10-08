import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "./node-editor";

/**
 * The guide stays where it is when the workspace changes size.
 *
 * ## The fault this is written from
 *
 * Reported as the worst thing on the canvas: panning jumps away from the nodes.
 * Measured on the device with the probe's `hopp` line, which compares where the
 * guide sits on the glass before and against after every change of geometry:
 * **`hopp 6px 800px`**. Eight hundred is exactly `workspaceGrowth`, so one step
 * of growth moved the guide a whole step across the screen.
 *
 * Both paths that change the geometry compensate the scroll by the amount the
 * origin moved — `scrollLeft + growLeft * zoom` growing, `scrollLeft - trimLeft *
 * zoom` shrinking — so on paper nothing should shift. One of them is not holding.
 *
 * ## Measured against the guide, not the scroll
 *
 * The scroll is *supposed* to change when the workspace grows; the guide is not.
 * Three of this session's measurements were worthless for comparing the wrong
 * one of those two.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function canvas(): Promise<{ nodeEditor: NodeEditor; viewport: HTMLElement }> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 820px; height: 820px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "n0",
    nodes: Array.from({ length: 7 }, (_, index) => ({
      id: `n${index}`,
      type: "text-question",
      position: { x: (index % 3) * 300, y: Math.floor(index / 3) * 240 },
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

/** Where the guide sits on the glass, which is what must not move by itself. */
const guideAt = (nodeEditor: NodeEditor, viewport: HTMLElement): { x: number; y: number } => {
  const view = viewport.getBoundingClientRect();
  const boxes = [...nodeEditor.shadowRoot!.querySelectorAll<HTMLElement>("flow-node")].map(
    (node) => node.getBoundingClientRect(),
  );

  return {
    x: Math.min(...boxes.map((box) => box.left)) - view.left,
    y: Math.min(...boxes.map((box) => box.top)) - view.top,
  };
};

const sizeOf = (nodeEditor: NodeEditor): string => {
  const workspace = nodeEditor.shadowRoot!.querySelector<HTMLElement>(
    ".node-editor__workspace",
  )!;
  const style = getComputedStyle(workspace);

  /*
   * Separated by a space, not by an "x". `2800px` already contains one, so
   * splitting the joined string on "x" made the height `NaN` — and a comparison
   * against `NaN` is false, so the guard below reported that the canvas never
   * shrank on a run where only the height could have.
   */
  return `${style.width} ${style.height}`;
};

/**
 * What the guide is *allowed* to do: exactly what was asked for, and nothing else.
 *
 *     jump = Δguide + asked
 *
 * where `asked` is the scroll the pan requested, read straight after assigning
 * it and before the growth gets a chance to answer. A node sits at
 * `(origin + offset) * zoom - scroll`, so a working compensation moves the
 * origin by a growth step and the scroll by the same amount, and the two cancel:
 * only the request is left on the glass.
 *
 * Two earlier versions of this test got the arithmetic wrong in opposite
 * directions and both were worthless. Comparing Δguide against the *final*
 * scroll reported an 800px jump on a canvas that was exact to the pixel — the
 * origin had moved a growth step and nothing subtracted it. Subtracting the
 * origin as well made it a tautology: `Δguide - (Δorigin * zoom - Δscroll)` is
 * zero by layout, whatever the code does, and both mutations below walked
 * straight through it.
 *
 * The probe on the device makes the first of those two mistakes, which is what
 * `hopp 800px` was.
 */
const jump = (
  before: { guide: { x: number; y: number } },
  after: { guide: { x: number; y: number } },
  asked: { x: number; y: number },
): number =>
  Math.hypot(after.guide.x - before.guide.x + asked.x, after.guide.y - before.guide.y + asked.y);

const sample = (nodeEditor: NodeEditor, viewport: HTMLElement) => ({
  guide: guideAt(nodeEditor, viewport),
  scroll: { x: viewport.scrollLeft, y: viewport.scrollTop },
});

describe("panning to an edge and pausing", () => {
  /*
   * All four edges, because growth on the low sides is the only growth that
   * moves the origin and therefore the only one with anything to compensate.
   * Six steps a side rather than a full sweep: an earlier version walked every
   * direction in one test and ran out of time before it arrived.
   */
  test.each([
    ["uppåt", 0, -1],
    ["nedåt", 0, 1],
    ["vänster", -1, 0],
    ["höger", 1, 0],
  ])("does not move the guide by itself when going %s", async (_name, dx, dy) => {
    const { nodeEditor, viewport } = await canvas();

    let worst = 0;
    let where = "";

    for (let step = 0; step < 6; step += 1) {
      const before = sample(nodeEditor, viewport);
      const size = sizeOf(nodeEditor);

      viewport.scrollLeft += dx * 400;
      viewport.scrollTop += dy * 400;

      /*
       * Read before the event goes out, so this is the request rather than the
       * answer — and clamped at an edge the way the browser clamps it, which is
       * a thirty-pixel discrepancy if you assume the full four hundred instead.
       */
      const asked = {
        x: viewport.scrollLeft - before.scroll.x,
        y: viewport.scrollTop - before.scroll.y,
      };

      viewport.dispatchEvent(new Event("scroll", { bubbles: true }));

      /*
       * Long enough for the trim as well as the growth. The first version waited
       * 30ms and never let the trim run at all — it fires a quarter of a second
       * after things settle, which is exactly what a person does by pausing, and
       * exactly what a test in a hurry skips.
       */
      await settle(320);

      const shift = jump(before, sample(nodeEditor, viewport), asked);

      if (shift > worst) {
        worst = shift;
        where = `${size} -> ${sizeOf(nodeEditor)}`;
      }
    }

    expect(worst, `guiden hoppade ${Math.round(worst)}px vid ${where}`).toBeLessThan(2);
  });
});

describe("and on the way back, when the room is given up again", () => {
  /*
   * The trim's own compensation, which nothing above touches: panning to an edge
   * only ever grows, so a test that walks one way and stops leaves the shrinking
   * half of the code unmeasured. Breaking it deliberately proved exactly that —
   * every assertion above passed with the trim compensating nothing at all.
   *
   * So: out to an edge far enough to grow several steps, then back past the
   * guide, pausing long enough each time for the quarter-second timer to fire.
   */
  test.each([
    ["uppåt och ned igen", 0, -1],
    ["vänsterut och tillbaka", -1, 0],
  ])("does not move the guide by itself going %s", async (_name, dx, dy) => {
    const { nodeEditor, viewport } = await canvas();

    for (let step = 0; step < 5; step += 1) {
      viewport.scrollLeft += dx * 700;
      viewport.scrollTop += dy * 700;
      viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
      await settle(40);
    }

    await settle(400);

    let worst = 0;
    let where = "";
    let trimmed = false;
    const trail: string[] = [];

    for (let step = 0; step < 8; step += 1) {
      const before = sample(nodeEditor, viewport);
      const size = sizeOf(nodeEditor);

      viewport.scrollLeft -= dx * 400;
      viewport.scrollTop -= dy * 400;

      const asked = {
        x: viewport.scrollLeft - before.scroll.x,
        y: viewport.scrollTop - before.scroll.y,
      };

      viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
      await settle(320);

      const now = sizeOf(nodeEditor);

      trail.push(`${Math.round(viewport.scrollTop)}@${now}`);
      const shift = jump(before, sample(nodeEditor, viewport), asked);

      if (shrank(size, now)) {
        trimmed = true;
      }
      if (shift > worst) {
        worst = shift;
        where = `${size} -> ${now}`;
      }
    }

    // Without this the test reports a clean canvas it never once made shrink.
    expect(trimmed, `ytan krympte aldrig: ${trail.join(" | ")}`).toBe(true);
    expect(worst, `guiden hoppade ${Math.round(worst)}px vid ${where}`).toBeLessThan(2);
  });
});

/** Whether a size string names a smaller canvas than the one before it. */
const shrank = (before: string, after: string): boolean => {
  const size = (text: string) => text.split(" ").map((part) => parseFloat(part));
  const [wasWide, wasTall] = size(before);
  const [isWide, isTall] = size(after);

  return isWide < wasWide || isTall < wasTall;
};
