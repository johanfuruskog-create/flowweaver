import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Story 095: a calculation in a page and a Text that shows its result while
 * the visitor types. Measured in the shadow tree, per keystroke — the text
 * has to change without Nästa, and an empty field must never print `NaN`.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const graph: GraphData = {
  startNodeId: "loan",
  settings: { sourceLocale: "sv" },
  nodes: [
    { id: "loan", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Låna" } } },
    {
      id: "amount", type: "number-question", parentPageId: "loan", order: 0, position: { x: 0, y: 0 },
      data: { title: { sv: "Lånesumma" }, variableName: "lan", min: 10000, max: 800000, step: 5000, required: true },
    },
    {
      id: "years", type: "number-question", parentPageId: "loan", order: 1, position: { x: 0, y: 0 },
      data: { title: { sv: "Lånetid" }, variableName: "ar", min: 1, max: 15, required: true },
    },
    {
      id: "calc", type: "calculation", parentPageId: "loan", order: 2, position: { x: 0, y: 0 },
      data: {
        title: { sv: "Månadskostnad" },
        assignments: [
          { id: "a1", variableName: "r", formula: "0,06 / 12" },
          { id: "a2", variableName: "kostnad", formula: "round(lan * r / (1 - pow(1 + r; -ar * 12)))" },
        ],
      },
    },
    {
      id: "text", type: "page-heading", parentPageId: "loan", order: 3, position: { x: 0, y: 0 },
      data: { title: { sv: "" }, description: { sv: "Ungefär **{{kostnad}} kr/mån**." } },
    },
    {
      id: "warn", type: "page-heading", parentPageId: "loan", order: 4, position: { x: 0, y: 0 },
      data: { title: { sv: "Dyrt" }, description: { sv: "Det är mycket." } },
      visibility: { match: "all", conditions: [{ id: "c", variableName: "kostnad", operator: "greater-than", value: "3000" }] },
    },
    { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" }, description: { sv: "{{kostnad}} kr/mån." } } },
  ],
  connections: [
    { id: "c", from: { nodeId: "loan", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
  ],
} as never;

async function mount(): Promise<ShadowRoot> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  document.body.append(preview);
  preview.graph = graph;
  await settle();
  return preview.shadowRoot!;
}

const type = (root: ShadowRoot, fieldId: string, value: string) => {
  const input = root.querySelector<HTMLInputElement>(`[data-page-field-id="${fieldId}"] input`)!;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
};
const textOf = (root: ShadowRoot, id: string) =>
  root.querySelector<HTMLElement>(`[data-page-heading-id="${id}"]`)!;

describe("en uträkning i sidan (story 095)", () => {
  /*
   * Raden nedan stod som `{{kostnad}}` fram till 13/9, och det är värt att
   * veta: felet Johan rapporterade på Låna-sidan — klamrar i besökarens ruta
   * innan hen svarat — var alltså inte ett förbisett fall utan **nedskrivet
   * som förväntat beteende**, i ett test som hette "ger platshållaren". Därför
   * fångade ingen grind det. En platshållare är redaktörens ord om texten, inte
   * besökarens; besökaren får nu ett streck och meningen omkring det hel.
   */
  test("texten räknas om medan man skriver, och en tom ruta ger ett streck — aldrig NaN", async () => {
    const root = await mount();

    // Nothing typed: the mark stands, no `NaN`, no `0`.
    expect(textOf(root, "text").textContent).toContain("–");
    expect(textOf(root, "text").textContent).not.toContain("{{");
    // An empty title draws no heading (AC 2).
    expect(textOf(root, "text").querySelector("h3")).toBeNull();
    expect(textOf(root, "warn").querySelector("h3")!.textContent).toBe("Dyrt");

    type(root, "amount", "100000");
    type(root, "years", "5");
    await settle();

    expect(textOf(root, "text").querySelector("strong")!.textContent).toBe("1 933 kr/mån");
    expect(textOf(root, "warn").hidden).toBe(true);

    type(root, "amount", "200000");
    await settle();
    expect(textOf(root, "text").querySelector("strong")!.textContent).toBe("3 867 kr/mån");
    // A text conditioned on the calculated variable appears as it is typed.
    expect(textOf(root, "warn").hidden).toBe(false);

    /*
     * Och tillbaka till strecket när rutan töms — det är den här halvan som
     * bär "aldrig NaN": en uträkning som förlorat sitt tal får inte skriva ut
     * vad den räknade fram ur ingenting.
     */
    type(root, "amount", "");
    await settle();
    expect(textOf(root, "text").textContent).toContain("–");
    expect(textOf(root, "text").textContent).not.toContain("NaN");
  });

  test("Nästa sparar variabeln, så resultatet läser den", async () => {
    const root = await mount();
    type(root, "amount", "100000");
    type(root, "years", "5");
    await settle();

    root.querySelector<HTMLButtonElement>('[data-action="next"], button[type="submit"]')!.click();
    await settle();

    expect(root.textContent).toContain("1 933 kr/mån.");
  });
});

/*
 * The sidebar's field list (compact, before Prova guiden) called the
 * calculation "Namnlöst fält" although it has a title: it is not a field, so
 * it was not in the field list the labels were read from. Seen in the film
 * Räkna medan man svarar (LOGG 6/9 natten mot 7).
 */
test("sidopanelens fältlista kallar uträkningen vid dess namn", async () => {
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.setAttribute("compact", "");
  document.body.append(preview);
  preview.graph = graph;
  await settle();

  const card = preview.shadowRoot!.querySelector<HTMLElement>(
    '.guide-preview__page-field-summary[data-page-field-id="calc"]',
  )!;
  expect(card.textContent).toContain("Månadskostnad");
  expect(card.textContent).not.toContain("Namnlöst fält");
});
