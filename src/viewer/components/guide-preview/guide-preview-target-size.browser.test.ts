import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";
import { targetSizeViolations } from "../../../testing/target-size";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * K6: what the visitor points at is at least 44 × 44 px to hit.
 *
 * Built with the slider (story 095), because that is where the promise was
 * made: "för mobil måste man ha extra stora ytor att dra i". The floor lived
 * as `min-height: 44px` in five places and nothing measured it; this does,
 * over the controls a page can carry — fields, slider, − / + buttons, radio
 * buttons, checkbox and the navigation — at a phone's width and at a desk's.
 *
 * Measured, not assumed: the last test shrinks a button through a style of
 * its own and expects the gate to say so. A gate that has never been seen to
 * fail may be measuring nothing.
 */

const K6 = 44;

const graph: GraphData = {
  startNodeId: "loan",
  settings: { sourceLocale: "sv" },
  nodes: [
    { id: "loan", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Låna" } } },
    {
      id: "amount", type: "number-question", parentPageId: "loan", order: 0, position: { x: 0, y: 0 },
      data: { title: { sv: "Lånesumma" }, variableName: "lan", min: 10000, max: 800000, step: 5000, unit: { sv: "kr" }, presentation: "range" },
    },
    {
      id: "years", type: "number-question", parentPageId: "loan", order: 1, position: { x: 0, y: 0 },
      data: { title: { sv: "Lånetid" }, variableName: "ar", min: 1, max: 15, step: 1, unit: { sv: "år" }, presentation: "stepper" },
    },
    {
      id: "gather", type: "question", parentPageId: "loan", order: 2, position: { x: 0, y: 0 },
      data: {
        title: { sv: "Vill du samla lån?" }, variableName: "samla",
        options: [{ id: "y", label: { sv: "Ja" }, value: "ja" }, { id: "n", label: { sv: "Nej" }, value: "nej" }],
      },
    },
    {
      id: "ok", type: "consent-question", parentPageId: "loan", order: 3, position: { x: 0, y: 0 },
      data: { title: { sv: "Jag har läst villkoren" }, variableName: "ok" },
    },
    { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
  ],
  connections: [
    { id: "c", from: { nodeId: "loan", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
  ],
} as never;

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount(width: number): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.style.cssText = `display: block; width: ${width}px;`;
  document.body.append(preview);
  preview.graph = graph;
  await settle();
  return preview;
}

describe("K6 — 44 × 44 px att träffa i visaren", () => {
  test.each([320, 390, 1024])("på %i px bredd", async (width) => {
    const preview = await mount(width);
    const controls = preview.shadowRoot!.querySelectorAll("input, button");

    // The page must actually carry the controls we mean to measure.
    expect(preview.shadowRoot!.querySelector('input[type="range"]')).not.toBeNull();
    expect(preview.shadowRoot!.querySelectorAll("button[data-step-for]").length).toBe(2);
    expect(controls.length).toBeGreaterThan(6);

    expect(targetSizeViolations(preview.shadowRoot!, K6)).toEqual([]);
  });

  test("grinden ser en krympt knapp", async () => {
    const preview = await mount(390);
    const shrink = document.createElement("style");
    // `!important`: the component's own sheet is adopted and cascades after a `<style>` appended here.
    shrink.textContent = ".guide-preview__step-button { width: 30px !important; height: 30px !important; }";
    preview.shadowRoot!.append(shrink);

    const violations = targetSizeViolations(preview.shadowRoot!, K6);

    expect(violations).toHaveLength(2);
    expect(violations[0]).toContain("30×30");
  });
});
