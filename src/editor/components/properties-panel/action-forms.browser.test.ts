// The sending steps are FlowWeaver PRO's; this test uses them (open-core step 4).
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { ruleCalcAstraGraph } from "../../../data/rule-calc-astra-graph";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GraphData } from "../../../viewer/types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../../testing/optional-pro";
await withPro("index.ts");
const { claimExampleGraph } = ((await proModule("data/claim-example-graph.ts")) ?? {}) as { claimExampleGraph: GraphData };
const { conferenceExampleGraph } = ((await proModule("data/conference-example-graph.ts")) ?? {}) as { conferenceExampleGraph: GraphData };
const { surveyExampleGraph } = ((await proModule("data/survey-example-graph.ts")) ?? {}) as { surveyExampleGraph: GraphData };
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * B3, handlingarnas former (GRAFISK-PROFIL, Visuell hierarki; Astras beslut
 * 30/9, GENOMGANG E5/E6/E7): one destructive form and one add form in the
 * whole panel.
 *
 * Measured 30/9 before the round (Fia): *Ta bort raden* and *Ta bort
 * kolumnen* were red text without the bin at 35 px; the card's *Ta bort
 * alternativ* was the only one in the profile's form.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount(graph: GraphData, nodeId: string): Promise<ShadowRoot> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1300px; height: 1400px;";
  document.body.append(editor);
  editor.graph = structuredClone(graph);
  await settle();
  await settle();
  (editor.shadowRoot!.querySelector("node-editor") as unknown as { selectNodeById(id: string): void }).selectNodeById(nodeId);
  await settle();
  const panel = editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;

  for (const toggle of panel.querySelectorAll<HTMLElement>('[data-action^="toggle-"][aria-expanded="false"]')) {
    toggle.click();
  }
  await settle();

  return panel;
}

