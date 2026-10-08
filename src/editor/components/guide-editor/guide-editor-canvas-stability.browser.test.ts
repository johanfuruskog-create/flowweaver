import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * The canvas does not move when a guide's health changes.
 *
 * ## What this protects
 *
 * The editor keeps the view's centre when its viewport changes size — it has to,
 * or going full screen would land you somewhere else in the guide. The cost is
 * that *any* size change scrolls: something in the chrome reflowing by forty
 * pixels moves the whole canvas under the hand of whoever is working.
 *
 * That is not a hypothetical. Hiding two rows of chrome with `display: none`
 * while recording the hero clip took their space with them, the viewport grew
 * 666x439 to 666x476, the centre logic compensated, and the node appeared to
 * jump about forty pixels the moment it was put down. It took most of an evening
 * to find, because the node never moved — the canvas moved under it.
 *
 * ## Why a test rather than a change
 *
 * Measured on the product, health changes do *not* resize anything today: the
 * same three nodes with "Inga problem" and with "2 fel · 2 varningar" give the
 * same canvas box, the same viewport height and the same scrollTop. An earlier
 * measurement said otherwise and was wrong — it compared an empty guide against
 * one with a node, which is two changes at once.
 *
 * So there is nothing to fix, and that is exactly when a guarantee is worth
 * writing down: it costs nothing today and it is the day somebody adds a row to
 * the chrome that it earns its place.
 */

afterEach(() => document.body.replaceChildren());

const guide = (connected: boolean): GraphData =>
  ({
    startNodeId: "q",
    settings: { sourceLocale: "sv" },
    nodes: [
      {
        id: "q",
        type: "question",
        position: { x: 60, y: 60 },
        data: {
          title: { sv: "Har du tandvärk?" },
          options: [
            { id: "ja", label: { sv: "Ja" }, value: "ja" },
            { id: "nej", label: { sv: "Nej" }, value: "nej" },
          ],
        },
      },
      { id: "r1", type: "result", position: { x: 420, y: 40 }, data: { title: { sv: "Tandläkaren" } } },
      { id: "r2", type: "result", position: { x: 420, y: 300 }, data: { title: { sv: "Godisaffären" } } },
    ],
    connections: connected
      ? [
          { id: "c1", from: { nodeId: "q", portId: "ja" }, to: { nodeId: "r1", portId: "input" } },
          { id: "c2", from: { nodeId: "q", portId: "nej" }, to: { nodeId: "r2", portId: "input" } },
        ]
      : [],
  }) as unknown as GraphData;

const settle = () =>
  new Promise<void>((resolve) => {
    // Three frames: the graph renders, the health pass lands, and the resize
    // observer gets one more in which to react to anything it moved.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });

function mount(): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("feature-level", "basic");
  editor.style.cssText = "display: block; width: 1200px; height: 700px;";
  document.body.append(editor);

  return editor;
}

/** What the canvas looks like, and where the view sits inside it. */
function canvasState(editor: GuideEditor): {
  canvas: string;
  viewport: number;
  scrollTop: number;
  health: string;
} {
  const root = editor.shadowRoot;
  const canvas = root?.querySelector(".guide-editor__canvas")?.getBoundingClientRect();
  const viewport = root
    ?.querySelector("node-editor")
    ?.shadowRoot?.querySelector<HTMLElement>(".node-editor__viewport");

  return {
    canvas: `${Math.round(canvas?.width ?? 0)}x${Math.round(canvas?.height ?? 0)}`,
    viewport: viewport?.clientHeight ?? 0,
    scrollTop: Math.round(viewport?.scrollTop ?? 0),
    health: root?.querySelector("[data-health-count]")?.textContent?.trim() ?? "",
  };
}

describe("the start-node warning appearing", () => {
  /*
   * The case that cost a day.
   *
   * Remove the start from a guide with more nodes and the warning appears in
   * `grid-row: 1` and takes its 37px out of the canvas. The canvas used to
   * scroll by half of that to keep its middle where it was, and the node
   * somebody had just put down appeared to jump. (It used to be the first node
   * that brought the band; since story 082 the first step is the start.)
   *
   * The viewport still changes size — that is the banner doing its job. What must
   * not happen is the scroll moving with it.
   */
  test("does not scroll the canvas", async () => {
    const editor = mount();

    editor.graph = guide(false);
    await settle();
    await settle();

    const viewport = () =>
      editor.shadowRoot
        ?.querySelector("node-editor")
        ?.shadowRoot?.querySelector<HTMLElement>(".node-editor__viewport");

    const before = {
      scrollTop: Math.round(viewport()?.scrollTop ?? 0),
      height: viewport()?.clientHeight ?? 0,
    };

    editor.shadowRoot
      ?.querySelector<NodeEditor>("node-editor")
      ?.removeNodeById("q");

    await settle();
    await settle();
    await settle();

    const after = {
      scrollTop: Math.round(viewport()?.scrollTop ?? 0),
      height: viewport()?.clientHeight ?? 0,
    };

    // Without the banner actually taking its space the test proves nothing.
    expect(after.height).toBeLessThan(before.height);
    expect(after.scrollTop).toBe(before.scrollTop);
  });
});

describe("a guide's health", () => {
  test("changes nothing about the canvas or where the view sits", async () => {
    const editor = mount();

    editor.graph = guide(true);
    await settle();
    await settle();
    const healthy = canvasState(editor);

    editor.graph = guide(false);
    await settle();
    await settle();
    const faulted = canvasState(editor);

    // Without the health actually changing, the comparison proves nothing —
    // so it says so, the way the port test does.
    expect(healthy.health).not.toBe(faulted.health);
    expect(healthy.viewport).toBeGreaterThan(0);

    expect(faulted.canvas).toBe(healthy.canvas);
    expect(faulted.viewport).toBe(healthy.viewport);
    expect(faulted.scrollTop).toBe(healthy.scrollTop);
  });
});
