import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { visibilityTwoConditionsGraph } from "../../../data/visibility-two-conditions-graph";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { ConditionalVisibility, GraphData } from "../../../viewer/types/graph";

/**
 * Dataförlusten mätt 29/9: panelen redigerar bara ett villkors första rad, och
 * varje ändring skrev tillbaka `conditions` som en lista av ett. Ett alternativ
 * eller fält med två villkor tappade det andra tyst första gången något i
 * kortet ändrades. Det andra villkoret och `match` ska komma igenom orörda.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function editorWith(nodeId: string): Promise<{ editor: GuideEditor; panel: ShadowRoot }> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1300px; height: 900px;";
  document.body.append(editor);
  editor.graph = structuredClone(visibilityTwoConditionsGraph) as never;
  await settle();
  await settle();
  (editor.shadowRoot!.querySelector("node-editor") as unknown as { selectNodeById(id: string): void }).selectNodeById(nodeId);
  await settle();
  await settle();

  return { editor, panel: editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot! };
}

function pick(select: HTMLSelectElement, value: string): void {
  expect([...select.options].map((option) => option.value), "valet finns").toContain(value);
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

const node = (editor: GuideEditor, id: string) => (editor.getData() as GraphData).nodes.find((one) => one.id === id)!;

describe("två villkor kommer igenom en redigering av det första", () => {
  test("på ett svarsalternativ", async () => {
    const { editor, panel } = await editorWith("applicant");
    const company = () =>
      (node(editor, "applicant").data.options as Array<{ id: string; visibility?: ConditionalVisibility }>).find(
        (option) => option.id === "applicant-company",
      )!;

    (panel.querySelector<HTMLElement>('[data-action="toggle-option"][data-option-id="applicant-company"]') ?? null)?.click();
    await settle();
    pick(
      panel.querySelector<HTMLSelectElement>('[data-option-visibility-property="variableName"][data-option-id="applicant-company"]')!,
      "customer",
    );
    await settle();

    expect(company().visibility).toEqual({
      match: "any",
      conditions: [
        { id: "first", variableName: "customer", operator: "equals", value: "ja" },
        { id: "second", variableName: "customer", operator: "equals", value: "ja" },
      ],
    });
  });

  test("på ett fält i en sida", async () => {
    const { editor, panel } = await editorWith("company-name");

    pick(panel.querySelector<HTMLSelectElement>('[data-visibility-property="variableName"]')!, "customer");
    await settle();

    expect(node(editor, "company-name").visibility).toEqual({
      match: "any",
      conditions: [
        { id: "first", variableName: "customer", operator: "equals", value: "ja" },
        { id: "second", variableName: "customer", operator: "equals", value: "ja" },
      ],
    });
  });
});
