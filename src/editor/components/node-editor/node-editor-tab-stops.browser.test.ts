import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * The canvas costs the same number of tab stops however large the guide is.
 *
 * ## What was wrong
 *
 * Every node carried `tabindex="0"` and every port is a button, so a guide of
 * thirty questions put something like a hundred and twenty stops between the
 * palette and whatever comes after the canvas. Somebody who tabs got a tour of
 * the entire guide whether they wanted one or not, and the shortcuts dialog's
 * promise that Tab reaches "the node's ports" was true only of the first node.
 *
 * The arrows were added to move between nodes for this reason, but adding a way
 * around does not remove the way through: both existed at once, and the slow one
 * was still the default.
 *
 * ## The rule instead
 *
 * One node at a time is in the tab order — the one being worked on — together
 * with its own ports. Arrows move that place around; Tab goes in and out of the
 * canvas as a whole. This is the roving tabindex every tree and toolbar uses, and
 * it is what makes "arrows between nodes, Tab to the ports" a description of the
 * product rather than an aspiration.
 *
 * ## What is asserted
 *
 * Not a number — a number would be a guess about how many ports a question has.
 * That growing the guide does not grow the cost of passing it.
 */

afterEach(() => document.body.replaceChildren());

const question = (id: string, y: number) => ({
  id,
  type: "question",
  position: { x: 80, y },
  data: {
    title: { sv: `Fråga ${id}` },
    options: [
      { id: "ja", label: { sv: "Ja" }, value: "ja" },
      { id: "nej", label: { sv: "Nej" }, value: "nej" },
    ],
  },
});

const guide = (count: number): GraphData =>
  ({
    startNodeId: "n0",
    settings: { sourceLocale: "sv" },
    nodes: Array.from({ length: count }, (_, index) =>
      question(`n${index}`, 60 + index * 220),
    ),
    connections: [],
  }) as unknown as GraphData;

const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ),
  );

async function mount(count: number): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("feature-level", "basic");
  editor.style.cssText = "display: block; width: 1200px; height: 700px;";
  document.body.append(editor);

  editor.graph = guide(count);
  await settle();
  await settle();

  return editor;
}

const canvasRoot = (editor: GuideEditor): ShadowRoot =>
  editor.shadowRoot!.querySelector("node-editor")!.shadowRoot!;

/**
 * Everything inside the nodes that Tab would stop at.
 *
 * Buttons are in the tab order unless something takes them out of it, so the
 * absence of `tabindex` counts as a stop — which is exactly how the ports got
 * there without anybody deciding they should.
 */
function tabStops(editor: GuideEditor): number {
  let stops = 0;

  canvasRoot(editor)
    .querySelectorAll("flow-node")
    .forEach((node) => {
      node.shadowRoot
        ?.querySelectorAll<HTMLElement>(".flow-node, .flow-node__port")
        .forEach((element) => {
          const index = element.getAttribute("tabindex");

          if (index === null ? element.tagName === "BUTTON" : Number(index) >= 0) {
            stops += 1;
          }
        });
    });

  return stops;
}

describe("tabbing past the canvas", () => {
  test("costs the same whether the guide has two nodes or eight", async () => {
    const small = tabStops(await mount(2));
    document.body.replaceChildren();
    const large = tabStops(await mount(8));

    expect(large).toBe(small);
  });

  test("leaves one node and its ports reachable", async () => {
    const editor = await mount(4);

    // Something has to be reachable, or the canvas cannot be entered at all —
    // which would pass the test above for the wrong reason.
    expect(tabStops(editor)).toBeGreaterThan(1);

    const inTheOrder = [...canvasRoot(editor).querySelectorAll("flow-node")].filter(
      (node) =>
        node.shadowRoot?.querySelector(".flow-node")?.getAttribute("tabindex") === "0",
    );

    expect(inTheOrder).toHaveLength(1);
  });

  test("the stop follows the arrows to whichever node is being worked on", async () => {
    const editor = await mount(4);
    const nodes = [...canvasRoot(editor).querySelectorAll("flow-node")];
    const stopId = (): string | null =>
      (
        nodes.find(
          (node) =>
            node.shadowRoot?.querySelector(".flow-node")?.getAttribute("tabindex") ===
            "0",
        ) as { nodeId?: string } | undefined
      )?.nodeId ?? null;

    const first = nodes[0] as HTMLElement & { nodeId: string };

    first.focus();
    const before = stopId();

    first.shadowRoot
      ?.querySelector<HTMLElement>(".flow-node")
      ?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, composed: true }),
      );
    await settle();

    const after = stopId();

    // Leaving the canvas and coming back returns to the node being worked on,
    // not to the first one in the graph.
    expect(before).not.toBeNull();
    expect(after).not.toBe(before);
  });
});
