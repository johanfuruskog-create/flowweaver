import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./properties-panel";

import type { PropertiesPanel } from "./properties-panel";

/**
 * The translation banner must name the ACTUAL source language.
 *
 * The hint used to hardcode Swedish — "Svensk källa visas som referens" — which
 * was true for every guide until the first English-source guide met the
 * translation mode (found while flipping the English translation film: the
 * banner said "The Swedish source is shown for reference" over an English
 * source). The browser already knows every language's name (`localeLabel`),
 * so the sentence carries the name of whatever the source is.
 */

afterEach(() => document.body.replaceChildren());

function panelWith(sourceLocale: string, activeLocale: string): PropertiesPanel {
  const panel = document.createElement("properties-panel") as PropertiesPanel;

  panel.editorMode = "administrator";
  document.body.append(panel);
  panel.sourceLocale = sourceLocale;
  panel.activeLocale = activeLocale;
  panel.nodeData = {
    id: "q1",
    type: "question",
    position: { x: 0, y: 0 },
    data: { title: "Do you rent?", variableName: "housing", options: [] },
  } as never;

  return panel;
}

describe("the translation banner's source hint", () => {
  test("names an English source as English, not as Swedish", () => {
    const panel = panelWith("en", "sv");
    const hint = panel.shadowRoot!.querySelector(
      ".properties-panel__translation-banner span",
    )!.textContent!;

    expect(hint).toContain("engelska");
    expect(hint).not.toContain("Svensk källa");
  });

  test("still names a Swedish source as Swedish", () => {
    const panel = panelWith("sv", "en");
    const hint = panel.shadowRoot!.querySelector(
      ".properties-panel__translation-banner span",
    )!.textContent!;

    expect(hint).toContain("svenska");
  });
});
