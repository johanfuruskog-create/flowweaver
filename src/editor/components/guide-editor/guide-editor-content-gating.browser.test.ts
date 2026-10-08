// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { withPro } from "../../../testing/optional-pro";
const PRO = await withPro("index.ts");
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";

afterEach(() => {
  document.body.replaceChildren();
});

/** True in the PRO repository, false in the exported open tree. */
const PRO_PALETTE =
  Object.keys(import.meta.glob("../../../pro/editor/palette.ts")).length > 0;

function paletteNodeTypes(editor: GuideEditor): string[] {
  const palette = editor.shadowRoot?.querySelector("node-palette")?.shadowRoot;
  return Array.from(
    palette?.querySelectorAll("[data-node-type]") ?? []
  ).map((el) => el.getAttribute("data-node-type") ?? "");
}

function mount(level: string): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  // Opt in: the default is readonly, and this test builds.
  editor.setAttribute("mode", "administrator");
  editor.setAttribute("feature-level", level);
  document.body.append(editor);
  editor.graph = {
    startNodeId: "n",
    nodes: [{ id: "n", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart" } }],
    connections: [],
  };
  return editor;
}

describe("guide-editor: rich content nodes are gated to advanced mode", () => {
  test("basic hides Image, Code and Annotated image (rich content)", () => {
    const types = paletteNodeTypes(mount("basic"));
    expect(types).not.toContain("image");
    expect(types).not.toContain("code");
    expect(types).not.toContain("annotated-image");
  });

  test("basic hides Service call", () => {
    expect(paletteNodeTypes(mount("basic"))).not.toContain("service-call");
  });

  test("basic has the multi-choice question but not text or number questions", () => {
    const types = paletteNodeTypes(mount("basic"));
    expect(types).toContain("question");
    expect(types).toContain("multi-choice");
    expect(types).not.toContain("text-question");
    expect(types).not.toContain("number-question");
  });

  test("basic has the rule node but not calculation", () => {
    const types = paletteNodeTypes(mount("basic"));
    expect(types).toContain("rule");
    expect(types).not.toContain("calculation");
  });

  test("the note node exists in every mode (basic included)", () => {
    expect(paletteNodeTypes(mount("basic"))).toContain("annotation");
    expect(paletteNodeTypes(mount("advanced"))).toContain("annotation");
  });

  test("advanced visar Kod och Annoterad bild", () => {
    const types = paletteNodeTypes(mount("advanced"));
    expect(types).toContain("image");
    expect(types).toContain("code");
    expect(types).toContain("annotated-image");
  });

  function baseTemplateOptions(editor: GuideEditor): string[] {
    editor.shadowRoot
      ?.querySelector("editor-toolbar")
      ?.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="manage-node-types"]'
      )
      ?.click();
    const dialog = editor.shadowRoot?.querySelector("node-type-editor")?.shadowRoot;
    dialog?.querySelector<HTMLButtonElement>('[data-action="add-new"]')?.click();
    return Array.from(
      dialog?.querySelectorAll<HTMLOptionElement>("[data-base-template] option") ?? []
    ).map((option) => option.value);
  }

  test("basic allows creating a template from single and multi choice (not text or number)", () => {
    expect(baseTemplateOptions(mount("basic"))).toEqual([
      "question",
      "multi-choice",
    ]);
  });

  test("advanced allows creating a template from every base type", () => {
    expect(baseTemplateOptions(mount("advanced"))).toEqual([
      "question",
      "multi-choice",
      "text-question",
      "number-question",
    ]);
  });
});

