import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Story 057 — flervalslistan blir etiketter i stället för ctrl-klick.
 *
 * Kryssrutor är kvar som standard och rätt när alternativen är få: de visar
 * allt på en gång och är mönstret alla känner igen. Det ANDRA läget var en
 * `<select multiple>`, alltså ctrl-klick — osynligt för den som inte fått veta,
 * och trasigt på pekskärm (praxis 17: en väg in som kräver något hälften av
 * enheterna inte har). Ett vanligt klick nollställde dessutom allt man valt.
 *
 * Visaren möts av fingrar, så träffytan är 44 px här — AA-golvet på 24 räcker
 * för ett redaktörsverktyg, inte för den publika ytan.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Tolv, alltså över tröskeln där sökrutan ska komma av sig själv. */
const LANDER = [
  "Sverige", "Finland", "Norge", "Danmark", "Island", "Tyskland",
  "Frankrike", "Spanien", "Portugal", "Polen", "Estland", "Litauen",
];

const graph = (selected: string[]): GraphData => ({
  version: 8,
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "multi-choice",
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Vad gäller felet?" },
        variableName: "fel",
        presentation: "multiselect",
        options: [
          { id: "a", label: { sv: "Belysning" }, value: "belysning" },
          { id: "b", label: { sv: "Cykelväg" }, value: "cykelvag" },
          { id: "c", label: { sv: "Klotter" }, value: "klotter" },
        ],
      },
    },
    { id: "r", type: "result", position: { x: 300, y: 0 }, data: { title: { sv: "Tack" } } },
  ],
  connections: [{ id: "c1", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "r", portId: "input" } }],
  ...(selected.length ? {} : {}),
}) as unknown as GraphData;

async function viewer(): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "sv");
  document.body.append(preview);
  preview.graph = graph([]) as never;

  await settle();

  return preview;
}

/**
 * Kontrollen bor i `chip-picker` sedan den delas med regelvillkorets värde, så
 * testerna går genom dess skugg-DOM. Påståendena är desamma: det är samma
 * beteende, på ett ställe i stället för två.
 */
const picker = (preview: GuidePreview): ShadowRoot =>
  preview.shadowRoot!.querySelector("[data-choice-picker]")!.shadowRoot!;

/** Alternativen visas när kontrollen används — samma gest som ett finger gör. */
const öppna = (preview: GuidePreview): void => {
  picker(preview)
    .querySelector<HTMLElement>(".chip-picker__box")
    ?.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
};

const chipLabels = (preview: GuidePreview): string[] =>
  [...picker(preview).querySelectorAll(".chip-picker__chip-label")]
    .map((one) => one.textContent?.trim() ?? "");

/**
 * Väljer ett alternativ — och söker fram det först när listan är lång.
 *
 * Alternativen tar inte plats innan man sökt: en lång lista hämtas fram, den
 * står inte och väntar. Så måste testet göra samma sak som en människa.
 */
async function choose(preview: GuidePreview, value: string): Promise<void> {
  öppna(preview);
  await settle();

  const search = picker(preview).querySelector<HTMLInputElement>(
    "[data-search]:not([hidden])",
  );

  if (search) {
    const label = [...picker(preview).querySelectorAll("[data-add]")].length;

    void label;
    search.value = value;
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
  }

  const button = picker(preview).querySelector<HTMLButtonElement>(
    `[data-add][data-value="${value}"]`,
  );

  if (!button) throw new Error(`Alternativet ${value} går inte att lägga till.`);

  button.click();
  await settle();
}

