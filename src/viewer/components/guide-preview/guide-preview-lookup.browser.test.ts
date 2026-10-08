import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

afterEach(() => {
  document.body.replaceChildren();
});

const KOMMUNER = [
  { id: "a", value: "1880", label: "Örebro" },
  { id: "b", value: "1881", label: "Kumla" },
  { id: "c", value: "0180", label: "Stockholm" },
];

/** A guide with a lookup field as step one and a result after it. */
function graf(extra: Record<string, unknown> = {}): GraphData {
  return {
    startNodeId: "kommun",
    nodes: [
      {
        id: "kommun",
        type: "autocomplete-question",
        position: { x: 0, y: 0 },
        data: {
          title: "Vilken kommun?",
          variableName: "kommun",
          codeVariableName: "kommunkod",
          source: "mock",
          mockItems: KOMMUNER,
          minChars: 2,
          required: true,
          ...extra,
        },
      },
      {
        id: "klart",
        type: "result",
        position: { x: 400, y: 0 },
        data: { title: "Tack", description: "Du valde {{kommun}} ({{kommunkod}})." },
      },
    ],
    connections: [
      {
        id: "c1",
        from: { nodeId: "kommun", portId: "continue" },
        to: { nodeId: "klart", portId: "input" },
      },
    ],
  };
}

function montera(data: GraphData): GuidePreview {
  const preview = document.createElement("guide-preview") as GuidePreview;
  document.body.append(preview);
  preview.graph = data;
  return preview;
}

/*
 * Kontrollen är `chip-picker` sedan 2026-08-31 — samma element som visarens
 * flervalslista och panelens villkorsvärde. Påståendena här är desamma; det
 * som ändrats är gesten. Det fanns inga piltangenter att välja med, så valet
 * görs på alternativets knapp, vilket är vad ett finger och ett tangentbord
 * båda gör.
 */
function field(preview: GuidePreview): HTMLElement & {
  choices: Array<{ label: string; value: string }>;
  text: string;
} {
  const element = preview.shadowRoot?.querySelector<HTMLElement & {
    choices: Array<{ label: string; value: string }>;
    text: string;
  }>("chip-picker[data-text-answer]");

  if (!element) {
    throw new Error("Uppslagsfältet renderades inte i guiden.");
  }

  return element;
}

function inputEl(preview: GuidePreview): HTMLInputElement {
  const element = field(preview).shadowRoot?.querySelector<HTMLInputElement>("[data-search]");

  if (!element) {
    throw new Error("Inmatningsfältet finns inte.");
  }

  return element;
}

function skriv(preview: GuidePreview, text: string): void {
  const element = inputEl(preview);
  element.focus();
  element.value = text;
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

function alternativ(preview: GuidePreview): HTMLButtonElement[] {
  return [...(field(preview).shadowRoot?.querySelectorAll<HTMLButtonElement>("[data-add]") ?? [])];
}

/** Väljer första träffen, som ett finger eller ett tangentbord gör. */
function välj(preview: GuidePreview): void {
  alternativ(preview)[0]?.click();
}

async function waitABit(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 280));
}

describe("a lookup field in a guide", () => {
  test("renders as a step with a field of its own", () => {
    const preview = montera(graf());

    expect(field(preview)).toBeTruthy();
    /*
     * Sökrutan, inte en combobox-roll. Modellen är knappar i tabbordningen —
     * se `chip-picker`: en `role="combobox"` med `aria-activedescendant` är
     * mönstret som nästan alltid byggs fel, och kontrollen hade redan en
     * fungerande lista av riktiga knappar.
     */
    expect(inputEl(preview).type).toBe("search");
  });

  // The whole point of mock mode: a guide can be built and tried before any BFF
  // exists.
  test("searches the field's own list without a network", async () => {
    const preview = montera(graf());

    skriv(preview, "öre");
    await waitABit();

    expect(alternativ(preview)).toHaveLength(1);
    expect(alternativ(preview)[0].textContent?.trim()).toContain("Örebro");
  });

  test("a choice moves the guide on and stores both label and code", async () => {
    const preview = montera(graf());

    skriv(preview, "öre");
    await waitABit();
    välj(preview);
    await waitABit();

    preview.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-action="next"]')
      ?.click();

    const text = preview.shadowRoot?.textContent ?? "";

    expect(text).toContain("Tack");
    expect(text).toContain("Örebro (1880)");
  });

  // Without a choice from the list the variable carries no code, and is then
  // useless to whatever comes next.
  test("free text is blocked when the field requires a choice from the list", async () => {
    const preview = montera(graf());

    skriv(preview, "Örebroo");
    await waitABit();

    preview.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-action="next"]')
      ?.click();

    expect(preview.shadowRoot?.textContent ?? "").not.toContain("Tack");
  });

  test("free text is allowed through when the field permits it", async () => {
    const preview = montera(graf({ allowFreeText: true, codeVariableName: "" }));

    skriv(preview, "Ödeshög");
    await waitABit();

    preview.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-action="next"]')
      ?.click();

    expect(preview.shadowRoot?.textContent ?? "").toContain("Tack");
  });
});
