import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Berättelse 134 — vad besökaren ser.
 *
 * Konferensmenyn: nötcurryn är inte ett val för den som svarat att den är
 * allergisk mot nötter, den är en fälla. Alternativet ritas därför inte alls
 * (K11 — det som är dolt finns inte i DOM:en), listan säger att den är kortare
 * än den ser ut, och ett val som hunnit göras och sedan blivit omöjligt sägs
 * i stället för att försvinna tyst.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const MENY = [
  { id: "veg", label: "Vegetariskt", value: "veg" },
  {
    id: "curry",
    label: "Nötcurry",
    value: "curry",
    visibility: {
      match: "all",
      conditions: [
        { id: "c1", variableName: "allergi", operator: "not-one-of", value: "notter" },
      ],
    },
  },
  { id: "nutfree", label: "Utan nötter", value: "nutfree" },
];

/** Allergifrågan, sedan menyn som en sida med ett fält, sedan ett resultat. */
const graph = (meny: Array<Record<string, unknown>> = MENY): GraphData =>
  ({
    version: 8,
    startNodeId: "allergi",
    settings: { sourceLocale: "sv", locales: ["sv"] },
    nodes: [
      {
        id: "allergi",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: "Har du någon allergi?",
          variableName: "allergi",
          options: [
            { id: "a1", label: "Nötter", value: "notter" },
            { id: "a2", label: "Inga", value: "inga" },
          ],
        },
      },
      { id: "sidan", type: "page", position: { x: 400, y: 0 }, data: { title: "Maten" } },
      {
        id: "meny",
        type: "question",
        parentPageId: "sidan",
        order: 1,
        position: { x: 0, y: 0 },
        data: { title: "Meny", variableName: "meny", options: meny },
      },
      { id: "klart", type: "result", position: { x: 800, y: 0 }, data: { title: "Tack" } },
    ],
    connections: [
      { id: "k1", from: { nodeId: "allergi", portId: "a1" }, to: { nodeId: "sidan", portId: "in" } },
      { id: "k2", from: { nodeId: "allergi", portId: "a2" }, to: { nodeId: "sidan", portId: "in" } },
      { id: "k3", from: { nodeId: "sidan", portId: "continue" }, to: { nodeId: "klart", portId: "in" } },
    ],
  }) as unknown as GraphData;

async function mount(meny?: Array<Record<string, unknown>>): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "sv");
  document.body.append(preview);
  preview.graph = graph(meny);
  await settle();

  return preview;
}

const root = (preview: GuidePreview): ShadowRoot => preview.shadowRoot!;

const radios = (preview: GuidePreview): HTMLInputElement[] => [
  ...root(preview).querySelectorAll<HTMLInputElement>('input[type="radio"][data-page-variable="meny"]'),
];

const next = (preview: GuidePreview): HTMLButtonElement =>
  [...root(preview).querySelectorAll<HTMLButtonElement>("button")].find((button) =>
    /Nästa|Fortsätt/i.test(button.textContent ?? ""),
  )!;

/** Svara på allergifrågan och gå vidare till menysidan. */
async function answerAllergy(preview: GuidePreview, optionId: string): Promise<void> {
  const radio = root(preview).querySelector<HTMLInputElement>(
    `input[type="radio"][value="${optionId}"]`,
  )!;

  radio.checked = true;
  radio.dispatchEvent(new Event("change", { bubbles: true }));
  await settle();
  next(preview).click();
  await settle();
}

