import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "./node-editor";

/**
 * The start node is on screen when a guide opens — Uppdrag 23/9, Del A punkt 1.
 *
 * ## The fault, measured
 *
 * `examples/editor-advanced.html` at 1440×900: the initial view centred the
 * *whole graph's* bounding box, and that graph is far wider than any viewport
 * (11 nodes, roughly 3300 canvas px across). The centre of that box put the
 * start node at x −1247 relative to the viewport — fully off screen to the
 * left, 2 of 11 nodes visible. `docs/UPPDRAG-2026-09-23-EDITORNS-VY.md`'s rule
 * is that the start node stands top-left with air instead; "anpassa allt" was
 * explicitly rejected because twelve nodes do not read at 1440 px.
 *
 * This graph reproduces that shape (nodes spread wide, start node at the left
 * edge) rather than inventing a small one that would pass by accident.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const wideGraph = () => ({
  startNodeId: "n0",
  nodes: Array.from({ length: 8 }, (_, index) => ({
    id: `n${index}`,
    type: "text-question",
    position: { x: index * 420, y: (index % 2) * 200 },
    data: { title: `Nod ${index}`, variableName: `v${index}` },
  })),
  connections: [],
});

async function canvas(): Promise<{ nodeEditor: NodeEditor; viewport: HTMLElement }> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1440px; height: 900px;";
  document.body.append(editor);
  editor.graph = wideGraph() as never;

  await settle();
  await settle();

  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(
    ".node-editor__viewport",
  );

  if (!nodeEditor || !viewport) throw new Error("node-editor saknas.");

  return { nodeEditor, viewport };
}

const zoomOf = (nodeEditor: NodeEditor): number =>
  new DOMMatrix(
    getComputedStyle(
      nodeEditor.shadowRoot!.querySelector<HTMLElement>(".node-editor__scaled")!,
    ).transform,
  ).a;

function startNodeElement(nodeEditor: NodeEditor): HTMLElement {
  const nodes = [...nodeEditor.shadowRoot!.querySelectorAll<HTMLElement>("flow-node")];
  const start = nodes.find((node) =>
    node.shadowRoot?.querySelector(".flow-node__start-flag"),
  );

  if (!start) throw new Error("startnoden saknas.");

  return start;
}

describe("startvyn", () => {
  test("startnodens ruta ligger inom viewporten när en bred guide öppnas", async () => {
    const { nodeEditor, viewport } = await canvas();

    const view = viewport.getBoundingClientRect();
    const rect = startNodeElement(nodeEditor).getBoundingClientRect();

    expect(
      rect.right > view.left &&
        rect.left < view.right &&
        rect.bottom > view.top &&
        rect.top < view.bottom,
      `startnoden ligger på ${Math.round(rect.left - view.left)},${Math.round(rect.top - view.top)} ` +
        `i en vy på ${Math.round(view.width)}x${Math.round(view.height)}`,
    ).toBe(true);
  });

  test("zoomen ändras aldrig av sig själv vid den initiala centreringen", async () => {
    const { nodeEditor } = await canvas();

    // Standardzoomen är 100 %; om den initiala vyn justerade zoomen för att få
    // in hela den breda grafen skulle den redan här avvika från 1.
    expect(zoomOf(nodeEditor)).toBeCloseTo(1, 5);
  });

  test("zoomen står kvar när grafen laddas om via `graph =`", async () => {
    const { nodeEditor } = await canvas();

    nodeEditor.setZoom(1.4);
    expect(zoomOf(nodeEditor)).toBeCloseTo(1.4, 5);

    nodeEditor.graph = wideGraph() as never;
    await settle();
    await settle();

    expect(zoomOf(nodeEditor)).toBeCloseTo(1.4, 5);
  });
});
