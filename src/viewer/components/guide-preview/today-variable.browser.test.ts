import { afterEach, describe, expect, test } from "vitest";
import "../../node-types/default-node-types";
import "./guide-preview";
import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/*
 * Story 086: the host's day reaches the visitor. `today` on the element is
 * what `{{idag}}` prints, what `age` counts to, and what a bound of `idag`
 * means — one day, three readers.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const graph: GraphData = {
  startNodeId: "pnr",
  settings: { sourceLocale: "sv" },
  nodes: [
    { id: "pnr", type: "text-question", position: { x: 0, y: 0 },
      data: { title: { sv: "Personnummer" }, variableName: "pnr", format: "personnummer" } },
    { id: "calc", type: "calculation", position: { x: 100, y: 0 },
      data: { title: { sv: "Ålder" }, assignments: [{ id: "a", variableName: "alder", formula: "age(pnr)" }] } },
    { id: "r", type: "result", position: { x: 200, y: 0 },
      data: { title: { sv: "Du är {{alder}} år" }, description: { sv: "Räknat {{idag}}." } } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "pnr", portId: "continue" }, to: { nodeId: "calc", portId: "input" } },
    { id: "c2", from: { nodeId: "calc", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
  ],
} as never;

describe("idag hos besökaren (story 086)", () => {
  test("värdens dag räknar åldern och står i texten — men inte bland svaren", async () => {
    const preview = document.createElement("guide-preview") as GuidePreview;
    preview.setAttribute("today", "2030-09-03");
    document.body.append(preview);
    preview.graph = graph;
    await settle();
    const root = preview.shadowRoot!;

    const input = root.querySelector<HTMLInputElement>("input")!;
    input.value = "20120904-2389";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();

    const card = root.querySelector('[data-node-type="result"]')!;
    // 2012-09-04 → the day before the 18th birthday.
    expect(card.querySelector("h2")!.textContent!.trim()).toBe("Du är 17 år");
    expect(card.textContent).toContain("Räknat 2030-09-03.");
    // The format stores its canonical form — twelve digits, no dash.
    expect(preview.getAnswers()).toEqual({ pnr: "201209042389", alder: "17" });
  });
});
