// The sending steps are FlowWeaver PRO's; this test uses them (open-core step 4).
import { page } from "vitest/browser";
import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";


import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../../testing/optional-pro";
await withPro("viewer/index.ts");
const { registerSubmissionReceiver, unregisterSubmissionReceiver } = (await proModule("viewer/core/submission-registry.ts")) ?? {};
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/*
 * Samma golv som navigeringen (Johan, 22/9), mätt för varje annan knapp på
 * besökarens yta: `.guide-preview__ask-actions`, `.guide-preview__submit-retry`
 * och `.guide-preview__repeat-add`/`-remove`. Mätt en och en, inte antaget:
 *
 * - Ask-dialogens "Ändra"/"Gå vidare": 88/120 px på 900 px bred sida, i en
 *   dialog med 32rem att röra sig på — samma frimärke-mönster.
 * - "Försök igen": 145 px på både 900 och 390 (ordet bär bredden, kortet
 *   gör det inte).
 * - "Lägg till": 155 px, redan nära golvet men fortfarande under det.
 *
 * De tre kontrollerna som INTE fick regeln, och varför (mätt, inte antaget):
 * - Felsummeringens länkar är `<a>` (se kommentaren vid
 *   `.guide-preview__error-summary [data-error-link]`). De står en per rad,
 *   så K6:s undantag för länkar i löpande text gäller inte dem: sedan
 *   genomgången 30/9 (V2) är varje länk 44 px hög, men inte 9rem bred —
 *   provet bor i `page-error-summary.browser.test.ts`.
 * - Filfältets "Använd exempelfoto" är redan `display: block` (fyller sin
 *   rad) och visas dessutom bara när värden konfigurerat ett exempelfoto —
 *   `every-field.html` gör det inte, så kontrollen finns inte att mäta här.
 * - Chip-väljarens kryss är en medvetet KOMPAKT pill med ett eget uträknat
 *   träffmål (`_chips.scss`, `$target: 44px` via ett pseudoelement) —
 *   `min(9rem, 100%)` hade gjort varje vald etikett lika bred som en knapp,
 *   raka motsatsen till hela poängen med en pill. Sökfältet är redan
 *   `flex: 1 1 10ch` (fyller raden), och alternativraderna är redan
 *   `width: 100%` (`_picker.scss`).
 *
 * Talet sänkt 10rem → 9rem samma dag (Johans bildgranskning): se
 * `guide-preview-navigation-floor.browser.test.ts` för varför.
 */

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.style.fontSize = "";
  unregisterSubmissionReceiver();
});

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function setViewport(width: number, fontSize: string | null): Promise<void> {
  await page.viewport(width, 900);
  document.documentElement.style.fontSize = fontSize ?? "";
}

const WIDTHS: Array<[number, string | null]> = [
  [900, null],
  [390, null],
  [320, "32px"],
];

describe("ask-actions golv", () => {
  function graph(): GraphData {
    return {
      startNodeId: "p",
      settings: { sourceLocale: "sv" },
      nodes: [
        { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
        {
          id: "n", type: "number-question", parentPageId: "p", order: 0, position: { x: 0, y: 0 },
          data: { title: { sv: "Tal" }, variableName: "tal", startValue: 5, required: true, requireInteraction: true },
        },
        { id: "r", type: "result", position: { x: 200, y: 0 }, data: { title: { sv: "Klart" } } },
      ],
      connections: [{ id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "r", portId: "input" } }],
    } as never;
  }

  test.runIf(PRO).each(WIDTHS)("%ipx / %s: Ändra och Gå vidare håller golvet, ingen overflow", async (width, fontSize) => {
    await setViewport(width, fontSize);
    const preview = document.createElement("guide-preview") as GuidePreview;

    document.body.append(preview);
    preview.graph = graph();
    await settle();
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();

    const dialog = preview.shadowRoot!.querySelector<HTMLElement>("dialog.guide-preview__ask")!;
    const change = dialog.querySelector<HTMLElement>('[data-ask="change"]')!.getBoundingClientRect();
    const cont = dialog.querySelector<HTMLElement>('[data-ask="continue"]')!.getBoundingClientRect();
    const floor = Math.min(144, dialog.getBoundingClientRect().width);

    expect(change.width, "Ändra under golvet").toBeGreaterThanOrEqual(floor - 1);
    expect(cont.width, "Gå vidare under golvet").toBeGreaterThanOrEqual(floor - 1);
    expect(change.right, "Ändra sticker ut ur fönstret").toBeLessThanOrEqual(width);
    expect(cont.right, "Gå vidare sticker ut ur fönstret").toBeLessThanOrEqual(width);
  });
});

