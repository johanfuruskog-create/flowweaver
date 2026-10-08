import { afterEach, describe, expect, test, vi } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import { exampleGraph } from "../../../data/example-graph";

import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

/**
 * De avsiktliga flyttarna av vyn glider — provlägets steg (se
 * guide-editor-proving), och de två som är samma rörelse: Guide-menyns
 * "Visa startnoden" och canvasens "Tillbaka till guiden". Johan 1/10 2026,
 * på frågan om de också skulle glida: "resten dina rekommendationer".
 * Glidningen själv och K5-klippet hålls i node-editor-center-smooth; här
 * hålls att anropen BER om den.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 80));

async function mount(): Promise<{ editor: GuideEditor; canvas: NodeEditor }> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1100px; height: 640px;";
  document.body.append(editor);
  editor.graph = structuredClone(exampleGraph) as never;
  await settle();
  await settle();
  const canvas = editor.shadowRoot!.querySelector<NodeEditor>("node-editor")!;
  return { editor, canvas };
}

describe("vyns avsiktliga flyttar", () => {
  test("Visa startnoden glider dit", async () => {
    const { editor, canvas } = await mount();
    const centred = vi.spyOn(canvas, "centerNodeById");

    editor.shadowRoot!.dispatchEvent(new CustomEvent("show-start-node-request", { bubbles: true, composed: true }));
    await settle();

    expect(centred).toHaveBeenCalledWith(exampleGraph.startNodeId, { smooth: true });
  });

  test("Tillbaka till guiden glider dit", async () => {
    const { canvas } = await mount();
    const centred = vi.spyOn(canvas, "centerNodeById");
    const back = canvas.shadowRoot!.querySelector<HTMLButtonElement>("[data-lost]")!;

    // Knappen är gömd tills guiden hamnat utanför bilden; vägen den tar är
    // densamma oavsett, så den trycks som den står.
    back.click();
    await settle();

    expect(centred).toHaveBeenCalledTimes(1);
    expect(centred.mock.calls[0]![1]).toEqual({ smooth: true });
  });
});
