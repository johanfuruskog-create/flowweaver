import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * *Föregående* is not drawn where there is nowhere to go back to, and *Nästa*
 * keeps its place at the end of the row (Astra 1/10, bilaga 10 punkt 10).
 * It stood disabled on every first step, 2.46 : 1 (genomgången 30/9, V15).
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 120));

const graph = {
  startNodeId: "a",
  nodes: [
    { id: "a", type: "text-question", position: { x: 0, y: 0 }, data: { title: { sv: "Vad heter du?" }, variableName: "namn" } },
    { id: "b", type: "text-question", position: { x: 400, y: 0 }, data: { title: { sv: "Var bor du?" }, variableName: "ort" } },
  ],
  connections: [{ id: "c", from: { nodeId: "a", portId: "continue" }, to: { nodeId: "b", portId: "input" } }],
};

async function mount(): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.style.cssText = "display:block;width:640px;";
  document.body.append(preview);
  preview.graph = graph as unknown as GraphData;
  await settle();
  return preview;
}

const place = (preview: GuidePreview) => {
  const root = preview.shadowRoot!;
  const row = root.querySelector(".guide-preview__navigation")!.getBoundingClientRect();
  const next = root.querySelector('[data-action="next"]')!.getBoundingClientRect();
  return { previous: root.querySelector('[data-action="previous"]') !== null, atEnd: Math.abs(row.right - next.right) < 1 };
};

describe("Föregående på första steget", () => {
  test("finns inte, och Nästa står kvar längst till höger", async () => {
    const preview = await mount();

    expect(place(preview)).toEqual({ previous: false, atEnd: true });
  });

  test("kommer tillbaka på andra steget, och Nästa står på samma plats", async () => {
    const preview = await mount();
    preview.shadowRoot!.querySelector<HTMLInputElement>("input[data-text-answer]")!.value = "Kim";
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();

    expect(preview.shadowRoot!.querySelector("h2")!.textContent).toContain("Var bor du?");
    expect(place(preview)).toEqual({ previous: true, atEnd: true });
  });
});