/** A token resolved where the button stands, so both themes and hosts agree. */
function tokenColour(beside: Element, token: string): string {
  const probe = document.createElement("span");
  probe.style.color = `var(${token})`;
  beside.parentElement!.append(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  return colour;
}

function expectRemoveForm(button: HTMLElement): void {
  const name = button.textContent!.replace(/\s+/g, " ").trim();
  const style = getComputedStyle(button);
  const icon = button.querySelector("svg");

  expect(icon, `${name}: soptunnan`).not.toBeNull();
  expect(icon!.getBoundingClientRect().width, `${name}: ikonens ruta`).toBeCloseTo(18, 0);
  expect(style.color, `${name}: --fw-danger-text`).toBe(tokenColour(button, "--fw-danger-text"));
  expect(style.backgroundColor, `${name}: ingen fyllning`).toBe("rgba(0, 0, 0, 0)");
  expect(style.borderLeftStyle, `${name}: ingen ram`).toBe("none");
  expect(button.getBoundingClientRect().height, `${name}: 44 px`).toBeGreaterThanOrEqual(44);
}

describe("Ta bort: en form i panelen", () => {
  test.runIf(PRO)("kortets Ta bort alternativ", async () => {
    const panel = await mount(claimExampleGraph as GraphData, "claim-what");
    const buttons = [...panel.querySelectorAll<HTMLElement>('[data-action="remove-option"]')];

    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach(expectRemoveForm);
  });

  test.runIf(PRO)("tjänsteanropets Ta bort raden", async () => {
    const panel = await mount(conferenceExampleGraph as GraphData, "conference-lookup");
    const buttons = [...panel.querySelectorAll<HTMLElement>('[data-action="remove-mapping"]')];

    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach(expectRemoveForm);
  });

  test.runIf(PRO)("inlämningens Ta bort kolumnen", async () => {
    const panel = await mount(surveyExampleGraph as GraphData, "survey-submit");
    const buttons = [...panel.querySelectorAll<HTMLElement>('[data-action="remove-column"]')];

    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach(expectRemoveForm);
  });
});

/** Resolves a token into the computed value of one property where `beside` stands. */
function tokenValue(beside: Element, property: string, value: string): string {
  const probe = document.createElement("div");
  probe.style.setProperty(property, value);
  beside.parentElement!.append(probe);
  const resolved = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return resolved;
}

/**
 * Lokal tilläggshandling (Visuell hierarki): primary outline, the plus as an
 * icon and never the character, `--fw-radius-button`, 44 px, the
 * collection's width. The empty variant keeps its tint but the same icon,
 * radius and height.
 */
function expectAddForm(button: HTMLElement, collection: HTMLElement, tinted = false): void {
  const name = button.textContent!.replace(/\s+/g, " ").trim();
  const style = getComputedStyle(button);
  const icon = button.querySelector("svg");

  expect(icon, `${name}: plus som ikon`).not.toBeNull();
  expect(icon!.getBoundingClientRect().width, `${name}: ikonens ruta`).toBeCloseTo(18, 0);
  expect(name, `${name}: inte tecknet +`).not.toMatch(/\+/);
  expect(style.borderTopLeftRadius, `${name}: --fw-radius-button`).toBe(tokenValue(button, "border-top-left-radius", "var(--fw-radius-button)"));
  expect(button.getBoundingClientRect().height, `${name}: 44 px`).toBeGreaterThanOrEqual(44);
  expect(style.borderTopStyle, `${name}: hel kant`).toBe("solid");
  expect(style.fontWeight, `${name}: --fw-weight-strong`).toBe(tokenValue(button, "font-weight", "var(--fw-weight-strong)"));
  expect(style.color, `${name}: --fw-primary-strong`).toBe(tokenColour(button, "--fw-primary-strong"));
  if (tinted) {
    expect(style.backgroundColor, `${name}: tonad`).toBe(tokenValue(button, "background-color", "var(--fw-primary-surface)"));
  } else {
    expect(style.borderTopColor, `${name}: kant --fw-primary`).toBe(tokenValue(button, "border-top-color", "var(--fw-primary)"));
    expect(style.backgroundColor, `${name}: genomskinlig`).toBe("rgba(0, 0, 0, 0)");
  }
  expect(button.getBoundingClientRect().width, `${name}: samlingens bredd`).toBeCloseTo(collection.getBoundingClientRect().width, 0);
}

describe("Lägg till: en form i panelen", () => {
  test.runIf(PRO)("tjänsteanropets Lägg till fält", async () => {
    const panel = await mount(conferenceExampleGraph as GraphData, "conference-lookup");
    const add = panel.querySelector<HTMLElement>('[data-action="add-mapping"]')!;
    expectAddForm(add, add.closest<HTMLElement>(".properties-panel__field")!.querySelector(".properties-panel__options")!);
  });

  test.runIf(PRO)("inlämningens Lägg till kolumn", async () => {
    const panel = await mount(surveyExampleGraph as GraphData, "survey-submit");
    const add = panel.querySelector<HTMLElement>('[data-action="add-column"]')!;
    expectAddForm(add, add.closest<HTMLElement>(".properties-panel__field")!.querySelector(".properties-panel__options")!);
  });

  test.runIf(PRO)("Lägg till svarsalternativ", async () => {
    const panel = await mount(claimExampleGraph as GraphData, "claim-what");
    const add = panel.querySelector<HTMLElement>('[data-action="add-option"]')!;
    expectAddForm(add, add.parentElement!.querySelector(".properties-panel__options")!);
  });

  test("Lägg till regel, och den tomma regelns tonade variant", async () => {
    let panel = await mount(ruleCalcAstraGraph as GraphData, "rc-rule");
    let add = panel.querySelector<HTMLElement>('[data-action="add-rule-case"]')!;
    const otherwise = panel.querySelector<HTMLElement>("[data-rule-otherwise]")!;
    expectAddForm(add, otherwise);

    document.body.replaceChildren();
    const empty = structuredClone(ruleCalcAstraGraph) as GraphData;
    empty.nodes.find((one) => one.id === "rc-rule")!.data.cases = [];
    panel = await mount(empty, "rc-rule");
    add = panel.querySelector<HTMLElement>('[data-action="add-rule-case"]')!;
    expectAddForm(add, panel.querySelector<HTMLElement>("[data-rule-otherwise]")!, true);
  });

  test("Lägg till uträkning", async () => {
    const panel = await mount(ruleCalcAstraGraph as GraphData, "rc-calc");
    const add = panel.querySelector<HTMLElement>('[data-action="add-assignment"]')!;
    expectAddForm(add, add.parentElement!.querySelector(".properties-panel__options")!);
  });
});

/**
 * Var tilläggshandlingen står (Visuell hierarki; E7, Astra 30/9): the
 * collection's help under its heading, before the rows; the add button
 * directly after the last row, at the collection's own gap, and nothing
 * after it inside the field. Measured before: the help stood after the
 * button, and the button's distance to the rows was the field's, not the
 * collection's.
 */
describe.runIf(PRO)("Lägg till står direkt efter samlingen, hjälptexten ovanför", () => {
  // Both guides are PRO's: none of these run in the open repo.
  const cases = ([
    ["tjänsteanropets rader", conferenceExampleGraph as GraphData, "conference-lookup", "add-mapping"],
    ["inlämningens kolumner", surveyExampleGraph as GraphData, "survey-submit", "add-column"],
  ] as Array<[string, GraphData, string, string]>).filter(([, graph]) => graph !== undefined);

  for (const [name, graph, nodeId, action] of cases) {
    test(name, async () => {
      const panel = await mount(graph, nodeId);
      const add = panel.querySelector<HTMLElement>(`[data-action="${action}"]`)!;
      const field = add.closest<HTMLElement>(".properties-panel__field")!;
      const list = field.querySelector<HTMLElement>(":scope > .properties-panel__options")!;
      const help = field.querySelector<HTMLElement>(":scope > .properties-panel__help")!;

      expect(help, "samlingen har en hjälptext").not.toBeNull();
      expect(help.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING, "hjälptexten före raderna").toBeTruthy();
      expect(add.nextElementSibling, "inget efter knappen").toBeNull();

      const rows = [...list.children] as HTMLElement[];
      const lastRow = rows[rows.length - 1];
      const gap = parseFloat(getComputedStyle(list).rowGap);
      const between = add.getBoundingClientRect().top - lastRow.getBoundingClientRect().bottom;
      expect(between, "samlingens eget avstånd till sista raden").toBeCloseTo(gap, 0);
    });
  }
});
