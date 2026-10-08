import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import { pageBuilderExampleGraph } from "../../../data/page-builder-example-graph";

import type { EditorToolbar } from "../editor-toolbar/editor-toolbar";
import type { FlowNode } from "../flow-node/flow-node";
import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

/**
 * The menu that sets every node's eye at once.
 *
 * Story 064 point 6: the menu is a **command**, not a second state beside the
 * nodes' — it sets each node's eye and then has nothing of its own to remember.
 * Johan, having first asked for a switch for the whole canvas: *"jag vill ha en
 * knapp som togglar sin egen ruta och sedan en meny som visar eller gömmer."*
 *
 * The menu is renamed with it. It said *Visa*, and the word now has two jobs —
 * *Visa alla som besökaren ser dem* lives inside it. *Vy* is what the tour
 * already calls it.
 */

afterEach(() => document.body.replaceChildren());

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

function mount(mode?: string): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.style.cssText = "display: block; width: 1400px; height: 800px;";
  if (mode) editor.setAttribute("mode", mode);
  document.body.append(editor);
  editor.graph = structuredClone(pageBuilderExampleGraph);
  return editor;
}

function canvas(editor: GuideEditor): NodeEditor {
  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");

  if (!nodeEditor) throw new Error("node-editor saknas");
  return nodeEditor;
}

function stepNodes(editor: GuideEditor): FlowNode[] {
  return [
    ...(canvas(editor).shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []),
  ].filter((node) => node.shadowRoot?.querySelector("[data-visitor-preview]"));
}

async function pick(editor: GuideEditor, action: string): Promise<void> {
  const toolbar =
    editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
  const trigger = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>(
    '[data-menu-trigger="view"]',
  );
  const item = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>(
    `[data-action="${action}"]`,
  );

  if (!trigger || !item) throw new Error(`hittade inte ${action} i Vy-menyn`);

  await userEvent.click(trigger);
  await userEvent.click(item);
  await settle();
}

describe("menyn Vy", () => {
  test("heter Vy, inte Visa", async () => {
    const editor = mount("administrator");
    await settle();

    const trigger = editor.shadowRoot
      ?.querySelector<EditorToolbar>("editor-toolbar")
      ?.shadowRoot?.querySelector<HTMLButtonElement>('[data-menu-trigger="view"]');

    expect(trigger?.textContent?.trim()).toBe("Vy");
  });

  test("Visa alla som besökaren ser dem tänder varje stegnods öga", async () => {
    const editor = mount("administrator");
    await settle();

    expect(stepNodes(editor).filter((node) => node.visitorView)).toEqual([]);

    await pick(editor, "visitor-view-all");

    const nodes = stepNodes(editor);

    expect(nodes.length).toBeGreaterThan(2);
    expect(nodes.every((node) => node.visitorView)).toBe(true);
  });

  test("Visa alla som struktur släcker dem igen", async () => {
    const editor = mount("administrator");
    await settle();

    await pick(editor, "visitor-view-all");
    await pick(editor, "structure-view-all");

    expect(stepNodes(editor).filter((node) => node.visitorView)).toEqual([]);
  });

  test("grafen hör inte av det", async () => {
    const editor = mount("administrator");
    await settle();

    const before = JSON.stringify(editor.getData());
    let changes = 0;

    editor.addEventListener("graph-changed", () => {
      changes += 1;
    });

    await pick(editor, "visitor-view-all");

    expect(JSON.stringify(editor.getData())).toBe(before);
    expect(changes).toBe(0);
  });
});
