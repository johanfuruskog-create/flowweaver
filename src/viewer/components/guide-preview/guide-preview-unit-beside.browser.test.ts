import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";

/**
 * The unit stands beside the number, on the same line.
 *
 * ## What broke it
 *
 * The rule that laid this out selected `input[type="number"]` — and the amount
 * field became text the day it started grouping while typed. Nothing matched
 * any more, the field took the full width from the general rule, and `kr/mån`
 * fell onto the line below. Measured: field 29–571 px, unit at y=191 while the
 * field sat at y=136.
 *
 * The lesson is the same one the page-field borders taught this afternoon: a
 * selector written against how something *happens to be spelled* fails silently
 * when the spelling changes. This one asks for `[data-number-answer]` — what
 * the field is.
 *
 * ## Why not simply "to the right"
 *
 * A field that grows puts the digits at the left edge and `kr/mån` at the far
 * right, with a hand's width of nothing between them. Johan asked for the unit
 * beside the field, so the field stops growing at 16ch — wide enough for a
 * grouped `2 100 000` — and the unit follows it.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function numberStep(): Promise<{ input: DOMRect; unit: DOMRect; width: number }> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.style.cssText = "display: block; width: 600px;";
  document.body.append(preview);
  preview.graph = {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "number-question",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Boendekostnad" }, variableName: "v", unit: { sv: "kr/mån" } },
      },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  const root = preview.shadowRoot!;
  const field = root.querySelector<HTMLElement>("[data-number-answer]")!;
  const unit = root.querySelector<HTMLElement>(".guide-preview__unit")!;

  return {
    input: field.getBoundingClientRect(),
    unit: unit.getBoundingClientRect(),
    width: root.querySelector<HTMLElement>(".guide-preview__card")!.clientWidth,
  };
}

describe("enheten vid ett sifferfält", () => {
  test("står på samma rad som fältet", async () => {
    const { input, unit } = await numberStep();

    // Samma rad, mätt som överlappande höjd — inte som samma `top`, eftersom
    // texten centreras mot ett högre fält.
    expect(unit.top).toBeLessThan(input.bottom);
    expect(unit.bottom).toBeGreaterThan(input.top);
  });

  test("och till höger om det", async () => {
    const { input, unit } = await numberStep();

    expect(unit.left).toBeGreaterThanOrEqual(input.right);
  });

  test("intill talet, inte vid kortets kant", async () => {
    /*
     * Det som skiljer "till höger om fältet" från "snyggt". Ett fält som växer
     * uppfyller det förra och ser ut som det senare inte gör.
     */
    const { input, unit, width } = await numberStep();

    expect(unit.left - input.right, "gapet mellan tal och enhet").toBeLessThan(24);
    expect(input.width, "fältet tog hela raden").toBeLessThan(width * 0.75);
  });
});
