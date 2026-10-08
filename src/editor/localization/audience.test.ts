import { describe, expect, test } from "vitest";

import {
  VIEWER_STRINGS,
  builtInStrings,
  isViewerString,
} from "../../viewer/localization/built-in-strings";
import { EDITOR_STRINGS } from "./editor-strings";
// The editor's lookup: the same `t`, with the editor's words loaded. Editor
// keys resolve only through it — that is the point of the split.
import { customizableUiStrings, t } from "./editor-ui-strings";
import { uiText } from "../../viewer/core/ui-strings";

/**
 * Every built-in string has an audience, and the two cannot reach each other.
 *
 * Story 017. The rule the whole story reduces to:
 *
 *   Translating the *content* into a language must never require the *tool*
 *   to be translated into the same language.
 *
 * That only holds if the two sets are genuinely separate. Until now they were
 * one table resolved by one function, so "Arabic" meant a single thing to the
 * code: ask for Arabic buttons in the viewer and you had asked a question about
 * the whole editor.
 */

describe("every key has exactly one audience", () => {
  // The audience is which file the key sits in, so it cannot be omitted —
  // there is nowhere to define a key that lacks one.
  test("no key belongs to both", () => {
    const both = Object.keys(VIEWER_STRINGS).filter((key) =>
      Object.prototype.hasOwnProperty.call(EDITOR_STRINGS, key),
    );

    expect(both).toEqual([]);
  });

  test("the two together are the whole table", () => {
    expect(Object.keys(builtInStrings()).length).toBe(
      Object.keys(VIEWER_STRINGS).length + Object.keys(EDITOR_STRINGS).length,
    );
  });

  test("both sides are non-trivial, so a bad split fails loudly", () => {
    expect(Object.keys(VIEWER_STRINGS).length).toBeGreaterThan(40);
    expect(Object.keys(EDITOR_STRINGS).length).toBeGreaterThan(300);
  });

  // The tool's words. If any of these ever became overridable, a guide could
  // rename the palette.
  test.each(["editor.close", "nodeType.question.label", "port.continue"])(
    "%s is the tool's",
    (key) => {
      expect(isViewerString(key)).toBe(false);
    },
  );

  // The resident's words, in a published guide.
  test.each(["nav.next", "nav.previous", "field.chooseOption", "validation.required"])(
    "%s is the resident's",
    (key) => {
      expect(isViewerString(key)).toBe(true);
    },
  );
});

describe("the boundary holds both ways", () => {
  // Criterion 6. Both directions, because a guard that only blocks is as
  // wrong as one that only permits.
  test("a guide can change what a resident reads", () => {
    expect(
      uiText("nav.next", { "nav.next": { sv: "Till nästa fråga" } }, "sv"),
    ).toBe("Till nästa fråga");
  });

  test("a guide cannot rename a node type", () => {
    expect(
      uiText(
        "nodeType.question.label",
        { "nodeType.question.label": { sv: "Kaka" } },
        "sv",
      ),
    ).toBe(t("nodeType.question.label", "sv"));
  });

  test("a guide cannot touch the toolbar", () => {
    expect(
      uiText("editor.close", { "editor.close": { sv: "Kaka" } }, "sv"),
    ).toBe(t("editor.close", "sv"));
  });

  // The guard is on the key, not on the shape: a well-formed override of an
  // editor key is ignored just as firmly as a malformed one.
  test("a whole map of tool keys changes nothing", () => {
    const attack = Object.fromEntries(
      Object.keys(EDITOR_STRINGS)
        .slice(0, 20)
        .map((key) => [key, { sv: "Kaka" }]),
    );

    const changed = Object.keys(attack).filter(
      (key) => uiText(key, attack, "sv") !== t(key, "sv"),
    );

    expect(changed).toEqual([]);
  });
});

describe("the editor reaches everything a resident reads", () => {
  // Criterion 2. Three of fifty-five used to be reachable. A text a resident
  // sees but the editor cannot reach is a text nobody owns.
  test("every viewer key is offered", () => {
    expect(customizableUiStrings().map((item) => item.key).sort()).toEqual(
      Object.keys(VIEWER_STRINGS).sort(),
    );
  });

  test("no tool key is offered", () => {
    expect(
      customizableUiStrings().filter((item) => !isViewerString(item.key)),
    ).toEqual([]);
  });

  // Derived rather than hand-listed, so a new viewer key is reachable the day
  // it exists rather than the day someone remembers.
  test("the label is the Swedish source text", () => {
    const next = customizableUiStrings().find((item) => item.key === "nav.next");

    expect(next?.label).toBe("Nästa");
  });
});

describe("content translation demands nothing of the tool", () => {
  /*
   * Criterion 7, stated as a measurement.
   *
   * A guide translated into Arabic supplies its own viewer texts. Nothing in
   * that transaction asks whether Arabic exists for the editor — and it cannot,
   * because a guide's overrides are keyed against the viewer table alone.
   */
  const arabicGuide = {
    "nav.next": { ar: "التالي" },
    "nav.previous": { ar: "السابق" },
    "field.chooseOption": { ar: "اختر خياراً" },
  };

  test("the resident reads Arabic", () => {
    expect(uiText("nav.next", arabicGuide, "ar")).toBe("التالي");
  });

  test("the editor is untouched and still Swedish", () => {
    expect(t("editor.close", "sv")).toBe("Stäng");
    expect(uiText("editor.close", arabicGuide, "ar")).toBe(t("editor.close", "ar"));
  });

  // The tool falls back to its own source, not to the guide's language.
  test("an editor key in an unsupported locale falls back, it does not fail", () => {
    expect(t("editor.close", "ar")).toBe("Stäng");
  });
});