describe("134 — villkorade alternativ hos besökaren", () => {
  test("kriterium 5: ett dolt alternativ ritas inte alls, och raden under listan säger det", async () => {
    const preview = await mount();

    await answerAllergy(preview, "a1");

    const labels = radios(preview).map((radio) => radio.value);

    expect(labels).toEqual(["veg", "nutfree"]);
    // Inte `hidden`, inte i DOM:en alls — K11.
    expect(root(preview).textContent).not.toContain("Nötcurry");

    const row = root(preview).querySelector<HTMLElement>("[data-options-hidden]");

    expect(row, "raden finns när något är dolt").toBeTruthy();
    expect(row!.textContent).toContain("Några alternativ visas inte");
  });

  test("kriterium 5 (Per, mutationskontroll): en etikett med markup ritas som text, K11", async () => {
    // Redaktörens etikett är innehåll, inte kod. Rendera den med innerHTML i
    // stället för escapeHtml (eller textContent) och en tagg smyger in i
    // besökarens sida.
    const farlig = MENY.map((option) =>
      option.id === "veg" ? { ...option, label: "<b>Vegetariskt</b>" } : option,
    );
    const preview = await mount(farlig);

    await answerAllergy(preview, "a2");

    expect(root(preview).querySelector("b")).toBeNull();
    expect(root(preview).textContent).toContain("<b>Vegetariskt</b>");
  });

  test("kriterium 5: raden finns inte när ingenting är dolt", async () => {
    const preview = await mount();

    await answerAllergy(preview, "a2");

    expect(radios(preview).map((radio) => radio.value)).toEqual(["veg", "curry", "nutfree"]);
    expect(root(preview).querySelector("[data-options-hidden]")).toBeNull();
  });

  test("kriterium 5: en fråga med alla alternativ dolda blockerar inte Nästa", async () => {
    const allaDolda = MENY.map((option) => ({ ...option, visibility: MENY[1]!.visibility }));
    const preview = await mount(allaDolda);

    await answerAllergy(preview, "a1");

    expect(radios(preview)).toHaveLength(0);
    expect(root(preview).querySelector("[data-options-hidden]")).toBeTruthy();

    next(preview).click();
    await settle();

    expect(root(preview).textContent).toContain("Tack");
  });

  test("kriterium 6: ett valt alternativ som blir dolt töms och sägs", async () => {
    const preview = await mount();

    // Ingen allergi: nötcurryn finns, och den väljs.
    await answerAllergy(preview, "a2");

    const curry = radios(preview).find((radio) => radio.value === "curry")!;
    curry.checked = true;
    curry.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    next(preview).click();
    await settle();
    expect(root(preview).textContent).toContain("Tack");

    // Tillbaka, byt till nötallergi, fram igen.
    preview.previous();
    await settle();
    preview.previous();
    await settle();

    const notter = root(preview).querySelector<HTMLInputElement>(
      'input[type="radio"][value="a1"]',
    )!;
    notter.checked = true;
    notter.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    next(preview).click();
    await settle();

    // Valet är borta, och sidan säger att det behöver göras om.
    expect(radios(preview).some((radio) => radio.checked)).toBe(false);
    expect(root(preview).textContent).toContain("behöver göras om");
    expect(preview.getAnswers().meny).toBeFalsy();

    // …som en varning, inte ett fel (Johan 21/9): besökaren gjorde inget
    // fel, ett ändrat svar tog bort valet. Mätt på ytan, inte på klassen:
    // varningens yta, aldrig felets.
    const row = root(preview).querySelector<HTMLElement>("[data-choice-redo]")!;
    const surface = getComputedStyle(row).backgroundColor;
    const probe = document.createElement("p");
    probe.className = "guide-preview__error";
    root(preview).append(probe);
    const danger = getComputedStyle(probe).backgroundColor;
    probe.remove();
    expect(row.getAttribute("role")).toBe("status");
    expect(surface, "raden bär felets färg").not.toBe(danger);
  });

  test("kriterium 6 (Per, mutationskontroll): granskningen visar inte ett svar som tömts", async () => {
    // Samma bana som ovan, men med en granskningssida sist. Berättelsen
    // säger "ett dolt alternativ kan aldrig vara valt" — det gäller inte
    // bara sidan, det gäller granskningen som läser motorns svarsposter.
    const withReview = graph();
    (withReview.nodes as unknown as Array<Record<string, unknown>>).splice(
      withReview.nodes.findIndex((node) => node.id === "klart"),
      0,
      { id: "granskning", type: "review", position: { x: 600, y: 0 }, data: {} },
    );
    (withReview.connections as unknown as Array<Record<string, unknown>>) = [
      { id: "k1", from: { nodeId: "allergi", portId: "a1" }, to: { nodeId: "sidan", portId: "in" } },
      { id: "k2", from: { nodeId: "allergi", portId: "a2" }, to: { nodeId: "sidan", portId: "in" } },
      { id: "k3", from: { nodeId: "sidan", portId: "continue" }, to: { nodeId: "granskning", portId: "input" } },
      { id: "k4", from: { nodeId: "granskning", portId: "continue" }, to: { nodeId: "klart", portId: "in" } },
    ];

    const preview = document.createElement("guide-preview") as GuidePreview;
    preview.setAttribute("active-locale", "sv");
    document.body.append(preview);
    preview.graph = withReview;
    await settle();

    await answerAllergy(preview, "a2");
    const curry = radios(preview).find((radio) => radio.value === "curry")!;
    curry.checked = true;
    curry.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    next(preview).click();
    await settle();
    // Granskningen: nötcurryn är med.
    expect(root(preview).textContent).toContain("Nötcurry");

    // Tillbaka till allergifrågan, byt till nötallergi, fram genom sidan igen.
    preview.previous();
    await settle();
    preview.previous();
    await settle();
    const notter = root(preview).querySelector<HTMLInputElement>(
      'input[type="radio"][value="a1"]',
    )!;
    notter.checked = true;
    notter.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    next(preview).click();
    await settle();

    // Granskningen igen: nötcurryn står inte kvar som ett svar.
    expect(root(preview).textContent).not.toContain("Nötcurry");
  });
});
