import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../node-editor/node-editor";

import type { NodeEditor } from "../node-editor/node-editor";
import type { FlowNode } from "./flow-node";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Story 084, AC 7 — a page that repeats is marked on the card: "× barn".
 * The word is the editor's, in the card's language; no row without a word
 * (the health flag carries that case); and the card's name says it in words,
 * because a symbol is never the only channel.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mounted(data: Record<string, unknown>, locale = "sv"): Promise<FlowNode> {
  const editor = document.createElement("node-editor") as NodeEditor;

  editor.editorMode = "administrator";
  editor.activeLocale = locale;
  editor.style.cssText = "display: block; width: 1200px; height: 700px;";
  document.body.append(editor);
  editor.graph = {
    version: 9,
    startNodeId: "sida",
    nodes: [{ id: "sida", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Dina barn", en: "Your children" }, ...data } }],
    connections: [],
  } as unknown as GraphData;
  await settle();

  return editor.shadowRoot!.querySelector<FlowNode>("flow-node")!;
}

const row = (node: FlowNode): HTMLElement | null =>
  node.shadowRoot!.querySelector<HTMLElement>("[data-repeat-row]");

const name = (node: FlowNode): string =>
  node.shadowRoot!.querySelector("[aria-label]")!.getAttribute("aria-label")!;

describe("upprepningsraden på sidkortet", () => {
  test("en upprepad sida visar × och ordet, och namnet säger det med ord", async () => {
    const node = await mounted({ repeats: true, repeatWord: { sv: "barn", en: "child" }, repeatVariable: "barn" });

    expect(row(node)?.textContent?.trim()).toBe("× barn");
    expect(name(node)).toContain("upprepas per barn");
  });

  test("ordet följer kortets språk", async () => {
    const node = await mounted({ repeats: true, repeatWord: { sv: "barn", en: "child" }, repeatVariable: "barn" }, "en");

    expect(row(node)?.textContent?.trim()).toBe("× child");
  });

  test("ingen rad utan ord, och ingen rad på en sida som inte upprepas", async () => {
    expect(row(await mounted({ repeats: true, repeatVariable: "barn" }))).toBeNull();
    expect(row(await mounted({ repeatWord: "barn" }))).toBeNull();
    expect(name(await mounted({ repeatWord: "barn" }))).not.toContain("upprepas");
  });
});
