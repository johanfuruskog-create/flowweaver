import { afterEach, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { EditorToolbar } from "../editor-toolbar/editor-toolbar";
import type { FlowNode } from "./flow-node";
import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GuidePreview } from "../../../viewer/components/guide-preview/guide-preview";
import type { NodeEditor } from "../node-editor/node-editor";

/**
 * A ring never hangs under its card — it moves up onto it.
 *
 * With the eye lit the structure leaves the flow and the card shrinks to the
 * visitor's view (story 064, 1/9: "boxen är för lång"). The port rows stay in
 * the structure so the lines stand still — and a question's rings move onto
 * its answers' rows, which are inside the view. A result's entry ring has no
 * row to move to: it sat where the structure put it, and when the structure
 * was the taller view the ring was below the card, in the air.
 *
 * Measured on the film Räkna medan man svarar (Johan's still, 7/9 2026, a red
 * arrow at the ring): the structure wraps "Avgiften blir [Avgift per månad]
 * kr i månaden." onto two lines with the chip, the run resolves it to one
 * line — card 173 px, ports row 181–209 from its top. The measurement on 1/9
 * ("ingen port utanför rutan") had no result whose text shrank when resolved.
 *
 * Johan's call was the ring, not the card: "kan inte porten flyttas upp på
 * resultatet … porten justeras och linjen ritas om". So the card stays as
 * short as its view (a floor under it left 40 px of nothing) and the ring is
 * lifted inside, with the canvas told to draw the line again.
 *
 * Later the same day the entry ring of a node with no exits moved up beside
 * the header (flow-node-entry-at-header), so a result's ring is inside the
 * card before any lift — `keepRingsInside` no longer has anything to move
 * here and the canvas is not told. It stays for the rings it still serves:
 * a question's entry ring, which keeps its row under a long description. The
 * outcome this test guards is unchanged.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const graph = {
  version: 10,
  startNodeId: "s",
  settings: { sourceLocale: "sv", locales: ["sv"] },
  nodes: [
    { id: "s", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Vad kostar det?" } } },
    {
      id: "belopp",
      type: "number-question",
      position: { x: 20, y: 112 },
      parentPageId: "s",
      order: 0,
      layout: { columnSpan: 12 },
      data: { title: { sv: "Belopp" }, variableName: "belopp", variableLabel: { sv: "Avgift per månad" }, min: 0, max: 99999 },
    },
    {
      id: "r",
      type: "result",
      position: { x: 700, y: 0 },
      data: { title: { sv: "Din avgift" }, description: { sv: "Avgiften blir {{belopp}} kr i månaden." } },
    },
  ],
  connections: [
    { id: "c1", from: { nodeId: "s", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
  ],
};

function node(editor: GuideEditor, id: string): FlowNode {
  const canvas = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  const found = [...(canvas?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? [])].find(
    (element) => element.nodeId === id,
  );
  if (!found) throw new Error(`ingen nod ${id}`);
  return found;
}

test("resultatets ring ligger inom kortet när texten blir kortare i provet", async () => {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.style.cssText = "display: block; width: 1400px; height: 800px;";
  editor.setAttribute("mode", "administrator");
  document.body.append(editor);
  editor.graph = structuredClone(graph) as never;
  await settle(250);

  const toolbar = editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
  await userEvent.click(toolbar!.shadowRoot!.querySelector<HTMLButtonElement>('[data-menu-trigger="guide"]')!);
  await userEvent.click(toolbar!.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="prove-guide"]')!);
  await settle(250);

  const run = node(editor, "s").shadowRoot!.querySelector<GuidePreview>("[data-visitor-preview]")!;
  const input = run.shadowRoot!.querySelector<HTMLInputElement>('input[data-page-variable="belopp"]')!;
  input.value = "2898";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();
  const result = node(editor, "r");
  run.shadowRoot!.querySelector<HTMLButtonElement>("[data-action='next']")!.click();
  await settle(400);

  const card = result.shadowRoot!.querySelector(".flow-node")!.getBoundingClientRect();
  const view = result.shadowRoot!.querySelector(".flow-node__visitor")!.getBoundingClientRect();
  const ring = result.shadowRoot!.querySelector(".flow-node__port--input")!.getBoundingClientRect();
  // The run resolved the text to one line — that is the case.
  const shown = result.shadowRoot!.querySelector(".flow-node__visitor")!.shadowRoot!.textContent!.replace(/\s+/g, " ");
  expect(shown).toContain("2 898 kr");

  expect(ring.bottom, "ringen under kortets kant").toBeLessThanOrEqual(card.bottom);
  // The card is still the view's height: the ring moved, the card did not grow.
  expect(card.bottom - view.bottom, "luft under besökarvyn").toBeLessThanOrEqual(20);
});
