import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Ett ENKELT uppslag som fält på en sida.
 *
 * ## Varför det saknades ett test här
 *
 * Uppslaget hade tre vägar och sviten täckte två: det egna kortet
 * (`guide-preview-lookup`) och det flervärda fältet på en sida
 * (`guide-preview-multi-lookup`). Det enkla fältet PÅ EN SIDA hade ingen — och
 * det är just den vägen som går genom sidans generella insamling, där varje
 * fält läses som `control.value`.
 *
 * Så länge kontrollen var `lookup-field` var `value` etiketten, alltså en
 * sträng, och det gick jämnt ut. `chip-picker.value` är en lista koder. Sidan
 * lagrade då kodlistan i stället för paret, och `value.trim()` på en lista
 * kastade innan någon hann se det.
 *
 * Lärdomen är formen och inte felet: när en kontroll byts ut måste VARJE väg
 * in i den ha ett test, inte varje kontroll.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const KOMMUNER = [
  { id: "a", value: "1880", label: "Örebro" },
  { id: "b", value: "1881", label: "Kumla" },
];

function graph(extra: Record<string, unknown> = {}): GraphData {
  return {
    version: 10,
    startNodeId: "s",
    nodes: [
      { id: "s", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Om dig" } } },
      {
        id: "f",
        type: "autocomplete-question",
        position: { x: 0, y: 0 },
        parentPageId: "s",
        order: 1,
        layout: { columnSpan: 12 },
        data: {
          title: { sv: "Vilken kommun?" },
          variableName: "kommun",
          source: "mock",
          mockItems: KOMMUNER,
          minChars: 2,
          ...extra,
        },
      },
      { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "s", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as unknown as GraphData;
}

type Picker = HTMLElement & {
  choices: Array<{ label: string; value: string }>;
  text: string;
};

async function viewer(extra: Record<string, unknown> = {}): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "sv");
  document.body.append(preview);
  preview.graph = graph(extra) as never;
  await settle(250);

  return preview;
}

const picker = (preview: GuidePreview): Picker =>
  preview.shadowRoot!.querySelector<Picker>("chip-picker[data-page-variable]")!;

const searchBox = (preview: GuidePreview): HTMLInputElement =>
  picker(preview).shadowRoot!.querySelector<HTMLInputElement>("[data-search]")!;

async function skriv(preview: GuidePreview, term: string): Promise<void> {
  const box = searchBox(preview);

  box.focus();
  box.value = term;
  box.dispatchEvent(new Event("input", { bubbles: true }));
  await settle(400);
}

const vidare = async (preview: GuidePreview): Promise<void> => {
  preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
  await settle(250);
};

describe("ett enkelt uppslag som sidfält", () => {
  test("lagrar paret, inte kodlistan", async () => {
    /*
     * Sidans generella insamling läser varje fälts `value`. Kontrollens är en
     * lista koder, så sidan lagrade `["1880"]` — en form ingen mall och ingen
     * regel förstår, och som dessutom inte bär etiketten brevet ska visa.
     */
    const preview = await viewer();

    await skriv(preview, "öre");
    picker(preview).shadowRoot!.querySelector<HTMLButtonElement>("[data-add]")!.click();
    await settle();

    await vidare(preview);

    expect(preview.getAnswers().kommun).toEqual({ label: "Örebro", value: "1880" });
  });

  test("och fri text som paret utan kod, när fältet tillåter det", async () => {
    const preview = await viewer({ allowFreeText: true });

    await skriv(preview, "Ödeshög");
    await vidare(preview);

    expect(preview.getAnswers().kommun).toEqual({ label: "Ödeshög", value: "" });
  });

  test("men ber om ett val ur listan när det inte gör det", async () => {
    /*
     * Det som kastade: beskedet byggs av `value.trim()`, och `value` var en
     * lista. En TypeError mitt i insamlingen ser inte ut som ett fel i fältet
     * — sidan bara slutar fungera.
     */
    const preview = await viewer();

    await skriv(preview, "Ödeshög");
    await vidare(preview);

    expect(preview.shadowRoot!.textContent, "sidan gick vidare ändå").not.toContain("Tack");
    expect(preview.shadowRoot!.textContent).toContain("Välj ett av förslagen");
  });
});

describe("fri text när man går tillbaka", () => {
  test("står kvar i rutan", async () => {
    /*
     * Gamla fältet fick texten tillbaka genom sitt `value`-attribut. Utan den
     * vägen såg steget tomt ut medan Nästa var påslagen — och nästa "vidare"
     * skrev över svaret med tomt. Ett svar man aldrig ändrat försvann genom
     * att man tittat på det, precis som etiketterna gjorde på flervalet.
     */
    const preview = document.createElement("guide-preview") as GuidePreview;

    preview.setAttribute("active-locale", "sv");
    document.body.append(preview);
    preview.graph = {
      version: 10,
      startNodeId: "q",
      nodes: [
        {
          id: "q",
          type: "autocomplete-question",
          position: { x: 0, y: 0 },
          data: {
            title: { sv: "Vilken kommun?" },
            variableName: "kommun",
            source: "mock",
            mockItems: KOMMUNER,
            minChars: 2,
            allowFreeText: true,
            required: true,
          },
        },
        { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
      ],
      connections: [
        { id: "c1", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
      ],
    } as never;
    await settle(250);

    const box = preview.shadowRoot!
      .querySelector<Picker>("chip-picker[data-text-answer]")!
      .shadowRoot!.querySelector<HTMLInputElement>("[data-search]")!;

    box.focus();
    box.value = "Ödeshög";
    box.dispatchEvent(new Event("input", { bubbles: true }));
    await settle(400);

    await vidare(preview);
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="previous"]')!.click();
    await settle(350);

    const åter = preview.shadowRoot!.querySelector<Picker>("chip-picker[data-text-answer]")!;

    expect(åter.text, "det man skrev kom inte tillbaka").toBe("Ödeshög");
    expect(
      preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.disabled,
      "Nästa var påslagen över en tom ruta",
    ).toBe(false);
  });
});
