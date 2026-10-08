import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * A big guide draws in time proportional to its size.
 *
 * ## The measurement this is written from
 *
 * Nobody had ever opened a guide larger than the examples, which top out around
 * two dozen nodes. A real one — an agency's, a municipality's — is several
 * times that. Measured on the advanced editor:
 *
 *      25 nodes    213 ms
 *      60 nodes    667 ms
 *     120 nodes  1 998 ms
 *     250 nodes  6 805 ms
 *
 * Ten times the nodes, thirty-two times the time. Nothing broke — every node
 * drew, every connection drew — it just got slower than anybody would sit
 * through, and a 120-node guide is entirely ordinary.
 *
 * The cause was not what it looked like. Connections were nearly free (249 of
 * them added 12%), and giving every node a shared stylesheet instead of its own
 * copy won 7%. The profiler found it: `get nodeData` was 4 192 ms of 6 850,
 * because it hands out a `structuredClone` and the canvas called it in loops
 * just to compare an id. Sixty per cent of the time went on copying data nobody
 * read. Asking for the id alone made 250 nodes 1 061 ms.
 *
 * ## Why this asserts a shape and not a number
 *
 * A millisecond ceiling is a test about the machine it runs on. What went wrong
 * here was the *shape* — time growing faster than the guide — and that is the
 * thing worth forbidding. Ten times the work may take ten times as long; it may
 * not take thirty.
 *
 * The absolute ceiling below is deliberately loose. It is there so that a
 * catastrophe still fails on a slow machine, not to police tens of
 * milliseconds.
 */

afterEach(() => document.body.replaceChildren());

const guideOf = (count: number): GraphData => {
  const nodes = [];
  const connections = [];

  for (let at = 0; at < count; at += 1) {
    const last = at === count - 1;

    nodes.push({
      id: `n${at}`,
      type: last ? "result" : "question",
      position: { x: (at % 10) * 320, y: Math.floor(at / 10) * 260 },
      data: last
        ? { title: { sv: "Klart" } }
        : {
            title: { sv: `Fråga ${at} om något som tar plats i en nod` },
            variableName: `v${at}`,
            options: [
              { id: "ja", label: { sv: "Ja" }, value: "ja" },
              { id: "nej", label: { sv: "Nej" }, value: "nej" },
            ],
          },
    });

    if (!last) {
      connections.push({
        id: `c${at}`,
        from: { nodeId: `n${at}`, portId: "ja" },
        to: { nodeId: `n${at + 1}`, portId: "input" },
      });
    }
  }

  return { startNodeId: "n0", nodes, connections } as unknown as GraphData;
};

const twoFrames = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

async function drawMs(editor: GuideEditor, count: number): Promise<number> {
  // A small guide first, so what is timed is drawing this one rather than
  // clearing the previous.
  editor.graph = guideOf(2);
  await twoFrames();

  const before = performance.now();

  editor.graph = guideOf(count);
  await twoFrames();
  return performance.now() - before;
}

/**
 * The median of three draws, not one.
 *
 * A single draw of 25 nodes is a few hundred milliseconds, and that is
 * exactly the side a shared CI runner has no room to measure cleanly — it
 * flaked the ratio to 19.5 on CI 15/9, 18.7 the day after, and once locally
 * under the full suite (LOGG 17/9), all with the ceiling comfortably above
 * the 9 this file was measured at alone. The large side (250 nodes, several
 * seconds) barely moves between draws; the small side is what noise reaches,
 * and the median of three is what steadies it without hiding a real
 * regression — a genuinely slow draw is slow all three times.
 */
async function medianDrawMs(editor: GuideEditor, count: number): Promise<number> {
  const samples = [await drawMs(editor, count), await drawMs(editor, count), await drawMs(editor, count)];

  return [...samples].sort((a, b) => a - b)[1]!;
}

function mount(): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("feature-level", "advanced");
  editor.style.cssText = "display: block; width: 1400px; height: 800px;";
  document.body.append(editor);
  return editor;
}

describe("a guide with a great many nodes", () => {
  test("draws all of them", async () => {
    const editor = mount();

    await drawMs(editor, 250);

    const drawn = editor.shadowRoot
      ?.querySelector("node-editor")
      ?.shadowRoot?.querySelectorAll("flow-node").length;

    // The ceiling below means nothing if the canvas quietly drew half of them.
    expect(drawn).toBe(250);
  });

  // Six draws now instead of two (median of three, each side): ~15 s run
  // alone, 33 615 ms measured in the full suite (18/9), where Chromium is
  // shared with hundreds of other files rather than idle. CI's runner is
  // slower still, so the timeout is 90 s — this test measures a ratio, not
  // a duration; the neighbour "not a wait" is what asserts absolute time.
  test("in time that grows with the guide, not faster", async () => {
    const editor = mount();

    const small = await medianDrawMs(editor, 25);
    const large = await medianDrawMs(editor, 250);

    /*
     * Ten times the nodes. This asserts a shape — a return to the old
     * quadratic cost — not a machine's speed, so the line has to clear every
     * real number seen and still fail both regressions it exists to catch.
     *
     * Median of three each way (see `medianDrawMs`), not one draw — a single
     * measurement flaked the ratio to 19.5 on CI (15/9) and 18.7 the day
     * after, and once locally under the full suite (LOGG 17/9), every time
     * from the small side's few hundred milliseconds catching a scheduling
     * hiccup rather than anything structurally wrong. The median halves that:
     * ten solo local runs swung 13.7–15.3 with it, against 9.7–13.9 with one
     * draw each side (LOGG 17/9).
     *
     * The line moved from 16 to 20 for the same reason the median did not
     * make it redundant: 16 is inside CI's own single-draw noise (18.7, 19.5)
     * on a runner the median does not fully insulate against, since the
     * *shared* machine is what varies, not just the one measurement on it.
     * Twenty is measured against what it must still catch: a genuine O(n²)
     * regression (an explicit wait scaled by the square of the node count,
     * QA's mutation, 17/9) gave 23.8, and the original bug this file was
     * written from gave 32. Both clear 20 with room; CI's worst noise so far
     * (19.5) does not.
     */
    expect(large / small).toBeLessThan(20);
  }, 90000);

  test("and a guide of the size a real one reaches is not a wait", async () => {
    const editor = mount();

    const ms = await drawMs(editor, 120);

    // Measured at 412 ms. Four seconds is not a target — it is the line
    // between slow and broken, and it was 2 000 before.
    expect(ms).toBeLessThan(4000);
  });
});
