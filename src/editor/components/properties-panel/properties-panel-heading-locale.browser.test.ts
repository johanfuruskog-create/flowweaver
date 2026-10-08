import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * The panel's heading is in the language the panel is showing.
 *
 * ## The failure this is written from
 *
 * Found in a film. It was recorded on the English page, on a guide whose source
 * language is English, and every field in the properties panel said "Housing
 * allowance is unusual in your situation" while the heading directly above them
 * said "Bostadsbidrag är ovanligt i din situation".
 *
 * `resolveText` takes a locale and defaults it to `DEFAULT_SOURCE_LOCALE`, which
 * is Swedish. Two calls in the panel — the heading and the title fallback — left
 * it out, so they read Swedish whatever the panel was set to. Every other call
 * in the file passes one.
 *
 * ## Why it is worth a test rather than a fix
 *
 * It is invisible in the only case anybody had looked at. A Swedish guide edited
 * in Swedish is right by accident, and that is every example page we had until
 * the English film needed an English source.
 */

afterEach(() => document.body.replaceChildren());

const bilingual = (source: string): GraphData =>
  ({
    settings: { sourceLocale: source },
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "question",
        position: { x: 40, y: 40 },
        data: {
          title: { sv: "Bor du i en hyresrätt?", en: "Do you rent your home?" },
          variableName: "hyr",
          options: [
            { id: "ja", label: { sv: "Ja", en: "Yes" }, value: "ja" },
            { id: "nej", label: { sv: "Nej", en: "No" }, value: "nej" },
          ],
        },
      },
    ],
    connections: [],
  }) as unknown as GraphData;

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

async function mountAndSelect(source: string): Promise<string> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("feature-level", "advanced");
  editor.setAttribute("active-locale", source);
  editor.style.cssText = "display: block; width: 1200px; height: 800px;";
  document.body.append(editor);
  editor.graph = bilingual(source);
  await settle();

  const canvas = editor.shadowRoot?.querySelector("node-editor");
  (canvas as unknown as { selectNodeById(id: string): void })?.selectNodeById("q");
  await settle();

  const panel = editor.shadowRoot?.querySelector("properties-panel");
  const heading = panel?.shadowRoot?.querySelector("h2, h3, [data-panel-title]");

  return (heading?.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("the properties panel's heading", () => {
  test("says the node's title in English when the guide is written in English", async () => {
    const heading = await mountAndSelect("en");

    expect(heading).toContain("Do you rent your home?");
    expect(heading).not.toContain("Bor du i en hyresrätt?");
  });

  /*
   * The case that was right by accident, kept so the fix cannot break it. Every
   * example page was this one until the English film needed an English source,
   * which is why nobody had seen the other.
   */
  test("and in Swedish when the guide is written in Swedish", async () => {
    const heading = await mountAndSelect("sv");

    expect(heading).toContain("Bor du i en hyresrätt?");
    expect(heading).not.toContain("Do you rent your home?");
  });
});
