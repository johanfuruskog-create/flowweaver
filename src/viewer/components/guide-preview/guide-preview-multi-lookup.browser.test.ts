import { answerField } from "../../core/answer-values";
import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import { registerCodeList } from "../../code-lists/code-list-registry";
import { navetCountryCodes } from "../../code-lists/navet-country-codes";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Sökfältet med flera val, som ett eget kort.
 *
 * ## Hur det här hittades
 *
 * Genom att titta. Medborgarskapsguiden gjordes plural — *vilka* medborgarskap
 * har du — och sviten var grön, bygget grönt, rökprovet 104/104. Skärmbilden
 * visade ett kort med rubrik, beskrivning, texten "Välj ett eller flera" och
 * **ingen inmatning alls**.
 *
 * Orsaken satt i ordningen mellan två villkor: `cardinality === "multi"`
 * prövades före `input === "lookup"`, så ett flervärt uppslag hamnade i
 * flervalsfrågans rendering och ritade en tom alternativlista. Kontrollen har
 * aldrig fungerat som eget kort — bara som fält inuti en sida, där sidan väljer
 * rendering på fälttyp i stället.
 *
 * Ingenting fångade det, eftersom varje test som rörde kontrollen la den i en
 * sida. Det här kortet är den vägen som saknades.
 */

registerCodeList(navetCountryCodes);

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const graph = (): GraphData => ({
  version: 8,
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "multi-autocomplete-question",
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Vilka länder är du medborgare i?" },
        variableName: "land",
        source: "codelist",
        codeListId: "navet-country-codes",
        allowFreeText: false,
        required: true,
        minChars: 2,
      },
    },
    { id: "r", type: "result", position: { x: 300, y: 0 }, data: { title: { sv: "Tack" } } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
  ],
}) as unknown as GraphData;

/*
 * Kontrollen är `chip-picker` sedan 2026-08-31 — samma element som visarens
 * flervalslista. Påståendena nedan är oförändrade; gesten är det som bytts.
 * Modellen har inga piltangenter, så valet görs på alternativets knapp.
 */
type Picker = HTMLElement & { choices: Array<{ label: string; value: string }> };

const picker = (preview: GuidePreview): Picker =>
  preview.shadowRoot!.querySelector<Picker>("chip-picker[data-text-lookup]")!;

const etiketter = (field: Picker): string[] =>
  [...field.shadowRoot!.querySelectorAll(".chip-picker__chip-label")].map(
    (one) => one.textContent?.trim() ?? "",
  );

const koder = (field: Picker): string[] => field.choices.map((one) => one.value);

/** Söker fram ett land och trycker på det, som ett finger gör. */
async function välj(field: Picker, term: string): Promise<void> {
  const box = field.shadowRoot!.querySelector<HTMLInputElement>("[data-search]")!;

  box.focus();
  box.value = term;
  box.dispatchEvent(new Event("input", { bubbles: true }));
  await settle(400);

  field.shadowRoot!.querySelector<HTMLButtonElement>("[data-add]")!.click();
  await settle(200);
}

async function viewer(): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "sv");
  document.body.append(preview);
  preview.graph = graph() as never;

  await settle();

  return preview;
}

