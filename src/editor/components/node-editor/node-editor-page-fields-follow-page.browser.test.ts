import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { pageBuilderExampleGraph } from "../../../data/page-builder-example-graph";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "./node-editor";

/**
 * A field inside a page follows its page.
 *
 * ## The failure this is written from
 *
 * Johan's picture, 3 September 2026: "Vägar till" with the start page lit and
 * its three fields dimmed to 0.28, ringed in red. The marking is derived from
 * the connections, and a field has none: the page carries them. So a field is
 * on the route exactly when its page is.
 *
 * A run has the same hole on paper (the fields' cards measured 0.35 under a
 * page at 1) but never on screen: a run draws every page as the visitor sees
 * it, and the cards are hidden. Nothing is done there — code with no visible
 * effect is only something to maintain.
 *
 * ## What is asserted
 *
 * Computed opacity on the field's card, next to a node that is off the route
 * — otherwise "light every field" would pass.
 */

afterEach(() => document.body.replaceChildren());

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

function mount(): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.setAttribute("mode", "administrator");
  editor.setAttribute("level", "advanced");
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = structuredClone(pageBuilderExampleGraph);
  return editor;
}

const canvasOf = (editor: GuideEditor): NodeEditor => {
  const canvas = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  if (!canvas) throw new Error("no node-editor");
  return canvas;
};

function opacityOf(editor: GuideEditor, id: string): number {
  const node = [...(canvasOf(editor).shadowRoot?.querySelectorAll<HTMLElement>("flow-node") ?? [])].find(
    (element) => (element as unknown as { nodeId: string | null }).nodeId === id,
  );
  const card = node?.shadowRoot?.querySelector<HTMLElement>(".flow-node");
  if (!card) throw new Error(`no card for ${id}`);
  return Number(getComputedStyle(card).opacity);
}

describe("a page's fields follow the page", () => {
  test("on the routes to a node", async () => {
    const editor = mount();
    await settle();

    canvasOf(editor).showRoutesTo("service-email-complete");
    await settle();

    // Both pages are on the way to the e-mail result; the guardian result is not.
    expect(opacityOf(editor, "service-applicant-page")).toBe(1);
    expect(opacityOf(editor, "service-applicant-name")).toBe(1);
    expect(opacityOf(editor, "service-email-address")).toBe(1);
    expect(opacityOf(editor, "service-guardian")).toBeLessThan(0.5);
  });
});
