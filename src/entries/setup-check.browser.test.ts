import { afterEach, describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";
import "../editor/components/guide-editor/guide-editor";
import "../viewer/components/guide-preview/guide-preview";

import { checkSetup } from "./setup-check";
import {
  clearDeclaredLocales,
  declareLocales,
  registerLocale,
  unregisterLocale,
} from "../viewer/localization/registry";
import { VIEWER_STRINGS } from "../viewer/localization/built-in-strings";

import type { CheckableElement } from "./setup-check";
import type { GraphData } from "../viewer/types/graph";

/**
 * The setup check — story 016.
 *
 * Every setup fault this project has had was silent, because the library stores
 * nothing and capability is opt in: a locked editor and a forgotten attribute
 * look exactly alike. The check is the host's way to ask.
 *
 * Half of these tests are about what it refuses to say. A check that warns
 * about what it cannot know becomes noise, and noise gets switched off — at
 * which point it is worse than not having one.
 */

function graph(locales: string[] = ["sv"]): GraphData {
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
  clearDeclaredLocales();
  ["ar", "fi"].forEach(unregisterLocale);
});

function mount(
  tag: "guide-editor" | "guide-preview",
  attributes: Record<string, string> = {},
  data?: GraphData,
): CheckableElement {
  const element = document.createElement(tag) as CheckableElement;
  Object.entries(attributes).forEach(([name, value]) =>
    element.setAttribute(name, value),
  );
  element.style.cssText = "display: block; width: 900px; height: 600px;";
  document.body.append(element);
  if (data) {
    element.graph = data;
  }
  return element;
}

const ids = (element: CheckableElement): string[] =>
  checkSetup(element).findings.map((finding) => finding.id);

describe("a setup that was done", () => {
  // Criterion 6: a silent answer has to mean right, or the check moves the
  // fault from silent to denied.
  test("says nothing", () => {
    const report = checkSetup(mount("guide-editor", { mode: "edit" }, graph()));

    expect(report).toEqual({ ok: true, findings: [] });
  });

  test("and the viewer needs no mode at all", () => {
    expect(checkSetup(mount("guide-preview", {}, graph())).ok).toBe(true);
  });
});

describe("capability is opt in, which is why it needs saying", () => {
  // The correct default and a forgotten attribute look identical. That is the
  // whole reason this finding exists.
  test("a missing mode is reported", () => {
    expect(ids(mount("guide-editor", {}, graph()))).toContain("mode-not-set");
  });

  test("and the consequence is stated, not just the name", () => {
    const finding = checkSetup(mount("guide-editor", {}, graph())).findings.find(
      (item) => item.id === "mode-not-set",
    );

    expect(finding?.consequence).toContain("Nothing in the guide can be changed");
  });

  test("it is a warning, because it is also the intended default", () => {
    const finding = checkSetup(mount("guide-editor", {}, graph())).findings.find(
      (item) => item.id === "mode-not-set",
    );

    expect(finding?.severity).toBe("warning");
  });
});

describe("languages the host has not set up", () => {
  test("a language with no texts anywhere is reported", () => {
    const element = mount("guide-editor", { mode: "edit" }, graph(["sv", "ar"]));

    expect(ids(element)).toContain("viewer-texts-missing:ar");
  });

  test("the count says how far off it is", () => {
    const element = mount("guide-editor", { mode: "edit" }, graph(["sv", "ar"]));
    const finding = checkSetup(element).findings.find((item) =>
      item.id.startsWith("viewer-texts-missing"),
    );

    expect(finding?.what).toContain(String(Object.keys(VIEWER_STRINGS).length));
  });

  // Story 017: the translator can fill them in the guide, so a host pack is one
  // of two ways rather than the only one. Either satisfies the check.
  test("a host pack settles it", () => {
    registerLocale(
      "ar",
      Object.fromEntries(Object.keys(VIEWER_STRINGS).map((key) => [key, "x"])),
    );
    const element = mount("guide-editor", { mode: "edit" }, graph(["sv", "ar"]));

    expect(ids(element)).not.toContain("viewer-texts-missing:ar");
  });

  test("and so does the guide's own text", () => {
    const own = graph(["sv", "ar"]);
    own.settings = {
      ...own.settings,
      strings: Object.fromEntries(
        Object.keys(VIEWER_STRINGS).map((key) => [key, { ar: "x" }]),
      ),
    };
    const element = mount("guide-editor", { mode: "edit" }, own);

    expect(ids(element)).not.toContain("viewer-texts-missing:ar");
  });

  // The source is what the guide is written in; there is nothing to translate.
  test("the source language is never reported", () => {
    const element = mount("guide-editor", { mode: "edit" }, graph(["sv"]));

    expect(ids(element)).toEqual([]);
  });
});

describe("a guide offering a language outside the declared list", () => {
  test("is reported once the host has declared one", () => {
    declareLocales(["sv", "en"]);
    const element = mount("guide-editor", { mode: "edit" }, graph(["sv", "fi"]));

    expect(ids(element)).toContain("locale-not-declared");
  });

  // No declaration means no decision taken, and a check that scolds a host for
  // a decision they have not made is the noise this must not become.
  test("and is silent until then", () => {
    const element = mount("guide-editor", { mode: "edit" }, graph(["sv", "en"]));

    expect(ids(element)).not.toContain("locale-not-declared");
  });
});

describe("what it refuses to say", () => {
  /*
   * `getEventListeners` is a devtools API and does not exist to a page, so a
   * missing graph-changed listener is genuinely invisible. Story 016's own
   * table claimed we could see it; we cannot, and pretending otherwise would
   * mean warning every host who wired their save correctly.
   */
  test("nothing about listeners, on an element with none", () => {
    const element = mount("guide-editor", { mode: "edit" }, graph());

    expect(checkSetup(element).findings).toEqual([]);
  });

  test("nothing about whether the mode is the right one", () => {
    const element = mount("guide-editor", { mode: "readonly" }, graph());

    expect(checkSetup(element).findings).toEqual([]);
  });

  // An element with no graph is a page that has not loaded one yet, which is a
  // normal moment rather than a fault.
  test("nothing about a graph that is not set yet", () => {
    expect(ids(mount("guide-editor", { mode: "edit" }))).toEqual([]);
  });
});

describe("the check can fail", () => {
  // A check that is green for a setup missing something is worse than none: it
  // moves the fault from silent to denied. These prove it is not vacuous.
  test("a bare editor is not silently approved", () => {
    expect(checkSetup(mount("guide-editor")).ok).toBe(false);
  });

  test("every finding carries both halves", () => {
    declareLocales(["sv"]);
    const report = checkSetup(mount("guide-editor", {}, graph(["sv", "ar"])));

    expect(report.findings.length).toBeGreaterThan(1);
    for (const finding of report.findings) {
      expect(finding.what.length).toBeGreaterThan(10);
      expect(finding.consequence.length).toBeGreaterThan(10);
    }
  });
});
