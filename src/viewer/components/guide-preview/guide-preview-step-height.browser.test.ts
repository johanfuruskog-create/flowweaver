import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Berättelse 144, kriterium 1, 2 och 7: kortet håller formen mellan två
 * lokala steg.
 *
 * Hero-klippet (1/10) visade frågekortet med alternativ och knapprad bytas mot
 * resultatkortet, en tredjedel så högt, på en bildruta. Nu börjar det nya
 * kortet i det gamlas höjd och går till sin egen i stegets tempo; under
 * `prefers-reduced-motion` och i miniatyren på canvasen är det ett klipp.
 *
 * Höjden läses ur DOM:en bildruta för bildruta — `offsetHeight`, som är
 * layoutens höjd och inte påverkas av stegets glidning (`transform`).
 *
 * ## Varför provet byter ut `matchMedia`
 *
 * Samma skäl som `glide-reduced-motion.browser.test.ts`: en browsertest-körning
 * har ingen knapp för webbläsarens inställning, så provet ger koden det svar
 * den frågar efter. Båda svaren körs — ett prov som bara körde *reduce* hade
 * gått grönt även om övergången aldrig fungerat.
 */

const realMatchMedia = window.matchMedia.bind(window);

afterEach(() => {
  document.body.replaceChildren();
  window.matchMedia = realMatchMedia;
});

function answerReducedMotion(reduce: boolean): void {
  window.matchMedia = ((query: string) =>
    query.includes("prefers-reduced-motion")
      ? ({ matches: reduce, media: query, addEventListener() {}, removeEventListener() {} } as never)
      : realMatchMedia(query)) as typeof window.matchMedia;
}

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** A tall question (five options and the button row) followed by a short result. */
function tallThenShort(): GraphData {
  return {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Vilken nivå passar dig?" },
          description: { sv: "Välj den som ligger närmast hur du arbetar i dag." },
          variableName: "niva",
          options: ["a", "b", "c", "d", "e"].map((id) => ({ id, label: { sv: `Nivå ${id}` }, value: id })),
        },
      },
      { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: ["a", "b", "c", "d", "e"].map((id) => ({
      id: `c-${id}`,
      from: { nodeId: "q", portId: id },
      to: { nodeId: "r", portId: "input" },
    })),
  } as unknown as GraphData;
}

async function questionCard(attributes: string[] = []): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  attributes.forEach((name) => preview.setAttribute(name, ""));
  preview.style.cssText = "display: block; width: 600px;";
  document.body.append(preview);
  preview.graph = tallThenShort();
  await settle();

  return preview;
}

const card = (preview: GuidePreview) =>
  preview.shadowRoot!.querySelector<HTMLElement>(".guide-preview__card")!;

/** Choose the first option and go on, the way a visitor does. */
function answerAndGoOn(preview: GuidePreview): void {
  const root = preview.shadowRoot!;
  const option = root.querySelector<HTMLInputElement>('input[type="radio"]');

  if (option) {
    option.click();
  } else {
    root.querySelector<HTMLElement>("[data-option-id], .guide-preview__option")!.click();
  }
  root.querySelector<HTMLButtonElement>('[data-action="next"]')?.click();
}

/**
 * Heights per frame from the moment of the change until it has settled,
 * plus everything the frames had that a local step must not have.
 */
async function framesAfterTheChange(preview: GuidePreview, ms = 400) {
  const before = card(preview).offsetHeight;
  const heights: number[] = [];
  const intruders: string[] = [];
  const started = performance.now();

  answerAndGoOn(preview);
  expect(card(preview).textContent, "steget bytte inte").toContain("Klart");

  while (performance.now() - started < ms) {
    const now = card(preview);
    heights.push(now.offsetHeight);
    if (preview.shadowRoot!.querySelector("[data-waiting]")) intruders.push("platshållare");
    if (now.hasAttribute("aria-busy")) intruders.push("aria-busy");
    await frame();
  }

  return { before, heights, intruders, after: card(preview).offsetHeight };
}

describe("höjden mellan två lokala steg", () => {
  test("börjar i det gamla kortets höjd och går till det nya under stegets 220 ms", async () => {
    answerReducedMotion(false);
    const preview = await questionCard();
    const { before, heights, after } = await framesAfterTheChange(preview);

    expect(before - after, `frågan ${before}px, resultatet ${after}px — inget att mäta`).toBeGreaterThan(100);
    expect(heights[0], `första bildrutan ${heights[0]}px, frågan var ${before}px`).toBeCloseTo(before, 0);
    expect(
      heights.some((height) => height < before - 5 && height > after + 5),
      `höjderna bildruta för bildruta: ${heights.join(", ")}`,
    ).toBe(true);
    expect(heights[heights.length - 1]).toBe(after);
    // Tillbaka till auto: ett kvarlämnat px-värde skulle låsa kortet när innehållet växer.
    expect(card(preview).style.height).toBe("");
    expect(card(preview).hasAttribute("data-height-shift")).toBe(false);
  });

  test("visar ingen platshållare och är aldrig upptagen — det finns inget att vänta på", async () => {
    answerReducedMotion(false);
    const preview = await questionCard();
    const { intruders } = await framesAfterTheChange(preview);

    expect(intruders).toEqual([]);
  });

  test("byts utan rörelse under prefers-reduced-motion (K5)", async () => {
    answerReducedMotion(true);
    const preview = await questionCard();
    const { heights, after } = await framesAfterTheChange(preview, 120);

    expect(heights[0], `första bildrutan ${heights[0]}px, det nya kortet ${after}px`).toBe(after);
    expect(card(preview).style.height).toBe("");
  });

  test("rörs inte i miniatyren på canvasen (in-node, editor-view)", async () => {
    answerReducedMotion(false);
    const preview = await questionCard(["in-node", "editor-view"]);
    const { heights, after } = await framesAfterTheChange(preview, 120);

    expect(heights[0], `första bildrutan ${heights[0]}px, det nya kortet ${after}px`).toBe(after);
    expect(card(preview).hasAttribute("data-height-shift")).toBe(false);
  });
});
