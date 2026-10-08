import { afterEach, beforeEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";
import { getEditableLibrary, saveToLibrary, setLibrary } from "../../services/template-library";

import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";
import type { PropertiesPanel } from "../properties-panel/properties-panel";
import type { GraphData, NodeTemplate } from "../../../viewer/types/graph";

/**
 * When the link to a node template breaks.
 *
 * The template's key used to be the node's `type`. If a colleague removed a
 * shared template, every node using it became unknown, in every guide. Now the
 * template is provenance: the node is already a fully valid node of its base
 * type.
 */

const mall: NodeTemplate = {
  type: "mall-ja-nej",
  label: "Ja/Nej-fråga",
  icon: "☑",
  base: "question",
  values: {},
};

/** A node created from the template, in a guide opened without the template. */
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
          options: [
            { id: "ja", label: { sv: "Ja" }, value: "ja" },
            { id: "nej", label: { sv: "Nej" }, value: "nej" },
          ],
        },
      },
      // En andra nod ur samma mall, med egen rubrik och eget variabelnamn.
      {
        id: "n2",
        type: "question",
        template: "mall-ja-nej",
        position: { x: 480, y: 80 },
        data: {
          title: { sv: "Har du körkort?" },
          variableName: "korkort",
          presentation: "radio",
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
  return editor;
}

const canvas = (editor: GuideEditor): NodeEditor =>
  editor.shadowRoot?.querySelector("node-editor") as NodeEditor;

function nodElement(editor: GuideEditor): Element | undefined {
  return [...(canvas(editor).shadowRoot?.querySelectorAll("flow-node") ?? [])][0];
}

/** Nodens rubrik utan startnodens prefix. */
function rubrik(editor: GuideEditor): string {
  const text =
    nodElement(editor)
      ?.shadowRoot?.querySelector(".flow-node__header-text")
      ?.textContent?.trim() ?? "";

  return text.replace(/^Start\s*·\s*/, "");
}

describe("a node whose template is gone", () => {
  test("is drawn as a real node, not as unknown", () => {
    const editor = montera();

    expect(
      nodElement(editor)?.shadowRoot?.querySelector(".flow-node__unknown")
    ).toBeNull();
    expect(nodElement(editor)?.shadowRoot?.textContent).toContain(
      "Bor du i kommunen?"
    );
  });

  test("keeps its ports, so the paths work", () => {
    const editor = montera();
    const portar = [
      ...(nodElement(editor)?.shadowRoot?.querySelectorAll("[data-port-id]") ?? []),
    ].map((port) => port.getAttribute("data-port-id"));

    expect(portar).toContain("ja");
    expect(portar).toContain("nej");
  });

  // The name degrades to the truth: the node *is* a question.
  test("heter grundtypens namn", () => {
    expect(rubrik(montera())).toBe("Fråga");
  });

  test("and the template's name again as soon as the template exists", () => {
    const editor = montera();
    expect(rubrik(editor)).toBe("Fråga");

    saveToLibrary(mall);
    editor.graph = graf();

    expect(rubrik(editor)).toBe("Ja/Nej-fråga");
  });

  test("the panel says the same as the canvas", () => {
    const editor = montera();
    canvas(editor).selectNodeById("n1");
    const panel = editor.shadowRoot?.querySelector<PropertiesPanel>("properties-panel");

    expect(panel?.shadowRoot?.textContent).toContain("Fråga");
  });

  // The provenance is authored. It must survive the template being gone,
  // otherwise the template cannot be recreated and the sibling nodes never find
  // their way home. See K6b.
  test("still carries the template's key", () => {
    expect(montera().getData().nodes[0].template).toBe("mall-ja-nej");
  });
});

describe("rescuing a removed template", () => {
  /** The action in the node's menu, which must say what it actually does. */
  function menyval(editor: GuideEditor): string | undefined {
    // Menyn hittar noden via händelsens väg, inte via koordinater.
    nodElement(editor)!.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, composed: true, cancelable: true })
    );
    return canvas(editor)
      .shadowRoot?.querySelector('[data-action="save-as-template"]')
      ?.textContent?.trim();
  }

  test("the menu says Recreate template, not Update", () => {
    const editor = montera();
    canvas(editor).selectNodeById("n1");

    expect(menyval(editor)).toBe("Återskapa mall");
  });

  test("and Update template when the template still exists", () => {
    saveToLibrary(mall);
    const editor = montera();
    canvas(editor).selectNodeById("n1");

    expect(menyval(editor)).toBe("Uppdatera mall");
  });

  function recreate(editor: GuideEditor): void {
    canvas(editor).dispatchEvent(
      new CustomEvent("save-as-node-template-intent", {
        detail: { nodeId: "n1" },
        bubbles: true,
        composed: true,
      })
    );

    const dialog = editor.shadowRoot?.querySelector("node-type-editor")?.shadowRoot;
    dialog!.querySelector<HTMLInputElement>("[data-name]")!.value = "Ja/Nej-fråga";
    dialog!.querySelector<HTMLButtonElement>('[data-action="create"]')!.click();
  }

  test("it is recreated under the same key", () => {
    const editor = montera();

    recreate(editor);

    expect(getEditableLibrary()).toHaveLength(1);
    expect(getEditableLibrary()[0].type).toBe("mall-ja-nej");
    expect(getEditableLibrary()[0].base).toBe("question");
  });

  test("the values come from what the nodes have in common", () => {
    const editor = montera();

    recreate(editor);

    expect(getEditableLibrary()[0].values).toEqual({
      presentation: "radio",
      options: [
        { id: "ja", label: { sv: "Ja" }, value: "ja" },
        { id: "nej", label: { sv: "Nej" }, value: "nej" },
      ],
    });
  });

  // Otherwise whichever node you happened to be on would have made its title
  // the template's, and every new node from it would have been born with "Bor
  // du i kommunen?".
  test("en nods egen rubrik blir inte mallens", () => {
    const editor = montera();

    recreate(editor);

    expect(getEditableLibrary()[0].values).not.toHaveProperty("title");
    expect(getEditableLibrary()[0].values).not.toHaveProperty("variableName");
  });

  // The only thing that happens to the existing nodes is that the name returns.
  test("befintliga noder skrivs aldrig om", () => {
    const editor = montera();
    const before = JSON.stringify(editor.getData().nodes);

    recreate(editor);

    expect(JSON.stringify(editor.getData().nodes)).toBe(before);
  });

  test("the dialog says where the values come from", () => {
    const editor = montera();

    canvas(editor).dispatchEvent(
      new CustomEvent("save-as-node-template-intent", {
        detail: { nodeId: "n1" },
        bubbles: true,
        composed: true,
      })
    );

    const dialog = editor.shadowRoot?.querySelector("node-type-editor")?.shadowRoot;

    expect(dialog?.querySelector("[data-note]")?.textContent).toContain(
      "2 noder i guiden har gemensamt"
    );
  });

  // The point of keeping the key: every node with the same provenance finds its
  // way home, not just the one you happened to be on.
  test("noden heter mallens namn igen", () => {
    const editor = montera();

    recreate(editor);
    editor.graph = editor.getData();

    expect(rubrik(editor)).toBe("Ja/Nej-fråga");
  });
});
