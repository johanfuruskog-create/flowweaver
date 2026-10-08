import { afterEach, describe, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";
import { expectDrawnCursor } from "../../../testing/drawn-cursor";

/**
 * One cursor for every grip, not three — mätt mot artiklarna 22/9
 * (docs/IDEAS.md): versionslistans och panelens burna rad har alltid sagt
 * `grabbing`; nodhuvudet sa `move` under en pågående dragning, ett annat ord
 * för en annan gest ("flytta det här till en annan yta", inte "du håller i
 * det du pekade på"). `grab` lovar `grabbing` — CSS Basic UI 4 säger det med
 * namnet — och nodhuvudet höll inte det löftet.
 *
 * ## Varför det mäts mitt i ett drag, inte bara i vila
 *
 * `grab` i vila var redan rätt. Felet satt i `:active` och
 * `:host([data-dragging])`, som bara syns medan ett finger eller en mus
 * faktiskt håller huvudet — så testet driver en riktig dragning genom
 * `node-editor` (samma sekvens som `node-editor-no-jump.browser.test.ts`
 * kör) i stället för att bara läsa stilmallen.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 80));

async function canvas(): Promise<{ nodeEditor: NodeEditor; header: HTMLElement }> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1000px; height: 600px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "text-question", position: { x: 40, y: 40 }, data: { title: "Ett", variableName: "a" } },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  const header = nodeEditor?.shadowRoot
    ?.querySelector("flow-node")
    ?.shadowRoot?.querySelector<HTMLElement>(".flow-node__header");

  if (!nodeEditor || !header) throw new Error("node-editor eller header saknas.");

  return { nodeEditor, header };
}

const at = (cx: number, cy: number): PointerEventInit => ({
  bubbles: true,
  composed: true,
  clientX: cx,
  clientY: cy,
  pointerId: 1,
  isPrimary: true,
  button: 0,
  buttons: 1,
});

describe("markören medan en nod bärs", () => {
  test("i vila lovar den ett grepp", async () => {
    const { header } = await canvas();

    expectDrawnCursor(header, "grab", "nodhuvudet i vila");
  });

  test("under dragningen håller den löftet — grabbing, inte move", async () => {
    const { header } = await canvas();
    const r0 = header.getBoundingClientRect();
    const x = r0.x + 40;
    const y = r0.y + r0.height / 2;

    header.dispatchEvent(new PointerEvent("pointerdown", at(x, y)));
    // Past the drag threshold, so node-editor has committed to a move and set
    // `data-dragging` on the node — the attribute the `:host([data-dragging])`
    // rule reads.
    for (let i = 1; i <= 4; i += 1) {
      const e = at(x + i * 15, y + i * 10);
      window.dispatchEvent(new PointerEvent("pointermove", e));
      header.dispatchEvent(new PointerEvent("pointermove", e));
    }

    expectDrawnCursor(header, "grabbing", "nodhuvudet under dragningen");

    header.dispatchEvent(new PointerEvent("pointerup", at(x + 60, y + 40)));
    window.dispatchEvent(new PointerEvent("pointerup", at(x + 60, y + 40)));
    await settle();
  });
});

/**
 * The port is where a connection is drawn from — our own gesture, so it gets a
 * drawn cursor like the others (K19, the port named there as a bounded
 * exception, E4 in docs/GENOMGANG-2026-09-30.md). The system's `crosshair` is
 * kept as the fallback. Read at rest: the rule is on the port itself, with no
 * state that only exists mid-drag.
 */
describe("markören på en port", () => {
  test("är ritad, med crosshair som reserv", async () => {
    const { nodeEditor } = await canvas();
    const port = nodeEditor.shadowRoot
      ?.querySelector("flow-node")
      ?.shadowRoot?.querySelector<HTMLElement>(".flow-node__port");

    if (!port) throw new Error("porten saknas.");

    expectDrawnCursor(port, "crosshair", "porten");
  });
});
