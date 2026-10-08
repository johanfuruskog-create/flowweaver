import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * A picker with one option is not a choice.
 *
 * A guide offered only in its source language has a language select that opens,
 * shows the language you are already in, and closes. That reads as something
 * being broken — a list that will not let you pick — when the truth is simply
 * that there is nowhere else to go.
 *
 * ## Why this moved
 *
 * It used to mount an `editor-toolbar` and set `guideLocales` on it. The picker
 * now sits on the editor's context row instead, because in a 56-pixel toolbar
 * the label beside it broke into two lines and, made to stay on one, pushed the
 * select off the edge. So the test asks the editor for a guide offered in one
 * language, which is what a host actually does.
 */

const guide = (locales: string[]): GraphData => ({
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Bor du i kommunen?" },
        variableName: "bor",
        options: [{ id: "ja", label: { sv: "Ja" }, value: "ja" }],
      },
    },
  ],
  connections: [],
  settings: { locales, sourceLocale: "sv" },
});

function mount(locales: string[]): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1100px; height: 700px;";
  document.body.append(editor);
  editor.graph = guide(locales);
  return editor;
}

const select = (editor: GuideEditor): HTMLSelectElement | null =>
  editor.shadowRoot?.querySelector<HTMLSelectElement>("[data-locale-select]") ?? null;

afterEach(() => document.body.replaceChildren());

describe("the guide's language picker", () => {
  test("is disabled when the guide has only its source", () => {
    const element = select(mount(["sv"]));

    expect({ found: element !== null, disabled: element?.disabled }).toEqual({
      found: true,
      disabled: true,
    });
  });

  test("and enabled as soon as there is somewhere to go", () => {
    const element = select(mount(["sv", "fi"]));

    expect({ options: element?.options.length, disabled: element?.disabled }).toEqual({
      options: 2,
      disabled: false,
    });
  });

  // Going back to one turns it off again: the list is set, not accumulated.
  test("turning back to one disables it again", () => {
    const editor = mount(["sv", "fi"]);

    editor.graph = guide(["sv"]);

    expect(select(editor)?.disabled).toBe(true);
  });
});