describe("Försök igen-golv", () => {
  function graph(): GraphData {
    return {
      startNodeId: "t",
      settings: { sourceLocale: "sv" },
      nodes: [
        { id: "t", type: "text-question", position: { x: 0, y: 0 }, data: { title: { sv: "Vad gäller felet?" }, variableName: "beskrivning" } },
        { id: "skicka", type: "submit-result", position: { x: 200, y: 0 }, data: { title: { sv: "Tack" }, recipientId: "mottagare" } },
      ],
      connections: [{ id: "c", from: { nodeId: "t", portId: "continue" }, to: { nodeId: "skicka", portId: "input" } }],
    } as never;
  }

  test.runIf(PRO).each(WIDTHS)("%ipx / %s: Försök igen håller golvet, ingen overflow", async (width, fontSize) => {
    await setViewport(width, fontSize);
    registerSubmissionReceiver({
      recipients: () => [{ id: "mottagare", label: "Mottagare" }],
      submit: async () => { throw new Error("Mottagaren svarar inte"); },
    });

    const preview = document.createElement("guide-preview") as GuidePreview;

    document.body.append(preview);
    preview.graph = graph();
    await settle();
    const field = preview.shadowRoot!.querySelector<HTMLInputElement>("[data-text-answer]")!;

    field.value = "Lampan är släckt";
    field.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle(250);

    const retry = preview.shadowRoot!.querySelector<HTMLElement>("[data-submit-retry]")!;
    const rect = retry.getBoundingClientRect();
    const card = preview.shadowRoot!.querySelector<HTMLElement>(".guide-preview__card")!;
    const floor = Math.min(144, card.getBoundingClientRect().width);

    expect(rect.width, "Försök igen under golvet").toBeGreaterThanOrEqual(floor - 1);
    expect(rect.right, "Försök igen sticker ut ur fönstret").toBeLessThanOrEqual(width);
  });
});

describe("Lägg till / Ta bort-golv (repeaterande sida)", () => {
  function graph(): GraphData {
    return {
      startNodeId: "barn",
      settings: { sourceLocale: "sv" },
      nodes: [
        { id: "barn", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Dina barn" }, repeats: true, repeatWord: { sv: "barn" }, repeatVariable: "barn" } },
        { id: "namn", type: "text-question", parentPageId: "barn", order: 1, position: { x: 0, y: 0 }, data: { title: { sv: "Namn" }, variableName: "namn" } },
        { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
      ],
      connections: [{ id: "c", from: { nodeId: "barn", portId: "continue" }, to: { nodeId: "r", portId: "input" } }],
    } as never;
  }

  test.runIf(PRO).each(WIDTHS)("%ipx / %s: Lägg till och Ta bort håller golvet, ingen overflow", async (width, fontSize) => {
    await setViewport(width, fontSize);
    const preview = document.createElement("guide-preview") as GuidePreview;

    document.body.append(preview);
    preview.graph = graph();
    await settle();
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="repeat-add"]')!.click();
    await settle();

    const add = preview.shadowRoot!.querySelector<HTMLElement>('[data-action="repeat-add"]')!.getBoundingClientRect();
    const remove = preview.shadowRoot!.querySelector<HTMLElement>('[data-action="repeat-remove"]')!.getBoundingClientRect();
    const card = preview.shadowRoot!.querySelector<HTMLElement>(".guide-preview__card")!;
    const floor = Math.min(144, card.getBoundingClientRect().width);

    expect(add.width, "Lägg till under golvet").toBeGreaterThanOrEqual(floor - 1);
    expect(remove.width, "Ta bort under golvet").toBeGreaterThanOrEqual(floor - 1);
    expect(add.right, "Lägg till sticker ut ur fönstret").toBeLessThanOrEqual(width);
    expect(remove.right, "Ta bort sticker ut ur fönstret").toBeLessThanOrEqual(width);
  });
});
