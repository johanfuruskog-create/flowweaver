import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import { clearDeclaredLocales, declareLocales } from "../../../viewer/localization/registry";

import type { GuideEditor } from "./guide-editor";
import type { PropertiesPanel } from "../properties-panel/properties-panel";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Ticking a language reaches the guide, and survives being saved.
 *
 * The panel's own test checks that the box fires an event carrying the right
 * list. Nothing checked that the editor stored it — so removing `locales` from
 * the settings it writes failed no test at all, and a tick would have looked
 * right and been forgotten on save.
 *
 * Found by sabotage while reviewing whether every test earns its place. The
 * answer for this feature was that one was missing rather than one too many —
 * and the missing one turned up a fault rather than a gap: `getData()` returned
 * the canvas's copy whole, whose `settings` are whatever was loaded, so every
 * guide-level change was applied, shown, recorded in the history and then
 * dropped on the way out.
 *
 * `getData()` is what `graph-changed` carries, which means the host was saving
 * a guide without them.
 */

const GRAPH: GraphData = {
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "question",
      position: { x: 0, y: 0 },
      data: { title: { sv: "Bor du här?" }, variableName: "here", options: [] },
    },
  ],
  connections: [],
  settings: { sourceLocale: "sv", locales: ["sv", "en"] },
} as unknown as GraphData;

function mount(): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1100px; height: 700px;";
  document.body.append(editor);
  editor.graph = structuredClone(GRAPH);
  return editor;
}

const panel = (editor: GuideEditor): ShadowRoot =>
  editor.shadowRoot!.querySelector<PropertiesPanel>("properties-panel")!.shadowRoot!;

const box = (editor: GuideEditor, code: string): HTMLInputElement | null =>
  panel(editor).querySelector<HTMLInputElement>(`[data-locale-offered="${code}"]`);

afterEach(() => {
  document.body.replaceChildren();
  clearDeclaredLocales();
});

describe("the guide's languages", () => {
  test("start as the graph says", () => {
    expect(mount().getData().settings?.locales).toEqual(["sv", "en"]);
  });


  test("unticking one is written to the guide", async () => {
    const editor = mount();
    box(editor, "en")!.click();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(editor.getData().settings?.locales).toEqual(["sv"]);
  });

  test("and ticking one back is written too", async () => {
    declareLocales(["sv", "en", "fi"]);
    const editor = mount();
    box(editor, "fi")!.click();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(editor.getData().settings?.locales).toContain("fi");
  });

  // The translations are not part of what the box changes. That is what makes
  // unticking safe, so it is worth stating rather than assuming.
  test("unticking leaves the translations in the nodes", async () => {
    const editor = mount();
    editor.graph = {
      ...structuredClone(GRAPH),
      nodes: [
        {
          ...GRAPH.nodes[0]!,
          data: { ...GRAPH.nodes[0]!.data, title: { sv: "Bor du här?", en: "Do you live here?" } },
        },
      ],
    } as GraphData;
    box(editor, "en")!.click();
    await new Promise((resolve) => setTimeout(resolve, 60));

    const title = editor.getData().nodes[0]!.data.title as Record<string, string>;
    expect({ locales: editor.getData().settings?.locales, english: title.en }).toEqual({
      locales: ["sv"],
      english: "Do you live here?",
    });
  });
});
