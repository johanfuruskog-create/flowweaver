import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";
import type { GraphData } from "../../../viewer/types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../../testing/optional-pro";
const { bookingExampleGraph } = ((await proModule("data/booking-example-graph.ts")) ?? {}) as { bookingExampleGraph: GraphData };
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * The header's two buttons — the eye and ⋯ — are a dense row of controls, so
 * each takes a finger in 44 × 44 while it is still drawn at its own size
 * (E10 in docs/GENOMGANG-2026-09-30.md, Astra 30/9, bilaga 4 in the brief).
 *
 * Measured the way a finger meets it: `elementFromPoint` 21 px from the
 * button's centre, in each of the four directions, walked down through every
 * shadow root. A pseudo-element hit comes back as its button, so this reads
 * the target and not the drawing. The same points must not land on a port or
 * on the header — the header drags the node — and the two targets must not
 * overlap each other.
 *
 * Run over a whole example guide rather than one node: a page container
 * draws the eye with its words beside it, and a node on a page has a menu and
 * no eye, so the header is laid out three ways.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 80));

async function canvas(): Promise<NodeEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = structuredClone(bookingExampleGraph);

  await settle();
  await settle();

  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");

  if (!nodeEditor) throw new Error("node-editor saknas.");

  return nodeEditor;
}

/** The deepest element under a point, through every open shadow root. */
function deepest(x: number, y: number): Element | null {
  let root: Document | ShadowRoot = document;
  let hit: Element | null = null;

  for (;;) {
    const next: Element | null = root.elementFromPoint(x, y);

    if (!next || next === hit) return hit;
    hit = next;
    if (!next.shadowRoot) return hit;
    root = next.shadowRoot;
  }
}

function headerButtons(nodeEditor: NodeEditor): { name: string; button: HTMLElement }[] {
  return Array.from(nodeEditor.shadowRoot!.querySelectorAll("flow-node")).flatMap((node) => {
    const id = node.getAttribute("data-node-id") ?? (node as unknown as { nodeData?: { id: string } }).nodeData?.id;

    return Array.from(
      node.shadowRoot!.querySelectorAll<HTMLElement>("[data-visitor-toggle]:not([hidden]), [data-node-menu]"),
    ).map((button) => ({
      name: `${id} ${button.hasAttribute("data-node-menu") ? "⋯" : "ögat"}`,
      button,
    }));
  });
}

const centre = (element: Element): { x: number; y: number } => {
  const r = element.getBoundingClientRect();

  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};

describe("nodhuvudets knappar", () => {
  test.runIf(PRO)("tar emot ett finger 21 px från mitten åt alla fyra håll", async () => {
    const nodeEditor = await canvas();
    const buttons = headerButtons(nodeEditor);
    const misses: string[] = [];

    expect(buttons.length, "knappar i guiden").toBeGreaterThan(4);

    for (const { name, button } of buttons) {
      button.scrollIntoView({ block: "center", inline: "center" });
      await settle();

      const c = centre(button);

      for (const [dx, dy, way] of [[-21, 0, "vänster"], [21, 0, "höger"], [0, -21, "upp"], [0, 21, "ned"]] as const) {
        const hit = deepest(c.x + dx, c.y + dy);

        if (!hit || (hit !== button && !button.contains(hit))) {
          misses.push(`${name} ${way}: ${hit ? `${hit.tagName.toLowerCase()}.${hit.className}` : "inget"}`);
        }
      }
    }

    expect(misses).toEqual([]);
  });

  test("ett tryck i träffytans kant startar ingen noddragning", async () => {
    const nodeEditor = await canvas();
    const viewport = nodeEditor.shadowRoot!.querySelector<HTMLElement>(".node-editor__viewport")!;
    const moved: string[] = [];

    for (const { name, button } of headerButtons(nodeEditor)) {
      button.scrollIntoView({ block: "center", inline: "center" });
      await settle();

      const before = JSON.stringify(nodeEditor.getData().nodes.map((node) => node.position));
      const c = centre(button);
      const x = c.x + 21;
      const y = c.y - 21;
      const target = deepest(x, y) ?? button;
      const init = (cx: number, cy: number): PointerEventInit => ({
        bubbles: true, composed: true, clientX: cx, clientY: cy, pointerId: 1, isPrimary: true, button: 0, buttons: 1,
      });

      target.dispatchEvent(new PointerEvent("pointerdown", init(x, y)));
      for (let i = 1; i <= 4; i += 1) {
        target.dispatchEvent(new PointerEvent("pointermove", init(x + i * 15, y + i * 10)));
        window.dispatchEvent(new PointerEvent("pointermove", init(x + i * 15, y + i * 10)));
      }
      if (viewport.hasAttribute("data-node-dragging")) moved.push(`${name}: data-node-dragging`);
      target.dispatchEvent(new PointerEvent("pointerup", init(x + 60, y + 40)));
      window.dispatchEvent(new PointerEvent("pointerup", init(x + 60, y + 40)));
      await settle();

      if (JSON.stringify(nodeEditor.getData().nodes.map((node) => node.position)) !== before) {
        moved.push(`${name}: en nod flyttades`);
      }
      // Close whatever the press opened, so the next button starts clean.
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
      await settle();
    }

    expect(moved).toEqual([]);
  });

  test("träffytorna överlappar inte varandra", async () => {
    const nodeEditor = await canvas();
    const byNode = new Map<Element, DOMRect[]>();

    for (const { button } of headerButtons(nodeEditor)) {
      const c = centre(button);
      const host = (button.getRootNode() as ShadowRoot).host;

      byNode.set(host, [...(byNode.get(host) ?? []), new DOMRect(c.x - 22, c.y - 22, 44, 44)]);
    }

    const overlaps: string[] = [];

    for (const [host, boxes] of byNode) {
      for (let i = 1; i < boxes.length; i += 1) {
        const [a, b] = [boxes[i - 1], boxes[i]];
        const overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);

        if (overlap > 0.5) overlaps.push(`${(host as unknown as { nodeData?: { id: string } }).nodeData?.id}: ${overlap.toFixed(1)} px`);
      }
    }

    expect(overlaps).toEqual([]);
  });
});
