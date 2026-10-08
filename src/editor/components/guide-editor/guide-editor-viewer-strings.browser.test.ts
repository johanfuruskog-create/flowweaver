import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import { registerLocale, unregisterLocale } from "../../../viewer/localization/registry";

import type { GuideEditor } from "./guide-editor";
import type { PropertiesPanel } from "../properties-panel/properties-panel";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * The administrator is told when the host has not registered viewer texts.
 *
 * Story 010, criterion 8. The guide can offer any language, but the viewer's
 * own buttons come from the host system. Without them the resident meets
 * Swedish buttons however well the content is translated — and no amount of
 * translating fixes it, so it belongs here rather than in the progress count.
 */

function graph(locales: string[]): GraphData {
  return {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Bor du i kommunen?" },
          variableName: "bor",
          options: [{ id: "ja", label: { sv: "Ja" }, value: "ja" }],
        },
      },
    ],
    connections: [],
    settings: { locales },
  };
}

afterEach(() => {
  document.body.replaceChildren();
  ["ar", "fi"].forEach(unregisterLocale);
});

function mount(data: GraphData): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1100px; height: 700px;";
  document.body.append(editor);
  editor.graph = data;
  return editor;
}

const panel = (editor: GuideEditor): ShadowRoot =>
  editor.shadowRoot?.querySelector<PropertiesPanel>("properties-panel")
    ?.shadowRoot as ShadowRoot;

const warnings = (editor: GuideEditor): string[] =>
  [...panel(editor).querySelectorAll(".properties-panel__locale-warning")].map(
    (element) => element.closest("[data-locale]")?.getAttribute("data-locale") ?? "",
  );

describe("the gap is named where it can be closed", () => {
  test("Swedish and English never warn — they ship with the package", () => {
    expect(warnings(mount(graph(["sv", "en"])))).toEqual([]);
  });

  test("a language the host has not registered is called out", () => {
    expect(warnings(mount(graph(["sv", "ar"])))).toEqual(["ar"]);
  });

  test("only the language that lacks texts is called out", () => {
    expect(warnings(mount(graph(["sv", "en", "ar", "fi"])))).toEqual(["ar", "fi"]);
  });

  test("registering the pack removes the warning", () => {
    registerLocale("ar", { "nav.next": "التالي" });

    expect(warnings(mount(graph(["sv", "ar"])))).toEqual([]);
  });

  test("the message says whose job it is", () => {
    const editor = mount(graph(["sv", "ar"]));
    const text =
      panel(editor).querySelector(".properties-panel__locale-warning")
        ?.textContent ?? "";

    expect(text).toContain("värdsystemet");
  });
});

describe("it is not the editor's debt", () => {
  // Criterion 7: the progress count measures the editor's content. A gap they
  // cannot close does not belong there.
  test("a missing pack does not change the translation progress", () => {
    const editor = mount(graph(["sv", "ar"]));
    const toolbar = editor.shadowRoot?.querySelector("editor-toolbar");
    const before = toolbar?.shadowRoot?.textContent;

    registerLocale("ar", { "nav.next": "التالي" });
    const after = mount(graph(["sv", "ar"])).shadowRoot?.querySelector(
      "editor-toolbar",
    )?.shadowRoot?.textContent;

    expect(after).toBe(before);
  });
});
