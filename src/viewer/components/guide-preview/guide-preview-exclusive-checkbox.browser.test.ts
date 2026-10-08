import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Berättelse 062 i kryssrutornas form.
 *
 * Samma regel, en annan presentation. Kryssrutorna är standard för en
 * flervalsfråga med få alternativ, och `chip-picker` tar över först när
 * listan blir lång — men *Inget av ovanstående* hör hemma i den korta
 * listan minst lika mycket som i den långa. En regel som bara gällde den
 * ena hade varit två svar på en fråga (praxis 1).
 *
 * ## Varför annonseringen måste byggas här
 *
 * Mätt före första raden kod: kortet bar INGA live-regioner alls, och
 * ingen förändringslyssnare — `guide-preview-multi` förekom på två
 * ställen i filen, markupen och avläsningen vid Nästa. En kryssruta som
 * kryssas av besökaren annonserar sig själv; en som koden kryssar UR gör
 * det inte, och det är precis den som behöver sägas.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 40) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const graph = (options: Array<Record<string, unknown>>): GraphData =>
  ({
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "multi-choice",
        position: { x: 0, y: 0 },
        data: { title: "Vilka länder är du medborgare i?", variableName: "land", options },
      },
      { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart" } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  }) as unknown as GraphData;

const BLANDAT = [
  { id: "a", label: "Danmark", value: "DK" },
  { id: "b", label: "Tyskland", value: "DE" },
  { id: "c", label: "Statslös", value: "XS", exclusive: true },
  { id: "d", label: "Okänt land", value: "XO", exclusive: true },
];

async function mount(options: Array<Record<string, unknown>>): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "sv");
  document.body.append(preview);
  preview.graph = graph(options);
  await settle();

  return preview;
}

const boxes = (preview: GuidePreview): HTMLInputElement[] => [
  ...preview.shadowRoot!.querySelectorAll<HTMLInputElement>(
    'input[name="guide-preview-multi"]',
  ),
];

const box = (preview: GuidePreview, value: string): HTMLInputElement =>
  boxes(preview).find((one) => one.value === value)!;

const ticked = (preview: GuidePreview): string[] =>
  boxes(preview).filter((one) => one.checked).map((one) => one.value);

const status = (preview: GuidePreview): string =>
  preview.shadowRoot!.querySelector("[data-multi-status]")?.textContent?.trim() ?? "";

const separator = (preview: GuidePreview): HTMLElement | null =>
  preview.shadowRoot!.querySelector<HTMLElement>("[data-choice-separator]");

async function tick(preview: GuidePreview, value: string): Promise<void> {
  box(preview, value).click();
  await settle();
}

describe("ersättningsregeln i kryssrutorna", () => {
  test("det exklusiva valet blir ensamt", async () => {
    const preview = await mount(BLANDAT);

    await tick(preview, "DK");
    await tick(preview, "DE");
    await tick(preview, "XS");

    expect(ticked(preview)).toEqual(["XS"]);
  });

  test("ett vanligt val tar bort det exklusiva", async () => {
    const preview = await mount(BLANDAT);

    await tick(preview, "XS");
    await tick(preview, "DK");

    expect(ticked(preview)).toEqual(["DK"]);
  });

  test("två exklusiva utesluter varandra", async () => {
    const preview = await mount(BLANDAT);

    await tick(preview, "XS");
    await tick(preview, "XO");

    expect(ticked(preview)).toEqual(["XO"]);
  });

  test("vanliga val står kvar bredvid varandra", async () => {
    const preview = await mount(BLANDAT);

    await tick(preview, "DK");
    await tick(preview, "DE");

    expect(ticked(preview)).toEqual(["DK", "DE"]);
  });

  test("svaret som lagras är det som står kvar", async () => {
    const preview = await mount(BLANDAT);

    await tick(preview, "DK");
    await tick(preview, "XS");

    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();

    expect(preview.getAnswers().land).toEqual("XS");
  });
});

describe("annonseringen", () => {
  test("raden finns och läses upp", async () => {
    const preview = await mount(BLANDAT);
    const region = preview.shadowRoot!.querySelector("[data-multi-status]");

    expect(region, "kortet saknar live-region").not.toBeNull();
    expect(region!.getAttribute("aria-live")).toBe("polite");
  });

  test("säger VARFÖR när det exklusiva rensade de andra", async () => {
    const preview = await mount(BLANDAT);

    await tick(preview, "DK");
    await tick(preview, "XS");

    expect(status(preview)).toContain("Danmark");
    expect(status(preview), "raden säger vad, inte varför").toContain(
      "inte kombineras med andra val",
    );
  });

  test("säger VARFÖR när det exklusiva åkte ut", async () => {
    const preview = await mount(BLANDAT);

    await tick(preview, "XS");
    await tick(preview, "DK");

    expect(status(preview)).toContain("Statslös");
    expect(status(preview)).toContain("inte kombineras med andra val");
  });

  test("tiger när besökaren själv kryssar ur — det hör man ändå", async () => {
    const preview = await mount(BLANDAT);

    await tick(preview, "DK");
    expect(status(preview)).toBe("");

    await tick(preview, "DK");
    expect(status(preview)).toBe("");
  });
});

describe("avskiljaren i kryssrutorna", () => {
  test("ritas när listan har båda sorterna", async () => {
    const preview = await mount(BLANDAT);

    expect(separator(preview)).not.toBeNull();
    expect(separator(preview)!.textContent).toContain("eller");
  });

  test("ritas inte när alla alternativ är vanliga", async () => {
    const preview = await mount([
      { id: "a", label: "Danmark", value: "DK" },
      { id: "b", label: "Tyskland", value: "DE" },
    ]);

    expect(separator(preview)).toBeNull();
  });

  test("de exklusiva står under den", async () => {
    const preview = await mount(BLANDAT);
    const rader = [
      ...preview.shadowRoot!.querySelectorAll<HTMLElement>(
        ".guide-preview__options > label, .guide-preview__options > [data-choice-separator]",
      ),
    ].map((one) => one.textContent?.trim() ?? "");
    const vid = rader.findIndex((one) => one.includes("eller"));

    expect(vid, "ingen avskiljare bland raderna").toBeGreaterThan(-1);
    expect(rader.slice(0, vid)).toEqual(["Danmark", "Tyskland"]);
    expect(rader.slice(vid + 1)).toEqual(["Statslös", "Okänt land"]);
  });

  test("är inte träffbar", async () => {
    const preview = await mount(BLANDAT);
    const rad = separator(preview)!;

    expect(rad.querySelector("input")).toBeNull();
    expect(rad.tabIndex).toBeLessThan(0);

    rad.click();
    await settle();

    expect(ticked(preview)).toEqual([]);
  });
});

describe("en fråga utan flaggor", () => {
  test("beter sig precis som före flaggan", async () => {
    const preview = await mount([
      { id: "a", label: "Sport", value: "sport" },
      { id: "b", label: "Musik", value: "musik" },
      { id: "c", label: "Film", value: "film" },
    ]);

    await tick(preview, "sport");
    await tick(preview, "musik");
    await tick(preview, "film");

    expect(ticked(preview)).toEqual(["sport", "musik", "film"]);
    expect(separator(preview)).toBeNull();
    expect(status(preview)).toBe("");
  });
});
