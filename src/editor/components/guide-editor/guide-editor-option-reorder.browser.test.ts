import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";
import type { PropertiesPanel } from "../properties-panel/properties-panel";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Dragging an answer to a new place, in the whole editor.
 *
 * The panel's own test proves the gesture reports where the answer landed.
 * Johan (23/9, Bygglov2): "it can be dragged but nothing sticks" — so the
 * report is not becoming the graph, or the graph is not becoming the panel.
 * Measured on the graph the editor hands out, which is the thing that is saved.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const graph = (): GraphData =>
  ({
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "question",
        position: { x: 40, y: 40 },
        data: {
          title: { sv: "Vad gäller ärendet?" },
          variableName: "amne",
          options: [
            { id: "a", label: { sv: "Bygglov" }, value: "bygglov" },
            { id: "b", label: { sv: "Avlopp" }, value: "avlopp" },
            { id: "c", label: { sv: "Buller" }, value: "buller" },
          ],
        },
      },
    ],
    connections: [],
  }) as unknown as GraphData;

async function mount(): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 800px;";
  document.body.append(editor);
  editor.graph = graph();
  await settle();
  await settle();
  return editor;
}

const optionOrder = (editor: GuideEditor): string[] =>
  ((editor.graph as GraphData).nodes[0]!.data.options as { id: string }[]).map((o) => o.id);

describe("dragging an answer in the editor", () => {
  test("the new order reaches the graph", async () => {
    const editor = await mount();
    const nodeEditor = editor.shadowRoot!.querySelector<NodeEditor>("node-editor")!;

    nodeEditor.selectNodeById("q");
    await settle();

    const panel = editor.shadowRoot!.querySelector<PropertiesPanel>("properties-panel")!;
    const options = () => [
      ...panel.shadowRoot!.querySelectorAll<HTMLElement>(".properties-panel__option[data-option-id]"),
    ];
    expect(options().map((o) => o.dataset.optionId), "panelen visar inte svaren").toEqual(["a", "b", "c"]);

    const handle = panel.shadowRoot!.querySelector<HTMLElement>(
      '.properties-panel__option[data-option-id="a"] [data-action="drag-option"]',
    )!;
    const first = options()[0]!.getBoundingClientRect();

    handle.dispatchEvent(
      new PointerEvent("pointerdown", { clientY: handle.getBoundingClientRect().top, bubbles: true, composed: true }),
    );
    window.dispatchEvent(new PointerEvent("pointermove", { clientY: first.top + first.height * 0.9 }));
    window.dispatchEvent(new PointerEvent("pointerup"));
    await settle();

    expect(optionOrder(editor)).toEqual(["b", "a", "c"]);
    expect(options().map((o) => o.dataset.optionId)).toEqual(["b", "a", "c"]);
  });
});
