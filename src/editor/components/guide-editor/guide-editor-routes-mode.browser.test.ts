import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import { exampleGraph } from "../../../data/example-graph";

import type { FlowNode } from "../flow-node/flow-node";
import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

/*
 * "Vilka vägar leder hit" as a MODE — Johan 2/9: the highlight used to die the
 * moment the selection did, and looking around meant losing the answer. In the
 * mode a bar sits on the canvas, pressing a node shows the paths to it,
 * pressing empty canvas cancels nothing, and Escape/Avsluta ends it.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 160): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function mountEditor(): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1200px; height: 800px;";
  document.body.append(editor);
  editor.graph = structuredClone(exampleGraph);
  await settle();
  return editor;
}

const canvas = (editor: GuideEditor): NodeEditor => {
  const found = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  if (!found) throw new Error("node-editor saknas");
  return found;
};

const bar = (editor: GuideEditor): HTMLElement | null =>
  canvas(editor).shadowRoot?.querySelector<HTMLElement>("[data-routes-bar]") ??
  null;

const highlighted = (editor: GuideEditor): number =>
  canvas(editor).shadowRoot?.querySelectorAll(
    ".node-editor__connection--highlighted",
  ).length ?? 0;

async function startMode(editor: GuideEditor): Promise<void> {
  const item = editor.shadowRoot
    ?.querySelector("editor-toolbar")
    ?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="routes-here"]');
  if (!item) throw new Error('Menyraden "Vägar hit" finns inte.');
  item.click();
  await settle();
}

describe("vägarna hit som läge", () => {
  test("menyraden startar läget: raden syns och ber om en nod", async () => {
    const editor = await mountEditor();

    await startMode(editor);

    expect(bar(editor)?.hidden).toBe(false);
    expect(bar(editor)?.textContent).toContain("Tryck på en nod");
  });

  test("klick på en nod visar vägarna dit, och tom yta släcker inget", async () => {
    const editor = await mountEditor();

    await startMode(editor);
    canvas(editor).selectNodeById("result-permit");
    await settle();

    const toPermit = highlighted(editor);
    expect(toPermit).toBeGreaterThan(0);
    expect(bar(editor)?.textContent).toContain("Ansök om körkortstillstånd");

    // Avmarkering (klick på tom yta) behåller vägvisningen.
    canvas(editor).selectNodeById(null);
    await settle();
    expect(highlighted(editor)).toBe(toPermit);

    // En annan nod byter vägvisningen.
    canvas(editor).selectNodeById("question-gender");
    await settle();
    expect(highlighted(editor)).not.toBe(toPermit);
    expect(bar(editor)?.textContent).toContain("Vilket kön");
  });

  test("Escape och Avsluta stänger läget och släcker markeringen", async () => {
    const editor = await mountEditor();

    await startMode(editor);
    canvas(editor).selectNodeById("result-permit");
    await settle();
    expect(highlighted(editor)).toBeGreaterThan(0);

    const viewport = canvas(editor).shadowRoot?.querySelector<HTMLElement>(
      ".node-editor__viewport",
    );
    viewport?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }),
    );
    await settle();

    expect(bar(editor)?.hidden).toBe(true);
    expect(highlighted(editor)).toBe(0);
  });

  /*
   * One name, one behaviour (5/9). The node's ⋯ used to say "Visa vägarna
   * hit" and draw a one-shot highlight that died with the selection, while
   * the Guide menu said "Vägar hit" and started the mode; the outline's ⇄
   * drew under the list. The films had to know which one they were pressing.
   * Every entry now starts the mode, on that node.
   */
  async function fromNodeMenu(editor: GuideEditor, id: string): Promise<void> {
    const card = [...(canvas(editor).shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? [])]
      .find((one) => one.nodeId === id)
      ?.shadowRoot?.querySelector<HTMLElement>(".flow-node");
    if (!card) throw new Error(`Kortet ${id} saknas`);
    const box = card.getBoundingClientRect();
    card.dispatchEvent(
      new MouseEvent("contextmenu", {
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
        bubbles: true,
        composed: true,
      }),
    );
    const item = canvas(editor).shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="routes-here"]',
    );
    if (!item) throw new Error('Nodens meny saknar "Vägar hit".');
    expect(item.textContent?.trim()).toBe("Vägar hit");
    item.click();
    await settle();
  }

  test("nodens meny startar samma läge, på den noden", async () => {
    const editor = await mountEditor();

    await fromNodeMenu(editor, "result-permit");

    expect(bar(editor)?.hidden).toBe(false);
    expect(bar(editor)?.textContent).toContain("Ansök om körkortstillstånd");
    const toPermit = highlighted(editor);
    expect(toPermit).toBeGreaterThan(0);

    // Läget, inte engångsmarkeringen: tom yta släcker inget.
    canvas(editor).selectNodeById(null);
    await settle();
    expect(highlighted(editor)).toBe(toPermit);
  });

  test("läget finns på Bas också — en regelnod räcker för att vägarna ska vara värda att läsa", async () => {
    /*
     * Reverses the 2/9 hiding: the item was hidden with `routeAnalysis` off
     * because it showed and did nothing — but the cause was the handler's own
     * gate, inherited from the preview's route summary, not a decision that
     * reading the routes is premium. The node's menu had already measured the
     * opposite on the housing-screening page (a Basic page around a Rule node).
     */
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.setAttribute("mode", "administrator");
    editor.setAttribute("modules", "fields");
    editor.style.cssText = "display: block; width: 1200px; height: 800px;";
    document.body.append(editor);
    editor.graph = structuredClone(exampleGraph);
    await settle();

    await startMode(editor);
    expect(bar(editor)?.hidden).toBe(false);
    canvas(editor).selectNodeById("result-permit");
    await settle();
    expect(highlighted(editor)).toBeGreaterThan(0);
  });

  test("att starta provet stänger vägläget", async () => {
    const editor = await mountEditor();

    await startMode(editor);
    canvas(editor).selectNodeById("result-permit");
    await settle();

    editor.shadowRoot
      ?.querySelector("editor-toolbar")
      ?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="prove-guide"]')
      ?.click();
    await settle();

    expect(bar(editor)?.hidden).toBe(true);
    const proving = canvas(editor).shadowRoot?.querySelector<HTMLElement>(
      "[data-proving-bar]",
    );
    expect(proving?.hidden).toBe(false);

    const nodes = [
      ...(canvas(editor).shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []),
    ];
    expect(nodes.length).toBeGreaterThan(0);
  });
});
