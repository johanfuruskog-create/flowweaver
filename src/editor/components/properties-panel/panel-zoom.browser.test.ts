import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Inget fält i panelen får zooma in sidan.
 *
 * ## Varför 16px inte är en smakfråga
 *
 * iOS zoomar in hela sidan när ett fält med mindre text får fokus, och zoomar
 * inte ut igen. Editorn står då kvar förstorad, canvasen halvt utanför bild,
 * och man får nypa tillbaka den för varje fält man rör. Guider byggs på en
 * iPad — panelen möts av samma webbläsare som visaren.
 *
 * ## Varför det gäller radkontrollerna
 *
 * De var 12px: svarsalternativens etikett och värde, regelvillkorets variabel,
 * jämförelse och värde, uträkningens rader, tjänsteanropets mappningar. Alltså
 * precis de fält man rör oftast när man bygger något.
 *
 * ## Varför testet går över nodtyper
 *
 * Min första mätning tittade på EN nodtyp och sa "två fält". Sanningen var tio,
 * i fyra nodtyper. Ett test som bara ser en nod hade sagt samma sak som jag.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function småFält(node: Record<string, unknown>): Promise<string[]> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "n",
    nodes: [{ id: "n", position: { x: 0, y: 0 }, ...node }],
    connections: [],
  } as never;

  await settle();
  await settle();

  editor.shadowRoot!
    .querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!
    .selectNodeById("n");
  await settle();
  await settle();

  const panel = editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;

  return [...panel.querySelectorAll<HTMLElement>("input, select, textarea")]
    .filter((el) => !["hidden", "checkbox", "radio"].includes((el as HTMLInputElement).type))
    .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
    .map((el) => {
      const nyckel = Object.keys(el.dataset)[0] ?? "?";

      return `${el.tagName.toLowerCase()}[${nyckel}] ${getComputedStyle(el).fontSize}`;
    });
}

const noder: Array<[string, Record<string, unknown>]> = [
  ["frågan", { type: "question", data: { title: { sv: "F" }, variableName: "v", options: [{ id: "a", label: { sv: "Ja" }, value: "y" }] } }],
  ["regeln", { type: "rule", data: { title: { sv: "R" }, cases: [{ id: "c", label: "A", match: "any", conditions: [{ id: "v", variableName: "", operator: "equals", value: "" }] }] } }],
  ["uträkningen", { type: "calculation", data: { title: { sv: "C" }, assignments: [{ id: "a", variableName: "x", formula: "1" }] } }],
  ["tjänsteanropet", { type: "service-call", data: { title: { sv: "S" }, responseMappings: [{ id: "m", field: "f", variableName: "v" }] } }],
];

describe("panelens fält", () => {
  for (const [namn, node] of noder) {
    test(`${namn} har inget fält under 16px`, async () => {
      const små = await småFält(node);

      expect(små, `zoomar in på iOS: ${små.join(", ")}`).toEqual([]);
    });
  }
});
