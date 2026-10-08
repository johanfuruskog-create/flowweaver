import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import { ikonkontrastbrott } from "../../../testing/contrast";

import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

/**
 * Every control identified by a shape rather than a word, in both themes.
 *
 * ## The fault this exists to prevent a second time
 *
 * A handle shipped with its edge at 1.41:1 against the canvas and its fill at
 * 1.05 — the same colour as the background it sat on. Nothing said so, because
 * `guide-editor-contrast` walks text: that is 1.4.3. A control identified by a
 * shape is 1.4.11, and it was measured nowhere.
 *
 * ## What it walks
 *
 * Every shadow root under a mounted editor, so a control added inside any
 * component is swept without anybody remembering to add it here. Buttons
 * carrying a word are left to the text sweep — text is what identifies those.
 *
 * ## Why states are driven
 *
 * Half of these controls do not exist until something is selected. The node's
 * own menu button and the handles on its lines appear with selection, so a sweep
 * of the resting canvas would report a clean bill of health for controls it
 * never saw.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 150));

function allRoots(): ShadowRoot[] {
  const roots: ShadowRoot[] = [];
  const walk = (node: ShadowRoot | Document): void => {
    node.querySelectorAll("*").forEach((element) => {
      const root = (element as HTMLElement).shadowRoot;

      if (root) {
        roots.push(root);
        walk(root);
      }
    });
  };

  walk(document);

  return roots;
}

async function editorIn(theme: "light" | "dark"): Promise<void> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("feature-level", "advanced");
  editor.setAttribute("theme", theme);
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "text-question", position: { x: 60, y: 60 }, data: { title: "Ett", variableName: "a" } },
      { id: "q2", type: "text-question", position: { x: 460, y: 60 }, data: { title: "Två", variableName: "b" } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q1", portId: "continue" }, to: { nodeId: "q2", portId: "input" } },
    ],
  } as never;

  await settle();
  await settle();

  // Brings out the controls that only exist for something selected.
  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");

  nodeEditor?.selectNodeById("q1");
  await settle();
}

describe.each(["light", "dark"] as const)("icon controls in %s", (theme) => {
  test("every one of them stands out from what is behind it", async () => {
    await editorIn(theme);

    const brott = allRoots().flatMap((root) => ikonkontrastbrott(root));

    expect(brott, brott.join("\n")).toEqual([]);
  });

  test("and the sweep actually found some to check", async () => {
    /*
     * A sweep that walks nothing passes for ever. This is the guard on the
     * guard: if a selector changes or a state stops being reached, the count
     * drops and this fails before the silence is mistaken for health.
     */
    await editorIn(theme);

    const found = allRoots().flatMap((root) =>
      [...root.querySelectorAll<HTMLElement>("button")].filter(
        (button) =>
          (button.textContent ?? "").trim().length <= 2 &&
          button.getBoundingClientRect().width > 0,
      ),
    );

    expect(found.length).toBeGreaterThanOrEqual(5);
  });
});
