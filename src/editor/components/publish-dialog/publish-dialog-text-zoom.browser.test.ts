import { afterEach, beforeEach, describe, expect, test } from "vitest";

import "./publish-dialog";

import type { PublishDialog, PublishRequest } from "./publish-dialog";
import type { GuideHealthIssue } from "../../services/guide-health-service";

/**
 * Fellistan vid 200 % textförstoring (Siv, LOGG 22 september).
 *
 * ## Vad som var fel, och varför browser-zoom aldrig hittade det
 *
 * WCAG 1.4.4 "Resize text" prövas i praktiken på två olika sätt, och de mäter
 * olika saker. Webbläsarens SIDZOOM (Ctrl + +) skalar varje CSS-pixel —
 * dialogens fasta `560px`-bredd blir `1120px` på skärmen och texten dubblas
 * i SAMMA takt, så förhållandet mellan dem står still. Den upptäcker
 * ingenting här.
 *
 * `rot 32px` simulerar i stället besökarens STANDARDTECKENSTORLEK (det andra
 * sättet 1.4.4 prövas på): `rem`-baserad text dubblas, men `560px` är en
 * literal — den rör sig inte. Textkolumnen, som delade sin fasta bredd med
 * knappen bredvid, pressades till 28×2025 px, ett tecken per rad (mätt i
 * `e2e/text-spacing-reflow-audit.mjs`).
 *
 * Fixen (`publish-dialog.scss`, `li`) gör varje rad till en enkolumns-grid:
 * texten får radens FULLA bredd oavsett vad knappen gör, och knappen står på
 * sin egen rad under. Inget breddvillkor att förhandla om, alltså ingenting
 * som kan gå sönder igen vid ett tredje teckenstorleksfall.
 */

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.style.fontSize = "";
});

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Samma sorts realistiska, långa meddelande som hälsokontrollen faktiskt
// skriver — inte en kort etikett som råkar rymmas oavsett bredd.
const LONG_ISSUE: GuideHealthIssue = {
  code: "dead-option",
  severity: "error",
  nodeId: "q1",
  message:
    "Hur stor är tomten?: alternativet \"Kanske\" leder inte vidare till någon fråga eller något resultat.",
};

async function openBlocked(): Promise<PublishDialog> {
  const element = document.createElement("publish-dialog") as PublishDialog;

  element.editorLocale = "sv";
  document.body.append(element);

  const request: PublishRequest = {
    version: 4,
    previous: 3,
    changes: [],
    outline: false,
    issues: [LONG_ISSUE],
  };

  void element.ask(request);
  await settle();

  return element;
}

describe("fellistan vid rot 32px (200 % textförstoring)", () => {
  beforeEach(() => {
    document.documentElement.style.fontSize = "32px";
  });

  test("texten bryter rad i stället för att pressas till ett tecken per rad", async () => {
    const element = await openBlocked();
    const row = element.shadowRoot!.querySelector<HTMLElement>("[data-errors-list] li")!;
    const text = row.querySelector<HTMLElement>(".publish-dialog__text")!;

    /*
     * `text.getClientRects()` svarar med EN rect — elementets egen box, för
     * `.publish-dialog__text` är en `display: flex`-behållare (blockartad),
     * inte en radbrytande inline-yta. Det som faktiskt visar hur många
     * VISUELLA rader innehållet bröt till är en `Range` över textnoden
     * (samma teknik som `page-error-summary.browser.test.ts` 21/9).
     */
    const range = document.createRange();
    range.selectNodeContents(text);
    const rects = [...range.getClientRects()];

    expect(rects.length, "minst en rad att mäta").toBeGreaterThan(0);
    // Antingen håller radantalet sig lågt, eller är varje rad bred nog för
    // att bära text — den pressade remsan (28 px, 70+ rader) klarar inget
    // av de två.
    const fewLines = rects.length <= 3;
    const wideEnough = rects.every((rect) => rect.width >= 200);

    expect(
      fewLines || wideEnough,
      `text.getClientRects(): ${rects.length} rader, bredd ${rects.map((r) => Math.round(r.width)).join(", ")}`,
    ).toBe(true);
  });

  test("knappen ligger under eller bredvid texten, aldrig ovanpå den", async () => {
    const element = await openBlocked();
    const row = element.shadowRoot!.querySelector<HTMLElement>("[data-errors-list] li")!;
    const text = row.querySelector<HTMLElement>(".publish-dialog__text")!;
    const button = row.querySelector<HTMLElement>("[data-goto]")!;

    const textRect = text.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();

    const under = buttonRect.top >= textRect.bottom;
    const beside = buttonRect.left >= textRect.right;

    expect(under || beside, "knappen varken ovanpå eller genom texten").toBe(true);
  });
});
