import { afterEach, beforeEach, describe, expect, test } from "vitest";
import "../../../viewer/node-types/default-node-types";
import "./guide-editor";
import {
  newNodeTemplate,
  nodeToTemplate,
  templateCapability,
} from "../../../viewer/node-types/node-templates";
import {
  getEditableLibrary,
  mergeIntoLibrary,
  setLibrary,
} from "../../services/template-library";
import type { GuideEditor } from "./guide-editor";
import type { NodePalette } from "../node-palette/node-palette";
import type { NodeTemplate } from "../../../viewer/types/graph";

beforeEach(() => {
  // Start with a clean library. The templates live in memory since storage
  // moved out to the host — clearing localStorage does nothing any more.
  setLibrary([]);
});

afterEach(() => {
  document.body.replaceChildren();
  setLibrary([]);
});

function mountEditor(): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  // Opt in: the default is readonly, and this test builds.
  editor.setAttribute("mode", "administrator");
  document.body.append(editor);
  editor.graph = {
    startNodeId: "n",
    nodes: [{ id: "n", type: "result", position: { x: 80, y: 80 }, data: { title: "Klart" } }],
    connections: [],
  };
  return editor;
}

function palette(editor: GuideEditor): NodePalette {
  const el = editor.shadowRoot?.querySelector<NodePalette>("node-palette");
  if (!el) throw new Error("Paletten saknas.");
  return el;
}

function nodmall(label: string): NodeTemplate {
  const spec = nodeToTemplate({
    id: "src",
    type: "multi-choice",
    position: { x: 0, y: 0 },
    data: { title: label },
  });
  if (!spec) throw new Error("Kunde inte bygga mall.");
  return { ...spec, label, icon: "☑" };
}

describe("guide-editor egna nodtyper (UI)", () => {
  test("addCustomNodeType sparar, registrerar och visar i paletten", () => {
    const editor = mountEditor();
    const spec = nodmall("Intressen");

    editor.addCustomNodeType(spec);

    expect(getEditableLibrary()).toHaveLength(1);

    const button = palette(editor).shadowRoot?.querySelector(
      `.node-palette__full button[data-node-type="${spec.type}"]`
    );
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain("Intressen");
  });

  test("removeCustomNodeType tar bort mallen och avregistrerar den", () => {
    const editor = mountEditor();
    const spec = nodmall("Intressen");
    editor.addCustomNodeType(spec);

    editor.removeCustomNodeType(spec.type);

    expect(getEditableLibrary()).toHaveLength(0);
    expect(
      palette(editor).shadowRoot?.querySelector(`.node-palette__full button[data-node-type="${spec.type}"]`)
    ).toBeNull();
  });

  test("updateCustomNodeType changes the name and shows through in the palette", () => {
    const editor = mountEditor();
    const spec = nodmall("Kommunval");
    editor.addCustomNodeType(spec);

    editor.updateCustomNodeType(spec.type, { label: "Regionval" });

    expect(getEditableLibrary()[0].label).toBe("Regionval");
    const button = palette(editor).shadowRoot?.querySelector(
      `.node-palette__full button[data-node-type="${spec.type}"]`
    );
    expect(button?.textContent).toContain("Regionval");
  });

  test("Update template from an instance swaps the template's defaults", () => {
    const spec = nodmall("Intressen");
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "inst",
      nodes: [
        {
          id: "inst",
          type: "multi-choice",
          template: spec.type,
          position: { x: 0, y: 0 },
          data: {
            options: [{ id: "z", label: "Z", value: "z" }],
            minSelected: 3,
          },
        },
      ],
      connections: [],
      settings: { nodeTemplates: [spec] },
    };

    editor.shadowRoot
      ?.querySelector("node-editor")
      ?.dispatchEvent(
        new CustomEvent("save-as-node-template-intent", {
          detail: { nodeId: "inst" },
          bubbles: true,
          composed: true,
        })
      );

    const updated = getEditableLibrary()[0];
    expect(updated?.values.options).toEqual([{ id: "z", label: "Z", value: "z" }]);
    expect(updated?.values.minSelected).toBe(3);
  });

  test("en mall i biblioteket syns i en annan guide", () => {
    const first = mountEditor();
    const spec = nodmall("Ja/Nej");
    first.addCustomNodeType(spec);
    first.remove();

    // En helt ny guide (annan graf) – biblioteket delas via localStorage.
    const second = mountEditor();

    expect(
      palette(second).shadowRoot?.querySelector(
        `.node-palette__full button[data-node-type="${spec.type}"]`
      )
    ).not.toBeNull();
  });

  test("Guide, Node templates opens the standalone editor", () => {
    const editor = mountEditor();

    editor.shadowRoot
      ?.querySelector("editor-toolbar")
      ?.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="manage-node-types"]'
      )
      ?.click();

    const dialog = editor.shadowRoot
      ?.querySelector("node-type-editor")
      ?.shadowRoot?.querySelector<HTMLDialogElement>("dialog");
    expect(dialog?.open).toBe(true);
  });

  test("text-based library templates are hidden in basic but listed in advanced", () => {
    const textSpec = newNodeTemplate("number-question");
    if (!textSpec) throw new Error("Kunde inte bygga textmall.");
    // Text-mallar ärver inputQuestions: av i basic, på i advanced.
    expect(templateCapability(textSpec)).toBe("inputQuestions");
    mergeIntoLibrary([{ ...textSpec, label: "E-postfråga", icon: "@" }]);

    const dialogText = (editor: GuideEditor): string => {
      editor.shadowRoot
        ?.querySelector("editor-toolbar")
        ?.shadowRoot?.querySelector<HTMLButtonElement>(
          '[data-action="manage-node-types"]'
        )
        ?.click();
      return (
        editor.shadowRoot?.querySelector("node-type-editor")?.shadowRoot
          ?.textContent ?? ""
      );
    };

    const mountAt = (level: string): GuideEditor => {
      const editor = document.createElement("guide-editor") as GuideEditor;
      // Opt in: the default is readonly, and this test builds.
      editor.setAttribute("mode", "administrator");
      editor.setAttribute("feature-level", level);
      document.body.append(editor);
      editor.graph = {
        startNodeId: "n",
        nodes: [
          { id: "n", type: "result", position: { x: 80, y: 80 }, data: { title: "Klart" } },
        ],
        connections: [],
      };
      return editor;
    };

    const basic = mountAt("basic");
    expect(dialogText(basic)).not.toContain("E-postfråga");
    basic.remove();

    const advanced = mountAt("advanced");
    expect(dialogText(advanced)).toContain("E-postfråga");
  });

  test("editor-locale-attributet ger engelsk chrome i nodmall-editorn", () => {
    const editor = mountEditor();
    editor.setAttribute("editor-locale", "en");

    editor.shadowRoot
      ?.querySelector("editor-toolbar")
      ?.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="manage-node-types"]'
      )
      ?.click();

    const title = editor.shadowRoot
      ?.querySelector("node-type-editor")
      ?.shadowRoot?.querySelector("#node-type-editor-title");
    expect(title?.textContent).toBe("Node templates");
  });
});
