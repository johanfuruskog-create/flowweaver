import { page, userEvent } from "@vitest/browser/context";
import { afterAll, afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";


import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GraphData } from "../../../viewer/types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule } from "../../../testing/optional-pro";
const { viewerCoverageGraph } = ((await proModule("data/viewer-coverage-graph.ts")) ?? {}) as { viewerCoverageGraph: GraphData };

/**
 * Uppdrag 28/9 (svarsalternativen), 1a: Vy-menyn kapades av
 * egenskapspanelen (inventeringen efter enhetligheten, bild 07 och 13) —
 * *"Visa alla som besökaren ser dem"* och radernas kortkommandon låg under
 * panelens vänsterkant.
 *
 * Panelen ligger medvetet över verktygsraden (`z-index: 25`, "så en smal
 * topmeny aldrig spiller in ovanpå sidopanelen"). Det beslutet står; en
 * meny nära verktygsradens högerkant fälls i stället ut åt vänster och
 * håller sig inom sin behållare — samma regel som fältets menyer.
 */

afterEach(() => document.body.replaceChildren());
afterAll(async () => {
  await page.viewport(1280, 800);
});

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe.each([
  [900, 600],
  [1280, 800],
] as const)("verktygsradens menyer i %i × %i", (width, height) => {
  test.each(["view", "help"])("%s-menyns alla rader träffas ända ut i högerkanten", async (name) => {
    await page.viewport(width, height);
    const editor = document.createElement("guide-editor") as GuideEditor;

    editor.setAttribute("mode", "administrator");
    editor.style.cssText = `display: block; width: ${width}px; height: ${height}px;`;
    document.body.append(editor);
    editor.graph = structuredClone(viewerCoverageGraph) as never;
    await settle(300);

    const toolbar = editor.shadowRoot!.querySelector("editor-toolbar")!;
    const root = toolbar.shadowRoot!;

    await userEvent.click(root.querySelector<HTMLElement>(`[data-menu-trigger="${name}"]`)!);
    await settle();
    const menu = root.querySelector<HTMLElement>(`[data-menu="${name}"]`)!;
    const rows = [...menu.querySelectorAll<HTMLElement>("[role^=menuitem]")].filter((row) => row.offsetParent !== null);

    expect(menu.hidden).toBe(false);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const box = row.getBoundingClientRect();
      // Just inside the row's right edge, where a shortcut or a long label ends.
      const x = box.right - 6;
      const y = box.top + box.height / 2;
      const hit = editor.shadowRoot!.elementFromPoint(x, y);

      expect(hit === toolbar, `${row.textContent?.trim()} vid x ${Math.round(x)} träffade ${hit?.localName}.${(hit as HTMLElement | null)?.className}`).toBe(true);
      expect(root.elementFromPoint(x, y)?.closest("[role^=menuitem]"), row.textContent?.trim()).toBe(row);
    }
  });
});
