import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Story 070 — händelser ur visaren. Värden vill mäta tratten — var
 * besökare börjar, vänder och faller ifrån — utan att skrapa DOM:en.
 * EN händelse, guide-progress, med kind och stegfakta; aldrig svar.
 * Editorns speglar (editor-view/proving) är tysta — tratten är
 * publicerade värdars, inte redaktörens klickande.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 250) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const graf = {
  version: 8,
  startNodeId: "q",
  nodes: [
    { id: "q", type: "text-question", position: { x: 0, y: 0 }, data: { title: { sv: "Vad hände?" }, variableName: "svar", required: true } },
    { id: "slut", type: "result", position: { x: 500, y: 0 }, data: { title: { sv: "Tack" } } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "slut", portId: "input" } },
  ],
};

function mounted(attrs: Record<string, string> = {}): {
  gp: GuidePreview;
  events: Array<{ kind: string; nodeId?: string; nodeType?: string }>;
} {
  const gp = document.createElement("guide-preview") as GuidePreview;
  const events: Array<{ kind: string; nodeId?: string }> = [];

  gp.addEventListener("guide-progress", ((event: CustomEvent) => {
    events.push(event.detail);
  }) as EventListener);
  for (const [name, value] of Object.entries(attrs)) gp.setAttribute(name, value);
  gp.style.cssText = "display: block; width: 600px;";
  document.body.append(gp);
  gp.graph = structuredClone(graf) as unknown as GraphData;
  return { gp, events };
}

const skriv = (gp: GuidePreview, text: string) => {
  const input = gp.shadowRoot!.querySelector<HTMLInputElement>("[data-text-answer]")!;

  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

const nasta = (gp: GuidePreview) =>
  [...gp.shadowRoot!.querySelectorAll<HTMLButtonElement>("button")]
    .find((button) => button.dataset.action === "next")!
    .click();

describe("guide-progress", () => {
  test("start, next, result — och back på vägen tillbaka", async () => {
    const { gp, events } = mounted();
    await settle();

    expect(events.map((e) => e.kind)).toEqual(["start"]);
    expect(events[0]).not.toHaveProperty("answers");

    skriv(gp, "Lampan");
    nasta(gp);
    await settle();

    expect(events.map((e) => e.kind)).toEqual(["start", "next", "result"]);
    expect(events[2]!.nodeId).toBe("slut");

    [...gp.shadowRoot!.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.dataset.action === "previous")!
      .click();
    await settle();

    expect(events.map((e) => e.kind)).toEqual(["start", "next", "result", "back"]);
  });

  test("valideringsstopp berättas med fältets nod, aldrig svaret", async () => {
    const { gp, events } = mounted();
    await settle();

    nasta(gp);
    await settle();

    const stopp = events.find((e) => e.kind === "validation-stopped");

    expect(stopp, "stoppet finns").toBeTruthy();
    expect(stopp!.nodeId).toBe("q");
    expect(JSON.stringify(stopp)).not.toContain("Lampan");
  });

  test("editorns speglar är tysta", async () => {
    const { events } = mounted({ "editor-view": "" });
    await settle();

    expect(events).toEqual([]);
  });
});
