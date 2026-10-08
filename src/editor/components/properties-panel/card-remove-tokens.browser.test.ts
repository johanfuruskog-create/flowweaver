import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { ruleCalcAstraGraph } from "../../../data/rule-calc-astra-graph";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * K6 (Siv, uppdrag 29/9 Del A/B/D): "Ta bort regeln", "Ta bort
 * alternativet" och "Ta bort uträkningen" — `.properties-panel__option-
 * remove`, one class shared by all three cards — carried a comment
 * claiming a 44px click area "ärvd av kroppens fält" since Astras vända 5,
 * but no rule anywhere set a min-height on the body's children.
 * `getBoundingClientRect` measured 40px before the fix, both themes; its
 * sibling `.properties-panel__condition-remove` (same row, same family)
 * already coded the floor explicitly rather than relying on an inheritance
 * that was never there.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount(nodeId: string): Promise<ShadowRoot> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1300px; height: 1400px;";
  document.body.append(editor);
  editor.graph = structuredClone(ruleCalcAstraGraph) as GraphData;
  await settle();
  await settle();
  (editor.shadowRoot!.querySelector("node-editor") as unknown as { selectNodeById(id: string): void }).selectNodeById(
    nodeId,
  );
  await settle();
  const panel = editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;

  for (const toggle of panel.querySelectorAll<HTMLElement>('[data-action^="toggle-"][aria-expanded="false"]')) {
    toggle.click();
  }
  await settle();

  return panel;
}

describe("kortens borttagningsrad", () => {
  test("Ta bort regeln håller K6:s 44px-golv", async () => {
    const panel = await mount("rc-rule");
    const buttons = [...panel.querySelectorAll<HTMLElement>('[data-action="remove-rule-case"]')];

    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.getBoundingClientRect().height, button.textContent!.trim()).toBeGreaterThanOrEqual(44);
    }
  });

  test("Ta bort uträkningen håller K6:s 44px-golv", async () => {
    const panel = await mount("rc-calc");
    const buttons = [...panel.querySelectorAll<HTMLElement>('[data-action="remove-assignment"]')];

    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.getBoundingClientRect().height, button.textContent!.trim()).toBeGreaterThanOrEqual(44);
    }
  });

  test("Ta bort alternativet håller K6:s 44px-golv", async () => {
    const panel = await mount("rc-housing");
    const buttons = [...panel.querySelectorAll<HTMLElement>('[data-action="remove-option"]')];

    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.getBoundingClientRect().height, button.textContent!.trim()).toBeGreaterThanOrEqual(44);
    }
  });
});