describe("flervalslistan i visaren", () => {
  test("har ingen select multiple kvar", async () => {
    const preview = await viewer();

    expect(preview.shadowRoot!.querySelector("select[multiple]")).toBeNull();
  });

  test("valda alternativ blir etiketter", async () => {
    const preview = await viewer();

    await choose(preview, "belysning");
    await choose(preview, "klotter");

    expect(chipLabels(preview)).toEqual(["Belysning", "Klotter"]);
  });

  test("och svaret följer med framåt", async () => {
    const preview = await viewer();

    await choose(preview, "belysning");
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();

    expect(preview.getAnswers().fel).toContain("belysning");
  });

  test("en etikett går att ta bort", async () => {
    const preview = await viewer();

    await choose(preview, "belysning");
    await choose(preview, "klotter");
    picker(preview).querySelector<HTMLButtonElement>("[data-remove]")!.click();
    await settle();

    expect(chipLabels(preview)).toEqual(["Klotter"]);
  });

  test("borttagningsknappen träffas i 44 px — visaren möts av fingrar", async () => {
    /*
     * Mätt med fingertoppar, inte med knappens ruta. Krysset ritas litet så
     * etiketten inte blir mest kryss, och ytan läggs på med ett pseudoelement
     * som `getBoundingClientRect` inte känner till. Det som ska hålla är vad
     * ett finger träffar — så det är det som mäts.
     */
    const preview = await viewer();

    await choose(preview, "belysning");

    const kryss = picker(preview).querySelector<HTMLButtonElement>("[data-remove]")!;
    const mitt = kryss.getBoundingClientRect();
    const x = mitt.left + mitt.width / 2;
    const y = mitt.top + mitt.height / 2;

    for (const [dx, dy] of [[-21, -21], [21, -21], [-21, 21], [21, 21]] as const) {
      const träff = picker(preview).elementFromPoint(x + dx, y + dy);

      expect(
        träff === kryss || kryss.contains(träff),
        `punkten (${dx}, ${dy}) träffade ${träff?.className ?? "ingenting"}`,
      ).toBe(true);
    }
  });

  test("och något säger vad som hände", async () => {
    const preview = await viewer();

    await choose(preview, "cykelvag");

    const status = picker(preview).querySelector("[data-status]")!;

    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toMatch(/Cykelväg/);
  });
});

const langGraph = (): GraphData => ({
  version: 8,
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "multi-choice",
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Vilka länder är du medborgare i?" },
        variableName: "medborgarskap",
        presentation: "multiselect",
        options: LANDER.map((namn) => ({
          id: namn.toLowerCase(),
          label: { sv: namn },
          value: namn.toLowerCase(),
        })),
      },
    },
    { id: "r", type: "result", position: { x: 300, y: 0 }, data: { title: { sv: "Tack" } } },
  ],
  connections: [{ id: "c1", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "r", portId: "input" } }],
}) as unknown as GraphData;

async function longViewer(): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "sv");
  document.body.append(preview);
  preview.graph = langGraph() as never;

  await settle();

  return preview;
}

/*
 * Den sökruta som VISAS.
 *
 * Rutan skapas en gång och står kvar — plattans tangentbord hör ihop med ett
 * element, och byts elementet ut mitt i inmatningen fälls det ihop. Att den
 * inte finns att söka i betyder därför att den är dold, inte att den saknas
 * ur skuggan. Påståendena är desamma.
 */
const search = (preview: GuidePreview): HTMLInputElement | null =>
  picker(preview).querySelector<HTMLInputElement>("[data-search]:not([hidden])");

const offered = (preview: GuidePreview): string[] =>
  [...picker(preview).querySelectorAll("[data-add]")].map(
    (one) => one.textContent?.trim() ?? "",
  );

async function type(preview: GuidePreview, term: string): Promise<void> {
  öppna(preview);
  await settle();

  const box = search(preview)!;

  // Som en människa: markören står i rutan medan hon skriver.
  box.focus();
  box.value = term;
  box.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();
}

