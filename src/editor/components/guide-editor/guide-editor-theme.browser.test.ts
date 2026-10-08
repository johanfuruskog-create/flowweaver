import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";
import type { EditorToolbar } from "../editor-toolbar/editor-toolbar";

/**
 * The theme is the host's business.
 *
 * The library **applies** a theme — that is rendering, and we own it — but it
 * owns neither the control nor the memory. A toggle is the host's chrome, and
 * where the choice is saved is the host system's call (K6d).
 */

afterEach(() => {
  document.body.replaceChildren();
  delete document.documentElement.dataset.theme;
});

function montera(theme?: string): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.setAttribute("mode", "administrator");

  if (theme) {
    editor.setAttribute("theme", theme);
  }

  document.body.append(editor);
  editor.graph = {
    startNodeId: "n1",
    nodes: [
      { id: "n1", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart" } },
    ],
    connections: [],
  };
  return editor;
}

describe("setTheme", () => {
  test("sets the theme on the editor", () => {
    const editor = montera();

    editor.setTheme("dark");

    // Our own attribute, not `data-theme`: the latter is a convention the host
    // may use itself, and the tokens must not hang off their element.
    expect(editor.dataset.fwTheme).toBe("dark");
    expect(editor.dataset.theme).toBeUndefined();
    expect(editor.theme).toBe("dark");
  });

  // An editor embedded in a host's own page must not recolour the page around
  // it. Writing on the document would be the same kind of intrusion as writing
  // in the host's storage.
  test("and does not touch the document", () => {
    const editor = montera();

    editor.setTheme("dark");

    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  test("null hands the decision back to the OS setting", () => {
    const editor = montera("dark");
    expect(editor.theme).toBe("dark");

    editor.setTheme(null);

    expect(editor.dataset.fwTheme).toBeUndefined();
    expect(editor.theme).toBeNull();
  });

  test("the attribute works for a host that only writes HTML", () => {
    expect(montera("dark").theme).toBe("dark");
  });

  test("a junk value gives no theme at all", () => {
    expect(montera("neon").theme).toBeNull();
  });

  test("without a choice the document's theme is inherited", () => {
    document.documentElement.dataset.theme = "dark";
    const editor = montera();

    expect(editor.theme).toBeNull();
    expect(editor.dataset.fwTheme).toBeUndefined();
  });
});

describe("the control lives outside the editor", () => {
  // En växlare är värdens chrome. Editorn renderar guiden; hur värden låter
  // någon byta tema hör hemma i värdens eget gränssnitt.
  test("verktygsraden har ingen tema-knapp", () => {
    const editor = montera();
    const toolbar = editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");

    expect(
      toolbar?.shadowRoot?.querySelector('[data-action="toggle-theme"]')
    ).toBeNull();
  });

  test("temat lagras aldrig", () => {
    const editor = montera();

    editor.setTheme("dark");

    expect(localStorage.getItem("flowweaver:theme")).toBeNull();
  });

  // The theme is a view, not content — just like the mode.
  test("och hamnar aldrig i guiden", () => {
    const editor = montera("dark");

    expect(JSON.stringify(editor.getData())).not.toContain("dark");
  });
});

describe("the theme reaches every surface", () => {
  // Johan, 2 September 2026, from a phone in dark mode: the list view sat as
  // a light sheet with dark rows on it — inverted against everything around
  // it. Its background was a token nothing ever darkened. The list view lies
  // over the canvas, so it takes the canvas's colour, in either theme.
  test("the list view's background is the canvas's, in dark mode too", () => {
    const editor = montera("dark");
    const listView = editor.shadowRoot?.querySelector<HTMLElement>(".guide-editor__list-view");

    expect(listView).not.toBeNull();
    const style = getComputedStyle(listView!);
    const canvas = style.getPropertyValue("--fw-canvas").trim();

    expect(canvas).toBe("#0d1117");
    expect(style.backgroundColor).toBe("rgb(13, 17, 23)");
  });
});
