import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Astra 1/10 (bilaga 10, punkt 16): *"Även bredare lägen måste tåla lång
 * text utan klippning."* A scale of long words on a desk-wide host: every
 * word is whole inside its own segment, never cut off and never spilling
 * into the neighbour's. (The stacked list under 480 px is an open question —
 * it collides with story 115, criteria 2 and 8 — and is not built.)
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 150));

const LONG = [
  "Mycket otillfredsställande",
  "Ganska otillfredsställande",
  "Ganska tillfredsställande",
  "Synnerligen tillfredsställande",
];

async function mount(width: number): Promise<ShadowRoot> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.style.cssText = `display:block;width:${width}px;`;
  document.body.append(preview);
  preview.graph = {
    startNodeId: "r",
    nodes: [{
      id: "r", type: "rating-question", position: { x: 0, y: 0 },
      data: { title: { sv: "Hur nöjd är du?" }, variableName: "nojd", steps: 4, labels: LONG.map((sv) => ({ sv })) },
    }],
    connections: [],
  } as unknown as GraphData;
  await settle();
  return preview.shadowRoot!;
}

describe("betygsskalan med långa ord", () => {
  test.each([900, 640, 520])("klipps inte på %i px", async (width) => {
    const root = await mount(width);
    const marks = [...root.querySelectorAll<HTMLElement>(".guide-preview__rating-mark")];

    expect(marks.map((mark) => mark.querySelector(".guide-preview__rating-word")?.textContent?.trim())).toEqual(LONG);
    for (const mark of marks) {
      const word = mark.querySelector<HTMLElement>(".guide-preview__rating-word")!;
      const box = mark.getBoundingClientRect();
      const text = word.getBoundingClientRect();
      expect(word.scrollWidth, `${word.textContent} klipps`).toBeLessThanOrEqual(word.clientWidth + 1);
      expect(text.left, `${word.textContent} går ut till vänster`).toBeGreaterThanOrEqual(box.left - 0.5);
      expect(text.right, `${word.textContent} går ut till höger`).toBeLessThanOrEqual(box.right + 0.5);
    }
  });
});
