import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../viewer/node-types/default-node-types";
import "./properties-panel";

import { getEditorCapabilities } from "../../config/editor-capabilities";
import type { PropertiesPanel } from "./properties-panel";
import type { FlowNodeData } from "../../../viewer/types/graph";

/**
 * Panelen i redaktörens ordning (uppdrag 23/9 2026, punkt 4).
 *
 * ## Vad som mättes först
 *
 * Fältordningen bestäms inte av formulärfilen utan av nodtypens deklaration i
 * `viewer/node-types/default-node-types.ts` — `describeNodeProperties` fäster
 * etiketter på fält via id och rör aldrig ordningen. Frågan låg därför som
 * Rubrik, Visas som, Spara svaret som, Variabeletikett, Beskrivning,
 * Alternativ, CSS-klasser: de tre rutorna en redaktör fyller varje gång stod
 * åtskilda av tre hen sätter en gång eller aldrig.
 *
 * ## Vad som prövas
 *
 * Ordningen i DOM, inte en lista med etiketter — en etikett byts, ett fält-id
 * är en identitet. Och folden: stängd när det tekniska är tomt, öppen efter
 * klick, kvar öppen vid byte av nod, och öppen av sig själv när ett fält i den
 * bär ett värde. Det sista är kravets hjärta — *Spara svaret som* får aldrig
 * gömmas när en regel behöver den, och en regel kan behöva den först när
 * svaret har ett namn.
 */

afterEach(() => document.body.replaceChildren());

function panelFor(node: FlowNodeData): PropertiesPanel {
  const panel = document.createElement("properties-panel") as PropertiesPanel;

  panel.editorMode = "administrator";
  panel.capabilities = getEditorCapabilities("advanced");
  document.body.append(panel);
  panel.nodeData = node;

  return panel;
}

const question = (data: Record<string, unknown> = {}): FlowNodeData =>
  ({
    id: "q",
    type: "question",
    position: { x: 0, y: 0 },
    data: {
      title: { sv: "Bor du i kommunen?" },
      description: "",
      variableName: "",
      variableLabel: "",
      cssClasses: "",
      presentation: "radio",
      options: [],
      ...data,
    },
  }) as unknown as FlowNodeData;

const multiChoice = (data: Record<string, unknown> = {}): FlowNodeData =>
  ({
    id: "m",
    type: "multi-choice",
    position: { x: 0, y: 0 },
    data: {
      title: { sv: "Vad är du intresserad av?" },
      description: "",
      variableName: "",
      variableLabel: "",
      cssClasses: "",
      presentation: "checkbox",
      options: [],
      ...data,
    },
  }) as unknown as FlowNodeData;

/** Fält-id:n i den ordning panelen ritar dem, hela formuläret. */
const order = (panel: PropertiesPanel): string[] =>
  [...panel.shadowRoot!.querySelectorAll<HTMLElement>("[data-property]")].map(
    (one) => one.dataset.property ?? "",
  );

const fold = (panel: PropertiesPanel): HTMLDetailsElement | null =>
  panel.shadowRoot!.querySelector<HTMLDetailsElement>(
    'details[data-property-section="advanced"]',
  );

/** Fält-id:n inuti folden. */
const inFold = (panel: PropertiesPanel): string[] =>
  [...(fold(panel)?.querySelectorAll<HTMLElement>("[data-property]") ?? [])].map(
    (one) => one.dataset.property ?? "",
  );

/** Ordningen bland de fält som står fritt, alltså utanför varje grupp. */
const looseOrder = (panel: PropertiesPanel): string[] => {
  const folded = new Set(inFold(panel));

  return order(panel).filter((id) => !folded.has(id));
};

/*
 * Alternativlistan bär inget `data-property` — den är en lista med rader, och
 * kontrollen sitter på varje rad. Ordningen mäts därför i DOM:en själv och
 * inte i en lista med id:n.
 */
const precedes = (panel: PropertiesPanel, before: string, after: string): boolean => {
  const root = panel.shadowRoot!;
  const first = root.querySelector(before);
  const second = root.querySelector(after);

  if (!first || !second) {
    throw new Error(`Hittade inte ${first ? after : before} i panelen.`);
  }

  return Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
};

