import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";
import {
  fokusbrott,
  fokusstopp,
  positivaTabindex,
} from "../../../testing/keyboard";

import type { GuideEditor } from "./guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * The keyboard in the editor.
 *
 * The order is **not** tested against the visual one here. The canvas's nodes
 * sit at free coordinates the editor chose, and there the graph's order is a
 * more sensible tab order than wherever the nodes happen to land on screen.
 * What does hold everywhere: can you see where you are, and is what you can
 * reach visible.
 */

function graf(): GraphData {
  return {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "question",
        position: { x: 40, y: 40 },
        data: {
          title: { sv: "Bor du i kommunen?" },
          variableName: "bor",
          options: [{ id: "ja", label: { sv: "Ja" }, value: "ja" }],
        },
      },
      { id: "r", type: "result", position: { x: 400, y: 40 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "q", portId: "ja" }, to: { nodeId: "r", portId: "input" } },
    ],
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

function montera(mode = "administrator"): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.setAttribute("mode", mode);
  editor.style.cssText = "display: block; width: 1200px; height: 800px;";
  document.body.append(editor);
  editor.graph = graf();
  return editor;
}

const subRoots = (editor: GuideEditor): ShadowRoot[] =>
  ["editor-toolbar", "node-palette", "properties-panel", "node-editor"]
    .map((picker) => editor.shadowRoot?.querySelector(picker)?.shadowRoot)
    .filter((rot): rot is ShadowRoot => Boolean(rot));

describe("tangentbordet i editorn", () => {
  test.each(["administrator", "edit", "translator", "readonly"])(
    "%s: varje stopp syns och visar fokus",
    async (mode) => {
      const editor = montera(mode);

      expect(fokusbrott(await fokusstopp(editor))).toEqual([]);
    },
  );

  test("no positive tabindex anywhere", () => {
    const editor = montera();
    const brott = [editor.shadowRoot!, ...subRoots(editor)].flatMap((rot) =>
      positivaTabindex(rot),
    );

    expect(brott).toEqual([]);
  });

  // A disabled mode should remove possibilities, not leave buttons that do
  // nothing to tab past.
  test("readonly leaves no dead stops", async () => {
    const editor = montera("readonly");
    const stopp = await fokusstopp(editor);

    expect(stopp.every((plats) => plats.synlig)).toBe(true);
  });
});
