import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * A node created from a node template is a node of its **base type** carrying
 * the template's key in `template`. The provenance is the editor's business —
 * the viewer must render the node as what it is and never show where it came
 * from.
 *
 * The file used to be called `guide-preview-custom-declarative`. It tested that
 * an editor-built *node type* rendered via the generic interpreter. After story
 * 007 there is no such node type — a template is never registered, so what
 * remains to test is that the tag does not interfere.
 */

const graph: GraphData = {
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "multi-choice",
      // Created from a template that no longer exists anywhere.
      template: "mall-intressen",
      position: { x: 0, y: 0 },
      data: {
        title: "Vilka intressen?",
        variableName: "intressen",
        options: [
          { id: "a", label: "Sport", value: "sport" },
          { id: "b", label: "Musik", value: "musik" },
          { id: "c", label: "Film", value: "film" },
        ],
        minSelected: 2,
      },
    },
    { id: "done", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart" } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "done", portId: "input" } },
  ],
};

afterEach(() => {
  document.body.replaceChildren();
});

function mount(): GuidePreview {
  const preview = document.createElement("guide-preview") as GuidePreview;
  document.body.append(preview);
  preview.graph = graph;
  return preview;
}

function checkboxes(preview: GuidePreview): HTMLInputElement[] {
  return Array.from(
    preview.shadowRoot?.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][name="guide-preview-multi"]'
    ) ?? []
  );
}

describe("guide-preview – en nod ur en nodmall", () => {
  test("renders as its base type, with its values", () => {
    const preview = mount();

    expect(checkboxes(preview)).toHaveLength(3);
    expect(preview.shadowRoot?.textContent).toContain("Vilka intressen?");
    expect(preview.shadowRoot?.textContent).toContain("välj minst 2");
  });

  test("validation applies, and the way forward works", () => {
    const preview = mount();

    // För få val blockeras.
    checkboxes(preview)[0].checked = true;
    preview.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="next"]')?.click();
    expect(preview.shadowRoot?.textContent).toContain("Vilka intressen?");
    expect(preview.shadowRoot?.textContent).not.toContain("Klart");

    // Kravet uppfyllt → vidare.
    const boxes = checkboxes(preview);
    boxes[0].checked = true;
    boxes[1].checked = true;
    preview.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="next"]')?.click();
    expect(preview.shadowRoot?.textContent).toContain("Klart");
  });

  // The template is registered nowhere, and it does not show.
  test("the provenance is never visible to the citizen", () => {
    const preview = mount();

    expect(preview.shadowRoot?.innerHTML).not.toContain("mall-intressen");
  });
});
