import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { FlowNode } from "../flow-node/flow-node";
import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

afterEach(() => document.body.replaceChildren());

describe("guide-editor Page thirds", () => {
  test("places three third-width fields on one row below the Page content", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: { title: "Kontakt", description: "Beskrivning som ska ligga ovanfor falten." } },
        { id: "first", type: "text-question", parentPageId: "page", order: 0, layout: { columnSpan: 4 }, position: { x: 0, y: 0 }, data: { title: "Forsta" } },
        { id: "second", type: "text-question", parentPageId: "page", order: 1, layout: { columnSpan: 4 }, position: { x: 0, y: 0 }, data: { title: "Andra" } },
        { id: "third", type: "text-question", parentPageId: "page", order: 2, layout: { columnSpan: 4 }, position: { x: 0, y: 0 }, data: { title: "Tredje" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const nodes = Array.from(nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []);
    const page = nodes.find((node) => node.nodeData?.id === "page");
    const fields = ["first", "second", "third"].map((id) =>
      nodes.find((node) => node.nodeData?.id === id)
    );

    expect(fields.map((field) => field?.style.top)).toEqual(["320px", "320px", "320px"]);
    expect(fields.map((field) => field?.dataset.columnSpan)).toEqual(["4", "4", "4"]);
    expect(fields.map((field) => Number.parseFloat(field?.style.left ?? "0")))
      .toEqual([120, 330.667, 541.333]);

    const pageContentBottom = page?.shadowRoot
      ?.querySelector<HTMLElement>(".flow-node__content")
      ?.getBoundingClientRect().bottom ?? 0;
    const firstFieldTop = fields[0]?.getBoundingClientRect().top ?? 0;
    expect(firstFieldTop).toBeGreaterThanOrEqual(pageContentBottom);
  });
});
