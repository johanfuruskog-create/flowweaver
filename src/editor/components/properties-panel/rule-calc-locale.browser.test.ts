import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { ruleCalcAstraGraph } from "../../../data/rule-calc-astra-graph";
import { EDITOR_STRINGS } from "../../localization/editor-strings";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Uppdrag 29/9, Del A/B: hjälpraderna i regel- och uträkningspanelen (067)
 * och Annars-kortets hjälprad ska gå via `editor-strings` (K1), aldrig
 * hårdkodad svenska.
 *
 * `src/gates/editor-locale-reach.browser.test.ts` sveper hela editorn på
 * samma sätt, men väljer aldrig en nod — så en regel- eller uträkningsnod
 * öppnas aldrig, och en hårdkodad rad i just de panelerna passerar den
 * grinden osedd (mätt 29/9: en sträng hårdkodad i Annars hjälprad fick
 * 25/25 gröna i `rule-calc-cards` + `condition-row` + den grinden). Det här
 * provet väljer regel- och uträkningsnoderna och fäller korten öppna,
 * precis som `condition-row.browser.test.ts` gör, innan sveget.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Samma sorts sammantextning som `editor-locale-reach`: allt en besökare kan läsa, skuggrötter med. */
function allText(root: ParentNode): string {
  let text = "";
  for (const element of root.querySelectorAll("*")) {
    if (!(element as HTMLElement).checkVisibility?.()) continue;
    const shadow = (element as HTMLElement).shadowRoot;
    if (shadow) text += ` ${allText(shadow)}`;
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) text += ` ${node.textContent}`;
    }
    const aria = (element as HTMLElement).getAttribute?.("aria-label");
    if (aria) text += ` ${aria}`;
  }
  return text;
}

/** De nycklar de här panelerna faktiskt ritar (067:s hjälprader, Annars, Låst struktur). */
const KEYS = [
  "editor.properties.ruleScope",
  "editor.properties.otherwise",
  "editor.properties.otherwise-help",
  "editor.properties.otherwise-name",
  "editor.properties.rule-name",
  "editor.properties.add-rule",
  "editor.properties.remove-rule",
  "editor.properties.assignments-order",
  "editor.properties.remove-calculation",
  "editor.properties.add-calculation",
] as const;

async function mount(locale: string, nodeId: "rc-rule" | "rc-calc"): Promise<{ editor: GuideEditor; panel: ShadowRoot }> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("editor-locale", locale);
  editor.style.cssText = "display: block; width: 1300px; height: 1400px;";
  document.body.append(editor);
  editor.graph = structuredClone(ruleCalcAstraGraph) as never;
  await settle();
  await settle();
  (editor.shadowRoot!.querySelector("node-editor") as unknown as { selectNodeById(id: string): void }).selectNodeById(nodeId);
  await settle();
  const panel = editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;
  for (const toggle of panel.querySelectorAll<HTMLButtonElement>('[data-action^="toggle-"][aria-expanded="false"]')) toggle.click();
  await settle();

  return { editor, panel };
}

/** Panelens sammantextning för både regelnoden och uträkningsnoden, ihopslaget. */
async function bothPanels(locale: string): Promise<string> {
  const rule = await mount(locale, "rc-rule");
  const ruleText = allText(rule.panel);
  document.body.replaceChildren();
  const calc = await mount(locale, "rc-calc");
  const calcText = allText(calc.panel);
  document.body.replaceChildren();

  return ` ${ruleText} ${calcText} `;
}

describe("regel- och uträkningspanelens hjälprader talar editorns språk", () => {
  test("det finns svenska att leta efter, så ett tomt svep inte kan gå igenom", () => {
    for (const key of KEYS) {
      const entry = EDITOR_STRINGS[key];
      expect(entry?.sv, key).toBeTruthy();
      expect(entry?.en, key).toBeTruthy();
      expect(entry!.sv).not.toBe(entry!.en);
    }
  });

  test("på engelska ritas ingen av de svenska raderna", async () => {
    const text = await bothPanels("en");
    const found = KEYS.filter((key) => text.includes(EDITOR_STRINGS[key]!.sv!)).map(
      (key) => `${key}: "${EDITOR_STRINGS[key]!.sv}"`,
    );

    expect(found).toEqual([]);
    for (const key of KEYS) {
      expect(text, key).toContain(EDITOR_STRINGS[key]!.en);
    }
  });

  test("på svenska ritas de svenska raderna", async () => {
    const text = await bothPanels("sv");

    for (const key of KEYS) {
      expect(text, key).toContain(EDITOR_STRINGS[key]!.sv);
    }
  });
});
