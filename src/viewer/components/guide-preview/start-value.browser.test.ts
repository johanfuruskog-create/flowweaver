import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Story 118, steg 2: ett fälts startvärde måste synas i den rutan en besökare
 * faktiskt ser — inte bara finnas i grafen. `ArrivalValueService` är svaret,
 * och `arrival-value-service.test.ts` mäter dess retur; den här filen mäter
 * att retursvärdet **når renderad DOM** (PRAXIS 35, berättelsens kriterium 2).
 *
 * `range-start-value.browser.test.ts` är förebilden: samma `arriveAt`-idiom
 * och samma sorts påstående, riktat mot det burna värdet
 * (`data-canonical`/`.value`) och inte mot en modell ingen besökare ser.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount(
  graph: GraphData,
  options: { today?: string; given?: GuidePreview["given"] } = {},
): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  if (options.today) {
    preview.setAttribute("today", options.today);
  }
  document.body.append(preview);
  // Given före grafen, som `given-answers.browser.test.ts` gör: värdens
  // befintliga svar ska stå där redan vid första ritningen.
  if (options.given) {
    preview.given = options.given;
  }
  preview.graph = graph;
  await settle();
  return preview;
}

/** Sidfältets burna kontroll — `data-page-variable`, inte reglagets/steppern. */
function pageField(preview: GuidePreview, variable: string): HTMLInputElement | null {
  return preview.shadowRoot?.querySelector<HTMLInputElement>(
    `input[data-page-variable="${variable}"]`,
  ) ?? null;
}

describe("startvärdet i renderad DOM (berättelse 118, steg 2)", () => {
  test("ett talfält på en sida visar startvärdet, och det burna värdet är det", async () => {
    const graph: GraphData = {
      startNodeId: "p",
      settings: { sourceLocale: "sv" },
      connections: [],
      nodes: [
        { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
        {
          id: "n",
          type: "number-question",
          parentPageId: "p",
          position: { x: 0, y: 0 },
          data: { title: { sv: "Tal" }, variableName: "tal", startValue: 10 },
        },
      ],
    } as never;

    const preview = await mount(graph);
    const field = pageField(preview, "tal");

    expect(field?.value).toBe("10");
    expect(field?.dataset.canonical).toBe("10");
  });

  test("ett datumfält med startValue \"idag\" visar värdens dag som ISO-datum", async () => {
    const graph: GraphData = {
      startNodeId: "p",
      settings: { sourceLocale: "sv" },
      connections: [],
      nodes: [
        { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
        {
          id: "d",
          type: "date-question",
          parentPageId: "p",
          position: { x: 0, y: 0 },
          data: { title: { sv: "Datum" }, variableName: "dat", startValue: "idag" },
        },
      ],
    } as never;

    const preview = await mount(graph, { today: "2030-01-02" });
    const field = pageField(preview, "dat");

    expect(field?.value).toBe("2030-01-02");
  });

  test("ett reglage med både startValue och min står på startValue, inte min", async () => {
    const graph: GraphData = {
      startNodeId: "p",
      settings: { sourceLocale: "sv" },
      connections: [],
      nodes: [
        { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
        {
          id: "r",
          type: "number-question",
          parentPageId: "p",
          position: { x: 0, y: 0 },
          data: {
            title: { sv: "Reglage" },
            variableName: "regl",
            presentation: "range",
            min: 0,
            max: 100,
            startValue: 40,
          },
        },
      ],
    } as never;

    const preview = await mount(graph);
    const field = pageField(preview, "regl");
    const slider = preview.shadowRoot?.querySelector<HTMLInputElement>('input[type="range"]');

    expect(field?.dataset.canonical).toBe("40");
    expect(slider?.value).toBe("40");
  });

  test("en uträkning som läser fältet visar ett tal vid ankomst, inte ett streck", async () => {
    // Egen testgraf, inte låneguiden (den byggs i steg 5). Samma form som
    // berättelsens tabell: ett fält, en uträkning på samma sida, en text
    // med mallvariabel — story 095:s mönster i miniatyr.
    const graph: GraphData = {
      startNodeId: "p",
      settings: { sourceLocale: "sv" },
      connections: [],
      nodes: [
        { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
        {
          id: "n",
          type: "number-question",
          parentPageId: "p",
          order: 0,
          position: { x: 0, y: 0 },
          data: { title: { sv: "Tal" }, variableName: "tal", startValue: 10 },
        },
        {
          id: "c",
          type: "calculation",
          parentPageId: "p",
          order: 1,
          position: { x: 0, y: 0 },
          data: {
            title: { sv: "Beräkning" },
            assignments: [
              { id: "a1", variableName: "dubbelt", label: { sv: "Dubbelt" }, formula: "tal * 2" },
            ],
          },
        },
        {
          id: "h",
          type: "page-heading",
          parentPageId: "p",
          order: 2,
          position: { x: 0, y: 0 },
          data: { description: { sv: "Resultat: {{dubbelt}} kr." }, presentation: "info" },
        },
      ],
    } as never;

    const preview = await mount(graph);
    const heading = preview.shadowRoot?.querySelector('[data-page-heading-id="h"]');

    expect(heading?.textContent).toContain("Resultat: 20 kr.");
    // "–" är märket för ett svar som saknas (UNANSWERED_MARK) — det ska inte
    // synas när fältet har ett startvärde att räkna på.
    expect(heading?.textContent).not.toContain("–");
  });

  test("ett fristående talsteg (inte på en sida) med startValue visar värdet", async () => {
    const graph: GraphData = {
      startNodeId: "n",
      settings: { sourceLocale: "sv" },
      connections: [],
      nodes: [
        {
          id: "n",
          type: "number-question",
          position: { x: 0, y: 0 },
          data: { title: { sv: "Fristående tal" }, variableName: "fri", startValue: 7 },
        },
      ],
    } as never;

    const preview = await mount(graph);
    const field = preview.shadowRoot?.querySelector<HTMLInputElement>("input[data-number-answer]");

    expect(field?.value).toBe("7");
    expect(field?.dataset.canonical).toBe("7");
  });

  describe("ett befintligt svar behåller sitt värde, aldrig startvärdet", () => {
    const graph: GraphData = {
      startNodeId: "p",
      settings: { sourceLocale: "sv" },
      connections: [],
      nodes: [
        { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
        {
          id: "n",
          type: "number-question",
          parentPageId: "p",
          position: { x: 0, y: 0 },
          data: { title: { sv: "Tal" }, variableName: "tal", startValue: 10 },
        },
      ],
    } as never;

    test("ett ifyllt svar vinner över startvärdet", async () => {
      const preview = await mount(graph, { given: { answers: { tal: "25" } } });
      const field = pageField(preview, "tal");

      expect(field?.value).toBe("25");
      expect(field?.dataset.canonical).toBe("25");
    });

    test("ett tomt svar (\"\") räknas som besvarat och behåller sin tomhet", async () => {
      const preview = await mount(graph, { given: { answers: { tal: "" } } });
      const field = pageField(preview, "tal");

      expect(field?.value).toBe("");
      expect(field?.dataset.canonical).toBe("");
    });
  });
});
