import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";
import { kontrastbrott } from "../../../testing/contrast";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";
import type { GraphData } from "../../../viewer/types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule } from "../../../testing/optional-pro";
const { conferenceExampleGraph } = ((await proModule("data/conference-example-graph.ts")) ?? {}) as { conferenceExampleGraph: GraphData };

/**
 * UPPDRAG-2026-09-28-SVARSALTERNATIV, del 1b: "Regel 1", "Rad 1" and the
 * rule/calculation editors' own help text (bild 58–59, mätt i mörkt tema)
 * were unreadable — measured 1.12:1 against the option's dark surface.
 *
 * ## The cause
 *
 * Neither `.properties-panel__option-header strong` nor
 * `.properties-panel__help` carried a `color` rule anywhere in
 * `properties-panel.scss`. `--fw-text` itself held the correct dark value
 * the whole way up (confirmed with `getComputedStyle(...).getPropertyValue
 * ("--fw-text")` at every ancestor) — nothing ever read it into `color`, so
 * both leaked the demo site's own literal body text colour straight through
 * every shadow boundary. It happened to equal `--fw-text`'s LIGHT value, so
 * it read fine in light theme and nowhere caught it there.
 *
 * ## A self-contained test, not an addition to `guide-editor-contrast`
 *
 * That file's "mörkt tema" branch set `document.documentElement.dataset.
 * theme`, never the editor's OWN `theme` property — measured directly, its
 * "mörkt tema" tests had been reading `--fw-text` as `#101828` (the LIGHT
 * value) all along, because the package scopes its tokens to the element
 * (K10), not to the host page's `:root`. This file's tests stayed
 * self-contained rather than folded into that one.
 *
 * ## 1e — the section headings the fixed mechanism exposed
 *
 * Turning the mechanism on properly (now fixed in `guide-editor-contrast`
 * too) exposed a second, unrelated, and much wider bug: every one of the
 * panel's six `<h3>` section headings ("Guiden", "För besökaren", "Språk",
 * "Visartexter", "Validering", "Avancerat") had no `color` rule anywhere —
 * literal `rgb(0, 0, 0)` in dark theme, on nearly every node type. Fixed
 * with one file-wide `h3 { color: var(--fw-text); }` in properties-panel.scss
 * (the same token `.properties-panel__header h2` already uses one level
 * up). `guide-editor-contrast` catches five of the six through its own
 * fixture; "Validering" needs the `fields` module and a validation
 * property to render at all, covered below.
 */

afterEach(() => document.body.replaceChildren());

function montera(nodeId: string, theme?: "dark", modules?: string): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  if (modules) editor.setAttribute("modules", modules);
  editor.style.cssText = "display: block; width: 1200px; height: 900px;";
  document.body.append(editor);
  editor.graph = conferenceExampleGraph;
  if (theme) editor.theme = theme;

  const canvas = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  canvas?.selectNodeById(nodeId);
  return editor;
}

function brott(editor: GuideEditor): string[] {
  const panel = editor.shadowRoot?.querySelector("properties-panel");
  return panel?.shadowRoot ? kontrastbrott(panel.shadowRoot) : ["properties-panel saknas"];
}

describe.each([
  ["ljust", undefined],
  ["mörkt", "dark" as const],
])("uträkningens och regelns egna rader och hjälptext, i %s tema", (_namn, tema) => {
  test("uträkningen (conference-room): raden och hjälptexten når AA", () => {
    expect(brott(montera("conference-room", tema))).toEqual([]);
  });

  test("regeln (conference-rule): raden och hjälptexten når AA", () => {
    expect(brott(montera("conference-rule", tema))).toEqual([]);
  });

  /*
   * "Validering" är den enda av panelens sex sektionsrubriker som varken
   * `guide-editor-contrast` eller de två proven ovan råkar rita — den
   * kräver modulen `fields` och minst en tillåten valideringsegenskap.
   * `conference-name` är ett textfält med `required` bakom
   * fieldValidation (`editor-modules.ts`).
   */
  test("valideringsrubriken (fields-modulen, conference-name) når AA", () => {
    expect(brott(montera("conference-name", tema, "logic content service fields"))).toEqual([]);
  });
});
