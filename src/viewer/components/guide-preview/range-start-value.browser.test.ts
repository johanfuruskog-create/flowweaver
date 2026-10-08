import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";


import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../../testing/optional-pro";
const { borrowExampleGraph } = ((await proModule("data/borrow-example-graph.ts")) ?? {}) as { borrowExampleGraph: GraphData };
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * Ett reglage visar alltid ett läge — så modellen måste hålla det.
 *
 * Mätt i chromium 13/9 på Låna-sidan vid första ritningen: reglaget stod på
 * `10000`, fältet bredvid var tomt, och uträkningen hade ingenting att räkna
 * på. Tre bilder av samma svar, två av dem tomma, en synlig för besökaren.
 *
 * En stepper (− / +) visar ingenting i vila om inget startvärde är satt — dess
 * fält är tomt — och att seeda den utan att redaktören bett om det vore samma
 * oärlighet åt andra hållet: ett svar besökaren aldrig gett och inte kan se
 * att hen gett. Det testas nedan på en egen liten fältgraf, inte på
 * låneguiden: lånetiden `ar` har SEDAN berättelse 118 steg 5 fått ett
 * startvärde (kriterium 6) just för att kostnadsrutan ska visa ett belopp vid
 * ankomst, så `ar` är inte längre exemplet på en tom stepper.
 */

function arriveAt(graph: GraphData, pageId: string): GuidePreview {
  const preview = document.createElement("guide-preview") as GuidePreview;
  document.body.append(preview);
  preview.graph = { ...structuredClone(graph), startNodeId: pageId };

  return preview;
}

function field(preview: GuidePreview, variable: string): HTMLInputElement | null {
  return preview.shadowRoot?.querySelector<HTMLInputElement>(
    `input[data-page-variable="${variable}"]`,
  ) ?? null;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("ett reglagefälts utgångsläge", () => {
  test.runIf(PRO)("fältet bär det reglaget visar, redan vid ankomst", () => {
    const preview = arriveAt(borrowExampleGraph, "loan-page");
    const slider = preview.shadowRoot?.querySelector<HTMLInputElement>('input[type="range"]');
    const amount = field(preview, "lan");

    // Det burna värdet, inte det grupperade — det är det uträkningen läser.
    expect(amount?.dataset.canonical).toBe("10000");
    expect(slider?.value).toBe("10000");
  });

  test("en stepper UTAN startvärde står kvar tom — den visar inget läge att hålla", () => {
    // Egen liten fältgraf, inte låneguiden: `ar` (låneguidens stepper) har
    // sedan steg 5 ett startvärde, se testet nedan. Skillnaden reglage/stepper
    // bevakas här i stället, på ett stepperfält utan startValue.
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
          data: {
            title: { sv: "Utan startvärde" }, variableName: "utan",
            presentation: "stepper", min: 1, max: 15, step: 1,
          },
        },
      ],
    } as never;

    const preview = arriveAt(graph, "p");
    const term = field(preview, "utan");

    expect(term?.value).toBe("");
    expect(term?.dataset.canonical).toBe("");
  });
});

describe("låneguidens lånetid (berättelse 118, steg 5, kriterium 6)", () => {
  /*
   * RÖTT MED FLIT tills utvecklaren sätter startValue: 8 på `loan-years` i
   * `borrow-example-graph.ts`. Testet skrivet före värdet (PRAXIS: ett test
   * som setts falla), så att lagningen har något att göra grönt.
   */
  test.runIf(PRO)("lånetiden visar 8 år vid ankomst, och kostnadsrutan läser ett belopp — inte strecket", () => {
    const preview = arriveAt(borrowExampleGraph, "loan-page");
    const term = field(preview, "ar");
    const summary = preview.shadowRoot?.querySelector('[data-page-heading-id="loan-summary"]');

    expect(term?.value).toBe("8");
    expect(term?.dataset.canonical).toBe("8");
    expect(summary?.textContent).toContain("kr/mån");
    // "–" är märket för ett svar som saknas (UNANSWERED_MARK i
    // guide-preview.ts, inte exporterad) — det ska inte synas när lånetiden
    // har ett startvärde att räkna kostnaden på.
    expect(summary?.textContent).not.toContain("–");
  });
});
