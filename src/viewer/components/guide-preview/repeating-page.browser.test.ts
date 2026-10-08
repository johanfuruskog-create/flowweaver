import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Story 084, steg 2: en sida som upprepas i visaren.
 *
 * En grupp per barn — `fieldset` med `legend` *Barn 1* (K4) — Lägg till och
 * Ta bort med fokus dit AC 6 säger, validering per post, och svaret som
 * lämnar sidan är listan. Fokus mäts i skuggträdet med `activeElement`,
 * inte antas: en omritning som tappar fokus syns bara så.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function graph(page: Record<string, unknown> = {}): GraphData {
  return {
    startNodeId: "barn",
    settings: { sourceLocale: "sv" },
    nodes: [
      {
        id: "barn", type: "page", position: { x: 0, y: 0 },
        data: { title: { sv: "Dina barn" }, repeats: true, repeatWord: { sv: "barn" }, repeatVariable: "barn", ...page },
      },
      {
        id: "namn", type: "text-question", parentPageId: "barn", order: 1, position: { x: 0, y: 0 },
        data: { title: { sv: "Namn" }, variableName: "namn", required: true },
      },
      {
        id: "skola", type: "question", parentPageId: "barn", order: 2, position: { x: 0, y: 0 },
        data: { title: { sv: "Går i skolan" }, variableName: "skola", options: [{ id: "ja", label: "Ja", value: "ja" }, { id: "nej", label: "Nej", value: "nej" }] },
      },
      {
        id: "arskurs", type: "text-question", parentPageId: "barn", order: 3, position: { x: 0, y: 0 },
        data: { title: { sv: "Årskurs" }, variableName: "arskurs", required: true },
        visibility: { match: "all", conditions: [{ id: "c", variableName: "skola", operator: "equals", value: "ja" }] },
      },
      { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" }, description: { sv: "Du har angett {{barn.count}} barn." } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "barn", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as never;
}

async function mount(page: Record<string, unknown> = {}): Promise<{ preview: GuidePreview; root: ShadowRoot }> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  document.body.append(preview);
  preview.graph = graph(page);
  await settle();
  return { preview, root: preview.shadowRoot! };
}

const groups = (root: ShadowRoot) => [...root.querySelectorAll<HTMLFieldSetElement>("fieldset[data-repeat-group]")];
const legends = (root: ShadowRoot) => groups(root).map((group) => group.querySelector("legend")!.textContent?.trim());
const nameInput = (root: ShadowRoot, index: number) =>
  root.querySelector<HTMLInputElement>(`[data-page-field-id="namn#${index}"] input`)!;
const click = (root: ShadowRoot, selector: string) => root.querySelector<HTMLButtonElement>(selector)!.click();
// Ett val är obligatoriskt av konstruktion, så varje post får ett svar på skolfrågan.
const choose = (root: ShadowRoot, index: number, value: string) => {
  const radio = root.querySelector<HTMLInputElement>(`[data-page-field-id="skola#${index}"] input[value="${value}"]`)!;
  radio.click();
  radio.dispatchEvent(new Event("change", { bubbles: true }));
};

describe("en sida som upprepas (story 084)", () => {
  test("en grupp per barn med legend, och Lägg till lägger fokus i den nya gruppen", async () => {
    const { root } = await mount();

    expect(legends(root)).toEqual(["Barn 1"]);
    // Under minsta antalet finns ingen Ta bort (AC 2).
    expect(root.querySelector('[data-action="repeat-remove"]')).toBeNull();
    expect(root.querySelector('[data-action="repeat-add"]')!.textContent?.trim()).toBe("Lägg till barn");

    nameInput(root, 0).value = "Alva";
    click(root, '[data-action="repeat-add"]');
    await settle();

    expect(legends(root)).toEqual(["Barn 1", "Barn 2"]);
    expect(root.activeElement).toBe(nameInput(root, 1));
    // Det som redan skrivits i barn 1 överlevde omritningen.
    expect(nameInput(root, 0).value).toBe("Alva");
    expect(root.querySelector<HTMLButtonElement>('[data-action="repeat-remove"][data-repeat-index="1"]')!.textContent?.trim()).toBe("Ta bort barn 2");
  });

  test("Ta bort flyttar fokus till gruppen före och säger vad som hände (AC 6)", async () => {
    const { root } = await mount();
    click(root, '[data-action="repeat-add"]');
    await settle();
    click(root, '[data-action="repeat-add"]');
    await settle();
    nameInput(root, 2).value = "Cleo";

    click(root, '[data-action="repeat-remove"][data-repeat-index="1"]');
    await settle();

    expect(legends(root)).toEqual(["Barn 1", "Barn 2"]);
    expect(root.activeElement).toBe(nameInput(root, 0));
    expect(root.querySelector("[data-repeat-status]")!.textContent).toBe("Barn 2 togs bort.");
    // Barn 3 blev barn 2 med sitt namn i behåll.
    expect(nameInput(root, 1).value).toBe("Cleo");

    // Den första gruppen borttagen: fokus på Lägg till, för det finns ingen före.
    click(root, '[data-action="repeat-remove"][data-repeat-index="0"]');
    await settle();
    expect(root.activeElement).toBe(root.querySelector('[data-action="repeat-add"]'));
  });

  test("egen knapptext, och vid största antalet finns ingen Lägg till", async () => {
    const { root } = await mount({ repeatMax: 2, addLabel: { sv: "Ett barn till" } });

    expect(root.querySelector('[data-action="repeat-add"]')!.textContent?.trim()).toBe("Ett barn till");
    click(root, '[data-action="repeat-add"]');
    await settle();

    expect(legends(root)).toEqual(["Barn 1", "Barn 2"]);
    expect(root.querySelector('[data-action="repeat-add"]')).toBeNull();
  });

  test("ett villkorat fält läser sin egen post (AC 4)", async () => {
    const { root } = await mount();
    click(root, '[data-action="repeat-add"]');
    await settle();

    choose(root, 1, "ja");
    await settle();

    expect(root.querySelector<HTMLElement>('[data-page-field-id="arskurs#0"]')!.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-page-field-id="arskurs#1"]')!.hidden).toBe(false);
  });

  test("felen står per post — *Barn 2 — Namn* — och svaret som lämnar sidan är listan", async () => {
    const { preview, root } = await mount();
    click(root, '[data-action="repeat-add"]');
    await settle();
    nameInput(root, 0).value = "Alva";
    choose(root, 0, "nej");
    choose(root, 1, "nej");

    click(root, '[data-action="next"]');
    await settle();

    // Ett fel: barn 2 saknar namn. Fokus rakt till det fältet, ingen summering.
    expect(root.querySelector("[data-error-summary]")).toBeNull();
    expect(root.activeElement).toBe(nameInput(root, 1));
    expect(root.querySelector('[data-page-field-id="namn#1"][data-invalid]')).toBeTruthy();
    expect(root.querySelector('[data-page-field-id="namn#0"][data-invalid]')).toBeNull();

    // Två fel: summeringen namnger posten.
    nameInput(root, 0).value = "";
    click(root, '[data-action="next"]');
    await settle();
    const links = [...root.querySelectorAll("[data-error-link]")].map((link) => link.textContent?.trim());
    expect(links).toEqual([
      'Barn 1 — Namn: Fältet är obligatoriskt.',
      'Barn 2 — Namn: Fältet är obligatoriskt.',
    ]);

    nameInput(root, 0).value = "Alva";
    nameInput(root, 1).value = "Bo";
    click(root, '[data-action="next"]');
    await settle();

    expect(preview.getAnswers()).toEqual({ barn: [{ namn: "Alva", skola: "nej" }, { namn: "Bo", skola: "nej" }] });
    // Formkodningen: en del per fält och post, som ett formulär med namngivna
    // fält hade skickat — inte en tom sträng för hela listan.
    expect([...preview.getFormData().entries()]).toEqual([
      ["barn[0].namn", "Alva"], ["barn[0].skola", "nej"], ["barn[1].namn", "Bo"], ["barn[1].skola", "nej"],
    ]);
    expect(root.textContent).toContain("Du har angett 2 barn.");

    // Tillbaka: grupperna kommer igen med sina namn.
    click(root, '[data-action="previous"]');
    await settle();
    expect(legends(root)).toEqual(["Barn 1", "Barn 2"]);
    expect(nameInput(root, 1).value).toBe("Bo");
  });
});

/*
 * Steg 3: granskningen och vägen tillbaka. Samma guide med ett
 * granskningssteg mellan sidan och resultatet.
 */
function reviewGraph(): GraphData {
  const base = graph();
  return {
    ...base,
    nodes: [
      ...base.nodes.filter((node) => node.id !== "r"),
      { id: "granska", type: "review", position: { x: 200, y: 0 }, data: { title: { sv: "Granska" } } },
      { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" }, description: { sv: "Barnen:\n{{barn}}" } } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "barn", portId: "continue" }, to: { nodeId: "granska", portId: "input" } },
      { id: "c2", from: { nodeId: "granska", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as never;
}

/*
 * Each record under its own heading, a row per question (story 084 AC 3;
 * the form since 1/10, punkt 18 / story 089 criterion 3): read here as
 * "Barn 1 | Namn = Alva | …" so a record is still one line to compare.
 */
const reviewRows = (root: ShadowRoot) =>
  [...root.querySelectorAll("[data-review-record]")].map((record) =>
    [
      record.querySelector("h4")!.textContent?.trim(),
      ...[...record.querySelectorAll("[data-review-row]")].map(
        (row) => `${row.querySelector("dt")!.textContent?.trim()} = ${row.querySelector("dd")!.textContent?.trim()}`,
      ),
    ].join(" | "),
  );

describe("granskningen av en sida som upprepas (story 084, steg 3)", () => {
  test("en rad per barn, Ändra fyller i grupperna igen, och ändringen syns", async () => {
    const preview = document.createElement("guide-preview") as GuidePreview;
    document.body.append(preview);
    preview.graph = reviewGraph();
    await settle();
    const root = preview.shadowRoot!;

    click(root, '[data-action="repeat-add"]');
    await settle();
    nameInput(root, 0).value = "Alva";
    choose(root, 0, "ja");
    await settle();
    root.querySelector<HTMLInputElement>('[data-page-field-id="arskurs#0"] input')!.value = "3";
    nameInput(root, 1).value = "Nils";
    choose(root, 1, "nej");
    click(root, '[data-action="next"]');
    await settle();

    // Sidan är en grupp, varje barn under sin rubrik (084 AC 3, 089) — etiketter, inte värden.
    expect(root.querySelector("[data-review-group] h3")!.textContent?.trim()).toBe("Dina barn");
    expect(reviewRows(root)).toEqual([
      "Barn 1 | Namn = Alva | Går i skolan = Ja | Årskurs = 3",
      "Barn 2 | Namn = Nils | Går i skolan = Nej",
    ]);

    // Ändra på sidan: tillbaka med båda grupperna ifyllda.
    const edits = [...root.querySelectorAll<HTMLButtonElement>("[data-review-edit]")];
    expect(edits).toHaveLength(1);
    expect(edits[0]!.getAttribute("aria-label")).toBe("Ändra svaren på Dina barn");
    edits[0]!.click();
    await settle();

    expect(legends(root)).toEqual(["Barn 1", "Barn 2"]);
    expect(nameInput(root, 0).value).toBe("Alva");
    expect(nameInput(root, 1).value).toBe("Nils");
    expect(root.querySelector<HTMLInputElement>('[data-page-field-id="skola#1"] input[value="nej"]')!.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>('[data-page-field-id="arskurs#0"] input')!.value).toBe("3");

    nameInput(root, 1).value = "Nina";
    click(root, '[data-action="next"]');
    await settle();

    // Tillbaka på granskningen, en gång per barn — inga dubbletter från återresan.
    expect(reviewRows(root)).toEqual([
      "Barn 1 | Namn = Alva | Går i skolan = Ja | Årskurs = 3",
      "Barn 2 | Namn = Nina | Går i skolan = Nej",
    ]);

    // Resultatet räknar upp posterna i ordning, med etiketter (AC 3, 5).
    click(root, '[data-action="next"]');
    await settle();
    const text = root.querySelector('[data-node-type="result"]')!.textContent?.replace(/\s+/g, " ") ?? "";
    // A block per child, `<br>` between the lines — textContent runs them together.
    expect(text).toMatch(/Barn 1\s*Namn: Alva\s*Går i skolan: Ja\s*Årskurs: 3/);
    expect(text).toMatch(/Barn 2\s*Namn: Nina\s*Går i skolan: Nej/);
  });
});
