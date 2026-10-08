import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { kontrast, tillRgba } from "../../../testing/contrast";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * The grip on a node's header: the only sign that the header can be dragged.
 *
 * ## What was measured
 *
 * **8×11 pixels at 0.55 opacity**, which came out at 3.34:1 against a result
 * node's header and 4.13:1 against a question's. Not invisible — and reported by
 * Johan as "otydligt", which is the more useful word: a mark that small reads as
 * a smudge rather than as a handle, and it is carrying the whole hint that the
 * header is grabbable.
 *
 * The header itself is the drag target and always has been; the grip is a
 * picture of that, `aria-hidden`, with nothing to press. Which is why this
 * measures how well it can be *seen* rather than how large a target it is —
 * shrinking the draggable area down to a grip would be the opposite of what a
 * finger needs, and was rejected when the mark was added.
 *
 * ## Why the ink is composited before it is measured
 *
 * Because opacity is how it was faint. Reading `color` alone would report the
 * full-strength ink and miss the entire fault — the same trap
 * `ikonkontrastbrott` documents for a half-transparent glyph.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Comfortably legible, rather than the 3:1 floor a non-text mark could claim. */
const READABLE = 4.5;
/** Below this it reads as a smudge; measured at 11px, reported as unclear. */
const SMALLEST = 14;

async function nodesOfEveryColour(): Promise<HTMLElement[]> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1300px; height: 900px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "a",
    nodes: [
      { id: "a", type: "text-question", position: { x: 40, y: 40 }, data: { title: "Fråga", variableName: "a" } },
      { id: "b", type: "rule", position: { x: 380, y: 40 }, data: { title: "Regel" } },
      { id: "c", type: "result", position: { x: 720, y: 40 }, data: { title: "Klart" } },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  return [
    ...editor.shadowRoot!.querySelector("node-editor")!.shadowRoot!.querySelectorAll<HTMLElement>(
      "flow-node",
    ),
  ];
}

/** The grip as the eye meets it: its ink laid over the header behind it. */
function asSeen(node: HTMLElement): { size: number; ratio: number; type: string } {
  const grip = node.shadowRoot!.querySelector<HTMLElement>(".flow-node__grip")!;
  const header = node.shadowRoot!.querySelector<HTMLElement>(".flow-node__header")!;
  const style = getComputedStyle(grip);
  const behind = tillRgba(getComputedStyle(header).backgroundColor);
  const ink = tillRgba(style.color);
  const alpha = parseFloat(style.opacity);
  const blended = [
    ink[0] * alpha + behind[0] * (1 - alpha),
    ink[1] * alpha + behind[1] * (1 - alpha),
    ink[2] * alpha + behind[2] * (1 - alpha),
    1,
  ] as typeof behind;

  return {
    size: grip.getBoundingClientRect().height,
    ratio: kontrast(blended, behind),
    type:
      node.shadowRoot!.querySelector(".flow-node")?.getAttribute("data-node-type") ??
      "okänd",
  };
}

describe("greppet på nodhuvudet", () => {
  test("är stort nog att läsas som ett handtag", async () => {
    const nodes = await nodesOfEveryColour();

    expect(nodes.length, "inga noder hittades").toBe(3);

    const tiny = nodes
      .map(asSeen)
      .filter((grip) => grip.size < SMALLEST)
      .map((grip) => `${grip.type}: ${Math.round(grip.size)}px`);

    expect(tiny, `grepp under ${SMALLEST}px`).toEqual([]);
  });

  test("och syns mot varje nodfärg", async () => {
    /*
     * Every colour, because the header is coloured by node type and the weakest
     * of them is what decides. The result node was the one at 3.34:1 — a green
     * header is the lightest we draw, and white ink at half strength nearly
     * vanished into it.
     */
    const nodes = await nodesOfEveryColour();
    const faint = nodes
      .map(asSeen)
      .filter((grip) => grip.ratio < READABLE)
      .map((grip) => `${grip.type}: ${grip.ratio.toFixed(2)}:1`);

    expect(faint, `grepp under ${READABLE}:1`).toEqual([]);
  });
});
