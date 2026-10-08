import { afterEach, beforeEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";
import { saveToLibrary, setLibrary } from "../../services/template-library";

import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";
import type { PropertiesPanel } from "../properties-panel/properties-panel";
import type { GraphData, NodeTemplate } from "../../../viewer/types/graph";

/**
 * Changing or removing a node's template.
 *
 * The provenance carries no data — it only says what the node is called. The
 * template's values apply when the node is **created**; repointing an existing
 * node must never rewrite what someone authored in it.
 */

const jaNej: NodeTemplate = {
  type: "mall-ja-nej",
  label: "Ja/Nej-fråga",
  base: "question",
  values: { presentation: "radio" },
};

const kommun: NodeTemplate = {
  type: "mall-kommun",
  label: "Kommunval",
  base: "question",
  // Entirely different values from the node's. They must not land in the node on a change.
  values: { presentation: "select", cssClasses: "kommun", variableName: "kommun" },
};

/** En textfrågemall — fel grundtyp för nodens typ. */
const epost: NodeTemplate = {
  type: "mall-epost",
  label: "E-postfråga",
  base: "text-question",
  values: { format: "email" },
};

function graf(): GraphData {
  return {
    startNodeId: "n1",
    nodes: [
      {
        id: "n1",
        type: "question",
        template: "mall-ja-nej",
        position: { x: 80, y: 80 },
        data: {
          title: { sv: "Bor du i kommunen?" },
          variableName: "bor",
          presentation: "radio",
          cssClasses: "",
          options: [
            { id: "ja", label: { sv: "Ja" }, value: "ja" },
            { id: "nej", label: { sv: "Nej" }, value: "nej" },
          ],
        },
      },
    ],
    connections: [],
  };
}

beforeEach(() => {
  setLibrary([]);
  [jaNej, kommun, epost].forEach(saveToLibrary);
});

afterEach(() => {
  document.body.replaceChildren();
  setLibrary([]);
});

function montera(): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  // Opt in: the default is readonly, and this test builds.
  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1100px; height: 700px;";
  document.body.append(editor);
  editor.graph = graf();
  editor.shadowRoot
    ?.querySelector<NodeEditor>("node-editor")
    ?.selectNodeById("n1");
  return editor;
}

const panel = (editor: GuideEditor): PropertiesPanel =>
  editor.shadowRoot?.querySelector("properties-panel") as PropertiesPanel;

function picker(editor: GuideEditor): HTMLSelectElement | null {
  return (
    panel(editor).shadowRoot?.querySelector<HTMLSelectElement>(
      "[data-template-select]"
    ) ?? null
  );
}

function choose(editor: GuideEditor, value: string): void {
  const select = picker(editor);
  select!.value = value;
  select!.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
}

const nod = (editor: GuideEditor) => editor.getData().nodes[0];

function rubrik(editor: GuideEditor): string {
  const canvas = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  const element = [...(canvas?.shadowRoot?.querySelectorAll("flow-node") ?? [])][0];

  // Trim first: the regex is anchored, and textContent starts with the line
  // break from the template string.
  const text =
    element?.shadowRoot?.querySelector(".flow-node__header-text")?.textContent?.trim() ??
    "";

  return text.replace(/^Start\s*·\s*/, "");
}

describe("valet av mall", () => {
  test("visar nodens nuvarande mall", () => {
    expect(picker(montera())?.value).toBe("mall-ja-nej");
  });

  // A question node cannot have come from a text-question template. Being able
  // to claim so would be an untruth about the node.
  test("erbjuder bara mallar med nodens egen grundtyp", () => {
    const values = [...(picker(montera())?.options ?? [])].map((o) => o.value);

    expect(values).toEqual(["", "mall-ja-nej", "mall-kommun"]);
  });

  // A picker containing only "Ingen mall" is noise.
  test("is absent entirely when the node neither has nor can get a template", () => {
    setLibrary([epost]);
    const utanTagg = graf();
    delete utanTagg.nodes[0].template;

    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = utanTagg;
    editor.shadowRoot
      ?.querySelector<NodeEditor>("node-editor")
      ?.selectNodeById("n1");

    expect(picker(editor)).toBeNull();
  });

  // …but a node carrying a template that vanished must be allowed to show it,
  // otherwise the key cannot be seen and the template cannot be recreated.
  test("remains for a node whose template is missing", () => {
    setLibrary([epost]);
    const editor = montera();

    expect(picker(editor)).not.toBeNull();
  });
});

