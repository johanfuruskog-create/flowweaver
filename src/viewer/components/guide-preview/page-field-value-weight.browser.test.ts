import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * What the visitor wrote is read, not a label: 400 (`--fw-weight-text`), the
 * label above it 600 (`--fw-weight-strong`). Measured 30/9 (GRAFISK-PROFIL,
 * *Hierarkin — roller*): the value stood in 600 — *Kim Andersson* in bold —
 * because the field's cell carried the label's weight and the input
 * inherited it through `font: inherit`.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 100) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const graph: GraphData = {
  startNodeId: "p",
  settings: { sourceLocale: "sv" },
  nodes: [
    { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Om dig" } } },
    {
      id: "name", type: "text-question", parentPageId: "p", order: 0, position: { x: 0, y: 0 },
      data: { title: { sv: "Ditt namn" }, variableName: "namn" },
    },
    {
      id: "days", type: "question", parentPageId: "p", order: 1, position: { x: 0, y: 0 },
      data: {
        title: { sv: "Hur många dagar?" }, variableName: "dagar",
        options: [{ id: "a", label: { sv: "En dag" }, value: "1" }, { id: "b", label: { sv: "Två dagar" }, value: "2" }],
      },
    },
    { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
  ],
  connections: [{ id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "r", portId: "input" } }],
} as never;

const weight = (el: Element) => getComputedStyle(el).fontWeight;

describe("vikten i en sidas fält", () => {
  test("det ifyllda värdet är 400, etiketten 600", async () => {
    const preview = document.createElement("guide-preview") as GuidePreview;
    preview.style.cssText = "display: block; width: 900px;";
    document.body.append(preview);
    preview.graph = graph;
    await settle();

    const root = preview.shadowRoot!;
    const input = root.querySelector<HTMLInputElement>('[data-page-field-id="name"] input')!;
    input.value = "Kim Andersson";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(weight(input)).toBe("400");
    expect(weight(root.querySelector('[data-page-field-id="name"] > label')!)).toBe("600");
    // The question's heading on the same page keeps its label weight too.
    expect(weight(root.querySelector('[data-page-field-id="days"] > legend')!)).toBe("600");
  });
});
