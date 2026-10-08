import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Story 067 — två sorters logik, panelen säger vilken. Fältets *visas om*
 * gäller på samma sida; regelnoden väljer väg mellan steg. Utan skylt bygger
 * redaktören regelnoder för fältsynlighet eller tvärtom. Hjälprader, inte
 * varningar — samma ton som sidrådet (2/9).
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mounted(): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 800px;";
  document.body.append(editor);
  editor.graph = {
    version: 8,
    startNodeId: "sidan",
    nodes: [
      { id: "sidan", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Om dig" } } },
      { id: "falt", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "sidan", order: 1, data: { title: { sv: "E-post" }, variableName: "epost" } },
      { id: "regeln", type: "rule", position: { x: 700, y: 0 }, data: { title: { sv: "Vägval" } } },
    ],
    connections: [],
  } as never;
  await settle();
  return editor;
}

const panel = (editor: GuideEditor) =>
  editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;

const select = (editor: GuideEditor, id: string) => {
  editor.shadowRoot!
    .querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!
    .selectNodeById(id);
};

describe("skylten mellan visas-om och regel", () => {
  test("fältets synlighetssektion säger 'på samma sida' och pekar mot Regel", async () => {
    const editor = await mounted();

    select(editor, "falt");
    await settle();

    const hint = panel(editor).querySelector<HTMLElement>(
      "[data-visibility-scope]",
    );

    expect(hint, "hjälpraden finns").toBeTruthy();
    expect(hint!.textContent).toContain("på samma sida");
    expect(hint!.textContent?.toLowerCase()).toContain("regel");
    expect(hint!.getAttribute("role")).toBeNull();
  });

  test("regelnodens panel pekar tillbaka mot visas om", async () => {
    const editor = await mounted();

    select(editor, "regeln");
    await settle();

    const hint = panel(editor).querySelector<HTMLElement>(
      "[data-rule-scope]",
    );

    expect(hint, "hjälpraden finns").toBeTruthy();
    expect(hint!.textContent?.toLowerCase()).toContain("visas om");
    expect(hint!.getAttribute("role")).toBeNull();
  });
});
