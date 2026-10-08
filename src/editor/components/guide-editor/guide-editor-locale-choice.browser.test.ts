import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Choosing a language should be a choice, not something you end up in.
 *
 * Criteria 5-7 in `docs/STORIES/008-vilket-sprak-ar-guiden-skriven-pa.md`. A
 * dropdown used to silently change what you were writing in, and a translator
 * was met with *"choose a language in the toolbar to start translating"*.
 */

function graf(sourceLocale?: string): GraphData {
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
    settings: {
      locales: ["sv", "en", "fi"],
      ...(sourceLocale ? { sourceLocale } : {}),
    },
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

function montera(attribut: Record<string, string> = {}, data = graf()): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.setAttribute("mode", "administrator");
  Object.entries(attribut).forEach(([namn, värde]) => editor.setAttribute(namn, värde));
  editor.style.cssText = "display: block; width: 1100px; height: 700px;";
  document.body.append(editor);
  editor.graph = data;
  return editor;
}

const etikett = (editor: GuideEditor): string =>
  editor.shadowRoot?.querySelector("[data-locale-label]")?.textContent?.trim() ?? "";

function chooseLanguage(editor: GuideEditor, locale: string): void {
  editor.shadowRoot?.dispatchEvent(
    new CustomEvent("locale-change", {
      detail: { locale },
      bubbles: true,
      composed: true,
    }),
  );
}

describe("the control says what the choice means", () => {
  // "Redigerar källan" until 3/9: *källan* was our word for the guide's own
  // language, and nobody meets it before they know a guide can be translated.
  // What you are doing, in plain words — and the pair with "Översätter till"
  // says which of the two modes you are in (Johan's choice, bedömningen K).
  test("the source: you are writing in it", () => {
    expect(etikett(montera())).toBe("Skriver på");
  });

  // It used to say only "Språk", and then you silently changed what you were
  // writing in.
  //
  // Finnish, not English: the language choice also drives the editor's chrome,
  // and the chrome exists only in Swedish and English. Finnish falls back to
  // Swedish, so the label is tested without being confused with that.
  test("another language: you are translating", () => {
    const editor = montera();

    chooseLanguage(editor, "fi");

    expect(etikett(editor)).toBe("Översätter till");
  });

  // Story 014, criterion 1. The label is the editor's own text, so it stays in
  // the editor's language however the content language moves. Choosing English
  // as the content language used to switch the whole tool to English — this is
  // the assertion that used to say so.
  test("choosing a chrome language leaves the editor's own texts alone", () => {
    const editor = montera();

    chooseLanguage(editor, "en");

    expect(etikett(editor)).toBe("Översätter till");
  });

  test("och tillbaka igen", () => {
    const editor = montera();

    chooseLanguage(editor, "fi");
    chooseLanguage(editor, "sv");

    expect(etikett(editor)).toBe("Skriver på");
  });

  // The source is the guide's, not a constant: in a Finnish guide, Finnish is
  // what you author in and Swedish is a translation.
  test("the source is the guide's own", () => {
    const editor = montera({}, graf("fi"));

    expect(etikett(editor)).toBe("Skriver på");

    chooseLanguage(editor, "sv");

    expect(etikett(editor)).toBe("Översätter till");
  });
});

describe("var editorn landar", () => {
  test("an editor lands in the source — that is where you author", () => {
    expect(montera().contentLocale).toBe("sv");
  });

  test("en finsk guide landar i finska", () => {
    expect(montera({}, graf("fi")).contentLocale).toBe("fi");
  });

  // Choosing is no task for someone invited precisely in order to translate.
  test("a translator lands in the first language that is not the source", () => {
    expect(montera({ mode: "translator" }).contentLocale).toBe("en");
  });

  test("the host can name the starting language", () => {
    expect(montera({ "active-locale": "fi" }).contentLocale).toBe("fi");
  });

  test("and that holds for a translator too", () => {
    expect(
      montera({ mode: "translator", "active-locale": "fi" }).contentLocale,
    ).toBe("fi");
  });

  test("a language the guide does not have is ignored", () => {
    expect(montera({ "active-locale": "de" }).contentLocale).toBe("sv");
  });

  // The starting language is a view, not data. See K12c.
  test("the starting language never lands in the guide", () => {
    const editor = montera({ "active-locale": "fi" });

    expect(JSON.stringify(editor.getData())).not.toContain("active-locale");
    expect(editor.getData().settings?.sourceLocale).toBeUndefined();
  });

  // A guide with only the source language has nothing to translate into.
  test("a translator with no other languages stays in the source", () => {
    const editor = montera(
      { mode: "translator" },
      { ...graf(), settings: { locales: ["sv"] } },
    );

    expect(editor.contentLocale).toBe("sv");
  });
});

/*
 * The picker is a field like the panel's selects (Astra via Johan 29/9; left
 * outside that round and done 29/9): the drawn chevron on a wrapper, filled
 * from `--fw-text-secondary` so a host overriding the token on the element
 * moves the arrow with it — see `src/editor/styles/_select.scss`.
 */
describe("the picker's shape", () => {
  test("wrapper with a masked chevron, field height, normal weight, room for the arrow", async () => {
    const editor = montera();

    await new Promise((resolve) => requestAnimationFrame(resolve));
    const select = editor.shadowRoot!.querySelector<HTMLSelectElement>("[data-locale-select]")!;
    const wrap = select.parentElement!;
    const style = getComputedStyle(select);
    const arrow = getComputedStyle(wrap, "::after");
    const height = select.getBoundingClientRect().height;

    expect(wrap.classList.contains("guide-editor__locale-select"), "wrapper").toBe(true);
    expect(style.appearance, "the platform arrow is off").toBe("none");
    expect(arrow.maskImage, "a drawn SVG chevron as a mask").toContain("svg");
    expect(arrow.pointerEvents).toBe("none");
    expect(Math.abs(wrap.getBoundingClientRect().height - height), "the wrapper adds nothing").toBeLessThanOrEqual(1);
    expect(height, "the fields' height").toBeGreaterThanOrEqual(44);
    expect(height).toBeLessThanOrEqual(48);
    expect(Number.parseFloat(style.paddingRight), "text never meets the arrow").toBeGreaterThanOrEqual(36);
    expect(style.fontWeight).toBe("400");

    const probe = document.createElement("span");

    editor.append(probe);
    editor.style.setProperty("--fw-text-secondary", "rgb(200, 30, 30)");
    expect(getComputedStyle(wrap, "::after").backgroundColor, "follows a local override").toBe("rgb(200, 30, 30)");
  });
});
