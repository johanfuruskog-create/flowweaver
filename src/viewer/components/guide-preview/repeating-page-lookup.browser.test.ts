import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { ChipPicker } from "../chip-picker/chip-picker";
import type { GraphData } from "../../types/graph";

/**
 * Ett uppslag på en sida som upprepas (story 090, avgjort under bygget).
 *
 * Beställ blanketter mättes på prova-sidan: besökaren valde *Ansökan om
 * bygglov*, tryckte Lägg till blankett — och valet var borta. Posten
 * lagrade bara etiketten (`recordOf` gjorde text av paret), och
 * återställningen läste det platta svaret under fältets namn, som en post
 * aldrig har. Så varje omritning av sidan — Lägg till, Föregående, Ändra
 * från granskningen — tömde uppslaget, utan ett fel någonstans.
 *
 * Paret ska överleva: det är samma beslut som för uppslaget på en vanlig
 * sida (etikett och kod är ETT värde), fast en nivå ner.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const graph: GraphData = {
  startNodeId: "blankett",
  settings: { sourceLocale: "sv" },
  nodes: [
    {
      id: "blankett", type: "page", position: { x: 0, y: 0 },
      data: { title: { sv: "Blanketter" }, repeats: true, repeatWord: { sv: "blankett" }, repeatVariable: "blankett" },
    },
    {
      id: "namn", type: "autocomplete-question", parentPageId: "blankett", order: 1, position: { x: 0, y: 0 },
      data: {
        title: { sv: "Blankett" }, variableName: "namn", required: true, source: "mock", minChars: 1,
        mockItems: [{ value: "bygglov", label: "Ansökan om bygglov" }, { value: "eldstad", label: "Anmälan om eldstad" }],
      },
    },
    {
      id: "antal", type: "number-question", parentPageId: "blankett", order: 2, position: { x: 0, y: 0 },
      data: { title: { sv: "Antal" }, variableName: "antal", required: true },
    },
    { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" }, description: { sv: "{{blankett}}" } } },
  ],
  connections: [
    { id: "c", from: { nodeId: "blankett", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
  ],
} as never;

async function mount(): Promise<{ preview: GuidePreview; root: ShadowRoot }> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  document.body.append(preview);
  preview.graph = graph;
  await settle();
  return { preview, root: preview.shadowRoot! };
}

const picker = (root: ShadowRoot, index: number) =>
  root.querySelector<ChipPicker>(`[data-page-field-id="namn#${index}"] chip-picker`)!;
const chips = (root: ShadowRoot) =>
  [...root.querySelectorAll<ChipPicker>("chip-picker")].map((one) => one.choices.map((choice) => choice.label).join("|"));
const antal = (root: ShadowRoot, index: number, value: string) => {
  const input = root.querySelector<HTMLInputElement>(`[data-page-field-id="antal#${index}"] input`)!;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};
const pick = async (root: ShadowRoot, index: number, term: string) => {
  const field = picker(root, index);
  const search = field.shadowRoot!.querySelector<HTMLInputElement>("[data-search]")!;
  search.value = term;
  search.dispatchEvent(new Event("input", { bubbles: true }));
  await settle(200);
  field.shadowRoot!.querySelector<HTMLButtonElement>("[data-options] button")!.click();
  await settle();
};
const click = (root: ShadowRoot, selector: string) => root.querySelector<HTMLButtonElement>(selector)!.click();

describe("ett uppslag på en sida som upprepas", () => {
  test("valet står kvar när en post läggs till, och paret följer med i svaret", async () => {
    const { preview, root } = await mount();

    await pick(root, 0, "bygg");
    antal(root, 0, "2");
    expect(chips(root)).toEqual(["Ansökan om bygglov"]);

    click(root, '[data-action="repeat-add"]');
    await settle();
    expect(chips(root)).toEqual(["Ansökan om bygglov", ""]);

    await pick(root, 1, "eld");
    antal(root, 1, "1");
    click(root, '[data-action="next"]');
    await settle();

    expect(preview.getAnswers()).toEqual({
      blankett: [
        { namn: { label: "Ansökan om bygglov", value: "bygglov" }, antal: "2" },
        { namn: { label: "Anmälan om eldstad", value: "eldstad" }, antal: "1" },
      ],
    });
    // Texten läser etiketten ur paret, som på en vanlig sida.
    expect(root.querySelector(".guide-preview__card")!.textContent).toMatch(/Blankett 1\s*Blankett: Ansökan om bygglov\s*Antal: 2/);

    // Tillbaka: båda valen står kvar som chips, inte som text.
    click(root, '[data-action="previous"]');
    await settle();
    expect(chips(root)).toEqual(["Ansökan om bygglov", "Anmälan om eldstad"]);
  });
});
