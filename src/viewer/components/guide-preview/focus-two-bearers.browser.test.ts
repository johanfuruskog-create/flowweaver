import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../node-types/default-node-types";
import "./guide-preview";


import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../../testing/optional-pro";
const { conferenceExampleGraph } = ((await proModule("data/conference-example-graph.ts")) ?? {}) as { conferenceExampleGraph: GraphData };
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * Tangentbordsfokus har två bärare, och det här mäter att de båda kommer fram
 * på besökarens yta (K3; WCAG 2.2 1.4.11, kontrast för annat än text).
 *
 * **Vad som var fel.** Indikatorn var en enda sak: `outline: 3px solid
 * var(--fw-focus-ring)`, och `--fw-focus-ring` är en 35-procentig tvätt av
 * indigo. Räknad mot ytorna den landar på ger den **1,76 : 1 i ljust och
 * 1,34 : 1 i mörkt**, mot kravets 3 : 1. En besökare som tabbade genom ett
 * formulär i mörkt läge hade en markering hen knappt kunde se, och hela
 * sviten var grön eftersom ingenting mätte en outline.
 *
 * Nu ritas fokus av `@include focus.ring` (`src/viewer/styles/_focus.scss`):
 * ett **ogenomskinligt streck** i `--fw-text`, som bär kravet (14,58 : 1 som
 * sämst, mätt), plus **ringen** som box-shadow utanför, som är det som gör
 * markeringen till vår och inte till webbläsarens.
 *
 * **Vad testet vaktar, och vad det inte gör.** Det mäter att båda bärarna
 * finns på knappen i den renderade skuggroten — inte hur de ser ut, och inte
 * kontrasttalen. Talen räknas med samma formel som `contrast-ratio.ts` och
 * står i `_focus.scss` och i LOGG 21/9; ett test som läste dem ur samma
 * ställe som koden hade mätt sig självt (PRAXIS 3).
 *
 * Sett falla: med `box-shadow` struken ur mixinen går *ringen finns* rött och
 * *strecket finns* grönt; med `outline` struken tvärtom. Båda riktningarna
 * prövade, så påståendet kan skilja de två bärarna åt.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount(): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "sv");
  preview.style.cssText = "font-family: var(--fw-font, sans-serif);";
  document.body.append(preview);
  preview.graph = structuredClone(conferenceExampleGraph) as never;
  await settle();

  return preview;
}

/**
 * Knappen som för besökaren framåt, fokuserad som ett tangentbord gör det.
 *
 * **Tabb först, sedan `focus()`.** `:focus-visible` matchar inte ett
 * `focus()` från skript hur som helst — webbläsaren avgör på hur det senaste
 * draget gjordes. Ett tangentbordstryck först sätter det tillståndet, och
 * därefter räknas fokus som tangentbordsfokus. Utan tabben läser man av ett
 * element som visserligen är fokuserat men inte matchar regeln, och mäter då
 * "ingen indikator" på en indikator som finns.
 *
 * `getComputedStyle` tar inte en pseudoKLASS — bara pseudoelement — så
 * `getComputedStyle(el, ":focus-visible")` svarar med tomma strängar och inte
 * med ett fel. Första körningen mätte precis det och såg ut som ett fynd
 * (PRAXIS 16: en sond som svarar villigt på fel fråga).
 *
 * Raden om att knappen finns står kvar för att visa att ytan alls är den vi
 * tror: ett tomt svar ska inte kunna läsas som "ingen indikator" när det i
 * själva verket är "ingen knapp" (PRAXIS 12).
 */
async function focusedButton(): Promise<CSSStyleDeclaration> {
  const preview = await mount();
  const button = preview.shadowRoot!.querySelector<HTMLButtonElement>(
    '[data-action="next"]',
  );

  expect(button, "sidan ritar en Nästa-knapp att fokusera").not.toBeNull();

  await userEvent.keyboard("{Tab}");
  button!.focus();
  await settle();

  expect(preview.shadowRoot!.activeElement).toBe(button);
  expect(button!.matches(":focus-visible"), "knappen räknas som tangentbordsfokus").toBe(true);

  return getComputedStyle(button!);
}

describe("fokus har två bärare", () => {
  test.runIf(PRO)("strecket: en ogenomskinlig outline, inte tvätten", async () => {
    const style = await focusedButton();

    expect(style.outlineStyle).toBe("solid");
    expect(parseFloat(style.outlineWidth)).toBeGreaterThanOrEqual(3);
    /*
     * Ogenomskinligt är hela poängen: en färg med alfa är tvätten igen, och
     * det var den som mätte 1,34 : 1. `rgba(…, 0.35)` fastnar här.
     */
    expect(style.outlineColor).not.toMatch(/rgba\([^)]*,\s*0?\.\d+\s*\)/);
  });

  test.runIf(PRO)("ringen: en skugga utanför strecket", async () => {
    const style = await focusedButton();

    expect(style.boxShadow).not.toBe("none");
    // Ingen förskjutning, bara spridning: det är en ring och inte en skugga.
    expect(style.boxShadow).toMatch(/0px 0px 0px \d+px/);
  });
});
