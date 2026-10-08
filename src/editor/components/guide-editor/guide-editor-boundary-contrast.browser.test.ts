import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import { kontrollkantsbrott } from "../../../testing/contrast";

import type { GuideEditor } from "./guide-editor";

/**
 * The edge of every control an editor can type in or press — WCAG 1.4.11.
 *
 * ## What the sweep found
 *
 * The same fault as the viewer, and wider. Measured before anything changed:
 * every `input`, `select` and `textarea` in the properties panel, the toolbar's
 * open menus, the palette's items, the node type editor and the prompt dialog
 * drew their edge with `--fw-border` — **1.47:1** in light, **1.95:1** in dark,
 * against a required 3:1. A token made for dividers, used for the boundary of a
 * control, in eighteen rules across nine components.
 *
 * `guide-editor-icon-contrast` already walked icon *buttons*, which is why the
 * connection handle and the node menu were caught earlier. Nothing had ever
 * looked at a text field.
 *
 * ## What it does not reach
 *
 * Only what is on screen with a node selected. The node type editor, the
 * versions panel and the dialogs are rendered when opened, so their fields were
 * fixed from the same sweep run by hand but are not held by this test —
 * deliberately stated, because a gate that implies more coverage than it has is
 * the fault this file was written after finding.
 *
 * ## Why this reaches through the shadow roots
 *
 * The editor is a tree of custom elements, and the controls that failed lived in
 * `properties-panel` — a component this file never names. A sweep that stopped
 * at the first shadow boundary would have reported the editor clean while the
 * panel it spends its whole time in was the thing at fault.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Parks the pointer on a neutral patch before anything is measured.
 *
 * The browser tests share one page per worker, and the pointer's position
 * survives between files — a test that dragged from the palette leaves the
 * mouse where "Lägg till Fråga" sits, `:hover` applies, and this sweep measures
 * the hover border instead of the resting one. That was the flake: red twice
 * in seven full runs, green every time alone, and the CI failure reproduced to
 * the hundredth (1.99:1 light, 2.74:1 dark) by hovering that button on
 * purpose. The patch stays in the document while the sweep runs, so nothing
 * underneath it is hovered; `afterEach` clears it with everything else.
 */
async function parkPointer(): Promise<void> {
  const { userEvent } = await import("@vitest/browser/context");
  const spot = document.createElement("div");

  spot.style.cssText =
    "position: fixed; top: 0; left: 0; width: 8px; height: 8px; z-index: 2147483647;";
  document.body.append(spot);
  await userEvent.hover(spot);
}

/** Every control in the tree, through every shadow root under the editor. */
function everything(root: ShadowRoot, into: HTMLElement[] = []): HTMLElement[] {
  for (const element of root.querySelectorAll<HTMLElement>("*")) {
    if (element.matches("input, select, textarea, button")) {
      into.push(element);
    }

    if (element.shadowRoot) {
      everything(element.shadowRoot, into);
    }
  }

  return into;
}

/**
 * Every shadow root under the editor, including its own.
 *
 * The root is pushed here rather than defaulted into the accumulator, which is
 * how the first version silently swept one root out of nineteen: `into = [root]`
 * only names the root when the caller passes nothing, so every nested root
 * recursed with a list and was never added to it. The token mutation still
 * failed — `guide-editor` has controls of its own — while breaking the
 * properties panel's fields, the ones this was written for, changed nothing.
 */
function roots(root: ShadowRoot, into: ShadowRoot[] = []): ShadowRoot[] {
  into.push(root);

  for (const element of root.querySelectorAll<HTMLElement>("*")) {
    if (element.shadowRoot) {
      roots(element.shadowRoot, into);
    }
  }

  return into;
}

async function editorWith(theme: "light" | "dark"): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("theme", theme);
  editor.style.cssText = "display: block; width: 1300px; height: 900px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "text-question", position: { x: 40, y: 40 }, data: { title: "Ett", variableName: "a" } },
      { id: "q2", type: "question", position: { x: 420, y: 40 }, data: { title: "Två", variableName: "b", options: [{ id: "o", label: "Ja", value: "ja" }] } },
    ],
    connections: [{ id: "c", from: { nodeId: "q1", portId: "continue" }, to: { nodeId: "q2", portId: "input" } }],
  } as never;

  await settle();
  await settle();

  /*
   * A node selected, because the properties panel is where the fields are and it
   * is empty until something is picked — which is exactly why they had never
   * been measured.
   */
  (
    editor.shadowRoot!.querySelector("node-editor") as unknown as {
      selectNodeById?(id: string): void;
    }
  ).selectNodeById?.("q1");

  await settle();
  await settle();
  await parkPointer();

  return editor;
}

describe.each(["light", "dark"] as const)("editorn i %s tema", (theme) => {
  test("varje kontroll har en kant som går att hitta", async () => {
    const editor = await editorWith(theme);

    /*
     * The theme is checked rather than assumed. The viewer's own contrast sweep
     * spent months switching a theme the component does not read, measuring the
     * light one twice and reporting it as two — so a sweep that names a theme
     * now proves it is in it.
     */
    const surface = getComputedStyle(editor).getPropertyValue("--fw-surface").trim();

    expect(surface, "temat slog aldrig igenom").toBe(
      theme === "dark" ? "#161b26" : "#ffffff",
    );

    // An empty sweep must never pass: it reads exactly like a clean one.
    expect(
      everything(editor.shadowRoot!).length,
      "inga kontroller hittades alls",
    ).toBeGreaterThan(10);

    expect(roots(editor.shadowRoot!).flatMap(kontrollkantsbrott)).toEqual([]);
  });

  /*
   * The hovered edge, held to the same bar as the resting one.
   *
   * Found by the pointer-parking work above: the hover style swapped the
   * border to `--fw-primary-muted`, which measured 1.99:1 in light and 2.74:1
   * in dark — hovering a button made its edge *harder* to see, not easier.
   * Johan's call: adjust so it is clear to the person pointing at it.
   */
  test("kanten håller även under pekaren", async () => {
    const editor = await editorWith(theme);
    const palette = editor.shadowRoot!.querySelector("node-palette")!;
    const button = palette.shadowRoot!.querySelector("button")!;
    const { userEvent } = await import("@vitest/browser/context");

    await userEvent.hover(button);

    expect(kontrollkantsbrott(palette.shadowRoot!)).toEqual([]);
  });
});