describe("ett flervärt uppslag som eget kort", () => {
  test("ritar ett sökfält", async () => {
    const field = picker(await viewer());

    expect(field).not.toBeNull();
    expect(field.shadowRoot!.querySelector("[data-search]:not([hidden])")).not.toBeNull();
  });

  test("och inte en tom alternativlista", async () => {
    /*
     * Det felaktiga kortet var inte tomt — det bar flervalsfrågans etikett över
     * ingenting. Att bara leta efter fältet hade missat att kortet dessutom
     * påstod något osant om vad man skulle göra.
     */
    const preview = await viewer();

    expect(preview.shadowRoot!.querySelector("[data-choice-chips]")).toBeNull();
    expect(preview.shadowRoot!.querySelector(".guide-preview__options")).toBeNull();
  });

  test("som tar emot flera värden", async () => {
    // Flertalet är förvalet nu: `single` är det som sätts på ett enda val.
    expect(picker(await viewer()).hasAttribute("single")).toBe(false);
  });

  test("och bär både namnen och koderna vidare", async () => {
    /*
     * Hela kedjan guiden bygger på: två val, två variabler, båda listor. En
     * regel testar koderna — namnet är översatt, koden är det inte — så ett
     * tomt `landskod` hade skickat alla till standardgrenen utan att något
     * såg trasigt ut.
     */
    const preview = await viewer();
    const field = picker(preview);

    for (const term of ["Danmark", "Turkiet"]) await välj(field, term);

    expect(koder(field).sort()).toEqual(["DK", "TR"]);

    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle(200);

    const answers = preview.getAnswers();

    expect(answerField(answers.land, "value").sort()).toEqual(["DK", "TR"]);
    /*
     * Svaret är PAREN: etikett och kod tillsammans, ett värde per val. Koderna
     * i sin egen variabel härleds ur samma värde vid samma tillfälle, så de
     * kan inte glida isär — förut var de två parallella listor som hölls i
     * takt av index.
     */
    expect(answers.land).toEqual([
      { label: "Danmark", value: "DK" },
      { label: "Turkiet", value: "TR" },
    ]);
  });

  test("och ber om val, inte om skrivet svar", async () => {
    /*
     * Kortet sa "Skriv ditt svar" över ett fält där man väljer länder ur en
     * sluten lista — man kan inte skriva ett svar, bara söka fram ett. Sett i
     * skärmbilden efter att fältet börjat ritas alls; sviten var grön hela
     * tiden, för den mätte att fältet fanns och aldrig vad det bad om.
     */
    const preview = await viewer();
    const label = preview.shadowRoot!.querySelector(".guide-preview__value-answer span")!;

    expect(label.textContent).toContain("Välj en eller flera");
  });

  test("och man får tillbaka sina val när man backar", async () => {
    /*
     * Hittat av Johan på en iPad. Motorn tappade ingenting — mätningen visade
     * `land = "Danmark\nTyskland"` och `landskod = "DK\nDE"` kvar i svaren,
     * och `value`-attributet satt rätt på fältet. Det var kontrollen som inte
     * byggde upp sina etiketter igen ur värdet den fått, så kortet såg tomt ut
     * medan svaret fanns.
     *
     * Värre än att se tomt ut: fyllde man i något nytt och gick vidare, skrevs
     * de gamla valen över av bara det nya. Ett svar man aldrig ändrat försvann
     * genom att man tittat på det.
     *
     * Koden måste tillbaka med etiketten. En återställd etikett utan kod är en
     * etikett ingen regel kan läsa — och regeln är hela skälet att koden lagras
     * bredvid namnet.
     */
    const preview = await viewer();
    const field = picker(preview);

    for (const term of ["Danmark", "Tyskland"]) await välj(field, term);

    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle(200);
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="previous"]')!.click();
    await settle(300);

    const åter = picker(preview);

    expect(etiketter(åter)).toEqual(["Danmark", "Tyskland"]);
    expect(koder(åter)).toEqual(["DK", "DE"]);
  });

  test("och ett återställt val går att ta bort", async () => {
    /*
     * Etiketter som ritas ur ett värde men inte finns i kontrollens egen lista
     * är dekor: krysset gör ingenting, och det märks först när någon försöker
     * ändra sig.
     */
    const preview = await viewer();

    await välj(picker(preview), "Danmark");

    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle(200);
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="previous"]')!.click();
    await settle(300);

    const åter = picker(preview);

    åter.shadowRoot!.querySelector<HTMLButtonElement>("[data-remove]")!.click();
    await settle(200);

    expect(åter.shadowRoot!.querySelectorAll("[data-chosen]")).toHaveLength(0);
    expect(åter.choices).toEqual([]);
  });

  test("och samma sak gäller uppslaget inuti en sida", async () => {
    /*
     * Sidan var värre än det egna kortet. Där ligger koden i en dold ruta som
     * ritades UTAN värde, så gick man tillbaka och vidare igen — utan att röra
     * fältet — skrevs `landskod` över med tomt. Etiketterna såg försvunna ut
     * och koden försvann på riktigt.
     *
     * Mätt, inte antaget: `doldKod: ""` medan svaret sa `landskod = "DK\nDE"`.
     */
    const preview = document.createElement("guide-preview") as GuidePreview;

    preview.setAttribute("active-locale", "sv");
    document.body.append(preview);
    preview.graph = {
      version: 8,
      startNodeId: "s",
      nodes: [
        { id: "s", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Om dig" } } },
        {
          id: "f",
          type: "multi-autocomplete-question",
          position: { x: 0, y: 0 },
          parentPageId: "s",
          order: 1,
          layout: { columnSpan: 12 },
          data: {
            title: { sv: "Länder" },
            variableName: "land",
                source: "codelist",
            codeListId: "navet-country-codes",
            minChars: 2,
          },
        },
        {
          id: "t",
          type: "text-question",
          position: { x: 400, y: 0 },
          data: { title: { sv: "Något annat" }, variableName: "annat" },
        },
        { id: "r", type: "result", position: { x: 800, y: 0 }, data: { title: { sv: "Klart" } } },
      ],
      connections: [
        { id: "c1", from: { nodeId: "s", portId: "continue" }, to: { nodeId: "t", portId: "input" } },
        { id: "c2", from: { nodeId: "t", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
      ],
    } as never;
    await settle(250);

    for (const term of ["Danmark", "Tyskland"]) await välj(picker(preview), term);

    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle(250);
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="previous"]')!.click();
    await settle(350);

    expect(etiketter(picker(preview))).toEqual(["Danmark", "Tyskland"]);

    // Och vidare igen utan att röra fältet får inte tömma koden.
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle(250);

    expect(answerField(preview.getAnswers().land, "value")).toEqual(["DK", "DE"]);
  });
});
