import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * A string that carries markup arrives as markup, not as visible tags.
 *
 * ## The failure this is written from
 *
 * Two of the library's own strings put a `<strong>` around the words you are
 * meant to click. The first render writes them with `innerHTML` and they were
 * right; the refresh that runs whenever the editor's language changes wrote them
 * with `textContent`, and the warning then read:
 *
 *     Guiden saknar startnod. Högerklicka på en fråga och välj
 *     &lt;strong&gt;Gör till startnod&lt;/strong&gt;.
 *
 * Nobody had met it because it needs both halves: a guide with no start node,
 * and a language refresh. Found in a frame of the hero clip, which is the first
 * thing that ever did both.
 *
 * ## What is asserted
 *
 * The rendered text, as a person reads it — no angle brackets — and an actual
 * `<strong>` element in the warning, so "it stopped showing tags" cannot be
 * satisfied by dropping the emphasis instead.
 */

afterEach(() => document.body.replaceChildren());

const withoutStart = (): GraphData =>
  ({
    startNodeId: null,
    nodes: [
      {
        id: "q",
        type: "question",
        position: { x: 40, y: 40 },
        data: {
          title: { sv: "Bor du i en hyresrätt?" },
          variableName: "hyr",
          options: [{ id: "ja", label: { sv: "Ja" }, value: "ja" }],
        },
      },
    ],
    connections: [],
  }) as unknown as GraphData;

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

describe("the warning about a missing start node", () => {
  test("keeps its emphasis after the language is refreshed", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;

    editor.setAttribute("mode", "administrator");
    editor.setAttribute("feature-level", "advanced");
    editor.style.cssText = "display: block; width: 1200px; height: 800px;";
    document.body.append(editor);
    editor.graph = withoutStart();
    await settle();

    // What every page does through `initSiteChrome`, and what the films do.
    editor.setAttribute("editor-locale", "en");
    await settle();

    const warning = editor.shadowRoot?.querySelector("[data-start-node-warning]");

    expect(warning?.textContent).not.toContain("<strong>");
    expect(warning?.textContent).toContain("Make start node");
    expect(warning?.querySelector("strong")).not.toBeNull();
  });
});
