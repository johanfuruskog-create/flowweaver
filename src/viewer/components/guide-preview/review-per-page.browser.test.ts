import { afterEach, describe, expect, test } from "vitest";
import "../../node-types/default-node-types";
import "./guide-preview";
import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/*
 * Story 089: granskningen visar sidan, inte fälten.
 *
 * Före 089 gav en sida med tre fält tre rader med tre Ändra, alla till samma
 * sida — och sidans rubrik syntes inte. Här: en fristående fråga (rad + Ändra
 * som förut), en vanlig sida med två fält (grupp med sidans rubrik och EN
 * Ändra), en upprepad sida (grupp; sedan 1/10 en underrubrik per barn med
 * frågorna på var sin rad — Astra, bilaga 10 punkt 18, Johans ja samma dag,
 * kriterium 3 omskrivet).
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function graph(): GraphData {
  return {
    startNodeId: "q",
    settings: { sourceLocale: "sv" },
    nodes: [
      { id: "q", type: "question", position: { x: 0, y: 0 },
        data: { title: { sv: "Bor du i kommunen?" }, variableName: "bor",
          options: [{ id: "o-ja", label: { sv: "Ja" }, value: "ja" }, { id: "o-nej", label: { sv: "Nej" }, value: "nej" }] } },
      { id: "omdig", type: "page", position: { x: 100, y: 0 }, data: { title: { sv: "Om dig" } } },
      { id: "namn", type: "text-question", parentPageId: "omdig", order: 1, position: { x: 0, y: 0 },
        data: { title: { sv: "Namn" }, variableName: "namn" } },
      { id: "epost", type: "text-question", parentPageId: "omdig", order: 2, position: { x: 0, y: 0 },
        data: { title: { sv: "E-post" }, variableName: "epost" } },
      { id: "barn", type: "page", position: { x: 200, y: 0 },
        data: { title: { sv: "Dina barn" }, repeats: true, repeatWord: { sv: "barn" }, repeatVariable: "barn" } },
      { id: "bnamn", type: "text-question", parentPageId: "barn", order: 1, position: { x: 0, y: 0 },
        data: { title: { sv: "Namn" }, variableName: "namn", required: true } },
      { id: "skola", type: "question", parentPageId: "barn", order: 2, position: { x: 0, y: 0 },
        data: { title: { sv: "Går i skolan" }, variableName: "skola",
          options: [{ id: "ja", label: "Ja", value: "ja" }, { id: "nej", label: "Nej", value: "nej" }] } },
      { id: "granska", type: "review", position: { x: 300, y: 0 }, data: { title: { sv: "Granska" } } },
      { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q", portId: "o-ja" }, to: { nodeId: "omdig", portId: "input" } },
      { id: "c2", from: { nodeId: "omdig", portId: "continue" }, to: { nodeId: "barn", portId: "input" } },
      { id: "c3", from: { nodeId: "barn", portId: "continue" }, to: { nodeId: "granska", portId: "input" } },
      { id: "c4", from: { nodeId: "granska", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as never;
}

const next = (root: ShadowRoot) => root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
const field = (root: ShadowRoot, key: string) => root.querySelector<HTMLInputElement>(`[data-page-field-id="${key}"] input`)!;

async function walkToReview(): Promise<ShadowRoot> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  document.body.append(preview);
  preview.graph = graph();
  await settle();
  const root = preview.shadowRoot!;

  root.querySelector<HTMLInputElement>('input[value="o-ja"]')!.click();
  next(root);
  await settle();

  field(root, "namn").value = "Anna";
  field(root, "epost").value = "anna@example.com";
  next(root);
  await settle();

  root.querySelector<HTMLButtonElement>('[data-action="repeat-add"]')!.click();
  await settle();
  field(root, "bnamn#0").value = "Alva";
  root.querySelector<HTMLInputElement>('[data-page-field-id="skola#0"] input[value="ja"]')!.click();
  field(root, "bnamn#1").value = "Nils";
  root.querySelector<HTMLInputElement>('[data-page-field-id="skola#1"] input[value="nej"]')!.click();
  next(root);
  await settle();

  expect(root.querySelector('[data-node-type="review"]')).toBeTruthy();
  return root;
}

const rowsOf = (scope: ParentNode) =>
  [...scope.querySelectorAll("[data-review-row]")].map(
    (row) => `${row.querySelector("dt")!.textContent?.trim()}: ${row.querySelector("dd")!.textContent?.trim()}`,
  );

describe("granskningen per sida (story 089)", () => {
  test("en sida är en grupp med sidans rubrik och en Ändra; en fråga är en rad", async () => {
    const root = await walkToReview();
    const groups = [...root.querySelectorAll("[data-review-group]")];

    expect(groups.map((g) => g.querySelector("h3")!.textContent?.trim())).toEqual(["Om dig", "Dina barn"]);
    expect(rowsOf(groups[0]!)).toEqual(["Namn: Anna", "E-post: anna@example.com"]);
    // En upprepning: *Barn 1*, *Barn 2* som rubriker, varje fråga med sitt svar
    // på en egen rad — inte postens fält ihopskrivna med kolon efter frågan.
    const records = [...groups[1]!.querySelectorAll("[data-review-record]")];
    expect(records.map((r) => r.querySelector("h4")!.textContent?.trim())).toEqual(["Barn 1", "Barn 2"]);
    expect(records.map((r) => rowsOf(r))).toEqual([
      ["Namn: Alva", "Går i skolan: Ja"],
      ["Namn: Nils", "Går i skolan: Nej"],
    ]);
    expect(groups[1]!.textContent, "inget kolon inne i ett svar").not.toMatch(/Namn: Alva,/);

    // Den fristående frågan står kvar som rad utanför grupperna.
    const loose = [...root.querySelectorAll("[data-review-row]")].filter((row) => !row.closest("[data-review-group]"));
    expect(rowsOf({ querySelectorAll: () => loose } as never)).toEqual(["Bor du i kommunen?: Ja"]);

    // Tre Ändra: en för frågan, en per sida — inte en per fält.
    const edits = [...root.querySelectorAll<HTMLButtonElement>("[data-review-edit]")];
    expect(edits.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Ändra svaret på Bor du i kommunen?",
      "Ändra svaren på Om dig",
      "Ändra svaren på Dina barn",
    ]);
    expect(groups[1]!.querySelector("[data-review-edit]")).toBe(edits[2]);
  });

  test("K6: varje Ändra är minst 44 px hög att träffa", async () => {
    // Measured 30/9 (GRAFISK-PROFIL, avvikelse 11): the link-dressed button
    // was 27 px tall — text plus 4 px padding — on the visitor's surface.
    const root = await walkToReview();
    const heights = [...root.querySelectorAll<HTMLButtonElement>("[data-review-edit]")].map(
      (b) => Math.round(b.getBoundingClientRect().height),
    );

    expect(heights).toHaveLength(3);
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
  });

  test("deklarationen listar sidorna, inte fälten", async () => {
    const root = await walkToReview();
    const listed = [...root.querySelectorAll("[data-review-declaration] li")].map((li) => li.textContent?.trim());

    expect(listed).toEqual(["Bor du i kommunen?", "Om dig", "Dina barn"]);
  });

  test("sidans Ändra leder till sidan, ifylld", async () => {
    const root = await walkToReview();

    root.querySelectorAll<HTMLButtonElement>("[data-review-edit]")[2]!.click();
    await settle();

    expect(root.querySelector("h2, h1")!.textContent).toContain("Dina barn");
    expect(field(root, "bnamn#0").value).toBe("Alva");
    expect(field(root, "bnamn#1").value).toBe("Nils");
  });
});
