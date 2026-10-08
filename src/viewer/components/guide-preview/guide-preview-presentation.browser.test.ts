import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

afterEach(() => {
  document.body.replaceChildren();
});

function mount(value: GraphData): GuidePreview {
  const preview = document.createElement("guide-preview") as GuidePreview;
  document.body.append(preview);
  preview.graph = value;
  return preview;
}

function clickNext(preview: GuidePreview): void {
  preview.shadowRoot
    ?.querySelector<HTMLButtonElement>('[data-action="next"]')
    ?.click();
}

describe("guide-preview: presentation styles for choice", () => {
  test("single choice as a dropdown: picks and branches", () => {
    const preview = mount({
      startNodeId: "q",
      nodes: [
        {
          id: "q",
          type: "question",
          position: { x: 0, y: 0 },
          data: {
            title: "Välj",
            variableName: "v",
            presentation: "select",
            options: [
              { id: "a", label: "A", value: "a" },
              { id: "b", label: "B", value: "b" },
            ],
          },
        },
        { id: "ra", type: "result", position: { x: 0, y: 0 }, data: { title: "Blev A" } },
        { id: "rb", type: "result", position: { x: 0, y: 0 }, data: { title: "Blev B" } },
      ],
      connections: [
        { id: "c1", from: { nodeId: "q", portId: "a" }, to: { nodeId: "ra", portId: "input" } },
        { id: "c2", from: { nodeId: "q", portId: "b" }, to: { nodeId: "rb", portId: "input" } },
      ],
    });

    const select = preview.shadowRoot?.querySelector<HTMLSelectElement>(
      "[data-choice-single]"
    );
    expect(select).not.toBeNull();
    select!.value = "b";
    select!.dispatchEvent(new Event("change", { bubbles: true }));
    clickNext(preview);
    expect(preview.shadowRoot?.textContent).toContain("Blev B");
  });

  test("multi choice as a pillbox: picks several and moves on", () => {
    const preview = mount({
      startNodeId: "q",
      nodes: [
        {
          id: "q",
          type: "multi-choice",
          position: { x: 0, y: 0 },
          data: {
            title: "Välj flera",
            variableName: "v",
            presentation: "multiselect",
            minSelected: 2,
            options: [
              { id: "a", label: "A", value: "a" },
              { id: "b", label: "B", value: "b" },
              { id: "c", label: "C", value: "c" },
            ],
          },
        },
        { id: "done", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart" } },
      ],
      connections: [
        { id: "c1", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "done", portId: "input" } },
      ],
    });

    /*
     * Två klick, inte ctrl-klick. Kontrollen var en `<select multiple>` fram
     * till story 057; gesten fanns inte på en pekskärm, och ett vanligt klick
     * nollställde det man redan valt.
     */
    // Kontrollen bor i `chip-picker`, delad med regelvillkorets värdefält.
    const picker = preview.shadowRoot!.querySelector("[data-choice-picker]")!.shadowRoot!;

    // Alternativen visas när kontrollen används.
    picker.querySelector<HTMLElement>(".chip-picker__box")!
      .dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));

    for (const value of ["a", "b"]) {
      picker.querySelector<HTMLButtonElement>(`[data-add][data-value="${value}"]`)?.click();
    }
    expect(picker.querySelectorAll("[data-chosen]").length, "två etiketter efter två klick").toBe(2);
    clickNext(preview);
    expect(preview.shadowRoot?.textContent).toContain("Klart");
  });

  test("CSS classes are applied to single- and multi-choice cards", () => {
    const single = mount({
      startNodeId: "q",
      nodes: [
        {
          id: "q",
          type: "question",
          position: { x: 0, y: 0 },
          data: {
            title: "Välj",
            variableName: "v",
            cssClasses: "featured  wide",
            options: [{ id: "a", label: "A", value: "a" }],
          },
        },
      ],
      connections: [],
    });
    const singleCard = single.shadowRoot?.querySelector(".guide-preview__card");
    expect(singleCard?.classList.contains("featured")).toBe(true);
    expect(singleCard?.classList.contains("wide")).toBe(true);

    const multi = mount({
      startNodeId: "q",
      nodes: [
        {
          id: "q",
          type: "multi-choice",
          position: { x: 0, y: 0 },
          data: {
            title: "Välj flera",
            variableName: "v",
            cssClasses: "boxed",
            options: [{ id: "a", label: "A", value: "a" }],
          },
        },
      ],
      connections: [],
    });
    expect(
      multi.shadowRoot?.querySelector(".guide-preview__card")?.classList.contains("boxed")
    ).toBe(true);
  });
});
