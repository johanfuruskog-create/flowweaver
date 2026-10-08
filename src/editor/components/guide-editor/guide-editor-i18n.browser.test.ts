import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";

afterEach(() => {
  document.body.replaceChildren();
});

function mount(locale?: string): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  // Opt in: the default is readonly, and this test builds.
  editor.setAttribute("mode", "administrator");
  if (locale) editor.setAttribute("editor-locale", locale);
  document.body.append(editor);
  editor.graph = {
    startNodeId: "n",
    nodes: [{ id: "n", type: "result", position: { x: 80, y: 80 }, data: { title: "Klart" } }],
    connections: [],
  };
  return editor;
}

describe("guide-editor – editor-locale ger engelsk chrome", () => {
  test("the shell, the toolbar and the palette in English", () => {
    const editor = mount("en");
    const shadow = editor.shadowRoot!;

    // Skalets flikar
    const tabs = Array.from(
      shadow.querySelectorAll("[data-sidebar-mode]")
    ).map((el) => el.textContent?.trim());
    expect(tabs).toContain("Properties");
    expect(tabs).toContain("Preview");

    // Verktygsfältets menyer
    const toolbar = shadow.querySelector("editor-toolbar")?.shadowRoot;
    expect(toolbar?.textContent).toContain("File");
    expect(toolbar?.textContent).toContain("Edit");

    // Paletten – chrome (panelens aria-namn + grupprubrik) + nodtypernas namn
    const palette = shadow.querySelector("node-palette")?.shadowRoot;
    expect(palette?.querySelector(".node-palette__full")?.getAttribute("aria-label")).toBe("Add node");
    expect(palette?.textContent).toContain("Content");
    expect(palette?.textContent).toContain("Question");
    expect(palette?.textContent).toContain("Result");
    expect(palette?.textContent).not.toContain("Fråga");

    // Egenskapspanelens tomläge (ingen nod markerad)
    const properties = shadow.querySelector("properties-panel")?.shadowRoot;
    expect(properties?.textContent).toContain("Select a node to edit it.");
  });

  test("svenska som standard (inget attribut)", () => {
    const editor = mount();
    const shadow = editor.shadowRoot!;
    const tabs = Array.from(
      shadow.querySelectorAll("[data-sidebar-mode]")
    ).map((el) => el.textContent?.trim());
    expect(tabs).toContain("Egenskaper");
    const palette = shadow.querySelector("node-palette")?.shadowRoot;
    expect(palette?.querySelector(".node-palette__full")?.getAttribute("aria-label")).toBe("Lägg till nod");
    expect(palette?.textContent).toContain("Innehåll");
    // Nodtypernas namn på svenska (källtext)
    expect(palette?.textContent).toContain("Fråga");
    expect(palette?.textContent).toContain("Resultat");
  });

  test("changing the attribute live switches language", () => {
    const editor = mount();
    editor.setAttribute("editor-locale", "en");
    const palette = editor.shadowRoot?.querySelector("node-palette")?.shadowRoot;
    expect(palette?.querySelector(".node-palette__full")?.getAttribute("aria-label")).toBe("Add node");
  });

  /*
   * Story 014, criterion 1. This used to assert the opposite, and the
   * opposite was the bug: a translator switching to English to translate the
   * *content* got English buttons, panel and palette. The tool changed language
   * under the hands of someone who asked for something else.
   */
  test("the toolbar's language picker leaves the editor's chrome alone", () => {
    const editor = mount();
    const palette = () =>
      editor.shadowRoot?.querySelector("node-palette")?.shadowRoot?.textContent ?? "";
    const before = palette();

    // The toolbar's locale-change is the *content* language.
    editor.shadowRoot
      ?.querySelector("editor-toolbar")
      ?.dispatchEvent(
        new CustomEvent("locale-change", {
          detail: { locale: "en" },
          bubbles: true,
          composed: true,
        })
      );

    expect(palette()).toBe(before);
    expect(palette()).toContain("Fråga");
  });

  test("the editor's language is the host's to set, and it still works", () => {
    const editor = mount();
    editor.setAttribute("editor-locale", "en");

    const palette = editor.shadowRoot?.querySelector("node-palette")?.shadowRoot;

    expect(palette?.textContent).toContain("Question");
  });

  /*
   * Switching the tool's language re-renders the toolbar, which builds a fresh
   * language picker with nothing selected. The content locale survived that by
   * accident while the axes were coupled — the one caller set both and
   * re-synced right after. Uncoupling them broke it, and it was found by
   * driving both controls in a browser rather than by a test.
   */
  test("switching the tool's language keeps the content language", () => {
    const editor = mount();

    editor.shadowRoot
      ?.querySelector("editor-toolbar")
      ?.dispatchEvent(
        new CustomEvent("locale-change", {
          detail: { locale: "en" },
          bubbles: true,
          composed: true,
        })
      );
    editor.setAttribute("editor-locale", "en");

    expect({
      content: editor.shadowRoot?.querySelector<HTMLSelectElement>(
        "[data-locale-select]"
      )?.value,
      label: editor.shadowRoot
        ?.querySelector("[data-locale-label]")
        ?.textContent?.trim(),
    }).toEqual({ content: "en", label: "Translating into" });
  });
});