describe("guide-editor: the modules attribute derives the capabilities", () => {
  function mountModules(modules: string): GuideEditor {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    editor.setAttribute("modules", modules);
    document.body.append(editor);
    editor.graph = {
      startNodeId: "n",
      nodes: [{ id: "n", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart" } }],
      connections: [],
    };
    return editor;
  }

  test("no modules = core: rule node but not calculation or code", () => {
    const editor = mountModules("");
    const types = paletteNodeTypes(editor);
    expect(types).toContain("rule");
    expect(types).not.toContain("calculation");
    expect(types).not.toContain("code");
    expect(editor.capabilities.advancedRules).toBe(false);
  });

  test("the logic module unlocks calculation but not content", () => {
    const editor = mountModules("logic");
    const types = paletteNodeTypes(editor);
    expect(types).toContain("calculation");
    expect(types).not.toContain("code");
    expect(editor.capabilities.advancedRules).toBe(true);
  });

  test("the content module unlocks code but not calculation", () => {
    const editor = mountModules("content");
    const types = paletteNodeTypes(editor);
    expect(types).toContain("code");
    expect(types).not.toContain("calculation");
  });

  test("Fält gives the visitor's own fields, Värdens tjänster the ones behind the host (097)", () => {
    const fields = mountModules("fields");
    const fieldTypes = paletteNodeTypes(fields);
    expect(fieldTypes).toContain("number-question");
    expect(fieldTypes).toContain("date-question");
    expect(fieldTypes).not.toContain("map-question");
    expect(fieldTypes).not.toContain("autocomplete-question");
    expect(fieldTypes).not.toContain("file-question");

    const hostServices = mountModules("host-services");
    const hostTypes = paletteNodeTypes(hostServices);
    expect(hostTypes).toContain("map-question");
    expect(hostTypes).toContain("autocomplete-question");
    expect(hostTypes).toContain("multi-autocomplete-question");
    // Attaching a file is offered by PRO only (Johan 8/10), so the open
    // palette lacks it whatever the modules say.
    if (PRO_PALETTE) expect(hostTypes).toContain("file-question");
    expect(hostTypes).not.toContain("number-question");
  });

  test("the modules attribute beats feature-level", () => {
    const editor = mountModules("");
    editor.setAttribute("feature-level", "advanced");
    // Modules satt → core gäller trots avancerad nivå.
    expect(editor.capabilities.calculations).toBe(false);
    expect(paletteNodeTypes(editor)).not.toContain("calculation");
  });
});

describe("guide-editor: the Modules menu in the toolbar", () => {
  function moduleToggles(editor: GuideEditor): HTMLButtonElement[] {
    const toolbar = editor.shadowRoot?.querySelector("editor-toolbar")?.shadowRoot;
    return Array.from(
      toolbar?.querySelectorAll<HTMLButtonElement>("[data-module-toggle]") ?? []
    );
  }

  test.runIf(PRO)("advanced: alla moduler ikryssade i menyn", () => {
    const editor = mount("advanced");
    const toggles = moduleToggles(editor);
    // One per catalogue entry: Logik, Innehåll, Fält, Värdens tjänster, Sidor,
    // Inlämning (Tjänst was split in two 6/10 — open-core step 2).
    expect(toggles.length).toBe(6);
    expect(toggles.every((b) => b.getAttribute("aria-checked") === "true")).toBe(
      true
    );
  });

  test("unticking Logik switches calculations off and removes the node", () => {
    const editor = mount("advanced");
    expect(editor.capabilities.calculations).toBe(true);

    const logik = moduleToggles(editor).find(
      (b) => b.dataset.moduleToggle === "logic"
    );
    if (!logik) throw new Error("Logik-toggeln saknas.");
    logik.click();

    expect(editor.capabilities.calculations).toBe(false);
    expect(editor.capabilities.advancedRules).toBe(false);
    // Core-baslinjen är kvar.
    expect(editor.capabilities.rules).toBe(true);
    expect(paletteNodeTypes(editor)).not.toContain("calculation");
    // Menyn speglar det avkryssade läget.
    const after = moduleToggles(editor).find(
      (b) => b.dataset.moduleToggle === "logic"
    );
    expect(after?.getAttribute("aria-checked")).toBe("false");
  });
});
