import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../node-editor/node-editor";

import { pageBuilderExampleGraph } from "../../../data/page-builder-example-graph";

import type { NodeEditor } from "../node-editor/node-editor";
import type { FlowNode } from "./flow-node";

/**
 * The eye in the node's header, and what pressing it may and may not do.
 *
 * Story 064: one state per node — the eye lit or not — and the menu is only a
 * command that sets them all. The button shows what you get if you press it: an
 * eye while the structure is shown, a pencil while the visitor's view is. The
 * *name* changes; `aria-pressed` deliberately does not, because a name that
 * changes and a pressed state at once is read twice over.
 *
 * The three things this holds, all of which were wrong before it existed:
 *
 * 1. A node type with no visitor view — a rule — has no button at all. A button
 *    that switches to a view that cannot be drawn is the same lie as a grip in
 *    a read-only canvas (story 063).
 * 2. The graph never hears about it. This is how the editor draws a node, not
 *    something about the guide, so `graph` must come back byte-identical and no
 *    change event may be dispatched.
 * 3. The node's rectangle does not move. Story point 8: the box is the taller
 *    of the two views, always, so ports stand still and "show them all" cannot
 *    create an overlap.
 */

afterEach(() => document.body.replaceChildren());

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

function mount(): NodeEditor {
  const editor = document.createElement("node-editor") as NodeEditor;

  editor.editorMode = "administrator";
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = structuredClone(pageBuilderExampleGraph);
  return editor;
}

function nodeElement(editor: NodeEditor, id: string): FlowNode {
  const found = [
    ...(editor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []),
  ].find((element) => element.nodeId === id);

  if (!found) throw new Error(`ingen nod med id ${id}`);
  return found;
}

/**
 * The box once it has stopped moving.
 *
 * A page measures its own children in a `ResizeObserver` and settles over
 * several frames — read one frame after mounting, the same untouched node
 * reports 691 px and then 700. Waiting for two equal readings measures the
 * node rather than the moment.
 */
async function stableRect(node: FlowNode): Promise<DOMRect> {
  let last = node.getBoundingClientRect();

  for (let attempt = 0; attempt < 30; attempt += 1) {
    await settle();

    const now = node.getBoundingClientRect();

    if (Math.round(now.height) === Math.round(last.height)) return now;
    last = now;
  }

  return last;
}

const toggle = (node: FlowNode): HTMLButtonElement | null =>
  node.shadowRoot?.querySelector<HTMLButtonElement>("[data-visitor-toggle]") ??
  null;

