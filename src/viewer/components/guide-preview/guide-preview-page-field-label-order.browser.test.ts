import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Title, unit, required marker — in that order.
 *
 * ## The failure this is written from
 *
 * The page field put the label together as title + required marker and then
 * appended the unit: *"Sökandens ålder (obligatoriskt) i år"*. The unit belongs
 * to the title — it says what to write — and the requirement comes last,
 * because it applies to the whole field. Measured in the page viewer on the
 * desktop and at 390 px.
 *
 * ## Why the accessible name as well
 *
 * The `<label for>` names the control, so the field's name *is* the label's
 * text. An assertion on the visible text alone would have slipped past the day
 * the two drifted apart. (The label wrapped the control until 6/9; it moved
 * out so the why could stand in the cell — see `page-field-why.browser.test.ts`.)
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function graph(): GraphData {
  return {
    startNodeId: "page",
    nodes: [
      { id: "page", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sidan", en: "The page" } } },
      {
        id: "age",
        type: "number-question",
        parentPageId: "page",
        order: 0,
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Sökandens ålder", en: "The applicant's age" },
          variableName: "applicantAge",
          unit: { sv: "år", en: "years" },
          required: true,
        },
      },
    ],
    connections: [],
    settings: { sourceLocale: "sv", locales: ["sv", "en"] },
  } as never;
}

async function labelOf(locale: "sv" | "en"): Promise<{ text: string; name: string }> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.style.cssText = "display: block; width: 600px;";
  preview.activeLocale = locale;
  document.body.append(preview);
  preview.graph = graph();

  await settle();
  await settle();

  const field = preview.shadowRoot?.querySelector<HTMLElement>(
    '[data-page-field-id="age"]',
  );
  if (!field) throw new Error("the page field is missing");

  const input = field.querySelector<HTMLInputElement>("input, textarea");
  if (!input) throw new Error("the control is missing");

  return {
    text: field.querySelector("label")?.textContent?.trim() ?? "",
    // The label points at the control: the name is the label's text.
    name: (input.labels?.[0]?.textContent ?? "").trim(),
  };
}

describe("ett sidfälts etikett", () => {
  test("sätter enheten före kravmarkören på svenska", async () => {
    const { text, name } = await labelOf("sv");

    expect(text).toBe("Sökandens ålder i år (obligatoriskt)");
    expect(name).toBe("Sökandens ålder i år (obligatoriskt)");
  });

  test("och på engelska", async () => {
    const { text } = await labelOf("en");

    expect(text).toBe("The applicant's age in years (required)");
  });
});
