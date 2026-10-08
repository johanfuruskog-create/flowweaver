import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "./node-editor";

/**
 * Two things Johan found in the canvas toolbar the day after it shipped
 * (23/9).
 *
 * 1. "Visa hela flödet" lands on some odd zoom — 54 % on his guide — and
 *    from there no number of + or − presses ever reaches 100 % again: every
 *    step multiplies by 1.1, so the sequence jumps straight over it. A step
 *    that crosses 100 % must land on it.
 *
 * 2. Clicking + or − with the mouse leaves focus on the button. The next
 *    thing anybody does is hold Space to pan — and Space on a focused button
 *    is a click, so the zoom moves again and the focus ring lights up on the
 *    button. A pointer click on a canvas action must hand focus back to the
 *    canvas; a keyboard activation keeps it where it is.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const wideGraph = () => ({
  startNodeId: "n0",
  nodes: Array.from({ length: 8 }, (_, index) => ({
    id: `n${index}`,
    type: "text-question",
    position: { x: index * 420, y: (index % 2) * 200 },
    data: { title: `Nod ${index}`, variableName: `v${index}` },
  })),
  connections: [],
});

async function editorAt(width: number): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = `display: block; width: ${width}px; height: 700px;`;
  document.body.append(editor);
  editor.graph = wideGraph() as never;

  await settle();
  await settle();

  return editor;
}

function nodeEditorOf(editor: GuideEditor): NodeEditor {
  const found = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  if (!found) throw new Error("node-editor saknas.");
  return found;
}

function button(nodeEditor: NodeEditor, action: string): HTMLButtonElement {
  const found = nodeEditor.shadowRoot!.querySelector<HTMLButtonElement>(
    `[data-canvas-toolbar] [data-action="${action}"]`,
  );
  if (!found) throw new Error(`${action} saknas.`);
  return found;
}

const readout = (nodeEditor: NodeEditor): string =>
  nodeEditor.shadowRoot!.querySelector<HTMLElement>("[data-canvas-toolbar-zoom]")!
    .textContent ?? "";

describe("tillbaka till 100 % efter Visa hela flödet (Johan 23/9)", () => {
  test("plus från en udda zoom landar på exakt 100 %, inte över", async () => {
    const editor = await editorAt(1400);
    const nodeEditor = nodeEditorOf(editor);

    button(nodeEditor, "canvas-fit").click();
    await settle();
    const fitted = readout(nodeEditor);
    expect(fitted, "grafen fick plats i vyn — mätningen behöver en udda zoom").not.toBe(
      "100 %",
    );

    const seen: string[] = [];
    for (let i = 0; i < 24 && readout(nodeEditor) !== "100 %"; i += 1) {
      button(nodeEditor, "canvas-zoom-in").click();
      seen.push(readout(nodeEditor));
    }

    expect(seen, `från ${fitted} via ${seen.join(", ")}`).toContain("100 %");
  });

  test("minus från över 100 % landar på exakt 100 %, inte under", async () => {
    const editor = await editorAt(1400);
    const nodeEditor = nodeEditorOf(editor);

    button(nodeEditor, "canvas-fit").click();
    await settle();
    // Up to the ceiling (150 %): 150 / 1.1ⁿ never equals 100 either.
    nodeEditor.setZoom(2); // clamped to ZOOM_MAX
    expect(readout(nodeEditor)).toBe("150 %");

    const seen: string[] = [];
    for (let i = 0; i < 24 && readout(nodeEditor) !== "100 %"; i += 1) {
      button(nodeEditor, "canvas-zoom-out").click();
      seen.push(readout(nodeEditor));
    }

    expect(seen, `via ${seen.join(", ")}`).toContain("100 %");
  });
});

describe("mellanslag efter en musklickad zoomknapp (Johan 23/9)", () => {
  test("ett musklick på + lämnar inte fokus på knappen", async () => {
    const editor = await editorAt(1400);
    const nodeEditor = nodeEditorOf(editor);
    const plus = button(nodeEditor, "canvas-zoom-in");

    // What a real mouse does: pointerdown, focus, click — in that order.
    plus.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true, button: 0 }));
    plus.focus();
    plus.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }));
    await settle();

    const before = readout(nodeEditor);
    expect(nodeEditor.shadowRoot!.activeElement, "fokus står kvar på knappen").not.toBe(plus);

    // Space is now a pan, not a second click.
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true }));
    plus.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", key: " ", bubbles: true, composed: true }));
    await settle();
    expect(readout(nodeEditor)).toBe(before);
  });

  test("Esc ur helskärm efter ett musklick på knappen tänder inte fokusringen på den", async () => {
    const editor = await editorAt(1400);
    const nodeEditor = nodeEditorOf(editor);
    const full = button(nodeEditor, "canvas-fullscreen");

    full.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true, button: 0 }));
    full.focus();
    full.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }));
    await settle();
    expect(editor.hasAttribute("wide"), "brett läge gick inte i").toBe(true);

    const deepActive = (): Element => {
      let active: Element = document.activeElement ?? document.body;
      while (active.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      return active;
    };
    deepActive().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }),
    );
    await settle();

    expect(editor.hasAttribute("wide"), "Esc lämnade inte brett läge").toBe(false);
    expect(full.matches(":focus-visible"), "fokusringen står på helskärmsknappen").toBe(false);
  });

  test("Enter på knappen från tangentbordet behåller fokus där", async () => {
    const editor = await editorAt(1400);
    const nodeEditor = nodeEditorOf(editor);
    const plus = button(nodeEditor, "canvas-zoom-in");

    plus.focus();
    plus.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 0 }));
    await settle();

    expect(nodeEditor.shadowRoot!.activeElement).toBe(plus);
  });
});
