import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";
// Some of these run the viewer as the editor does — `editor-view`, `proving` —
// and read the editor's words on the canvas. Those load with the editor's
// lookup, never with the viewer (entries.test.ts).
import "../../../editor/localization/editor-ui-strings";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

afterEach(() => {
  document.body.replaceChildren();
});

function mount(node: Record<string, unknown>, locale?: string): GuidePreview {
  const preview = document.createElement("guide-preview") as GuidePreview;
  document.body.append(preview);
  preview.graph = {
    startNodeId: "q",
    nodes: [
      { id: "q", position: { x: 0, y: 0 }, ...node },
      { id: "done", type: "result", position: { x: 0, y: 0 }, data: { title: "Done" } },
    ],
    connections: [
      { id: "c", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "done", portId: "input" } },
    ],
  } as GraphData;
  if (locale) preview.activeLocale = locale;
  return preview;
}

describe("guide-preview: field hints follow the display language", () => {
  test("a number in English, with the unit beside the field", () => {
    /*
     * The hint used to read "Enter a number in kr", so the label was doing two
     * jobs — naming the thing and stating its unit. The unit now stands after
     * the field, where the eye is while typing, and the hint says only what it
     * is for. Both halves are asserted: the sentence lost the unit and the field
     * gained it.
     */
    const preview = mount(
      { type: "number-question", data: { title: "Income", variableName: "v", unit: "kr" } },
      "en"
    );

    expect(preview.shadowRoot?.textContent).toContain("Enter a number");
    expect(preview.shadowRoot?.textContent).not.toContain("Enter a number in kr");
    expect(preview.shadowRoot?.querySelector(".guide-preview__unit")?.textContent).toBe("kr");
  });

  test("and the unit stays reachable for a screen reader", () => {
    /*
     * Moving it out of the label would otherwise take it away from anybody not
     * looking at the field — a worse field than the one this started from. So it
     * is described by, not hidden.
     */
    const preview = mount(
      { type: "number-question", data: { title: "Income", variableName: "v", unit: "kr" } },
      "en"
    );
    const field = preview.shadowRoot?.querySelector("[data-number-answer]");
    const describedBy = field?.getAttribute("aria-describedby");

    expect(describedBy, "fältet pekar inte ut enheten").toBeTruthy();

    // Flera id:n är hur aria-describedby fungerar — enheten ska vara ett av
    // dem, inte nödvändigtvis det enda (skrivformsnotisen pekas också ut).
    const descriptions = describedBy!
      .split(/\s+/)
      .map((id) => preview.shadowRoot?.getElementById(id)?.textContent);

    expect(descriptions, "beskrivningen är inte enheten").toContain("kr");
  });

  test("text in English (required)", () => {
    const preview = mount(
      { type: "text-question", data: { title: "Name", variableName: "v", required: true } },
      "en"
    );
    expect(preview.shadowRoot?.textContent).toContain("Write your answer");
    expect(preview.shadowRoot?.textContent).toContain("(required)");
  });

  test("single choice in English", () => {
    const preview = mount(
      {
        type: "question",
        data: {
          title: "Pick",
          variableName: "v",
          options: [{ id: "a", label: "A", value: "a" }],
        },
      },
      "en"
    );
    expect(preview.shadowRoot?.textContent).toContain("Select an option");
  });

  test("Swedish by default (no language set)", () => {
    const preview = mount({
      type: "number-question",
      data: { title: "Inkomst", variableName: "v", unit: "kr" },
    });
    expect(preview.shadowRoot?.textContent).toContain("Ange ett tal");
    expect(preview.shadowRoot?.querySelector(".guide-preview__unit")?.textContent).toBe("kr");
  });
});

describe("guide-preview: the route analysis omits the Continue heading", () => {
  test("the forward port shows only where it leads, not Continue", () => {
    const preview = document.createElement("guide-preview") as GuidePreview;
    preview.setAttribute("compact", "");
    document.body.append(preview);
    preview.graph = {
      startNodeId: "q",
      nodes: [
        { id: "q", type: "text-question", position: { x: 0, y: 0 }, data: { title: "Namn", variableName: "v" } },
        { id: "done", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart" } },
      ],
      connections: [
        { id: "c", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "done", portId: "input" } },
      ],
    } as GraphData;

    const text = preview.shadowRoot?.textContent ?? "";
    expect(text).toContain("Leder till: Klart");
    expect(text).not.toContain("Fortsätt");
  });
});

describe("guide-preview: a page and its inspector follow the display language", () => {
  const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  /*
   * Found on a tablet, on the English every-field page: the date question's
   * label read "När märkte du felet?" although the graph carries an English
   * title. The page renderer asked PageFieldsService for its fields without
   * passing the display language, so every label resolved to the source.
   */
  test("a page field's label is the translation, not the source", () => {
    const preview = document.createElement("guide-preview") as GuidePreview;

    document.body.append(preview);
    preview.graph = {
      startNodeId: "p",
      nodes: [
        { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Om felet", en: "About the fault" } } },
        {
          id: "d",
          type: "text-question",
          parentPageId: "p",
          order: 1,
          position: { x: 0, y: 0 },
          data: {
            title: { sv: "När märkte du felet?", en: "When did you notice the fault?" },
            variableName: "datum",
            placeholder: { sv: "För- och efternamn", en: "First and last name" },
          },
        },
      ],
      connections: [],
    } as GraphData;
    preview.activeLocale = "en";

    expect(preview.shadowRoot?.textContent).toContain("When did you notice the fault?");
    expect(preview.shadowRoot?.textContent).not.toContain("När märkte du felet?");

    // The placeholder rides the same resolution: bug 3 on the same tablet.
    expect(
      preview.shadowRoot?.querySelector<HTMLInputElement>("[data-page-variable]")?.placeholder,
    ).toBe("First and last name");
  });

  /*
   * Same tablet, same page: the variables panel said "Variabler" and "tomt" on
   * a page whose every other word was English. Chrome is never hardcoded —
   * the project's own rule, and these two had slipped past it.
   */
  test("the variables panel speaks the display language", async () => {
    const preview = mount(
      { type: "text-question", data: { title: "Anything", variableName: "v" } },
      "en"
    );

    await settle();
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();

    const summary = preview.shadowRoot!.querySelector("[data-variable-inspector] summary");

    expect(summary?.textContent).toContain("Variables");
    expect(preview.shadowRoot!.querySelector("[data-variable-inspector] dd em")?.textContent).toBe(
      "empty",
    );
  });
});
