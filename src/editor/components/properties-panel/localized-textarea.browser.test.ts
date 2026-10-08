import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { annotationNoteGraph } from "../../../data/annotation-note-graph";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GraphData } from "../../../viewer/types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule } from "../../../testing/optional-pro";
const { viewerCoverageGraph } = ((await proModule("data/viewer-coverage-graph.ts")) ?? {}) as { viewerCoverageGraph: GraphData };

/**
 * Uppdrag 28/9, Del 1: *"Varför frågar vi det här?"* och *"Anteckning"*
 * visade `[object Object]` (inventeringens bilder 28, 39, 53, 64).
 *
 * Båda är lokaliserade egenskaper med kontrollen `textarea`, och värdet är
 * rätt: `{ sv, en }`. Panelens textarea skrev värdet rakt in i rutan —
 * `escapeHtml(value)` — i stället för att gå genom `localizedField` som
 * textfälten gör. Skrivvägen slog redan ihop det aktiva språket i kartan,
 * så den som rörde rutan skrev `[object Object]` som svensk text och
 * behöll engelskan: felet blev data vid första ändringen.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function editorWith(graph: GraphData, nodeId: string): Promise<{ editor: GuideEditor; area: () => HTMLTextAreaElement }> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1300px; height: 900px;";
  document.body.append(editor);
  editor.graph = structuredClone(graph) as never;
  await settle();
  await settle();
  select(editor, nodeId);
  await settle();
  await settle();

  return { editor, area: () => textarea(editor, graph === annotationNoteGraph ? "text" : "why") };
}

function select(editor: GuideEditor, nodeId: string): void {
  (editor.shadowRoot!.querySelector("node-editor") as unknown as { selectNodeById?(id: string): void }).selectNodeById?.(nodeId);
}

function textarea(editor: GuideEditor, property: string): HTMLTextAreaElement {
  const panel = editor.shadowRoot!.querySelector("properties-panel")!;
  const area = panel.shadowRoot!.querySelector<HTMLTextAreaElement>(`textarea[data-property="${property}"]`);

  if (!area) throw new Error(`Ingen textarea för ${property}.`);
  return area;
}

const dataOf = (editor: GuideEditor, nodeId: string) =>
  (editor.getData() as GraphData).nodes.find((node) => node.id === nodeId)!.data;

describe.each(
  // The first guide is PRO's: measured where it is, the note either way.
  ([
    ["Varför frågar vi det här?", viewerCoverageGraph, "ef-contact", "why"],
    ["Anteckning", annotationNoteGraph, "note", "text"],
  ] as Array<[string, GraphData, string, string]>).filter(([, graph]) => graph !== undefined),
)("en lokaliserad textarea: %s", (_name, graph, nodeId, property) => {
  const original = graph.nodes.find((node) => node.id === nodeId)!.data[property] as { sv: string; en: string };

  test("visar källspråkets text, aldrig [object Object]", async () => {
    const { area } = await editorWith(graph, nodeId);

    expect(area().value).toBe(original.sv);
  });

  test("öppnad och lämnad utan ändring bevarar båda språken", async () => {
    const { editor, area } = await editorWith(graph, nodeId);

    area().dispatchEvent(new Event("input", { bubbles: true }));
    area().dispatchEvent(new Event("change", { bubbles: true }));
    await settle();

    expect(dataOf(editor, nodeId)[property]).toEqual(original);
  });

  test("en ändring skriver källspråket, behåller det andra och står kvar efter omladdning", async () => {
    const { editor, area } = await editorWith(graph, nodeId);

    area().value = "Ny text";
    area().dispatchEvent(new Event("input", { bubbles: true }));
    area().dispatchEvent(new Event("change", { bubbles: true }));
    await settle();

    expect(dataOf(editor, nodeId)[property]).toEqual({ sv: "Ny text", en: original.en });

    const saved = editor.getData();

    editor.graph = structuredClone(saved) as never;
    await settle();
    select(editor, nodeId);
    await settle();
    await settle();

    expect(area().value).toBe("Ny text");
    expect(dataOf(editor, nodeId)[property]).toEqual({ sv: "Ny text", en: original.en });
  });
});
