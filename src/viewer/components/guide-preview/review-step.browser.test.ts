import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Granska och skicka (story 049): svaren samlade, med en väg tillbaka.
 *
 * Raderna GENERERAS ur motorns svarsposter — guiden vet vilka frågor
 * besökaren passerat och vad som svarats, så ingen bygger sammanfattningen
 * för hand. Ändra-länken tar besökaren tillbaka till sin fråga, och om
 * rättelsen inte ändrar vägen spelas resten av svaren upp automatiskt hem
 * till granskningen igen. Ändrar rättelsen vägen gäller nya vägen — ärligt.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 100) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Fråga (Ja/Nej) → textfråga → granska → resultat; Nej hoppar direkt till resultat. */
function reviewGraph(): GraphData {
  return {
    startNodeId: "q",
    settings: { sourceLocale: "sv" },
    nodes: [
      {
        id: "q",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Bor du i kommunen?" },
          variableName: "bor",
          options: [
            { id: "o-ja", label: { sv: "Ja" }, value: "ja" },
            { id: "o-nej", label: { sv: "Nej" }, value: "nej" },
          ],
        },
      },
      {
        id: "t",
        type: "text-question",
        position: { x: 200, y: 0 },
        data: { title: { sv: "Vilken adress?" }, variableName: "adress" },
      },
      { id: "granska", type: "review", position: { x: 400, y: 0 }, data: { title: { sv: "Granska dina svar" } } },
      { id: "r", type: "result", position: { x: 600, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q", portId: "o-ja" }, to: { nodeId: "t", portId: "input" } },
      { id: "c2", from: { nodeId: "q", portId: "o-nej" }, to: { nodeId: "r", portId: "input" } },
      { id: "c3", from: { nodeId: "t", portId: "continue" }, to: { nodeId: "granska", portId: "input" } },
      { id: "c4", from: { nodeId: "granska", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as never;
}

async function walkToReview(): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  document.body.append(preview);
  preview.graph = reviewGraph();
  await settle();

  const root = preview.shadowRoot!;
  root.querySelector<HTMLInputElement>('input[value="o-ja"]')!.click();
  root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
  await settle();

  const text = root.querySelector<HTMLInputElement>("[data-text-answer]")!;
  text.value = "Parkgatan 12";
  root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
  await settle();

  return preview;
}

describe("granskningssteget", () => {
  test("raderna genereras ur svaren längs besökarens väg", async () => {
    const preview = await walkToReview();
    const card = preview.shadowRoot!.querySelector('[data-node-type="review"]')!;
    const rows = card.querySelectorAll("[data-review-row]");

    expect(rows.length).toBe(2);
    expect(rows[0]!.textContent).toContain("Bor du i kommunen?");
    // Alternativets ETIKETT, aldrig värdet.
    expect(rows[0]!.textContent).toContain("Ja");
    expect(rows[0]!.textContent).not.toContain("o-ja");
    expect(rows[1]!.textContent).toContain("Parkgatan 12");
  });

  test("datadeklarationen kan stängas av av värden, som variabelpanelen", async () => {
    // A page where a real person registers interest is not a demonstration of
    // the tool: the list of four headings under her own answers reads as one.
    // Johan's call 16/9 for the interest page; the property is the host's,
    // default on, so every other guide is untouched.
    const preview = await walkToReview();
    expect(preview.reviewDeclarationEnabled).toBe(true);

    preview.reviewDeclarationEnabled = false;
    await settle();
    expect(preview.shadowRoot!.querySelector("[data-review-declaration]")).toBeNull();
    // The rows and the way back are still there — only the declaration went.
    expect(preview.shadowRoot!.querySelectorAll("[data-review-row]").length).toBe(2);

    preview.reviewDeclarationEnabled = true;
    await settle();
    expect(preview.shadowRoot!.querySelector("[data-review-declaration]")).not.toBeNull();
  });

  test("datadeklarationen listar det som samlats in", async () => {
    const preview = await walkToReview();
    const declaration = preview.shadowRoot!.querySelector("[data-review-declaration]")!;

    expect(declaration.textContent).toContain("Det här byggde beskedet på");
    expect(declaration.textContent).toContain("Bor du i kommunen?");
    expect(declaration.textContent).toContain("Vilken adress?");
  });

  test("Ändra går tillbaka, och samma svar spelar hem till granskningen igen", async () => {
    const preview = await walkToReview();
    const root = preview.shadowRoot!;

    root.querySelectorAll<HTMLButtonElement>("[data-review-edit]")[0]!.click();
    await settle();

    // Tillbaka på frågan.
    expect(root.querySelector('[data-node-type="question"]')).toBeTruthy();

    // Samma svar igen → textfrågan är redan besvarad och hoppas över.
    root.querySelector<HTMLInputElement>('input[value="o-ja"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle(200);

    const card = root.querySelector('[data-node-type="review"]');
    expect(card).toBeTruthy();
    expect(card!.textContent).toContain("Parkgatan 12");
  });

  test("ett svar som ändrar vägen ger nya vägen — ingen bluffad återkomst", async () => {
    const preview = await walkToReview();
    const root = preview.shadowRoot!;

    root.querySelectorAll<HTMLButtonElement>("[data-review-edit]")[0]!.click();
    await settle();

    root.querySelector<HTMLInputElement>('input[value="o-nej"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle(200);

    // Nej-vägen går direkt till resultatet — granskningen ligger inte på den.
    expect(root.querySelector('[data-node-type="review"]')).toBeNull();
    expect(root.textContent).toContain("Tack");
    // Och adressen från Ja-vägen följer inte med: det värden får är vägen som
    // gåtts, inte allt som skrivits (6/9 2026, Johan: "behöver historiken tas
    // bort för den delen").
    expect(preview.getAnswers()).toEqual({ bor: "nej" });
  });
});
