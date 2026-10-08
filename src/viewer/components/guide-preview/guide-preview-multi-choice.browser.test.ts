import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

const graph = (extra: Record<string, unknown>): GraphData => ({
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "multi-choice",
      position: { x: 0, y: 0 },
      data: {
        title: "Välj intressen",
        variableName: "val",
        options: [
          { id: "a", label: "Sport", value: "sport" },
          { id: "b", label: "Musik", value: "musik" },
          { id: "c", label: "Film", value: "film" },
        ],
        ...extra,
      },
    },
    { id: "done", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart" } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "done", portId: "input" } },
  ],
});

afterEach(() => {
  document.body.replaceChildren();
});

function mount(value: GraphData): GuidePreview {
  const preview = document.createElement("guide-preview") as GuidePreview;
  document.body.append(preview);
  preview.graph = value;
  return preview;
}

function checkboxes(preview: GuidePreview): HTMLInputElement[] {
  return Array.from(
    preview.shadowRoot?.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][name="guide-preview-multi"]'
    ) ?? []
  );
}

function clickNext(preview: GuidePreview): void {
  preview.shadowRoot
    ?.querySelector<HTMLButtonElement>('[data-action="next"]')
    ?.click();
}

describe("guide-preview: multi-choice question", () => {
  test("renderar en kryssruta per alternativ", () => {
    const preview = mount(graph({}));
    expect(checkboxes(preview)).toHaveLength(3);
    /*
     * "Välj **en** eller flera" — the string the viewer actually renders.
     *
     * This read "ett" and passed anyway, for a reason worth the note: the
     * stylesheet used to be written into the shadow root as a `<style>` block,
     * so `textContent` carried the whole of `guide-preview.scss` — including a
     * comment quoting the old wording. The assertion was matching a CSS comment.
     * The sheet is now adopted rather than written (story 064 put a viewer
     * inside every node on the canvas), and the test met the real text for the
     * first time.
     */
    expect(
      preview.shadowRoot?.querySelector(".guide-preview__card")?.textContent,
    ).toContain("Välj en eller flera");
  });

  test("visar antalskravet i ledtexten", () => {
    const preview = mount(graph({ minSelected: 2 }));
    expect(preview.shadowRoot?.textContent).toContain("välj minst 2");
  });

  test("blocks too few choices and lets through once the requirement is met", () => {
    const preview = mount(graph({ minSelected: 2 }));

    checkboxes(preview)[0].checked = true;
    clickNext(preview);
    // Kvar på frågan (för få val).
    expect(preview.shadowRoot?.textContent).toContain("Välj intressen");
    expect(preview.shadowRoot?.textContent).not.toContain("Klart");

    const boxes = checkboxes(preview);
    boxes[0].checked = true;
    boxes[1].checked = true;
    clickNext(preview);
    // Nu uppfyllt → vidare till resultatet.
    expect(preview.shadowRoot?.textContent).toContain("Klart");
  });
});
