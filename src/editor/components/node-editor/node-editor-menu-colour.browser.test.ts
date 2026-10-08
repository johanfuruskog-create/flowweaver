import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { kontrast, tillRgba } from "../../../testing/contrast";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "./node-editor";

/**
 * Red means "this removes something" — and nothing else.
 *
 * ## Where this was found
 *
 * In a frame of the film that teaches somebody to build their first guide. The
 * node menu was open, and every item in it was red: *Visa vägarna hit*,
 * *Duplicera*, *Spara som mall*, *Exportera som mall*. Only *Gör till startnod*
 * was not.
 *
 * The rule came from the **connection** menu, whose single item was "remove
 * connection" — red, correctly. When the node menu reused the container, every
 * item inherited the colour:
 *
 *     button:not(.node-editor__connection-color) { color: var(--fw-danger-text); }
 *
 * Two harms at once. A harmless action looks dangerous, so a new editor
 * hesitates in the wrong place — and the one item that really does destroy
 * something no longer stands out among the others. Red that means everything
 * means nothing.
 *
 * ## Why the test reads colour rather than class names
 *
 * A class can be renamed and a test that watches it goes on passing while the
 * screen says something else. What matters is what the eye receives, so this
 * compares the rendered colour of each item against the colour of the one that
 * is genuinely destructive.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 100) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function openNodeMenu(): Promise<HTMLButtonElement[]> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1200px; height: 800px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "text-question", position: { x: 40, y: 40 }, data: { title: { sv: "Ett" }, variableName: "a" } },
      { id: "q2", type: "text-question", position: { x: 400, y: 40 }, data: { title: { sv: "Två" }, variableName: "b" } },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  const nodeEditor = editor.shadowRoot!.querySelector<NodeEditor>("node-editor")!;
  const node = Array.from(nodeEditor.shadowRoot!.querySelectorAll("flow-node")).find(
    (candidate) => (candidate as { nodeId?: string }).nodeId === "q2",
  )!;

  node.shadowRoot!.querySelector<HTMLButtonElement>("[data-node-menu]")!.click();
  await settle();

  return Array.from(
    nodeEditor.shadowRoot!.querySelectorAll<HTMLButtonElement>(
      ".node-editor__connection-menu button:not(.node-editor__connection-color)",
    ),
  );
}

const colourOf = (button: HTMLButtonElement): string => getComputedStyle(button).color;

/**
 * Del 7 (UPPDRAG-2026-09-28-ENHETLIGHET, 28/9): the SAME red-means-everything
 * fault, one level down — `[data-action^="remove-"]` is a PREFIX match, so it
 * painted `remove-from-page` ("Lyft ut ur sidan") the same destructive red as
 * `remove-node`/`remove-connection`, even though Ted measured that lifting a
 * node out of a page destroys nothing: the node and all its data stay on the
 * canvas, and undo restores exactly. Needs its own fixture — a node WITH
 * `parentPageId` set, the only condition under which "Lyft ut ur sidan"
 * renders at all (see `removeFromPageAction` in node-editor.ts).
 */
async function openNodeMenuInPage(): Promise<HTMLButtonElement[]> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1200px; height: 800px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "page1",
    nodes: [
      { id: "page1", type: "page", position: { x: 40, y: 40 }, data: { title: { sv: "Sida" } } },
      {
        id: "field1",
        type: "text-question",
        position: { x: 20, y: 100 },
        parentPageId: "page1",
        data: { title: { sv: "Fält" }, variableName: "a" },
      },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  const nodeEditor = editor.shadowRoot!.querySelector<NodeEditor>("node-editor")!;
  const node = Array.from(nodeEditor.shadowRoot!.querySelectorAll("flow-node")).find(
    (candidate) => (candidate as { nodeId?: string }).nodeId === "field1",
  )!;

  node.shadowRoot!.querySelector<HTMLButtonElement>("[data-node-menu]")!.click();
  await settle();

  return Array.from(
    nodeEditor.shadowRoot!.querySelectorAll<HTMLButtonElement>(
      ".node-editor__connection-menu button:not(.node-editor__connection-color)",
    ),
  );
}

describe("Lyft ut ur sidan", () => {
  test("är neutral, inte röd som en riktig borttagning", async () => {
    const items = await openNodeMenuInPage();
    const liftOut = items.find((item) => item.dataset.action === "remove-from-page")!;
    const others = items.filter((item) => item !== liftOut);

    expect(liftOut, "ingen \"Lyft ut ur sidan\"-post i menyn").toBeTruthy();

    const matchesADestructiveOne = others
      .filter((item) => item.dataset.action?.startsWith("remove-"))
      .some((item) => colourOf(item) === colourOf(liftOut));

    expect(matchesADestructiveOne, "\"Lyft ut ur sidan\" ser lika röd ut som en riktig borttagning").toBe(false);
  });
});

describe("the node menu", () => {
  test("opens with items to look at", async () => {
    // The measurement below is meaningless on an empty menu, so it is asserted.
    expect((await openNodeMenu()).length).toBeGreaterThan(3);
  });

  test("paints only the removing item as removing", async () => {
    const items = await openNodeMenu();
    const removing = items.find((item) => item.dataset.action?.startsWith("remove-"))!;
    const others = items.filter((item) => item !== removing);

    expect(removing, "ingen borttagningspost i menyn").toBeTruthy();

    const wrongly = others
      .filter((item) => colourOf(item) === colourOf(removing))
      .map((item) => item.dataset.action ?? item.textContent?.trim());

    expect(
      wrongly,
      `poster som ser destruktiva ut: ${wrongly.join(", ")}`,
    ).toEqual([]);
  });

  test("and the ordinary items are still readable", async () => {
    /*
     * Taking the red away must not leave grey-on-white. WCAG 1.4.3 wants 4.5:1
     * for text, and a menu item is text somebody reads before choosing.
     */
    const items = await openNodeMenu();
    const menu = items[0]!.closest<HTMLElement>(".node-editor__connection-menu")!;
    const behind = tillRgba(getComputedStyle(menu).backgroundColor);

    const weak = items
      .map((item) => ({
        name: item.dataset.action ?? "",
        ratio: kontrast(tillRgba(colourOf(item)), behind),
      }))
      .filter((measured) => measured.ratio < 4.5);

    expect(weak.map((one) => `${one.name} ${one.ratio.toFixed(2)}:1`)).toEqual([]);
  });
});