describe("att byta mall", () => {
  test("changes only what the node is called", () => {
    const editor = montera();
    expect(rubrik(editor)).toBe("Ja/Nej-fråga");

    choose(editor, "mall-kommun");

    expect(rubrik(editor)).toBe("Kommunval");
  });

  // The template's values apply when the node is created. A change is not a creation.
  test("the new template's values do not land in the node", () => {
    const editor = montera();
    const before = nod(editor).data;

    choose(editor, "mall-kommun");

    expect(nod(editor).data).toEqual(before);
    expect(nod(editor).data.presentation).toBe("radio");
    expect(nod(editor).data.variableName).toBe("bor");
  });

  // The picker used to show the old value afterwards: the change went down the
  // live-typing branch, which deliberately skips the panel re-render.
  test("the picker shows what was chosen", () => {
    const editor = montera();

    choose(editor, "mall-kommun");

    expect(picker(editor)?.value).toBe("mall-kommun");
  });

  test("and is an undo step of its own", () => {
    const editor = montera();

    choose(editor, "mall-kommun");
    editor.undo();

    expect(nod(editor).template).toBe("mall-ja-nej");
  });

  test("the node's type is untouched", () => {
    const editor = montera();

    choose(editor, "mall-kommun");

    expect(nod(editor).type).toBe("question");
  });
});

describe("removing the template from a node", () => {
  test("no data disappears", () => {
    const editor = montera();
    const before = JSON.stringify(nod(editor).data);

    choose(editor, "");

    expect(JSON.stringify(nod(editor).data)).toBe(before);
  });

  test("the node takes the base type's name instead", () => {
    const editor = montera();

    choose(editor, "");

    expect(rubrik(editor)).toBe("Fråga");
  });

  test("the provenance is gone, not empty", () => {
    const editor = montera();

    choose(editor, "");

    expect(nod(editor)).not.toHaveProperty("template");
  });

  test("the ports remain, so the paths work", () => {
    const editor = montera();

    choose(editor, "");

    const canvas = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const element = [...(canvas?.shadowRoot?.querySelectorAll("flow-node") ?? [])][0];
    const portar = [
      ...(element?.shadowRoot?.querySelectorAll("[data-port-id]") ?? []),
    ].map((port) => port.getAttribute("data-port-id"));

    expect(portar).toContain("ja");
    expect(portar).toContain("nej");
  });

  test("works via the node's menu too", () => {
    const editor = montera();
    const canvas = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const element = [...(canvas?.shadowRoot?.querySelectorAll("flow-node") ?? [])][0];

    element!.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, composed: true, cancelable: true })
    );
    canvas?.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-action="detach-template"]')
      ?.click();

    expect(nod(editor)).not.toHaveProperty("template");
  });

  test("the menu item is absent on a node without a template", () => {
    const editor = montera();
    choose(editor, "");

    const canvas = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const element = [...(canvas?.shadowRoot?.querySelectorAll("flow-node") ?? [])][0];
    element!.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, composed: true, cancelable: true })
    );

    expect(
      canvas?.shadowRoot?.querySelector('[data-action="detach-template"]')
    ).toBeNull();
  });
});

describe("en mall som tagits bort ur biblioteket", () => {
  // The key is the only thing that survived. Drop it from the picker and the
  // template can no longer be recreated, and that without anyone asking. See
  // K6b.
  test("stays selected in the picker", () => {
    setLibrary([kommun]);
    const editor = montera();

    expect(picker(editor)?.value).toBe("mall-ja-nej");
    expect(picker(editor)?.selectedOptions[0].textContent).toContain(
      "Saknad mall"
    );
  });

  test("and disappears only when the editor chooses it away", () => {
    setLibrary([kommun]);
    const editor = montera();

    expect(nod(editor).template).toBe("mall-ja-nej");

    choose(editor, "");

    expect(nod(editor)).not.toHaveProperty("template");
  });
});
