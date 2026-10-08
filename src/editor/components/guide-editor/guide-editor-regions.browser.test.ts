import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Jumping between the editor's parts without walking through them.
 *
 * ## The gap
 *
 * The editor has four places to be: the row of guide-wide actions, the palette
 * of node types, the canvas, and the side panel. Reaching the canvas from the
 * top of the palette meant tabbing past every node type in it, and reaching the
 * side panel meant tabbing past the canvas — which, before the tab order was
 * made to rove, meant every node and every port in the guide.
 *
 * Making the canvas cheap to pass is half the fix. The other half is not having
 * to pass it.
 *
 * ## Why F6
 *
 * It is the platform's own answer — Windows, browsers and desktop apps have
 * cycled panes with F6 for decades, and it is what a screen reader user tries
 * first. Ctrl and a digit was the other candidate and is not available: browsers
 * keep Ctrl+1…9 for switching tabs and a page cannot have them.
 *
 * ## Landing on the region, not inside it
 *
 * F6 puts focus on the region itself rather than on its first control. One rule
 * for four places instead of four rules, the name of the place is announced by
 * the focus landing on something that has one, and Tab from there goes in. The
 * alternative — knowing, per region, which control deserves the focus — is four
 * pieces of knowledge that fall out of step the moment a region changes.
 */

afterEach(() => document.body.replaceChildren());

const guide = (): GraphData =>
  ({
    startNodeId: "q",
    settings: { sourceLocale: "sv" },
    nodes: [
      { id: "q", type: "question", position: { x: 80, y: 80 }, data: { title: { sv: "Fråga" } } },
    ],
    connections: [],
  }) as unknown as GraphData;

const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ),
  );

async function mount(): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("feature-level", "basic");
  editor.style.cssText = "display: block; width: 1200px; height: 700px;";
  document.body.append(editor);

  editor.graph = guide();
  await settle();
  await settle();

  return editor;
}

/** Which region holds the focus, by its own name for itself. */
const focusedRegion = (editor: GuideEditor): string | null =>
  (editor.shadowRoot?.activeElement as HTMLElement | null)
    ?.closest?.("[data-region]")
    ?.getAttribute("data-region") ?? null;

const press = (editor: GuideEditor, shiftKey = false) =>
  editor.dispatchEvent(
    new KeyboardEvent("keydown", { key: "F6", shiftKey, bubbles: true, composed: true }),
  );

describe("F6", () => {
  test("moves to the next region and comes back round", async () => {
    const editor = await mount();
    const visited: (string | null)[] = [];

    for (let step = 0; step < 5; step += 1) {
      press(editor);
      visited.push(focusedRegion(editor));
    }

    // Four distinct places, then the first one again.
    expect(new Set(visited.slice(0, 4)).size).toBe(4);
    expect(visited.every(Boolean)).toBe(true);
    expect(visited[4]).toBe(visited[0]);
  });

  test("with Shift goes the other way", async () => {
    const editor = await mount();

    press(editor);
    const first = focusedRegion(editor);

    // Two nulls would agree with each other and prove nothing.
    expect(first).not.toBeNull();

    press(editor);
    press(editor, true);

    expect(focusedRegion(editor)).toBe(first);
  });

  test("the canvas is one of them", async () => {
    const editor = await mount();
    const seen: (string | null)[] = [];

    for (let step = 0; step < 4; step += 1) {
      press(editor);
      seen.push(focusedRegion(editor));
    }

    expect(seen).toContain("canvas");
  });
});