const TITLE = '[data-property="title"]';
const DESCRIPTION = '[data-property="description"]';
const OPTIONS = ".properties-panel__options";
const PRESENTATION = '[data-property="presentation"]';

describe("panelen i redaktörens ordning", () => {
  test.each([
    ["frågan", question],
    ["flervalsfrågan", multiChoice],
  ])("%s: rubrik, beskrivning, alternativ, visas som", (_name, make) => {
    const panel = panelFor(make());

    expect(precedes(panel, TITLE, DESCRIPTION)).toBe(true);
    expect(precedes(panel, DESCRIPTION, OPTIONS)).toBe(true);
    expect(precedes(panel, OPTIONS, PRESENTATION)).toBe(true);
  });

  test.each([
    ["frågan", question],
    ["flervalsfrågan", multiChoice],
  ])("%s: det tekniska ligger under Avancerat, inte bland innehållet", (_name, make) => {
    const panel = panelFor(make());

    expect(inFold(panel)).toEqual(["variableName", "variableLabel", "cssClasses"]);
    expect(looseOrder(panel)).not.toContain("variableName");
    expect(looseOrder(panel)).not.toContain("cssClasses");
  });

  test("folden heter Avancerat, på editorns språk", () => {
    const panel = panelFor(question());

    expect(fold(panel)?.querySelector("summary")?.textContent).toMatch(/avancerat/i);

    panel.editorLocale = "en";
    expect(fold(panel)?.querySelector("summary")?.textContent).toMatch(/advanced/i);
  });

  test("folden står sist, efter allt som står fritt", () => {
    const panel = panelFor(question());
    const ids = order(panel);
    const first = inFold(panel)[0];

    expect(ids.indexOf(first)).toBe(ids.length - inFold(panel).length);
  });
});

describe("folden minns hur den lämnades", () => {
  test("stängd vid start när det tekniska är tomt", () => {
    expect(fold(panelFor(question()))?.open).toBe(false);
  });

  test("öppen efter klick, och kvar öppen vid byte av nod", async () => {
    const panel = panelFor(question());

    await userEvent.click(fold(panel)!.querySelector("summary")!);
    expect(fold(panel)?.open).toBe(true);

    // Byte av nod: panelen ritar om från grunden, och minnet sitter på
    // komponenten och inte i markeringen.
    panel.nodeData = multiChoice();
    expect(fold(panel)?.open).toBe(true);
  });

  test("stängd igen efter ett andra klick, och stängd vid byte av nod", async () => {
    const panel = panelFor(question());

    await userEvent.click(fold(panel)!.querySelector("summary")!);
    await userEvent.click(fold(panel)!.querySelector("summary")!);
    expect(fold(panel)?.open).toBe(false);

    panel.nodeData = multiChoice();
    expect(fold(panel)?.open).toBe(false);
  });

  test("minnet lever i editorn, inte i lagringen", async () => {
    const panel = panelFor(question());

    await userEvent.click(fold(panel)!.querySelector("summary")!);

    // En ny panel är en ny editor: den börjar stängd igen.
    expect(fold(panelFor(question()))?.open).toBe(false);
  });
});

/**
 * Johans beslut 23/9 2026, som ersatte den första regeln: folden öppnar sig
 * **aldrig** av innehållet.
 *
 * Första bygget fällde upp den så fort något av dess fält bar ett värde, för
 * att *Spara svaret som* aldrig skulle gömmas när en regel behövde den. Johan
 * vände på det: *"Automatisk öppning utifrån innehållet gör panelen mindre
 * förutsägbar och riskerar att åter ge nästan alltid öppna grupper."* Nästan
 * varje fråga i en riktig guide namnger sitt svar, så regeln fällde upp
 * gruppen på nästan varje nod — alltså precis det läge folden finns för att
 * få bort. Det som är kvar är personens eget val, och `focusField`, som är en
 * navigering och inte en gissning.
 */
describe("folden öppnar sig aldrig av innehållet", () => {
  test.each([
    ["svaret har ett namn", { variableName: "bor" }],
    ["variabeletiketten är satt", { variableLabel: { sv: "Bosatt" } }],
    ["en CSS-klass är satt", { cssClasses: "kompakt" }],
  ])("stängd även när %s", (_name, data) => {
    expect(fold(panelFor(question(data)))?.open).toBe(false);
  });
});
