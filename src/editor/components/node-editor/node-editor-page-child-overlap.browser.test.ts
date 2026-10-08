import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./node-editor";

import { pageBuilderExampleGraph } from "../../../data/page-builder-example-graph";

import type { NodeEditor } from "./node-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * A page's own fields may not be drawn on top of each other.
 *
 * `example-graphs-no-overlap.browser.test.ts` guards every *other* pair of
 * nodes and skips this one on purpose — a page and its children are drawn one
 * inside the other by construction. That exclusion also hid the siblings from
 * each other, and this is the case it hid: on page two of page-builder both
 * fields carry a visibility row, which the stacking never knew about.
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

function siblingOverlaps(editor: NodeEditor, graph: GraphData): string[] {
  const pageOf = new Map(
    graph.nodes
      .filter((node) => node.parentPageId)
      .map((node) => [node.id, node.parentPageId as string]),
  );

  const drawn = [...(editor.shadowRoot?.querySelectorAll<HTMLElement>("flow-node") ?? [])]
    .map((element) => ({
      id: (element as unknown as { nodeId: string | null }).nodeId ?? "?",
      box: element.getBoundingClientRect(),
    }))
    .filter((one) => one.box.width > 0 && pageOf.has(one.id));

  const found: string[] = [];

  for (let a = 0; a < drawn.length; a += 1) {
    for (let b = a + 1; b < drawn.length; b += 1) {
      const one = drawn[a];
      const other = drawn[b];
      if (pageOf.get(one.id) !== pageOf.get(other.id)) continue;

      const across =
        Math.min(one.box.right, other.box.right) - Math.max(one.box.left, other.box.left);
      const down =
        Math.min(one.box.bottom, other.box.bottom) - Math.max(one.box.top, other.box.top);

      if (across > 0.5 && down > 0.5) {
        found.push(
          `${one.id} ↔ ${other.id} (${Math.round(across)}×${Math.round(down)} px)`,
        );
      }
    }
  }

  return found;
}

describe("a page's fields", () => {
  test("are never drawn on top of each other", async () => {
    const editor = mount(pageBuilderExampleGraph);
    await settle();

    expect(siblingOverlaps(editor, pageBuilderExampleGraph)).toEqual([]);
  });

  test("stay apart when a field grows a row the stacking never saw", async () => {
    // A title long enough to wrap, on a full-width field: the height comes from
    // the text, and no constant can know it.
    const graph: GraphData = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 40, y: 40 }, data: { title: "Sida", description: "Beskrivning." } },
        {
          id: "tall",
          type: "text-question",
          parentPageId: "page",
          order: 0,
          layout: { columnSpan: 12 },
          position: { x: 0, y: 0 },
          data: {
            title:
              "En rubrik som är tillräckligt lång för att brytas över flera rader i fältets huvud",
            variableName: "tall",
            required: true,
            placeholder: "En platshållare som också tar plats i kortet",
          },
          visibility: {
            match: "all",
            conditions: [
              { id: "c", variableName: "annat", operator: "equals", value: "ja" },
            ],
          },
        },
        { id: "after", type: "text-question", parentPageId: "page", order: 1, layout: { columnSpan: 12 }, position: { x: 0, y: 0 }, data: { title: "Efter", variableName: "after" } },
      ],
      connections: [],
    };

    const editor = mount(graph);
    await settle();

    expect(siblingOverlaps(editor, graph)).toEqual([]);
  });

  test("settle in one layout pass — measure, place, done", async () => {
    // The loop to be afraid of is measure → layout → height → measure. A
    // field's height follows from its column width and the layout moves only
    // its `y`, so the second pass must find nothing to change.
    const editor = mount(pageBuilderExampleGraph);

    const tops: string[] = [];
    for (let frame = 0; frame < 6; frame += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const field = [...(editor.shadowRoot?.querySelectorAll<HTMLElement>("flow-node") ?? [])]
        .find(
          (element) =>
            (element as unknown as { nodeId: string | null }).nodeId ===
            "service-phone-number",
        );
      tops.push(field?.style.top ?? "?");
    }

    // One change at most: the fallback height gives way to the measured one.
    const changes = tops.filter((top, index) => index > 0 && top !== tops[index - 1]);
    expect(changes.length).toBeLessThanOrEqual(1);
    expect(tops.at(-1)).toBe(tops.at(-2));
  });
});
