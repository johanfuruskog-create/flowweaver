import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Story 069 — Nästa svarar alltid (Johans beslut 2/9). En död knapp
 * förklarar sig inte; sidfältens mönster — aktiv knapp, beskedet vid
 * klick — gäller nu varje frågetyp.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mounted(node: Record<string, unknown>): Promise<ShadowRoot> {
  const gp = document.createElement("guide-preview") as GuidePreview;

  gp.style.cssText = "display: block; width: 600px;";
  document.body.append(gp);
  gp.graph = {
    version: 8,
    startNodeId: "q",
    nodes: [
      { id: "q", position: { x: 0, y: 0 }, ...node },
      { id: "slut", type: "result", position: { x: 500, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: node.type === "question"
      ? [{ id: "c1", from: { nodeId: "q", portId: "val-a" }, to: { nodeId: "slut", portId: "input" } }]
      : [{ id: "c1", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "slut", portId: "input" } }],
  } as unknown as GraphData;
  await settle();
  return gp.shadowRoot!;
}

const nasta = (root: ShadowRoot) =>
  [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.dataset.action === "next",
  )!;

describe("Nästa svarar alltid", () => {
  test("obligatoriskt textfält: aktiv knapp, beskedet vid klick", async () => {
    const root = await mounted({
      type: "text-question",
      data: { title: { sv: "Vad hände?" }, variableName: "svar", required: true },
    });

    expect(nasta(root).disabled, "aldrig död").toBe(false);

    nasta(root).click();
    await settle();

    expect(root.querySelectorAll("[aria-invalid='true']").length).toBeGreaterThan(0);
    expect(root.textContent).toContain("obligatoriskt");
    // Rubriken står kvar — vi gick ingenstans.
    expect(root.querySelector("h2")?.textContent).toContain("Vad hände?");
  });

  test("envalsfråga utan val: aktiv knapp, beskedet vid klick", async () => {
    const root = await mounted({
      type: "question",
      data: {
        title: { sv: "Vilket?" },
        variableName: "val",
        presentation: "radio",
        options: [
          { id: "val-a", label: { sv: "A" }, value: "a" },
          { id: "val-b", label: { sv: "B" }, value: "b" },
        ],
      },
    });

    expect(nasta(root).disabled, "aldrig död").toBe(false);

    nasta(root).click();
    await settle();

    // Beskedet syns, och vi gick ingenstans.
    expect(root.querySelector("h2")?.textContent).toContain("Vilket?");
    expect(
      root.querySelector(".guide-preview__error, [role='alert']")?.textContent?.trim() || "",
      "ett besked",
    ).not.toBe("");

    // Val + Nästa går vidare — och radion hoppar aldrig själv.
    root.querySelector<HTMLInputElement>("input[type='radio']")!.click();
    await settle();
    expect(root.querySelector("h2")?.textContent).toContain("Vilket?");
    nasta(root).click();
    await settle();
    expect(root.querySelector("h2")?.textContent).toContain("Klart");
  });
});
