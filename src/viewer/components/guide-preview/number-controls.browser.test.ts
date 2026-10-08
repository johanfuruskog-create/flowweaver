import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Story 095, AC 3: the slider and the − / + buttons beside a number field.
 * The field is the answer; the others write into it, and the field moves the
 * slider back. Measured on the page's controls and on the text that reads
 * the calculated variable — a slider that moves without the text following
 * is the bug the story exists for.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function graph(amount: Record<string, unknown> = {}): GraphData {
  return {
    startNodeId: "loan",
    settings: { sourceLocale: "sv" },
    nodes: [
      { id: "loan", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Låna" } } },
      {
        id: "amount", type: "number-question", parentPageId: "loan", order: 0, position: { x: 0, y: 0 },
        data: { title: { sv: "Lånesumma" }, variableName: "lan", min: 10000, max: 800000, step: 5000, unit: { sv: "kr" }, presentation: "range", ...amount },
      },
      {
        id: "years", type: "number-question", parentPageId: "loan", order: 1, position: { x: 0, y: 0 },
        data: { title: { sv: "Lånetid" }, variableName: "ar", min: 1, max: 15, step: 1, unit: { sv: "år" }, presentation: "stepper" },
      },
      {
        id: "calc", type: "calculation", parentPageId: "loan", order: 2, position: { x: 0, y: 0 },
        data: { title: { sv: "Räkna" }, assignments: [{ id: "a", variableName: "summa", formula: "lan * ar" }] },
      },
      {
        id: "text", type: "page-heading", parentPageId: "loan", order: 3, position: { x: 0, y: 0 },
        data: { title: { sv: "" }, description: { sv: "Totalt {{summa}} kr." } },
      },
      { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "loan", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as never;
}

async function mount(data = graph()): Promise<ShadowRoot> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  document.body.append(preview);
  preview.graph = data;
  await settle();
  return preview.shadowRoot!;
}

const field = (root: ShadowRoot, id: string) =>
  root.querySelector<HTMLInputElement>(`input[data-number-target="${id}"]`)!;
const range = (root: ShadowRoot) => root.querySelector<HTMLInputElement>('input[type="range"]')!;
const step = (root: ShadowRoot, direction: "-1" | "1") =>
  root.querySelector<HTMLButtonElement>(`button[data-step-for="years"][data-step="${direction}"]`)!;
const text = (root: ShadowRoot) => root.querySelector<HTMLElement>('[data-page-heading-id="text"]')!.textContent;

const slide = (root: ShadowRoot, value: string) => {
  range(root).value = value;
  range(root).dispatchEvent(new Event("input", { bubbles: true, composed: true }));
};
const type = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
};

describe("reglaget och stegknapparna (story 095)", () => {
  test("reglaget skriver in i fältet, grupperat, och texten följer med", async () => {
    const root = await mount();

    expect(range(root).min).toBe("10000");
    expect(range(root).max).toBe("800000");
    expect(range(root).step).toBe("5000");
    expect(range(root).getAttribute("aria-label")).toBe("Lånesumma, reglage");
    // The slider is not an answer of its own.
    expect(range(root).hasAttribute("data-page-variable")).toBe(false);

    step(root, "1").click();
    slide(root, "200000");
    await settle();

    expect(field(root, "amount").value).toBe("200 000");
    expect(field(root, "amount").dataset.canonical).toBe("200000");
    expect(text(root)).toContain("Totalt 200 000 kr.");
  });

  test("fältet flyttar reglaget", async () => {
    const root = await mount();

    type(field(root, "amount"), "150000");
    await settle();

    expect(range(root).value).toBe("150000");
  });

  test("stegknapparna går ett steg, från tomt till min, och stannar vid spannets kanter", async () => {
    const root = await mount();
    const years = field(root, "years");

    expect(step(root, "1").getAttribute("aria-label")).toBe("Öka Lånetid");
    expect(step(root, "-1").getAttribute("aria-label")).toBe("Minska Lånetid");

    step(root, "1").click();
    expect(years.value).toBe("1");
    step(root, "1").click();
    step(root, "1").click();
    expect(years.value).toBe("3");
    step(root, "-1").click();
    expect(years.value).toBe("2");

    type(years, "15");
    step(root, "1").click();
    expect(years.value).toBe("15");
    type(years, "1");
    step(root, "-1").click();
    expect(years.value).toBe("1");

    type(years, "");
    step(root, "-1").click();
    expect(years.value).toBe("1");
  });

  test("utan min och max ritas inget reglage — fältet står ensamt", async () => {
    const root = await mount(graph({ min: undefined, max: undefined }));

    expect(root.querySelector('input[type="range"]')).toBeNull();
    expect(field(root, "amount")).not.toBeNull();
  });

  test("ett decimalt steg räknas med stegets egna decimaler", async () => {
    const root = await mount(graph({ presentation: "stepper", min: 0, max: 1, step: 0.1 }));
    const button = root.querySelector<HTMLButtonElement>('button[data-step-for="amount"][data-step="1"]')!;

    // The first press lands on min (0); three more are 0,1 + 0,1 + 0,1.
    button.click();
    button.click();
    button.click();
    button.click();

    expect(field(root, "amount").dataset.canonical).toBe("0.3");
  });
});
