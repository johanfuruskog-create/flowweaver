import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./node-editor";

import { pageBuilderExampleGraph } from "../../../data/page-builder-example-graph";

import type { NodeEditor } from "./node-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * The field area starts where the page's text ends — not on a constant.
 *
 * ## The failure this is written from
 *
 * `PAGE_CONTENT_TOP` was 260 and the dashed frame's `inset` 214px. Measured on
 * page-builder, the page node's `.flow-node__content` ends at 221 px, so the
 * constants happened to look right — but a title that wraps onto a second line
 * or a longer description moves that bottom, and the constant does not follow.
 * The page's own text then ends up underneath the first field.
 *
 * ## What the 106 px below the description are
 *
 * The page node's own ports: `.flow-node__ports` (18 px of margin plus 72 px
 * of two port rows) and the content box's 16 px of bottom padding. Those are
 * the connections' anchors, not air without a job — moving them out of the
 * text block is the page node's redesign (B), parked. What was left to remove
 * was the drop hint's band above the fields.
 */

afterEach(() => document.body.replaceChildren());

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

function mount(graph: GraphData): NodeEditor {
  const editor = document.createElement("node-editor") as NodeEditor;
  editor.editorMode = "administrator";
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = graph;
  return editor;
}

/** The distance from a page's text block to its first field, per page. */
function gaps(editor: NodeEditor, graph: GraphData): Array<[string, number]> {
  const drawn = new Map(
    [...(editor.shadowRoot?.querySelectorAll<HTMLElement>("flow-node") ?? [])].map(
      (element) => [
        (element as unknown as { nodeId: string | null }).nodeId ?? "?",
        element,
      ],
    ),
  );

  return graph.nodes
    .filter((node) => node.type === "page" && !node.parentPageId)
    .map((page) => {
      const pageElement = drawn.get(page.id);
      const contentBottom =
        pageElement?.shadowRoot
          ?.querySelector<HTMLElement>(".flow-node__content")
          ?.getBoundingClientRect().bottom ?? 0;

      const firstChild = graph.nodes
        .filter((node) => node.parentPageId === page.id)
        .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))[0];
      const childTop =
        drawn.get(firstChild?.id ?? "")?.getBoundingClientRect().top ?? 0;

      return [page.id, Math.round(childTop - contentBottom)] as [string, number];
    });
}

const wrappingPage: GraphData = {
  startNodeId: "page",
  nodes: [
    {
      id: "page",
      type: "page",
      position: { x: 40, y: 40 },
      data: {
        title:
          "En sidrubrik som är så lång att den måste brytas över minst två rader i sidans huvud",
        description:
          "En beskrivning i tre eller fyra rader, som den redaktören faktiskt skriver när sidan behöver förklaras: vad besökaren ska fylla i, varför det efterfrågas och vad som händer sedan. Textblockets botten flyttar sig, och fältytan måste följa med. Utan den mätningen står texten kvar där den hamnade och fältet lägger sig ovanpå den — det är hela felet, i en enda mening.",
      },
    },
    { id: "first", type: "text-question", parentPageId: "page", order: 0, layout: { columnSpan: 12 }, position: { x: 0, y: 0 }, data: { title: "Första fältet", variableName: "first" } },
  ],
  connections: [],
};

describe("sidans fältyta", () => {
  test("släppzonens etikett ligger mellan textblocket och första fältet", async () => {
    // The page with the wrapping title: a fixed `top` on the label lands in
    // the middle of the description instead of on the frame, and that is
    // measurable.
    const editor = mount(wrappingPage);
    await settle();

    const page = [...(editor.shadowRoot?.querySelectorAll<HTMLElement>("flow-node") ?? [])]
      .find(
        (element) =>
          (element as unknown as { nodeId: string | null }).nodeId === "page",
      );
    const contentBottom =
      page?.shadowRoot
        ?.querySelector<HTMLElement>(".flow-node__content")
        ?.getBoundingClientRect().bottom ?? 0;
    const hint = editor.shadowRoot?.querySelector<HTMLElement>(
      '.node-editor__page-surface[data-page-id="page"] .node-editor__page-drop-hint',
    );
    const firstField = [...(editor.shadowRoot?.querySelectorAll<HTMLElement>("flow-node") ?? [])]
      .find(
        (element) =>
          (element as unknown as { nodeId: string | null }).nodeId === "first",
      );

    const hintBox = hint?.getBoundingClientRect();
    expect(hintBox?.height ?? 0).toBeGreaterThan(0);
    // The label sits on the frame's top edge: below the page's port rows,
    // above the fields. Touching either one puts it in the way rather than in
    // the margin.
    expect(hintBox!.bottom).toBeLessThanOrEqual(
      firstField!.getBoundingClientRect().top,
    );
    expect(hintBox!.top).toBeGreaterThanOrEqual(contentBottom - 20);
  });

  test("börjar strax under textblocket, aldrig ovanpå det", async () => {
    const editor = mount(pageBuilderExampleGraph);
    await settle();

    gaps(editor, pageBuilderExampleGraph).forEach(([id, gap]) => {
      expect(gap, `${id}: avstånd text → första fältet`).toBeGreaterThanOrEqual(0);
      expect(gap, `${id}: avstånd text → första fältet`).toBeLessThanOrEqual(40);
    });
  });

  test("följer med när rubriken bryts och beskrivningen växer", async () => {
    const editor = mount(wrappingPage);
    await settle();

    gaps(editor, wrappingPage).forEach(([id, gap]) => {
      expect(gap, `${id}: avstånd text → första fältet`).toBeGreaterThanOrEqual(0);
      expect(gap, `${id}: avstånd text → första fältet`).toBeLessThanOrEqual(40);
    });
  });
});
