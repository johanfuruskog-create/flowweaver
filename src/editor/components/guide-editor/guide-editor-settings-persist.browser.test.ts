import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Guide-level settings survive being read back out.
 *
 * `getData()` is what `graph-changed` carries, which is what a host saves. It
 * used to return the canvas's copy of the graph whole — and the canvas's
 * `settings` is whatever was there when the guide loaded, because nothing ever
 * updates it.
 *
 * So a change to the languages a guide is offered in, or to a text an editor
 * customised, was applied to the editor's own copy, shown correctly in the
 * panel, recorded in the undo history — and then dropped on the way out. The
 * editor looked right and the save was wrong, which is the worst arrangement of
 * the two.
 *
 * Nodes come from the canvas, settings from the editor. Each half from its
 * owner, so there is no second copy to keep in step.
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
  editor.style.cssText = "display: block; width: 1000px; height: 600px;";
  document.body.append(editor);
  editor.graph = structuredClone(GRAPH);
  return editor;
}

/** The panel's events, dispatched as the panel dispatches them. */
function fromPanel(editor: GuideEditor, type: string, detail: unknown): void {
  editor.shadowRoot!
    .querySelector("properties-panel")!
    .dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
}

afterEach(() => document.body.replaceChildren());

describe("what a host is handed when it saves", () => {
  test("the languages the guide is offered in", async () => {
    const editor = mount();
    fromPanel(editor, "guide-locales-changed", { locales: ["sv"] });
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(editor.getData().settings?.locales).toEqual(["sv"]);
  });

  test("a text the editor customised", async () => {
    const editor = mount();
    fromPanel(editor, "guide-string-changed", {
      key: "nav.next",
      value: { sv: "Vidare" },
    });
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(editor.getData().settings?.strings?.["nav.next"]).toEqual({ sv: "Vidare" });
  });

  // Without this the two above could pass on an editor that returned settings
  // and lost the nodes instead.
  test("and the nodes still come from the canvas", async () => {
    const editor = mount();
    fromPanel(editor, "guide-locales-changed", { locales: ["sv"] });
    await new Promise((resolve) => setTimeout(resolve, 60));

    const data = editor.getData();
    expect({ nodes: data.nodes.length, start: data.startNodeId }).toEqual({
      nodes: 1,
      start: "q",
    });
  });

  test("what the graph arrived with is still there when nothing changed", () => {
    expect(mount().getData().settings).toMatchObject({
      sourceLocale: "sv",
      locales: ["sv", "en"],
    });
  });
});
