import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * A line stays attached to its port when the node changes height.
 *
 * ## The failure this is written from
 *
 * Delete one of a question's two connections and the guide stops being valid, so
 * the health pass puts a band on the node — and the node grows by it. The ports
 * sit at fixed offsets inside the node, so they move down with it. The lines had
 * already been drawn.
 *
 * Measured in the browser on the case that found it: the node went from 213 px
 * to 232, the port from y=537 to y=555, and the remaining line stayed at 536.
 * Nineteen pixels adrift, and it stayed there — nothing redraws on its own.
 *
 * The cause was not the ordering inside `removeConnection`. There was a
 * `ResizeObserver` meant for exactly this, set up in `connectedCallback` right
 * after `render()` — when the canvas is still empty. It observed the nodes it
 * found, which was none, and nothing created afterwards was ever added to it.
 *
 * ## Why the line is deleted the way a person deletes it
 *
 * The first version of this test removed the connection by assigning a new
 * `graph`, which is shorter to write and passes with the fix taken back out —
 * that path re-renders the nodes and draws afterwards, so it never had the
 * problem. Only `removeConnection` draws immediately and leaves the health pass
 * to change the height behind it. So the test clicks the line and presses
 * Delete, and the band comes from `GuideHealthService` by way of `guide-editor`
 * rather than from the test.
 *
 * ## What this file no longer proves — 2026-08-13
 *
 * The band was replaced by a marking of a fixed size, so the height change this
 * was written from cannot happen any more. The `ResizeObserver` that fixed it is
 * still there as a net, and **it is now without a test.** Two mechanisms were
 * tried and both were measured to prove nothing: adding an answer through the
 * properties panel schedules a draw of its own and passes with the observer
 * taken back out, and padding on the node is invisible to the observer, which
 * watches the content box. Rather than keep a test that cannot fall, there is
 * none. Say so out loud instead of leaving a green one that lies.
 *
 * ## What is asserted
 *
 * Not "a redraw happened" — that passes on a redraw that draws the same wrong
 * thing. The line's first point and the port's centre, in the same coordinate
 * space, within a pixel and a half of each other. That is the thing a person is
 * looking at.
 */

afterEach(() => document.body.replaceChildren());

const question = {
  id: "q",
  type: "question",
  position: { x: 40, y: 60 },
  data: {
    title: { sv: "Bor du i en bostad du hyr eller äger?" },
    variableName: "boende",
    options: [
      { id: "ja", label: { sv: "Ja" }, value: "ja" },
      { id: "nej", label: { sv: "Nej" }, value: "nej" },
    ],
  },
};

const results = [
  { id: "r1", type: "result", position: { x: 420, y: 30 }, data: { title: { sv: "Ja-svaret" } } },
  { id: "r2", type: "result", position: { x: 420, y: 300 }, data: { title: { sv: "Nej-svaret" } } },
];

const yesLeadsSomewhere = {
  id: "c1",
  from: { nodeId: "q", portId: "ja" },
  to: { nodeId: "r1", portId: "input" },
};

const noLeadsSomewhere = {
  id: "c2",
  from: { nodeId: "q", portId: "nej" },
  to: { nodeId: "r2", portId: "input" },
};

const guide = (connections: unknown[]): GraphData =>
  ({ startNodeId: "q", nodes: [question, ...results], connections }) as unknown as GraphData;

const settle = () =>
  new Promise<void>((resolve) => {
    // Three frames: the graph renders, the health pass lands, and whatever it
    // moved gets one more frame in which to be redrawn.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });

function mount(): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("feature-level", "advanced");
  editor.style.cssText = "display: block; width: 1200px; height: 800px;";
  document.body.append(editor);
  return editor;
}

/** How far the "ja" line's start sits from the centre of the "ja" port. */
function gapAtPort(editor: GuideEditor): { gap: number; height: number } {
  const canvas = editor.shadowRoot?.querySelector("node-editor")?.shadowRoot;
  if (!canvas) throw new Error("no canvas");

  const node = [...canvas.querySelectorAll<HTMLElement>("flow-node")].find((one) =>
    (one.shadowRoot?.textContent ?? "").includes("Bor du"),
  );

  const port = node?.shadowRoot?.querySelector<HTMLElement>('[data-port-id="ja"]');

  const line = [...canvas.querySelectorAll<SVGPathElement>("path[data-connection-id]")].find(
    (path) =>
      path.dataset.connectionId === "c1" && !path.getAttribute("class")?.includes("hit"),
  );

  if (!node || !port || !line) throw new Error("node, port or line missing");

  const portBox = port.getBoundingClientRect();
  const svgBox = line.ownerSVGElement?.getBoundingClientRect();
  const start = line.getPointAtLength(0);

  return {
    gap: Math.hypot(
      start.x + (svgBox?.left ?? 0) - (portBox.left + portBox.width / 2),
      start.y + (svgBox?.top ?? 0) - (portBox.top + portBox.height / 2),
    ),
    height: node.getBoundingClientRect().height,
  };
}

/** Selects a connection by clicking it, then presses Delete — as a person would. */
function deleteConnection(editor: GuideEditor, connectionId: string): void {
  const canvas = editor.shadowRoot?.querySelector("node-editor");
  const root = canvas?.shadowRoot;
  const line = root?.querySelector<SVGPathElement>(
    `path[data-connection-id="${connectionId}"]`,
  );
  const viewport = root?.querySelector<HTMLElement>(".node-editor__viewport");

  if (!line || !viewport) throw new Error("line or viewport missing");

  const box = line.getBoundingClientRect();
  line.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      composed: true,
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
      pointerId: 1,
      isPrimary: true,
      button: 0,
    }),
  );

  viewport.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Delete", bubbles: true, composed: true }),
  );
}

describe("a line and the port it comes out of", () => {
  test("meet when the guide is drawn", async () => {
    const editor = mount();

    editor.graph = guide([yesLeadsSomewhere, noLeadsSomewhere]);
    await settle();

    expect(gapAtPort(editor).gap).toBeLessThan(1.5);
  });

  /*
   * The original case, kept — but it now asserts the opposite thing.
   *
   * Deleting the line used to put a band on the node and make it 19 px taller.
   * The band was replaced by a marking in the header on 2026-08-13, precisely so
   * that this could not happen, so the guarantee here is that the height does
   * *not* move. Left in place because it is the case that found the bug, and a
   * regression here would bring the whole failure back.
   */
  test("and the node does not change height when a line is deleted", async () => {
    const editor = mount();

    editor.graph = guide([yesLeadsSomewhere, noLeadsSomewhere]);
    await settle();
    const before = gapAtPort(editor);

    deleteConnection(editor, "c2");
    await settle();
    await settle();
    const after = gapAtPort(editor);

    expect(after.height).toBe(before.height);
    expect(after.gap).toBeLessThan(1.5);
  });
});
