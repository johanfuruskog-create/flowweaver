import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * En vanlig fråga med många alternativ: sökbar lista i stället för en spalt.
 *
 * ## Varför ett tredje läge
 *
 * Johans iakttagelse: pillboxen tar mindre plats, och **vissa frågor har
 * väldigt många alternativ**. Radioknappar visar allt på en gång, vilket är
 * rätt vid fem och obrukbart vid femtio: en spalt man skrollar förbi, där man
 * tappar bort vad som stod överst innan man nått botten.
 *
 * Rullgardinen finns redan och löser platsen — men inte letandet. En
 * `<select>` har ingen sökning värd namnet, och på en telefon blir den en
 * hjullista genom alla alternativ.
 *
 * ## Varför samma kontroll som flervalet
 *
 * För att det är samma handling: hitta något i en lista och välja det. Att
 * skriva en egen enkelvalsvariant hade varit den tredje kopian på en dag.
 * Skillnaden är ett attribut — `single` — inte en andra kontroll.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const LANDER = [
  "Sverige", "Finland", "Norge", "Danmark", "Island",
  "Tyskland", "Frankrike", "Spanien", "Portugal", "Polen",
];

const graph = (presentation: string): GraphData => ({
  version: 9,
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Var bor du?" },
        variableName: "bostad",
        presentation,
        options: LANDER.map((namn) => ({
          id: `o-${namn.toLowerCase()}`,
          label: { sv: namn },
          value: namn.toLowerCase(),
        })),
      },
    },
    { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
  ],
  connections: LANDER.map((namn) => ({
    id: `c-${namn}`,
    from: { nodeId: "q", portId: `o-${namn.toLowerCase()}` },
    to: { nodeId: "r", portId: "input" },
  })),
}) as unknown as GraphData;

async function viewer(presentation = "search"): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "sv");
  document.body.append(preview);
  preview.graph = graph(presentation) as never;

  await settle();

  return preview;
}

const picker = (preview: GuidePreview): ShadowRoot =>
  preview.shadowRoot!.querySelector("[data-choice-picker]")!.shadowRoot!;

/** Alternativen visas när kontrollen används — samma gest som ett finger gör. */
const öppna = (preview: GuidePreview): void => {
  picker(preview)
    .querySelector<HTMLElement>(".chip-picker__box")
    ?.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
};

const chips = (preview: GuidePreview): string[] =>
  [...picker(preview).querySelectorAll(".chip-picker__chip-label")].map(
    (one) => one.textContent?.trim() ?? "",
  );

/** Söker fram alternativet först när listan är lång — som en människa måste. */
async function choose(preview: GuidePreview, id: string): Promise<void> {
  öppna(preview);
  await settle();

  const search = picker(preview).querySelector<HTMLInputElement>(
    "[data-search]:not([hidden])",
  );

  if (search) {
    search.value = id.replace(/^o-/, "");
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
  }

  picker(preview).querySelector<HTMLButtonElement>(`[data-add][data-value="${id}"]`)!.click();
  await settle();
}

describe("en fråga som visas som sökbar lista", () => {
  test("ritar kontrollen, inte radioknappar", async () => {
    const preview = await viewer();

    expect(preview.shadowRoot!.querySelector("[data-choice-picker]")).not.toBeNull();
    expect(preview.shadowRoot!.querySelector('input[type="radio"]')).toBeNull();
  });

  test("och har sökruta, för listan är lång", async () => {
    expect(picker(await viewer()).querySelector("[data-search]")).not.toBeNull();
  });

  test("ett val blir en etikett", async () => {
    const preview = await viewer();

    await choose(preview, "o-norge");

    expect(chips(preview)).toEqual(["Norge"]);
  });

  test("ett andra val ERSÄTTER det första", async () => {
    /*
     * Det är en fråga med ett svar. Två etiketter hade sett ut som ett flerval
     * och lämnat frågan om vilken av dem som styr vägen vidare.
     */
    const preview = await viewer();

    await choose(preview, "o-norge");
    await choose(preview, "o-polen");

    expect(chips(preview)).toEqual(["Polen"]);
  });

  test("och svaret leder vidare på sin egen väg", async () => {
    const preview = await viewer();

    await choose(preview, "o-danmark");
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();

    expect(preview.getAnswers().bostad).toBe("danmark");
    expect(preview.shadowRoot!.textContent).toContain("Tack");
  });

  test("utan val säger den till i stället för att gå vidare", async () => {
    const preview = await viewer();

    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();

    expect(preview.shadowRoot!.textContent).not.toContain("Tack");
  });
});

describe("de två gamla lägena", () => {
  test("radioknappar ritas som förut", async () => {
    expect((await viewer("radio")).shadowRoot!.querySelector('input[type="radio"]')).not.toBeNull();
  });

  test("och rullgardinen med", async () => {
    expect((await viewer("select")).shadowRoot!.querySelector("[data-choice-single]")).not.toBeNull();
  });

  test("och rutan säger inte 'inget valt' bredvid det man skriver", async () => {
    /*
     * Sett i en skärmbild: platshållaren stod kvar till vänster om markören
     * medan man sökte, så rutan bar två texter som konkurrerade. Sökrutan har
     * sin egen platshållare och gör jobbet; den andra är bara i vägen.
     */
    const preview = await viewer();
    const ruta = picker(preview).querySelector(".chip-picker__box")!;

    expect(ruta.textContent?.trim()).toBe("");
  });
});
