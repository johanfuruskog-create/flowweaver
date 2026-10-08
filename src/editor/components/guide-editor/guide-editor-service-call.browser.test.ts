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
      { id: "svc", type: "service-call", position: { x: 300, y: 0 }, data: {
        title: "Tjänsteanrop", endpoint: "/api/tjanst", method: "POST",
        requestVariables: [], mockResponse: '{ "maxLoan": 2550000 }',
        responseMappings: [{ id: "m1", field: "", variableName: "" }],
      } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "pris", portId: "continue" }, to: { nodeId: "svc", portId: "input" } },
    ],
  };
  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  const panel = editor.shadowRoot?.querySelector<PropertiesPanel>("properties-panel");
  if (!nodeEditor || !panel) throw new Error("Editorn saknas.");
  return { editor, nodeEditor, panel };
}

const svcData = (editor: GuideEditor) =>
  editor.getData().nodes.find((node) => node.id === "svc")!.data;

describe("guide-editor: service node", () => {
  test("chooses variables to send with the call", async () => {
    const { editor, nodeEditor, panel } = mount();
    nodeEditor.selectNodeById("svc");

    /*
     * Variablerna väljs i `chip-picker` sedan tjänsteanropet använder samma
     * kontroll som allt annat man väljer flera av. Det var kryssrutor: en
     * spalt att skanna efter bockar, där det VALDA är det svåraste att läsa.
     */
    const väljaren = panel.shadowRoot?.querySelector("[data-request-picker]")?.shadowRoot;

    // Alternativen visas när kontrollen används.
    väljaren?.querySelector<HTMLElement>(".chip-picker__box")
      ?.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));

    const knapp = väljaren?.querySelector<HTMLButtonElement>('[data-add][data-value="pris"]');

    if (!knapp) throw new Error("Alternativet för pris saknas.");

    await userEvent.click(knapp);

    expect(svcData(editor).requestVariables).toEqual(["pris"]);
  });

  test("and names them by alias first, as everywhere else", async () => {
    /*
     * Johan 3/9: "tjänstens frågor också". The option used to say the bare
     * name — what the BFF receives — but the editor recognises the alias, the
     * word the rules and the cards use. Both, alias first, like the chooser.
     */
    const { editor, nodeEditor, panel } = mount();
    editor.graph = {
      ...editor.getData(),
      nodes: editor.getData().nodes.map((node) =>
        node.id === "pris" ? { ...node, data: { ...node.data, variableLabel: "Bostadspris" } } : node,
      ),
    };
    nodeEditor.selectNodeById("svc");

    const väljaren = panel.shadowRoot?.querySelector("[data-request-picker]")?.shadowRoot;
    väljaren?.querySelector<HTMLElement>(".chip-picker__box")
      ?.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
    const knapp = väljaren?.querySelector<HTMLButtonElement>('[data-add][data-value="pris"]');

    expect(knapp?.textContent?.replace(/\s+/g, " ").trim()).toBe("Bostadspris — pris");
  });

  test("maps a response field to a variable", async () => {
    const { editor, nodeEditor, panel } = mount();
    nodeEditor.selectNodeById("svc");

    const fieldInput = panel.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-mapping-property="field"]'
    );
    const variableInput = panel.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-mapping-property="variableName"]'
    );
    if (!fieldInput || !variableInput) throw new Error("Mappningsfälten saknas.");

    await userEvent.fill(fieldInput, "maxLoan");
    await userEvent.fill(variableInput, "maxLån");

    const mappings = svcData(editor).responseMappings as Array<{ field: string; variableName: string }>;
    expect(mappings[0]).toMatchObject({ field: "maxLoan", variableName: "maxLån" });
  });

  test("adds and removes mapping rows", async () => {
    const { editor, nodeEditor, panel } = mount();
    nodeEditor.selectNodeById("svc");

    const addButton = panel.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="add-mapping"]'
    );
    if (!addButton) throw new Error("Lägg till-knappen saknas.");
    await userEvent.click(addButton);
    expect((svcData(editor).responseMappings as unknown[]).length).toBe(2);

    const removeButton = panel.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="remove-mapping"]'
    );
    if (!removeButton) throw new Error("Ta bort-knappen saknas.");
    await userEvent.click(removeButton);
    expect((svcData(editor).responseMappings as unknown[]).length).toBe(1);
  });

  test("redigerar exempelsvaret som JSON", async () => {
    const { editor, nodeEditor, panel } = mount();
    nodeEditor.selectNodeById("svc");

    const textarea = panel.shadowRoot?.querySelector<HTMLTextAreaElement>(
      '[data-property="mockResponse"]'
    );
    if (!textarea) throw new Error("Exempelsvarsfältet saknas.");
    await userEvent.fill(textarea, '{ "decision": "approved" }');

    expect(svcData(editor).mockResponse).toBe('{ "decision": "approved" }');
  });
});
