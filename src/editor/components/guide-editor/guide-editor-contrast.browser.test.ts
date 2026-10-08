import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";
import { kontrastbrott } from "../../../testing/contrast";

import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Colour contrast in the editor, in both themes.
 *
 * The editor sits here all day. The node headers' identity colours, the badge
 * tints and the dimmed help texts are the three places where a colour tends to
 * be chosen to be noticed rather than to be read.
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
          description: { sv: "Svaret avgör vilka regler som gäller." },
          variableName: "bor",
          options: [
            { id: "ja", label: { sv: "Ja" }, value: "ja" },
            { id: "nej", label: { sv: "Nej" }, value: "nej" },
          ],
        },
      },
      { id: "regel", type: "rule", position: { x: 340, y: 40 }, data: { title: { sv: "Välj väg" }, cases: [] } },
      { id: "kalk", type: "calculation", position: { x: 40, y: 240 }, data: { title: { sv: "Räkna ut" }, assignments: [] } },
      { id: "tjanst", type: "service-call", position: { x: 340, y: 240 }, data: { title: { sv: "Hämta beslut" } } },
      { id: "r", type: "result", position: { x: 640, y: 40 }, data: { title: { sv: "Du kan ansöka" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "q", portId: "ja" }, to: { nodeId: "r", portId: "input" } },
    ],
  };
}

afterEach(() => {
  document.body.replaceChildren();
  delete document.documentElement.dataset.theme;
});

function montera(mode: string, tema?: "dark"): GuideEditor {
  if (tema) {
    document.documentElement.dataset.theme = tema;
  }

  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.setAttribute("mode", mode);
  editor.style.cssText = "display: block; width: 1200px; height: 800px;";
  document.body.append(editor);
  editor.graph = graf();
  /*
   * UPPDRAG-2026-09-28-SVARSALTERNATIV, 1e (Siv, mätt 28/9): `document.
   * documentElement.dataset.theme` alone never reached the editor's own
   * tokens — the package scopes them to the ELEMENT (K10, an embedded
   * module may not touch the host page's `:root`), governed by
   * `data-fw-theme` on `guide-editor` itself through its own `theme`
   * property. Measured directly with `getComputedStyle(editor).
   * getPropertyValue("--fw-text")`: every "mörkt tema" test in this file
   * had been reading the LIGHT value all along. Left in place too, in case
   * a host page's own convention on `<html>` ever matters for something
   * else this file should also cover.
   */
  if (tema) {
    editor.theme = tema;
  }
  return editor;
}

/** Varje del av editorn, inklusive delkomponenternas skuggrötter. */
function brott(editor: GuideEditor): string[] {
  const roots: Array<ShadowRoot> = [editor.shadowRoot!];

  for (const picker of ["editor-toolbar", "node-palette", "properties-panel", "node-editor"]) {
    const del = editor.shadowRoot?.querySelector(picker);
    if (del?.shadowRoot) roots.push(del.shadowRoot);
  }

  const canvas = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  canvas?.shadowRoot?.querySelectorAll("flow-node").forEach((nod) => {
    if (nod.shadowRoot) roots.push(nod.shadowRoot);
  });

  return roots.flatMap((rot) => kontrastbrott(rot));
}

describe.each([["ljust", undefined], ["mörkt", "dark" as const]])(
  "editorn i %s tema",
  (_namn, tema) => {
    test.each(["administrator", "edit", "translator", "readonly"])(
      "%s når AA",
      (mode) => {
        expect(brott(montera(mode, tema))).toEqual([]);
      },
    );

    // The check row and the markings on the nodes are drawn in status colours,
    // chosen to draw the eye. That is exactly when contrast tends to be
    // sacrificed.
    test("nodes with problems meet AA", () => {
      const editor = montera("administrator", tema);
      const canvas = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
      canvas?.selectNodeById("q");

      expect(brott(editor)).toEqual([]);
    });
  },
);
