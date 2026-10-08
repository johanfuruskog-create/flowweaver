import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";
import type { GraphData } from "../../../viewer/types/graph";

afterEach(() => {
  document.body.replaceChildren();
});

/** Three questions. Only the first is translated into English. */
function graf(): GraphData {
  return {
    startNodeId: "q1",
    nodes: [
      {
        id: "q1",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Första", en: "First" },
          variableName: "a",
          options: [{ id: "ja1", label: { sv: "Ja", en: "Yes" }, value: "ja" }],
        },
      },
      {
        id: "q2",
        type: "question",
        position: { x: 400, y: 0 },
        data: {
          title: { sv: "Andra" },
          variableName: "b",
          options: [{ id: "ja2", label: { sv: "Ja" }, value: "ja" }],
        },
      },
      {
        id: "q3",
        type: "question",
        position: { x: 800, y: 0 },
        data: {
          title: { sv: "Tredje" },
          variableName: "c",
          options: [{ id: "ja3", label: { sv: "Ja" }, value: "ja" }],
        },
      },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q1", portId: "ja1" }, to: { nodeId: "q2", portId: "input" } },
      { id: "c2", from: { nodeId: "q2", portId: "ja2" }, to: { nodeId: "q3", portId: "input" } },
    ],
  };
}

function montera(mode?: string): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  // Opt in: the default is readonly, and this test builds.
  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1100px; height: 700px;";

  if (mode) {
    editor.setAttribute("mode", mode);
  }

  document.body.append(editor);
  editor.graph = graf();
  return editor;
}

const knapp = (editor: GuideEditor): HTMLButtonElement | null =>
  editor.shadowRoot?.querySelector<HTMLButtonElement>(
    '[data-action="next-untranslated"]',
  ) ?? null;

/** Switches language the way the app does it. */
function chooseLanguage(editor: GuideEditor, locale: string): void {
  editor.shadowRoot?.dispatchEvent(
    new CustomEvent("locale-change", {
      detail: { locale },
      bubbles: true,
      composed: true,
    }),
  );
}

function markerad(editor: GuideEditor): string | null {
  const canvas = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  const nod = [
    ...(canvas?.shadowRoot?.querySelectorAll("flow-node") ?? []),
  ].find((kandidat) =>
    kandidat.shadowRoot?.querySelector(".flow-node[data-selected]"),
  );

  return (nod as { nodeData?: { id: string } })?.nodeData?.id ?? null;
}

describe("the jump to the next untranslated", () => {
  // The aid belongs to the language choice, not to a mode.
  test("is not shown in the source language", () => {
    const editor = montera();

    expect(knapp(editor)?.hidden).toBe(true);
  });

  test("is shown once another language is chosen and something remains", () => {
    const editor = montera();

    chooseLanguage(editor, "en");

    expect(knapp(editor)?.hidden).toBe(false);
  });

  // Whoever translates their own guide needs it as much as someone hired in.
  test("exists in both edit and translator", () => {
    for (const mode of [undefined, "translator"]) {
      const editor = montera(mode);
      chooseLanguage(editor, "en");

      expect(knapp(editor)?.hidden, `läge: ${mode ?? "edit"}`).toBe(false);

      document.body.replaceChildren();
    }
  });

  test("goes to the first untranslated node", () => {
    const editor = montera();
    chooseLanguage(editor, "en");

    knapp(editor)?.click();

    expect(markerad(editor)).toBe("q2");
  });

  // En översättare betar av dem i tur och ordning.
  test("moves on to the next on the second press", () => {
    const editor = montera();
    chooseLanguage(editor, "en");

    knapp(editor)?.click();
    knapp(editor)?.click();

    expect(markerad(editor)).toBe("q3");
  });

  test("starts over after the last", () => {
    const editor = montera();
    chooseLanguage(editor, "en");

    knapp(editor)?.click();
    knapp(editor)?.click();
    knapp(editor)?.click();

    expect(markerad(editor)).toBe("q2");
  });

  // If you select a node further along yourself, the jump should wrap around and
  // take the ones before it rather than continue forward and leave them
  // behind.
  test("wraps around from a node you selected yourself", () => {
    const editor = montera();
    chooseLanguage(editor, "en");

    // q3 is the *last* untranslated one. q2 comes before it and is untranslated too.
    editor.shadowRoot
      ?.querySelector<NodeEditor>("node-editor")
      ?.selectNodeById("q3");

    knapp(editor)?.click();

    expect(markerad(editor)).toBe("q2");
  });

  test("a selected node that is translated starts from the first untranslated", () => {
    const editor = montera();
    chooseLanguage(editor, "en");

    // q1 is translated and is not in the list at all.
    editor.shadowRoot
      ?.querySelector<NodeEditor>("node-editor")
      ?.selectNodeById("q1");

    knapp(editor)?.click();

    expect(markerad(editor)).toBe("q2");
  });

  // A button that does nothing is worse than no button.
  test("disappears when everything is translated", () => {
    const editor = montera();

    const allt = graf();
    allt.nodes.forEach((node) => {
      node.data.title = { sv: "x", en: "x" };
      (node.data.options as Array<{ label: unknown }>).forEach((option) => {
        option.label = { sv: "Ja", en: "Yes" };
      });
    });
    editor.graph = allt;

    chooseLanguage(editor, "en");

    expect(knapp(editor)?.hidden).toBe(true);
  });

  test("the label says how many remain", () => {
    const editor = montera();

    chooseLanguage(editor, "en");

    expect(knapp(editor)?.getAttribute("aria-label")).toContain("2");
  });
});
