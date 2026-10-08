import { afterEach, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../node-editor/node-editor";

import { exampleGraph } from "../../../data/example-graph";

import type { NodeEditor } from "../node-editor/node-editor";
import type { FlowNode } from "./flow-node";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * The rings sit on their rows at every zoom, not only at 1.
 *
 * `alignPortsToAnswers` measures the distance between a ring and its answer's
 * row on screen and sets it as a CSS length — inside a canvas that is scaled
 * by the zoom. A screen distance of 100 px is 200 px of card at zoom 0.5, so
 * the ring stopped halfway. Noted on 7/9 while lifting a result's ring onto
 * its card, measured here before anything was changed (PRAXIS 6): Johan,
 * "vill inte ha några sådana buggar när redaktörerna testar".
 *
 * Two orders, because they take different paths: zoom first and then the
 * eye (the alignment runs once, at that zoom), and the eye first and then the
 * zoom (the alignment has to run again when the scale changes).
 */

afterEach(() => document.body.replaceChildren());

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

function mount(graph: GraphData): NodeEditor {
  const editor = document.createElement("node-editor") as NodeEditor;

  editor.editorMode = "administrator";
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = structuredClone(graph);
  return editor;
}

function nodeElement(editor: NodeEditor, id: string): FlowNode {
  const found = [
    ...(editor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []),
  ].find((element) => element.nodeId === id);

  if (!found) throw new Error(`ingen nod med id ${id}`);
  return found;
}

/** Each exit ring's distance (screen px) from the middle of its answer's row. */
function misses(node: FlowNode): Record<string, number> {
  const preview = node.shadowRoot?.querySelector<HTMLElement>("[data-visitor-preview]");
  const rows = [
    ...(preview?.shadowRoot?.querySelectorAll<HTMLElement>("[data-option-id]") ?? []),
  ];
  const out: Record<string, number> = {};

  node.shadowRoot
    ?.querySelectorAll<HTMLElement>(".flow-node__port-row--output [data-port-id]")
    .forEach((port) => {
      const row = rows.find((candidate) => candidate.dataset.optionId === port.dataset.portId);
      if (!row) return;
      const rowBox = (row.closest("label") ?? row).getBoundingClientRect();
      const portBox = port.getBoundingClientRect();
      out[port.dataset.portId ?? ""] = Math.abs(
        portBox.top + portBox.height / 2 - (rowBox.top + rowBox.height / 2),
      );
    });

  return out;
}

async function light(node: FlowNode): Promise<void> {
  node.shadowRoot?.querySelector<HTMLButtonElement>("[data-visitor-toggle]")?.click();
  await settle();
  await settle();
}

for (const zoom of [1, 0.5, 1.6]) {
  test(`zoom ${zoom} först, sedan ögat: ringarna på sina rader`, async () => {
    const editor = mount(exampleGraph);
    await settle();
    editor.setZoom(zoom);
    await settle();

    const node = nodeElement(editor, "question-gender");
    await light(node);
    await settle();

    const found = misses(node);
    expect(Object.keys(found).length).toBe(3);
    // Half a card px on screen, whatever the zoom — what zoom 1 already held.
    expect(Math.max(...Object.values(found)), `vid zoom ${zoom}: ${JSON.stringify(found)}`).toBeLessThanOrEqual(0.5 * zoom);
  });

  test(`ögat först, sedan zoom ${zoom}: ringarna följer med`, async () => {
    const editor = mount(exampleGraph);
    await settle();

    const node = nodeElement(editor, "question-gender");
    await light(node);
    await settle();
    editor.setZoom(zoom);
    await settle();
    await settle();

    const found = misses(node);
    expect(Object.keys(found).length).toBe(3);
    expect(Math.max(...Object.values(found)), `efter zoom ${zoom}: ${JSON.stringify(found)}`).toBeLessThanOrEqual(0.5 * zoom);
  });
}