describe("ögat i nodhuvudet", () => {
  test("regelnoden har ingen knapp", async () => {
    const editor = mount();
    await settle();

    expect(toggle(nodeElement(editor, "service-age-rule"))).toBeNull();
  });

  test("en fråga har ögat, med namnet Som besökaren ser den", async () => {
    const editor = mount();
    await settle();

    const button = toggle(nodeElement(editor, "service-contact-page"));

    expect(button?.getAttribute("aria-label")).toBe("Som besökaren ser den");
    expect(button?.hasAttribute("aria-pressed")).toBe(false);
  });

  test("ett tryck döper om knappen till Ändra och tänder data-visitor-view", async () => {
    const editor = mount();
    await settle();

    const node = nodeElement(editor, "service-contact-page");

    toggle(node)?.click();
    await settle();

    expect(node.hasAttribute("data-visitor-view")).toBe(true);
    expect(toggle(node)?.getAttribute("aria-label")).toBe("Justera");

    toggle(node)?.click();
    await settle();

    expect(node.hasAttribute("data-visitor-view")).toBe(false);
    expect(toggle(node)?.getAttribute("aria-label")).toBe("Som besökaren ser den");
  });

  test("grafen är oförändrad och ingen ändringshändelse skickas", async () => {
    const editor = mount();
    await settle();

    const before = JSON.stringify(editor.graph);
    let changes = 0;

    editor.addEventListener("graph-changed", () => {
      changes += 1;
    });

    toggle(nodeElement(editor, "service-contact-page"))?.click();
    await settle();

    expect(JSON.stringify(editor.graph)).toBe(before);
    expect(changes).toBe(0);
  });

  test("sidans ruta följer besökarvyn med ögat, och flyttar sig inte", async () => {
    /*
     * The card ends where the visitor's view ends — the box rule exists to
     * stop growth over a neighbour, not to keep 100 px of nothing under a
     * form. It used to read "never grows": true while the structure carried
     * two chips per field. Story 077 took the chips off, and this page's
     * structure (607) is now 3 px shorter than its form (610) — the growth
     * the stylesheet names and the example gate measures against neighbours.
     * Story 095's K6 gate then measured the radio rows at 40 px and gave them
     * the visitor's 44; the picture on the canvas is the visitor's view at
     * full width, so it carries those rows too: 11 px, measured on 6/9 2026.
     * Then 15 px, measured on 21/9 2026: the page field's `<legend>` got the
     * 8 px it was owed above its list (the spacing floor, skill rule) — the
     * browser lays a legend outside the fieldset's `gap`, so the air was 0
     * before — and the card carries that air too, as it should.
     */
    const editor = mount();
    await settle();

    const node = nodeElement(editor, "service-contact-page");
    const before = await stableRect(node);

    toggle(node)?.click();

    const after = await stableRect(node);
    const form = node.shadowRoot!.querySelector(".flow-node__visitor")!.getBoundingClientRect();

    expect(Math.round(after.x)).toBe(Math.round(before.x));
    expect(Math.round(after.y)).toBe(Math.round(before.y));
    expect(Math.round(after.width)).toBe(Math.round(before.width));
    // 16 px content padding and the border: nothing else under the form.
    expect(Math.round(after.bottom - form.bottom)).toBeLessThanOrEqual(18);
    expect(Math.round(after.height - before.height), "the K6 rows, the legend's air, and the odd pixels").toBeLessThanOrEqual(15);
  });

  test("en fri nods ruta följer besökarvyn och kommer tillbaka med pennan", async () => {
    /*
     * It used to read "shrinks". That was true while a result's structure
     * carried an empty port row under its text — 46 px that made the
     * structure (163) taller than the view (142). With the entry ring beside
     * the header (7/9 2026) the structure is its text alone, 117, and the
     * view with its heading and navigation row is the taller of the two by
     * 25 px: the growth the stylesheet names and the example gate measures
     * against the neighbours. What the box does is follow the view.
     */
    const editor = mount();
    await settle();

    const node = nodeElement(editor, "service-guardian");
    const before = await stableRect(node);

    toggle(node)?.click();
    const lit = await stableRect(node);
    const view = node.shadowRoot!.querySelector(".flow-node__visitor")!.getBoundingClientRect();

    expect(Math.round(lit.x)).toBe(Math.round(before.x));
    expect(Math.round(lit.y)).toBe(Math.round(before.y));
    expect(Math.round(lit.width)).toBe(Math.round(before.width));
    // 16 px content padding and the border: nothing else under the view.
    expect(Math.round(lit.bottom - view.bottom)).toBeLessThanOrEqual(18);

    toggle(node)?.click();
    const back = await stableRect(node);

    expect(Math.round(back.height)).toBe(Math.round(before.height));
  });

  test("en nod som tillkommer är släckt, och de tända står kvar", async () => {
    const editor = mount();
    await settle();

    toggle(nodeElement(editor, "service-contact-page"))?.click();
    await settle();

    /*
     * A graph coming back in — an undo, a save round trip — must not put every
     * node back to structure while somebody is looking at the visitor's view.
     * What has to be off is the node that was not there before.
     */
    const grown = structuredClone(pageBuilderExampleGraph);

    grown.nodes.push({
      id: "ny-nod",
      type: "result",
      position: { x: 1800, y: 1800 },
      data: { title: { sv: "Ny" } },
    } as (typeof grown.nodes)[number]);
    editor.graph = grown;
    await settle();

    expect(nodeElement(editor, "service-contact-page").visitorView).toBe(true);
    expect(nodeElement(editor, "ny-nod").visitorView).toBe(false);
  });
});
