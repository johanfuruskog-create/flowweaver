import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";


import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../../testing/optional-pro";
const { conferenceExampleGraph } = ((await proModule("data/conference-example-graph.ts")) ?? {}) as { conferenceExampleGraph: GraphData };
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * Berättelse 134, en Fable-uppföljning (Ted 21/9): raden *Några alternativ
 * visas inte utifrån dina tidigare svar* satt med lika luft ovanför och
 * nedanför på konferenscasets *Menyn*-sida — mellan huvudrättens lista och
 * rubriken *Efterrätt* — och läste därför som en inledning till efterrätten i
 * stället för en fortsättning på listan ovanför.
 *
 * Designskillens regel: besläktat binds med **halva** avståndet till det som
 * svarar på något annat. Raden hör till huvudrättens lista (den säger att
 * *den* listan är kortare än den ser ut), inte till nästa fråga. Så luften
 * uppåt ska vara högst hälften av luften nedåt — den nedåt är avståndet
 * mellan två skilda frågor på sidan, det vanliga och redan befintliga.
 *
 * Mätt med `getBoundingClientRect`, inte på ögonmått (skillen), på den
 * riktiga guiden (`conferenceExampleGraph`) med nötallergi svarad, som är det
 * enda villkoret på den här sidan som håller ett alternativ tillbaka.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount(): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "sv");
  // Sajtens typsnitt, inte webbläsarens serif — annars mäts fel yta (skillen).
  preview.style.cssText = "font-family: var(--fw-font, sans-serif);";
  document.body.append(preview);
  preview.graph = structuredClone(conferenceExampleGraph) as never;
  await settle();

  return preview;
}

const root = (preview: GuidePreview): ShadowRoot => preview.shadowRoot!;

const next = async (preview: GuidePreview): Promise<void> => {
  root(preview).querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
  await settle();
};

const pick = async (preview: GuidePreview, variable: string, value: string): Promise<void> => {
  const radio = root(preview).querySelector<HTMLInputElement>(
    `input[data-page-variable="${variable}"][value="${value}"]`,
  )!;

  radio.checked = true;
  radio.dispatchEvent(new Event("change", { bubbles: true }));
  await settle();
};

/** Söker fram Stockholmsupplagan, svarar på nivån och går vidare (samma väg som 134:s eget test). */
async function chooseConference(preview: GuidePreview): Promise<void> {
  const picker = root(preview).querySelector<HTMLElement>("chip-picker")!;
  const box = picker.shadowRoot!.querySelector<HTMLInputElement>("[data-search]")!;

  box.focus();
  box.value = "Stock";
  box.dispatchEvent(new Event("input", { bubbles: true }));
  await settle(400);
  picker.shadowRoot!.querySelector<HTMLButtonElement>("[data-add]")!.click();
  await settle(200);
  await next(preview);

  // Var står du i dag? (Johan 1/10) — ett eget steg före vistelsen.
  const level = root(preview).querySelector<HTMLInputElement>('input[data-option-id="conference-level-basic"]')!;

  level.checked = true;
  level.dispatchEvent(new Event("change", { bubbles: true }));
  await settle();
  await next(preview);
}

/** Kryssar för nötter på allergifrågan — det enda villkoret på Menyn-sidan. */
async function nutAllergy(preview: GuidePreview): Promise<void> {
  const box = root(preview).querySelector<HTMLInputElement>(
    'input[name="guide-preview-multi"][value="notter"]',
  )!;

  box.checked = true;
  box.dispatchEvent(new Event("change", { bubbles: true }));
  await settle();
  await next(preview);
}

/** Fram till Menyn-sidan, en dag, med nötallergi svarad. */
async function walkToMenu(): Promise<GuidePreview> {
  const preview = await mount();

  await chooseConference(preview);
  await pick(preview, "dagar", "1");
  await next(preview);
  await nutAllergy(preview);

  return preview;
}

describe("134 uppföljning — luften kring \"Några alternativ visas inte\" på Menyn", () => {
  test.runIf(PRO)("raden binds till huvudrättens lista: luften uppåt är högst hälften av luften nedåt", async () => {
    const preview = await walkToMenu();

    const mainChoices = root(preview).querySelector<HTMLElement>(
      '[data-page-field-id="conference-main"] .guide-preview__page-choices',
    )!;
    const row = root(preview).querySelector<HTMLElement>(
      '[data-page-field-id="conference-main"] [data-options-hidden]',
    )!;
    const dessertLegend = root(preview).querySelector<HTMLElement>(
      '[data-page-field-id="conference-dessert"] legend',
    )!;

    expect(row, "nötcurryn ska vara utesluten, och raden ska finnas").toBeTruthy();

    const above = row.getBoundingClientRect().top - mainChoices.getBoundingClientRect().bottom;
    const below = dessertLegend.getBoundingClientRect().top - row.getBoundingClientRect().bottom;

    expect(above, "luften uppåt (rad ← huvudrättens lista)").toBeGreaterThan(0);
    expect(below, "luften nedåt (rad → Efterrätt)").toBeGreaterThan(0);
    expect(above, "uppåt ska vara högst hälften av nedåt").toBeLessThanOrEqual(below / 2 + 0.5);
  });
});