describe("söket, som kommer av listans längd", () => {
  test("finns inte när alternativen är få", async () => {
    /*
     * Tre alternativ behöver ingen sökruta. Den vore brus — och den skulle
     * dessutom vara en inställning till som kan sättas fel.
     */
    expect(search(await viewer())).toBeNull();
  });

  test("men finns när listan blivit för lång att skanna", async () => {
    expect(search(await longViewer())).not.toBeNull();
  });

  test("och filtrerar på det man skriver", async () => {
    const preview = await longViewer();

    await type(preview, "land");

    expect(offered(preview)).toEqual(["Finland", "Island", "Tyskland", "Estland"]);
  });

  test("utan att tappa det man redan valt", async () => {
    /*
     * Sökningen rör bara vad som erbjuds. Ett val som försvinner för att man
     * skrev vidare är den sortens fel man inte upptäcker förrän svaret är
     * inskickat.
     */
    const preview = await longViewer();

    await choose(preview, "norge");
    await type(preview, "land");

    expect(chipLabels(preview)).toEqual(["Norge"]);
  });

  test("och fokus står kvar i rutan medan man skriver", async () => {
    /*
     * Listan ritas om vid varje tangenttryck. Rutan gjorde det förut också,
     * och fokus fick sättas tillbaka för hand — vilket fungerar i en
     * webbläsare med mus och fäller ihop tangentbordet på en platta, där
     * det hör ihop med ett element som just byttes ut.
     *
     * Nu ritas rutan en gång och står kvar, så det som mäts är att den ÄR
     * samma element och att ingenting tar fokus ifrån den.
     */
    const preview = await longViewer();
    const före = search(preview);

    await type(preview, "la");

    expect(search(preview), "sökrutan byttes ut mitt i inmatningen").toBe(före);
    expect(picker(preview).activeElement).toBe(search(preview));
  });

  test("ett valt alternativ erbjuds inte igen", async () => {
    const preview = await longViewer();

    await choose(preview, "sverige");

    expect(offered(preview)).not.toContain("Sverige");
  });

  test("det valda ligger i en ruta, det valbara utanför", async () => {
    /*
     * Hittat i en skärmbild: valda etiketter och valbara alternativ ritades
     * likadant — två rader rundade konturer, som bara krysset skilde åt. Man
     * läste dem som en enda lista.
     *
     * Rutan är samma grepp som uppslagsfältet fick: den säger *det här är ditt
     * svar*, och det som står under den är något att lägga till. Ett hus i
     * stället för en färgskillnad, för färg ensam är inte skillnad nog (1.4.1).
     */
    const preview = await viewer();

    await choose(preview, "belysning");

    const ruta = picker(preview).querySelector(".chip-picker__box")!;

    expect(ruta.querySelector("[data-chosen]"), "etiketten i rutan").not.toBeNull();
    expect(ruta.querySelector("[data-add]"), "alternativet utanför").toBeNull();
  });

  test("och rutan finns även innan man valt något", async () => {
    // Annars hoppar layouten vid första klicket, och tomrummet säger ingenting.
    const preview = await viewer();
    const ruta = picker(preview).querySelector(".chip-picker__box")!;

    expect(ruta).not.toBeNull();
    expect(ruta.textContent).toContain("Inget valt än");
  });

  test("sökrutan ligger i rutan, hos det den söker fram", async () => {
    const preview = await longViewer();

    expect(
      picker(preview).querySelector(".chip-picker__box [data-search]"),
    ).not.toBeNull();
  });

  test("och etiketterna står kvar när man backar", async () => {
    /*
     * Pillboxen läser sitt valda ur motorns svar och inte ur ett utkast, så
     * den ska klara det här av sig självt. Prövat i stället för antaget:
     * uppslagsfältet såg likadant ut och gjorde det inte.
     */
    const preview = await longViewer();

    await choose(preview, "norge");
    await choose(preview, "polen");

    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle(150);
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="previous"]')!.click();
    await settle(200);

    expect(chipLabels(preview)).toEqual(["Norge", "Polen"]);
  });

  test("och de går fortfarande att ta bort efteråt", async () => {
    const preview = await longViewer();

    await choose(preview, "norge");
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle(150);
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="previous"]')!.click();
    await settle(200);

    picker(preview).querySelector<HTMLButtonElement>("[data-remove]")!.click();
    await settle(150);

    expect(chipLabels(preview)).toEqual([]);
  });
});
