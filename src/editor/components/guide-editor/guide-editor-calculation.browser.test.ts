import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import "../../../viewer/node-types/default-node-types";
import "./guide-editor";
import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";
import type { PropertiesPanel } from "../properties-panel/properties-panel";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function mount(): { editor: GuideEditor; nodeEditor: NodeEditor; panel: PropertiesPanel } {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it
  // Opt in: the default is readonly, and this test builds.
  editor.setAttribute("mode", "administrator");
  document.body.append(editor);
  editor.graph = {
    startNodeId: "pris",
    nodes: [
      { id: "pris", type: "number-question", position: { x: 0, y: 0 }, data: { title: "Pris", variableName: "pris" } },
      { id: "calc", type: "calculation", position: { x: 300, y: 0 }, data: { title: "Uträkning", assignments: [{ id: "a1", variableName: "", formula: "" }] } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "pris", portId: "continue" }, to: { nodeId: "calc", portId: "input" } },
    ],
  };
  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  const panel = editor.shadowRoot?.querySelector<PropertiesPanel>("properties-panel");
  if (!nodeEditor || !panel) throw new Error("Editorn saknas.");
  return { editor, nodeEditor, panel };
}

describe("guide-editor: calculation node", () => {
  test("redigerar en rad och sparar variabel och formel", async () => {
    const { editor, nodeEditor, panel } = mount();
    nodeEditor.selectNodeById("calc");
    // The row is a card, closed until opened (uppdrag 29/9 Del A).
    await userEvent.click(panel.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="toggle-assignment"]')!);

    const variableInput = panel.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-assignment-property="variableName"]'
    );
    const formulaInput = panel.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-assignment-property="formula"]'
    );
    if (!variableInput || !formulaInput) throw new Error("Radfälten saknas.");

    await userEvent.fill(variableInput, "kontantinsats");
    // The formula is the formula field (139): typed into its text, not filled as an input.
    formulaInput.shadowRoot!.querySelector<HTMLElement>("[data-text]")!.focus();
    await userEvent.keyboard("{Control>}a{/Control}pris * 0,15");

    const calc = editor.getData().nodes.find((node) => node.id === "calc");
    const assignments = calc?.data.assignments as Array<{ variableName: string; formula: string }>;
    expect(assignments[0]).toMatchObject({ variableName: "kontantinsats", formula: "pris * 0,15" });
  });

  test("offers the available variables in the formula's own menu, not as a list under the rows", async () => {
    const { nodeEditor, panel } = mount();
    nodeEditor.selectNodeById("calc");
    await userEvent.click(panel.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="toggle-assignment"]')!);

    // Story 139 / Astra §10: the running list under the rows is gone; the
    // variable from the price question is offered by the formula field's
    // "Infoga variabel" menu instead.
    const field = panel.shadowRoot!.querySelector<HTMLElement & { variables: Array<{ value: string }> }>('rich-text-field[formula]')!;

    expect(field, "the row's formula is the formula field").toBeTruthy();
    expect(field.variables.map((one) => one.value)).toContain("pris");
    expect(panel.shadowRoot!.querySelector("[data-available-variables]")).toBeNull();
  });

  test("adds and removes rows", async () => {
    const { editor, nodeEditor, panel } = mount();
    nodeEditor.selectNodeById("calc");
    await userEvent.click(panel.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="toggle-assignment"]')!);

    const addButton = panel.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="add-assignment"]'
    );
    if (!addButton) throw new Error("Lägg till-knappen saknas.");
    await userEvent.click(addButton);

    let rows = panel.shadowRoot?.querySelectorAll("[data-assignment-id]");
    expect(rows?.length).toBe(2);

    const removeButton = panel.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="remove-assignment"]'
    );
    if (!removeButton) throw new Error("Ta bort-knappen saknas.");
    await userEvent.click(removeButton);

    rows = panel.shadowRoot?.querySelectorAll("[data-assignment-id]");
    expect(rows?.length).toBe(1);
    expect((editor.getData().nodes.find((n) => n.id === "calc")?.data.assignments as unknown[]).length).toBe(1);
  });
});
