import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Johan 29/9, on the field's switch: "det ska fungera som andra saker, ska
 * inte sticka iväg". The answer option's switch (story 134) unfolds its
 * condition group the same way and goes through the same re-render; this
 * is the same measurement for it — the switch at the bottom of the panel,
 * the unfolded controls must come into view.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mounted(): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1200px; height: 480px;";
  document.body.append(editor);
  editor.graph = {
    version: 8,
    startNodeId: "org",
    settings: { sourceLocale: "sv", locales: ["sv"] },
    nodes: [
      {
        id: "org",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Vill du ange organisation?" },
          variableName: "organisation",
          options: [
            { id: "org-ja", label: { sv: "Ja" }, value: "ja" },
            { id: "org-nej", label: { sv: "Nej" }, value: "nej" },
          ],
        },
      },
      {
        id: "typ",
        type: "multi-choice",
        position: { x: 400, y: 0 },
        data: {
          title: { sv: "Typ av kontakt" },
          variableName: "typ",
          options: [
            { id: "opt-privat", label: { sv: "Privatperson" }, value: "privatperson" },
            { id: "opt-foretag", label: { sv: "Företag" }, value: "foretag" },
          ],
        },
      },
    ],
    connections: [
      { id: "k1", from: { nodeId: "org", portId: "org-ja" }, to: { nodeId: "typ", portId: "input" } },
      { id: "k2", from: { nodeId: "org", portId: "org-nej" }, to: { nodeId: "typ", portId: "input" } },
    ],
  } as never;
  await settle();
  return editor;
}

const panel = (editor: GuideEditor) =>
  editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;

const scroller = (editor: GuideEditor) =>
  panel(editor).querySelector<HTMLElement>(".properties-panel__content")!;

const card = (editor: GuideEditor, optionId: string) =>
  panel(editor).querySelector<HTMLElement>(`[data-option-id="${optionId}"]`)!;

function isInside(el: HTMLElement, box: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  const b = box.getBoundingClientRect();

  return r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
}

describe("alternativets reglage och rullpositionen", () => {
  test("reglaget längst ner i vyn: villkorsgruppen rullas fram", async () => {
    const editor = await mounted();

    editor.shadowRoot!
      .querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!
      .selectNodeById("typ");
    await settle();

    card(editor, "opt-foretag").querySelector<HTMLElement>('[data-action="toggle-option"]')!.click();
    await settle();

    const toggle = card(editor, "opt-foretag").querySelector<HTMLInputElement>('[data-option-visibility-property="enabled"]')!;

    expect(toggle, "reglaget finns i det öppna kortet").toBeTruthy();
    toggle.scrollIntoView({ block: "end" });
    await settle(50);
    const before = scroller(editor).scrollTop;

    expect(before, "panelen måste rulla för att provet ska säga något").toBeGreaterThan(0);

    toggle.click();
    await settle();

    const variable = card(editor, "opt-foretag").querySelector<HTMLElement>('[data-option-visibility-property="variableName"]');

    expect(variable, "villkorsgruppen ritas").toBeTruthy();
    expect(scroller(editor).scrollTop, "rullat framåt, inte till toppen").toBeGreaterThanOrEqual(before);
    expect(isInside(variable!, scroller(editor)), "variabelväljaren är i den synliga rutan").toBe(true);
  });
});
