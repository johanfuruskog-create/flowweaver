import { page, userEvent } from "@vitest/browser/context";
import { afterAll, afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./node-editor";


import type { NodeEditor } from "./node-editor";
import type { GraphData } from "../../../viewer/types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../../testing/optional-pro";
const { viewerCoverageGraph } = ((await proModule("data/viewer-coverage-graph.ts")) ?? {}) as { viewerCoverageGraph: GraphData };
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * Nodens ⋯-meny ritades under minikartan (Fias inventering, bild 66).
 *
 * Mätt 28/9 i 900 × 600: med knappen strax upp till vänster om kartan låg
 * båda menyraderna över den, och `elementFromPoint` i radernas mitt gav
 * `div.node-editor__minimap`. Menylagret låg inuti `.node-editor__scaled`,
 * vars transform öppnar en egen stapelkontext — inget z-index i lagret nådde
 * förbi kartan, som är syskon till den otransformerade förfadern.
 */

afterEach(() => document.body.replaceChildren());
afterAll(async () => {
  await page.viewport(1280, 800);
});

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function menuNearTheMap(): Promise<{ root: ShadowRoot; editor: NodeEditor; button: HTMLElement; menu: HTMLElement }> {
  await page.viewport(900, 600);
  const editor = document.createElement("node-editor") as NodeEditor;

  editor.editorMode = "administrator";
  editor.style.cssText = "display: block; width: 900px; height: 600px;";
  document.body.append(editor);
  editor.graph = structuredClone(viewerCoverageGraph) as never;
  await settle(300);

  const root = editor.shadowRoot!;
  const map = root.querySelector<HTMLElement>(".node-editor__minimap")!.getBoundingClientRect();
  const viewport = root.querySelector<HTMLElement>(".node-editor__viewport")!;
  const button = root.querySelector("flow-node")!.shadowRoot!.querySelector<HTMLElement>("[data-node-menu]")!;
  const start = button.getBoundingClientRect();

  viewport.scrollLeft += start.left - (map.left - 60);
  viewport.scrollTop += start.bottom - (map.top - 20);
  await settle(200);
  await userEvent.click(button);
  await settle(200);

  return { root, editor, button, menu: root.querySelector<HTMLElement>(".node-editor__connection-menu")! };
}

describe("nodens meny och minikartan", () => {
  test.runIf(PRO)("menyn ligger över minikartan: ett tryck på en rad träffar raden", async () => {
    const { root, menu } = await menuNearTheMap();
    const map = root.querySelector<HTMLElement>(".node-editor__minimap")!;
    const rows = [...menu.querySelectorAll<HTMLElement>("button")];

    expect(map.hidden, "kartan ska synas, annars mäter provet inget").toBe(false);
    const over = rows.filter((row) => {
      const r = row.getBoundingClientRect();
      const m = map.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;

      return x >= m.left && x <= m.right && y >= m.top && y <= m.bottom;
    });

    expect(over.length, "minst en rad ska ligga över kartan").toBeGreaterThan(0);
    for (const row of over) {
      const r = row.getBoundingClientRect();
      const hit = root.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);

      expect(hit === row || row.contains(hit), `${row.textContent?.trim()} träffade ${hit?.className}`).toBe(true);
    }
  });

  test.runIf(PRO)("menyn följer sin knapp när canvasen rullar och zoomas", async () => {
    const { root, editor, button, menu } = await menuNearTheMap();
    const gap = () => {
      const b = button.getBoundingClientRect();
      const m = root.querySelector<HTMLElement>(".node-editor__connection-menu")!.getBoundingClientRect();

      // `+ 0` so a rounded −0 reads as 0: `toEqual` tells the two apart.
      return { x: Math.round(m.left - b.left) + 0, y: Math.round(m.top - b.bottom) + 0 };
    };
    const before = gap();

    root.querySelector<HTMLElement>(".node-editor__viewport")!.scrollTop -= 40;
    await settle(120);
    expect(gap(), "efter rullning").toEqual(before);

    const width = menu.getBoundingClientRect().width;

    (editor as unknown as { setZoom(zoom: number): void }).setZoom(0.8);
    await settle(200);
    expect(gap(), "efter zoom").toEqual(before);
    expect(
      Math.round(root.querySelector<HTMLElement>(".node-editor__connection-menu")!.getBoundingClientRect().width),
      "menyn läses i skärmstorlek, oavsett zoom",
    ).toBe(Math.round(width));
  });

  /*
   * Mätt 28/9: med lagret på editorns egen nivå placerades menyn om i vyns
   * scroll-händelse, som kommer efter rullningen — mellan de två stod menyn
   * kvar, och när editorn centrerade sig efter monteringen syntes den halva
   * canvasen från sin knapp. I arbetsytan rullar den med av sig själv.
   */
  test.runIf(PRO)("menyn sitter vid sin knapp redan i samma ögonblick som canvasen rullar", async () => {
    const { root, button } = await menuNearTheMap();
    const gap = () => {
      const b = button.getBoundingClientRect();
      const m = root.querySelector<HTMLElement>(".node-editor__connection-menu")!.getBoundingClientRect();

      return Math.round(m.top - b.bottom) + 0;
    };
    const before = gap();

    root.querySelector<HTMLElement>(".node-editor__viewport")!.scrollTop -= 60;
    // No await: measured before any scroll event can run.
    expect(gap()).toBe(before);
  });
});

