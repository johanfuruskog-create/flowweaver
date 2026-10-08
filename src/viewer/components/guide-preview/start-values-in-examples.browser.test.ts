import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";


import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../../testing/optional-pro";
const { claimExampleGraph } = ((await proModule("data/claim-example-graph.ts")) ?? {}) as { claimExampleGraph: GraphData };
const { movingExampleGraph } = ((await proModule("data/moving-example-graph.ts")) ?? {}) as { movingExampleGraph: GraphData };
const { quoteExampleGraph } = ((await proModule("data/quote-example-graph.ts")) ?? {}) as { quoteExampleGraph: GraphData };
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * Berättelse 118, steg 5, kriterium 6 — de tre guiderna efter låneguiden.
 *
 * RÖTT MED FLIT tills utvecklaren sätter värdena i respektive graf-fil (inte
 * här — QA:s test kommer före värdet). Samma `arriveAt`-mönster som
 * `range-start-value.browser.test.ts`: hoppa rakt till sidan där fältet och
 * uträkningen står, och mät renderad DOM — fältets `.value` och rutans text.
 *
 * ## Två av tre uträkningar läser en variabel som INTE finns på samma sida
 *
 * `claim-payout` läser `{{ersattning}}` (belopp − sjalvrisk) och
 * `{{sjalvrisk}}` — och `sjalvrisk` kommer från `claim-register`, ett
 * `service-call`-steg PÅ EN TIDIGARE SIDA. `moving-rent-text` läser
 * `{{hyresdagar}}` (max av dagar och uppsagningsdagar) — och
 * `uppsagningsdagar` kommer på samma sätt från `moving-register`, tidigare.
 *
 * `arriveAt` hoppar rakt till målsidan och går aldrig igenom de tidigare
 * stegen, så de variablerna är annars odefinierade oavsett startvärdet — mätt
 * i webbläsaren: rutan visar strecket för DEM redan i dag, av ett skäl som
 * inte har med kriterium 6 att göra. Det testas inte här (det är
 * hälsokontrollens och tjänsteanropets ämne). I stället seedas de via
 * `given`, som om besökaren redan passerat det tidigare steget — exakt det
 * `given-answers.browser.test.ts` gör för samma sorts fall. Det isolerar
 * påståendet till precis det kriterium 6 lovar: fältet på DEN HÄR sidan.
 *
 * Offerten har inget sådant beroende — `uppskattning` läser bara `rum` och
 * `yta`, båda på samma sida — så den seedar ingenting.
 */

afterEach(() => document.body.replaceChildren());

function arriveAt(
  graph: GraphData,
  pageId: string,
  given?: GuidePreview["given"],
  today?: string,
): GuidePreview {
  const preview = document.createElement("guide-preview") as GuidePreview;
  if (today) preview.setAttribute("today", today);
  document.body.append(preview);
  if (given) preview.given = given;
  preview.graph = { ...structuredClone(graph), startNodeId: pageId };
  return preview;
}

function field(preview: GuidePreview, variable: string): HTMLInputElement | null {
  return preview.shadowRoot?.querySelector<HTMLInputElement>(
    `input[data-page-variable="${variable}"]`,
  ) ?? null;
}

// "–" är märket för ett svar som saknas (UNANSWERED_MARK i guide-preview.ts,
// inte exporterad) — samma tecken som i `range-start-value.browser.test.ts`.
const UNANSWERED = "–";

describe("offerten: yta och antal rum (quote-example-graph.ts)", () => {
  test.runIf(PRO)("fälten visar startvärdena, och uppskattningen läser ett belopp — inte strecket", () => {
    const preview = arriveAt(quoteExampleGraph, "quote-work-page");
    const rooms = field(preview, "rum");
    const area = field(preview, "yta");
    const estimate = preview.shadowRoot?.querySelector('[data-page-heading-id="quote-estimate-text"]');

    expect(rooms?.value).toBe("3");
    expect(rooms?.dataset.canonical).toBe("3");
    expect(area?.value).toBe("70");
    expect(area?.dataset.canonical).toBe("70");
    expect(estimate?.textContent).toContain("kr");
    expect(estimate?.textContent).not.toContain(UNANSWERED);
  });
});

describe("ersättningen: uppskattat belopp (claim-example-graph.ts)", () => {
  test.runIf(PRO)("fältet visar startvärdet, och ersättningsrutan läser ett belopp — inte strecket", () => {
    // sjalvrisk seedas — se toppkommentaren. Kravet på beröring avgörs
    // separat och mäts inte här.
    const preview = arriveAt(claimExampleGraph, "claim-amount-page", {
      answers: { sjalvrisk: "1500" },
    });
    const amount = field(preview, "belopp");
    const payout = preview.shadowRoot?.querySelector('[data-page-heading-id="claim-payout"]');

    // Det visade, inte det burna: talfält grupperar tusental i vad som visas
    // (smalt mellanslag, \u00a0) — låneguidens 8 är ensiffrig, så skillnaden
    // syntes inte förrän kravet mättes på ett fyrsiffrigt belopp. Det burna
    // värdet (det uträkningen läser) är fortfarande "5000".
    expect(amount?.value).toBe("5\u00a0000");
    expect(amount?.dataset.canonical).toBe("5000");
    expect(payout?.textContent).toContain("kr");
    expect(payout?.textContent).not.toContain(UNANSWERED);
  });
});

describe("flyttanmälan: utflyttningsdag (moving-example-graph.ts)", () => {
  test.runIf(PRO)("datumfältet visar dagens dag, och hyresdagsrutan läser ett tal — inte strecket", () => {
    // uppsagningsdagar seedas — se toppkommentaren. Kravet på beröring avgörs
    // separat och mäts inte här.
    const preview = arriveAt(
      movingExampleGraph,
      "moving-out-page",
      { answers: { uppsagningsdagar: "90" } },
      "2030-01-02",
    );
    const outDate = field(preview, "utflytt");
    const rent = preview.shadowRoot?.querySelector('[data-page-heading-id="moving-rent-text"]');

    expect(outDate?.value).toBe("2030-01-02");
    expect(rent?.textContent).toContain("dagar");
    expect(rent?.textContent).not.toContain(UNANSWERED);
  });
});
