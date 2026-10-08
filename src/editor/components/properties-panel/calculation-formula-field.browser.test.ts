import { userEvent } from "@vitest/browser/context";
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { ruleCalcAstraGraph } from "../../../data/rule-calc-astra-graph";
import { CalculationService } from "../../../viewer/services/calculation-service";
import type { GuideEditor } from "../guide-editor/guide-editor";
import type { RichTextField } from "../rich-text-field/rich-text-field";

/**
 * Story 139 in the panel: the calculation row's formula is the formula
 * field — chips for the variables the panel knows, the node's own rows
 * included — and what it writes into the guide is the formula string, the
 * same one that came in.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 250) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mounted(): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = structuredClone(ruleCalcAstraGraph);
  await settle();
  editor.shadowRoot!
    .querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!
    .selectNodeById("rc-calc");
  await settle();
  return editor;
}

const panel = (editor: GuideEditor) => editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;

const formulaFields = (editor: GuideEditor) =>
  [...panel(editor).querySelectorAll<RichTextField>('rich-text-field[formula][data-assignment-property="formula"]')];

const chips = (field: RichTextField) =>
  [...field.shadowRoot!.querySelectorAll<HTMLElement>("[data-text] [data-chip]")].map((chip) => chip.dataset.variable);

const storedFormulas = (editor: GuideEditor) =>
  CalculationService.parseAssignments(editor.graph.nodes.find((node) => node.id === "rc-calc")!.data.assignments).map((row) => row.formula);

describe("uträkningens formelfält", () => {
  test("varje rad har formelfältet, brickor för guidens variabler och de egna raderna, strängen orörd", async () => {
    const editor = await mounted();
    const fields = formulaFields(editor);

    expect(fields.length).toBe(3);
    expect(fields.map((field) => field.value)).toEqual(["inkomst * 0.1", "barn * 1500", "round(min(grund + barntillagg; 9000))"]);
    expect(chips(fields[0]!)).toEqual(["inkomst"]);
    expect(chips(fields[2]!), "de egna raderna är brickor").toEqual(["grund", "barntillagg"]);
    expect(fields[2]!.variables.map((one) => one.value)).toEqual(expect.arrayContaining(["inkomst", "barn", "grund", "barntillagg", "idag"]));
    // A row never offers itself (Fia 29/9): `bidrag = … bidrag …` is a cycle.
    expect(fields[2]!.variables.map((one) => one.value)).not.toContain("bidrag");
    expect(fields[0]!.variables.map((one) => one.value)).not.toContain("grund");
    expect(storedFormulas(editor)).toEqual(["inkomst * 0.1", "barn * 1500", "round(min(grund + barntillagg; 9000))"]);
  });

  test("det som skrivs i fältet hamnar i guiden som formeltext, och en vald variabel som sitt namn", async () => {
    const editor = await mounted();

    // The row is a card, closed until opened (Del A); the field is in its body.
    panel(editor).querySelector<HTMLElement>('[data-assignment-id="rc-a-total"] [data-action="toggle-assignment"]')!.click();
    await settle();
    const field = formulaFields(editor)[2]!;
    const text = field.shadowRoot!.querySelector<HTMLElement>("[data-text]")!;

    text.focus();
    await userEvent.keyboard("{Control>}{End}{/Control}");
    await userEvent.keyboard(" + 1");
    await settle();
    expect(storedFormulas(editor)[2]).toBe("round(min(grund + barntillagg; 9000)) + 1");

    await userEvent.keyboard(" * ");
    field.shadowRoot!.querySelector<HTMLButtonElement>("[data-answer-toggle]")!.click();
    await settle(50);
    const row = [...field.shadowRoot!.querySelectorAll<HTMLButtonElement>("[data-answer-menu] [data-insert]")].find((one) => one.dataset.insert === "barn")!;

    row.click();
    await settle();
    expect(storedFormulas(editor)[2]).toBe("round(min(grund + barntillagg; 9000)) + 1 * barn");
    expect(chips(formulaFields(editor)[2]!)).toEqual(["grund", "barntillagg", "barn"]);
  });
});

/*
 * The chips' labels follow the guide's source language (film "Räkna medan
 * man svarar", 30/9): in an English-source guide the formula chip read
 * "Inkomst", because the panel resolved `variableLabel` with no locale and
 * so always in Swedish. The same fault sat in the plain text fields' menu.
 */
describe("brickornas etikett följer guidens källspråk", () => {
  async function englishSource(selectId: string): Promise<GuideEditor> {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    const graph = structuredClone(ruleCalcAstraGraph);

    graph.settings = { ...graph.settings, sourceLocale: "en", locales: ["sv", "en"] };
    editor.setAttribute("mode", "administrator");
    editor.style.cssText = "display: block; width: 1400px; height: 900px;";
    document.body.append(editor);
    editor.graph = graph;
    await settle();
    editor.shadowRoot!
      .querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!
      .selectNodeById(selectId);
    await settle();
    return editor;
  }

  test("formelfältets bricka säger Income i en engelsk källguide", async () => {
    const editor = await englishSource("rc-calc");
    const field = formulaFields(editor)[0]!;

    expect(field.variables.find((one) => one.value === "inkomst")?.label).toBe("Income");
    expect(field.shadowRoot!.querySelector("[data-text] [data-chip]")?.textContent?.trim()).toBe("Income");
  });

  test("textfältets variabelmeny säger Income i en engelsk källguide", async () => {
    const editor = await englishSource("rc-page");
    const field = panel(editor).querySelector<RichTextField>("rich-text-field:not([formula])")!;

    expect(field, "sidan har ett textfält med variabelmeny").not.toBeNull();
    expect(field.variables.find((one) => one.value === "inkomst")?.label).toBe("Income");
  });
});
