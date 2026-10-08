import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import { registerCodeList } from "../../code-lists/code-list-registry";
import { navetCountryCodes } from "../../code-lists/navet-country-codes";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Statslös och Tyskland går inte ihop — hela vägen från kodlistan till chippet.
 *
 * De andra testerna för berättelse 062 prövar kontrollen och kryssrutorna med
 * flaggan given. Det här prövar VÄGEN: att `exclusive` på Skatteverkets `XS`
 * tar sig genom `LookupService`, in i `chip-picker` och ut som ett borttaget
 * val — utan att någon skriver flaggan för hand.
 *
 * ## Varför återbesöket har ett eget test
 *
 * En guide lagrar etikett och kod, aldrig flaggan. Går besökaren vidare och
 * tillbaka byggs valen upp ur det lagrade svaret, och där fanns hålet: chippet
 * *Statslös* hade glömt att det står ensamt, och nästa land lade sig bredvid
 * det. Steget bort och tillbaka är alltså inte en detalj i testet — det är
 * felfallet.
 */

registerCodeList(navetCountryCodes);

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const graph = (): GraphData =>
  ({
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

type Picker = HTMLElement & { choices: Array<{ label: string; value: string }> };

const picker = (preview: GuidePreview): Picker =>
  preview.shadowRoot!.querySelector<Picker>("chip-picker[data-text-lookup]")!;

const chips = (preview: GuidePreview): string[] =>
  [...picker(preview).shadowRoot!.querySelectorAll(".chip-picker__chip-label")].map(
    (one) => one.textContent?.trim() ?? "",
  );

const status = (preview: GuidePreview): string =>
  picker(preview).shadowRoot!.querySelector("[data-status]")?.textContent?.trim() ?? "";

async function search(preview: GuidePreview, term: string): Promise<void> {
  const box = picker(preview).shadowRoot!.querySelector<HTMLInputElement>("[data-search]")!;

  box.focus();
  box.value = term;
  box.dispatchEvent(new Event("input", { bubbles: true }));
  await settle(400);
}

async function choose(preview: GuidePreview, term: string, value: string): Promise<void> {
  await search(preview, term);

  const button = picker(preview).shadowRoot!.querySelector<HTMLButtonElement>(
    `[data-add][data-value="${value}"]`,
  );

  if (!button) throw new Error(`${value} står inte i listan efter "${term}".`);

  button.click();
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

const press = async (preview: GuidePreview, action: string): Promise<void> => {
  preview.shadowRoot!.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
  await settle(200);
};

describe("Skatteverkets XS i ett riktigt uppslag", () => {
  test("Statslös rensar de länder som valts", async () => {
    const preview = await viewer();

    await choose(preview, "danmark", "DK");
    await choose(preview, "statsl", "XS");

    expect(chips(preview)).toEqual(["Statslös"]);
    expect(status(preview)).toContain("Danmark");
    expect(status(preview)).toContain("inte kombineras med andra val");
  });

  test("ett land tar bort Statslös", async () => {
    const preview = await viewer();

    await choose(preview, "statsl", "XS");
    await choose(preview, "danmark", "DK");

    expect(chips(preview)).toEqual(["Danmark"]);
    expect(status(preview)).toContain("Statslös");
  });

  test("också efter ett steg fram och tillbaka — flaggan lagras inte i svaret", async () => {
    const preview = await viewer();

    await choose(preview, "statsl", "XS");
    await press(preview, "next");
    await press(preview, "previous");

    expect(chips(preview), "valet kom inte tillbaka alls").toEqual(["Statslös"]);

    await choose(preview, "danmark", "DK");

    expect(chips(preview)).toEqual(["Danmark"]);
  });

  test("avskiljaren står mellan länderna och de som är ensamma", async () => {
    const preview = await viewer();

    await search(preview, "sta");

    const rader = [
      ...picker(preview).shadowRoot!.querySelectorAll<HTMLElement>("[data-options] > li"),
    ].map((one) => one.textContent?.trim() ?? "");
    const vid = rader.findIndex((one) => one === "eller");

    expect(vid, "ingen avskiljare i uppslagets lista").toBeGreaterThan(-1);
    expect(rader.slice(vid + 1)).toEqual(["Statslös"]);
    expect(rader.slice(0, vid).length).toBeGreaterThan(0);
  });
});
