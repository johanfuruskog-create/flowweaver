import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Every button the palette offers adds a node. All of them, at every level.
 *
 * ## Why this is a sweep and not three cases
 *
 * The palette was offering three buttons that did nothing. Templates are not
 * node types, so the capability filter that thins the registry never reached
 * them, and a template built on a text question stayed on show in basic mode
 * where text questions are off. Clicking it added no node, raised no error and
 * said nothing.
 *
 * That was fixed where it happened, and a test in `node-palette` says templates
 * now follow the same capability as the node they would create. This file was
 * written to guard the wider property: if the tool offers it, it works.
 *
 * ## The cause, once it was dug out
 *
 * Not a missing filter — the editor already filtered templates by capability
 * before handing them over. A **stale list**. The palette re-thins its node
 * types whenever `capabilities` is set, but the template list is only written
 * by `refreshPalette()`, and changing the feature level never called it. An
 * editor moved from advanced to basic kept offering templates built on types
 * it no longer had, and the add path refused them without a word.
 *
 * So the last case below changes the level *after* mounting, which is the only
 * way to reproduce it. Mounting straight into basic never could.
 *
 * ## Why it clicks rather than reasons
 *
 * Comparing the palette's list against the capability table would be the same
 * reasoning the code already does, checked twice. Pressing the button and
 * counting the nodes asks the only question that matters, and it cannot agree
 * with a bug by sharing its assumption.
 */

const EMPTY = (): GraphData =>
  ({
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
  }) as unknown as GraphData;

afterEach(() => document.body.replaceChildren());

/*
 * Templates, deliberately spanning the levels.
 *
 * A bare editor has none, and the first version of this sweep therefore passed
 * with the fix removed — it swept a palette that had nothing to get wrong. One
 * is built on a type basic has and one on a type it does not, so the sweep has
 * something to catch at every level.
 */
const TEMPLATES = [
  { type: "nodmall-val", base: "question", label: "Ja eller nej", data: {} },
  { type: "nodmall-epost", base: "number-question", label: "Antal", data: {} },
];

function mount(level: string): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("feature-level", level);
  editor.style.cssText = "display: block; width: 1200px; height: 800px;";
  document.body.append(editor);
  editor.graph = EMPTY();
  (editor as unknown as { nodeTemplates: unknown }).nodeTemplates = TEMPLATES;
  return editor;
}

const palette = (editor: GuideEditor): ShadowRoot =>
  editor.shadowRoot?.querySelector("node-palette")?.shadowRoot as ShadowRoot;

const nodeCount = (editor: GuideEditor): number =>
  editor.shadowRoot
    ?.querySelector("node-editor")
    ?.shadowRoot?.querySelectorAll("flow-node").length ?? 0;

const buttons = (editor: GuideEditor): string[] =>
  [...palette(editor).querySelectorAll<HTMLElement>("[data-node-type]")].map(
    (button) => button.dataset.nodeType ?? ""
  );

describe.each(["basic", "advanced", "service"])(
  "the palette at feature-level %s",
  (level) => {
    test("offers something, including a template", () => {
      const shown = buttons(mount(level));

      // A level that offered nothing would pass the sweep below by doing no
      // work at all — and a palette with no templates would sweep past the
      // failure this file was written for.
      expect(shown.length).toBeGreaterThan(2);
      expect(shown.some((type) => type.startsWith("nodmall-"))).toBe(true);
    });

    test("and every button it offers adds a node", () => {
      const editor = mount(level);
      const dead: string[] = [];

      for (const type of buttons(editor)) {
        const before = nodeCount(editor);

        palette(editor)
          .querySelector<HTMLElement>(`[data-node-type="${CSS.escape(type)}"]`)
          ?.click();

        if (nodeCount(editor) === before) {
          dead.push(type);
        }
      }

      // Named, because the fix is different for each and the message is where
      // somebody will read which one it was.
      expect(dead).toEqual([]);
    });
  }
);

describe("changing the level after the editor is up", () => {
  test("takes the templates with it", () => {
    const editor = mount("advanced");

    expect(buttons(editor)).toContain("nodmall-epost");

    editor.setAttribute("feature-level", "basic");

    /*
     * The reproduction. The palette re-filtered its node types and kept the
     * template list it was handed at mount, so this button stayed — and did
     * nothing when pressed, because the add path checks the capability the
     * palette had stopped checking.
     */
    expect(buttons(editor)).not.toContain("nodmall-epost");
  });

  test("and what is left still works", () => {
    const editor = mount("advanced");

    editor.setAttribute("feature-level", "basic");

    const dead = buttons(editor).filter((type) => {
      const before = nodeCount(editor);

      palette(editor)
        .querySelector<HTMLElement>(`[data-node-type="${CSS.escape(type)}"]`)
        ?.click();
      return nodeCount(editor) === before;
    });

    expect(dead).toEqual([]);
  });
});