/**
 * Fable-uppföljning 21/9: Johan på skärmbilden av Menyn — *"Huvudrätt och
 * efterrätt ligger för nära listboxarna."* Mätt med `getBoundingClientRect`:
 * etikett (`legend`) → alternativlistans första rad var **0px**, inte de 8px
 * `.guide-preview__page-field`s egen `gap` är satt till.
 *
 * Orsaken är webbläsarens egen layout för `<legend>`: den notchar
 * fieldsetets kant med en egen algoritm och räknas inte som ett vanligt
 * rutnätsbarn, så grid-`gap` hoppar över den — samma anledning till att
 * `.guide-preview__options` (den fristående frågesteget) redan har en
 * `legend { margin-bottom: var(--fw-space-2) }`-regel av samma skäl.
 * `.guide-preview__page-field`, som Huvudrätt/Efterrätt använder på en
 * flerfältssida, saknade motsvarigheten.
 *
 * Referensen för vad "rätt" är: ett textfält på samma guide (*Namn* på
 * kontaktsidan) vars etikett → fält redan är 8px, eftersom den etiketten är
 * en vanlig `<label>` i en `<div>` och inte en `<legend>` i en `<fieldset>`
 * — grid-gapet fungerar där som avsett. Rättningen ger legend samma 8px för
 * hand, så luften blir lika på båda fältslagen i stället för att alternativ-
 * listan läses som ihopklistrad med sin rubrik.
 */
describe("Fable-uppföljning 21/9 — legend → lista lika luftig som etikett → textfält", () => {
  test.runIf(PRO)("Huvudrätt och Efterrätt: legend → första alternativet ≈ Namn: etikett → fältet (±1px)", async () => {
    const preview = await walkToMenu();

    const mainLegend = root(preview).querySelector<HTMLElement>(
      '[data-page-field-id="conference-main"] legend',
    )!;
    const mainFirstOption = root(preview).querySelector<HTMLElement>(
      '[data-page-field-id="conference-main"] .guide-preview__page-choices label',
    )!;
    const dessertLegend = root(preview).querySelector<HTMLElement>(
      '[data-page-field-id="conference-dessert"] legend',
    )!;
    const dessertFirstOption = root(preview).querySelector<HTMLElement>(
      '[data-page-field-id="conference-dessert"] .guide-preview__page-choices label',
    )!;

    const mainGap = mainFirstOption.getBoundingClientRect().top - mainLegend.getBoundingClientRect().bottom;
    const dessertGap =
      dessertFirstOption.getBoundingClientRect().top - dessertLegend.getBoundingClientRect().bottom;

    // Vidare till Dina kontaktuppgifter för textfältets referensmått, på
    // samma guide och med samma sidfältsgrid — bara utan fieldset-notchen.
    await pick(preview, "huvudratt", "vegetariskt");
    await pick(preview, "efterratt", "fruktsallad");
    await next(preview); // Menyn → Pass du vill gå på
    await pick(preview, "passval", "sprakmodell");
    await pick(preview, "passtillval", "ja"); // berättelse 138: passets andra fråga
    await next(preview); // Pass du vill gå på → Dina kontaktuppgifter

    const nameLabel = root(preview).querySelector<HTMLElement>(
      '[data-page-field-id="conference-name"] label',
    )!;
    const nameInput = root(preview).querySelector<HTMLElement>(
      '[data-page-field-id="conference-name"] input',
    )!;

    expect(nameLabel, "kontaktsidan ska ha nåtts").toBeTruthy();

    const textGap = nameInput.getBoundingClientRect().top - nameLabel.getBoundingClientRect().bottom;

    expect(Math.abs(mainGap - textGap), "Huvudrätt: legend → första alternativet, ±1px mot textfältet").toBeLessThanOrEqual(1);
    expect(Math.abs(dessertGap - textGap), "Efterrätt: legend → första alternativet, ±1px mot textfältet").toBeLessThanOrEqual(1);
  });
});
