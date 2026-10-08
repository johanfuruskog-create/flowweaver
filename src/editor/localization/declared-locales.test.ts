import { afterEach, describe, expect, test } from "vitest";

import {
  clearDeclaredLocales,
  coverageOf,
  declareLocales,
  declaredDefaultLocale,
  declaredLocales,
  registerLocale,
  unregisterLocale,
} from "../../viewer/localization/registry";
// The editor lookup, so the editor side of the coverage has a table to count.
import "./editor-ui-strings";
import { VIEWER_STRINGS } from "../../viewer/localization/built-in-strings";
import { EDITOR_STRINGS } from "./editor-strings";

/**
 * The third axis — story 014.
 *
 * Language codes are the host's responsibility: they know their organisation's
 * languages and we do not. Until they say so there is no list, and the editor
 * keeps the free-text field it has always had, because the package must work
 * when the host does nothing at all.
 *
 * Declaring is therefore a decision the host takes, not a restriction we
 * impose. And it is governance over the *codes*, not over the texts — a
 * translator still supplies the viewer's texts in the guide itself (story 017).
 */

afterEach(() => {
  clearDeclaredLocales();
  ["fi", "ar"].forEach(unregisterLocale);
});

describe("until the host speaks", () => {
  // Criterion 7. A municipality that needs Somali must not be blocked because
  // nobody called declareLocales.
  test("there is no list", () => {
    expect(declaredLocales()).toBeNull();
  });

  test("and no default of ours", () => {
    expect(declaredDefaultLocale()).toBeNull();
  });

  // null is "no decision taken", which is a different thing from an empty
  // list — it is what keeps the free-text field alive.
  test("an empty declaration is the same as none", () => {
    declareLocales([]);

    expect(declaredLocales()).toBeNull();
  });
});

describe("once they have", () => {
  test("the list is theirs", () => {
    declareLocales(["sv", "en", "ar"]);

    expect(declaredLocales()).toEqual(["sv", "en", "ar"]);
  });

  test("the codes are normalised, so sv-se and sv-SE are one language", () => {
    declareLocales(["sv-se", "AR"]);

    expect(declaredLocales()).toEqual(["sv-SE", "ar"]);
  });

  test("the default is the one they named", () => {
    declareLocales(["sv", "fi"], { default: "fi" });

    expect(declaredDefaultLocale()).toBe("fi");
  });

  // A default outside the list would be a state nobody could act on.
  test("a default outside the list falls back to the first", () => {
    declareLocales(["sv", "fi"], { default: "de" });

    expect(declaredDefaultLocale()).toBe("sv");
  });

  test("without a named default the first entry is it", () => {
    declareLocales(["fi", "sv"]);

    expect(declaredDefaultLocale()).toBe("fi");
  });

  test("declaring again replaces rather than merges", () => {
    declareLocales(["sv", "en"]);
    declareLocales(["ar"]);

    expect(declaredLocales()).toEqual(["ar"]);
  });
});

describe("coverage is reported, not enforced", () => {
  /*
   * Criterion 8. A completeness rule looks tempting — translate everything or
   * the language does not run — but we add keys in every version, so every
   * host's pack would become incomplete the moment they upgrade and their
   * Finnish editor would vanish for a change they did not make. See story 013.
   */
  test("a language we ship is complete on both sides", () => {
    const coverage = coverageOf("en");

    expect({
      viewer: coverage.viewer.missing.length,
      editor: coverage.editor.missing.length,
    }).toEqual({ viewer: 0, editor: 0 });
  });

  test("a language nobody supplied is empty on both sides", () => {
    const coverage = coverageOf("ar");

    expect({
      viewer: coverage.viewer.filled,
      editor: coverage.editor.filled,
      viewerTotal: coverage.viewer.total,
      editorTotal: coverage.editor.total,
    }).toEqual({
      viewer: 0,
      editor: 0,
      viewerTotal: Object.keys(VIEWER_STRINGS).length,
      editorTotal: Object.keys(EDITOR_STRINGS).length,
    });
  });

  test("registering reports what the pack covers", () => {
    const coverage = registerLocale("ar", { "nav.next": "التالي" });

    expect(coverage.viewer.filled).toBe(1);
    expect(coverage.viewer.missing).not.toContain("nav.next");
  });

  // The two audiences are independent obligations: a viewer pack says nothing
  // about the editor, and asking for one must not imply the other. Story 017.
  test("a viewer pack leaves the editor's side untouched", () => {
    const coverage = registerLocale("ar", { "nav.next": "التالي" });

    expect(coverage.editor.filled).toBe(0);
  });

  test("an editor pack leaves the viewer's side untouched", () => {
    const coverage = registerLocale("fi", { "editor.close": "Sulje" });

    expect({ editor: coverage.editor.filled, viewer: coverage.viewer.filled }).toEqual(
      { editor: 1, viewer: 0 },
    );
  });

  // The point of criterion 8: an incomplete pack still runs.
  test("a partial pack is still registered and still used", () => {
    registerLocale("fi", { "editor.close": "Sulje" });

    expect(coverageOf("fi").editor.filled).toBe(1);
    expect(coverageOf("fi").editor.missing.length).toBeGreaterThan(0);
  });
});

describe("none of this is stored in a guide", () => {
  // Criterion 9. The offer is the host's setup, like the mode and the theme.
  test("declaring touches no graph", () => {
    const graph = { settings: { locales: ["sv"] } };
    const before = JSON.stringify(graph);

    declareLocales(["sv", "ar"], { default: "ar" });

    expect(JSON.stringify(graph)).toBe(before);
  });
});
