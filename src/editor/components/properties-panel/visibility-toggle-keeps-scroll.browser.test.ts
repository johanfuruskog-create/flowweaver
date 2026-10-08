import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Johan 29/9: "När man slår på villkorsstyrd synlighet hoppar scrollen upp
 * så man ser inte det utfällda utan behöver scrolla ner för att se."
 *
 * The switch re-renders the whole panel (`innerHTML`), and the scroll
 * container is a new element at scrollTop 0. The thing the editor just
 * opened — the condition's controls — lands below the fold. Measured before
 * the fix: scrollTop 0 after the click, the variable chooser outside the
 * visible box.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mounted(): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  // Low enough that a text field's panel has to scroll to reach the switch.
  editor.style.cssText = "display: block; width: 1200px; height: 480px;";
  document.body.append(editor);
  editor.graph = {
    version: 8,
    startNodeId: "sidan",
    nodes: [
      { id: "sidan", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Om dig" } } },
      { id: "falt", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "sidan", order: 1, data: { title: { sv: "E-post" }, variableName: "epost" } },
      { id: "fraga", type: "question", position: { x: -400, y: 0 }, data: { title: { sv: "Vill du bli kontaktad?" }, variableName: "kontakt", options: [{ id: "ja", label: "Ja", value: "ja" }, { id: "nej", label: "Nej", value: "nej" }] } },
    ],
    connections: [],
  } as never;
  await settle();
  return editor;
}

const panel = (editor: GuideEditor) =>
  editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;

const scroller = (editor: GuideEditor) =>
  panel(editor).querySelector<HTMLElement>(".properties-panel__content")!;

/** Within the box, to the pixel: `block: "nearest"` lands the edge on the
 *  edge, and layout keeps fractions (measured 0.44 px over). */
function isInside(el: HTMLElement, box: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  const b = box.getBoundingClientRect();

  return r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
}

describe("villkorsstyrd synlighet och rullpositionen", () => {
  test("reglaget på: villkorets kontroller syns utan att rulla", async () => {
    const editor = await mounted();

    editor.shadowRoot!
      .querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!
      .selectNodeById("falt");
    await settle();

    const toggle = panel(editor).querySelector<HTMLInputElement>('[data-visibility-property="enabled"]')!;

    expect(toggle, "reglaget finns").toBeTruthy();
    toggle.scrollIntoView({ block: "start" });
    await settle(50);
    const before = scroller(editor).scrollTop;

    expect(before, "panelen måste rulla för att provet ska säga något").toBeGreaterThan(0);

    toggle.click();
    await settle();

    const variable = panel(editor).querySelector<HTMLElement>('[data-visibility-property="variableName"]');

    expect(variable, "villkorets kontroller ritas").toBeTruthy();
    expect(scroller(editor).scrollTop, "rullpositionen behålls").toBeGreaterThan(0);
    expect(isInside(variable!, scroller(editor)), "variabelväljaren är i den synliga rutan").toBe(true);
  });

  test("reglaget längst ner i vyn: kontrollerna rullas fram, inte längre än nödvändigt", async () => {
    const editor = await mounted();

    editor.shadowRoot!
      .querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!
      .selectNodeById("falt");
    await settle();

    const toggle = panel(editor).querySelector<HTMLInputElement>('[data-visibility-property="enabled"]')!;

    // Johan's case: scrolled just far enough to see the switch, at the bottom.
    toggle.scrollIntoView({ block: "end" });
    await settle(50);
    const before = scroller(editor).scrollTop;

    toggle.click();
    await settle();

    const variable = panel(editor).querySelector<HTMLElement>('[data-visibility-property="variableName"]')!;

    expect(isInside(variable, scroller(editor)), "variabelväljaren är i den synliga rutan").toBe(true);
    expect(scroller(editor).scrollTop, "rullat framåt, inte tillbaka till toppen").toBeGreaterThanOrEqual(before);
    expect(
      isInside(panel(editor).querySelector<HTMLElement>('[data-visibility-property="enabled"]')!, scroller(editor)),
      "reglaget är fortfarande synligt",
    ).toBe(true);
  });

  test("byte av nod börjar överst", async () => {
    const editor = await mounted();
    const nodeEditor = editor.shadowRoot!.querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!;

    nodeEditor.selectNodeById("falt");
    await settle();
    panel(editor).querySelector<HTMLInputElement>('[data-visibility-property="enabled"]')!.scrollIntoView({ block: "start" });
    await settle(50);
    expect(scroller(editor).scrollTop).toBeGreaterThan(0);

    nodeEditor.selectNodeById("fraga");
    await settle();

    expect(scroller(editor).scrollTop, "en annan nod visas från början").toBe(0);
  });
});
