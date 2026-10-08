import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../node-editor/node-editor";

import { exampleGraph } from "../../../data/example-graph";

import type { NodeEditor } from "../node-editor/node-editor";
import type { FlowNode } from "./flow-node";

/**
 * The box is the taller of the two views. Never the sum of them.
 *
 * ## The fault this is written from
 *
 * Story 064 point 8, and the assignment's own guard rail: a node is as tall as
 * whichever of its two views is taller, so ports stand still and "show them all"
 * cannot push one node over another. The first build got the arithmetic wrong.
 * The port rows sat *below* the pair of views, so the node came out as the
 * visitor's view **plus** the structure's port rows.
 *
 * Measured on the built site, `sv/examples/editor.html`, Pages (before 064)
 * against the local build (after): question-gender 428 → 748 px, question-age
 * 293 → 575, result-permit 222 → 402. In the structure view that left an empty
 * 490 px cell above the port rows — heading, tag, 320 px of nothing, and then
 * Man/Kvinna/Annat at the very bottom.
 *
 * With the rows back inside the structure cell the three are 536, 426 and
 * 322 px, the same number with the eye lit as with it out, and the input port
 * sits at the same y in both views (221 and 168; the middle node is the start
 * and has none).
 *
 * ## What is asserted, and why twice
 *
 * The three numbers below are the heights those nodes had **before 064**, read
 * off Pages. They are a fixture and nothing in this repository produces them, so
 * they are a ceiling and not an equality: a node may not be taller than the
 * larger of its old self and its visitor view.
 *
 * The second assertion is the one that bites in any environment: the node's
 * height is its chrome plus the *larger* of the two views, not their sum. The
 * chrome is measured rather than assumed — it is whatever the header and the
 * content's padding come to — so the claim is about the arithmetic and not
 * about a particular font.
 */

afterEach(() => document.body.replaceChildren());

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

/** Heights on Pages before story 064, `sv/examples/editor.html`. */
const BEFORE_064: Record<string, number> = {
  "question-gender": 428,
  "question-age": 293,
  "result-permit": 222,
};

function mount(): NodeEditor {
  const editor = document.createElement("node-editor") as NodeEditor;

  editor.editorMode = "administrator";
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = structuredClone(exampleGraph);
  return editor;
}

function nodeElement(editor: NodeEditor, id: string): FlowNode {
  const found = [
    ...(editor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []),
  ].find((element) => element.nodeId === id);

  if (!found) throw new Error(`ingen nod med id ${id}`);
  return found;
}

function boxes(node: FlowNode) {
  const root = node.shadowRoot!;
  const height = (selector: string): number =>
    root.querySelector(selector)?.getBoundingClientRect().height ?? 0;

  /*
   * The chrome is measured from the header and the content's own padding, not
   * as "the node minus the views".
   *
   * That subtraction was the first attempt and it was worthless: with the port
   * rows outside the pair of views it counted them as chrome, so the formula
   * absorbed exactly the fault it was written to catch and passed against the
   * broken layout. A measurement that cannot tell the two apart is not one.
   */
  const content = root.querySelector(".flow-node__content")!;
  const padding = getComputedStyle(content);
  // The card's own 1 px border, top and bottom, which is outside the content's
  // padding and is what the node measured 2.2 px over the sum without.
  const card = getComputedStyle(root.querySelector(".flow-node")!);

  return {
    node: node.getBoundingClientRect().height,
    views: height(".flow-node__views"),
    structure: height(".flow-node__structure"),
    visitor: height("[data-visitor-preview]"),
    chrome:
      height(".flow-node__header") +
      Number.parseFloat(padding.paddingTop) +
      Number.parseFloat(padding.paddingBottom) +
      Number.parseFloat(card.borderTopWidth) +
      Number.parseFloat(card.borderBottomWidth),
  };
}

describe("nodens ruta med båda vyerna", () => {
  test.each(Object.keys(BEFORE_064))(
    "%s är den större vyn, inte summan av dem",
    async (id) => {
      const editor = mount();
      await settle();
      await settle();

      const measured = boxes(nodeElement(editor, id));

      expect(measured.visitor).toBeGreaterThan(0);
      expect(Math.round(measured.node)).toBeLessThanOrEqual(
        Math.max(BEFORE_064[id], measured.visitor + measured.chrome) + 2,
      );
      expect(Math.round(measured.node)).toBeLessThanOrEqual(
        Math.round(
          measured.chrome + Math.max(measured.structure, measured.visitor),
        ) + 2,
      );
    },
  );

  test("strukturvyn har ingen tom cell mellan taggen och portraderna", async () => {
    const editor = mount();
    await settle();
    await settle();

    const node = nodeElement(editor, "question-gender");
    const measured = boxes(node);

    /*
     * The rows follow the card's own content. When they sat outside the pair of
     * views, the empty visitor cell stood between the tag and them and pushed
     * them to the bottom of the node — the reported picture was heading, tag,
     * 320 px of nothing, then Man/Kvinna/Annat.
     *
     * What is left over when the visitor's view is the taller of the two is
     * space *below* the last row, which is right: the box is the taller view
     * and the structure is drawn at the top of it.
     */
    const rows = [
      ...(node.shadowRoot?.querySelectorAll<HTMLElement>(".flow-node__port-row") ??
        []),
    ];
    // The chips are off by default since 077; the tag row exists only when
    // the canvas says so, and a hidden row measures a zero rectangle.
    node.toggleAttribute("data-show-variables", true);
    const tags = node.shadowRoot!.querySelector(".flow-node__field-labels")!;
    const gap =
      rows[0].getBoundingClientRect().top - tags.getBoundingClientRect().bottom;

    expect(rows.length).toBeGreaterThan(2);
    expect(Math.round(gap)).toBeLessThanOrEqual(40);
    expect(Math.round(measured.structure)).toBeLessThanOrEqual(
      Math.round(measured.views) + 2,
    );
  });
});
