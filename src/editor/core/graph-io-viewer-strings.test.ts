import { describe, expect, test } from "vitest";

import "../../viewer/node-types/default-node-types";

import { exportGraphJson, importGraphJson } from "./graph-io";
import { t, uiText } from "../../viewer/core/ui-strings";

/**
 * `settings.strings` carries the guide's wording for texts a **resident** reads.
 *
 * Story 017, criteria 3 and 4. A key belonging to the tool has no meaning here,
 * and `uiText` already refuses to honour one — but refusing is not the same as
 * discarding. The key arrived with the guide and stays exactly where it was.
 *
 * The alternative would be to delete it, and that is the exact failure K6b
 * exists to prevent: a host puts something in the guide and the first editor to
 * open and save erases it without a word.
 *
 * Moving it to `settings.extra` was tried first and is worse: export writes
 * `extra` back at the settings level, so a nested `strings` there overwrites
 * the real one on the way out. The door's job is to lose nothing; deciding what
 * counts is the lookup's.
 */

function roundTrip(strings: Record<string, unknown>): Record<string, unknown> {
  const file = JSON.stringify({
    startNodeId: null,
    nodes: [],
    connections: [],
    settings: { strings },
  });
  const result = importGraphJson(file);
  if (!result.success) {
    throw new Error(`import failed: ${result.errors.join(", ")}`);
  }
  const out = exportGraphJson(result.graph);
  if (!out.success) {
    throw new Error(`export failed: ${out.errors.join(", ")}`);
  }
  return JSON.parse(out.json) as Record<string, unknown>;
}

const settingsOf = (file: Record<string, unknown>): Record<string, unknown> =>
  (file.settings ?? {}) as Record<string, unknown>;

describe("what the guide may override", () => {
  test("a viewer key survives the round trip", () => {
    const settings = settingsOf(roundTrip({ "nav.next": { ar: "التالي" } }));

    expect(settings.strings).toEqual({ "nav.next": { ar: "التالي" } });
  });

  // K6b. Refusing to honour a key is right; deleting it is the fault the
  // requirement exists to prevent. Leaving it is the cheapest way to keep it,
  // and `uiText` already makes it inert.
  test("a tool key survives too, untouched", () => {
    const settings = settingsOf(roundTrip({ "editor.close": { sv: "Kaka" } }));

    expect(settings.strings).toEqual({ "editor.close": { sv: "Kaka" } });
  });

  test("a mixed map keeps both", () => {
    const settings = settingsOf(
      roundTrip({
        "nav.next": { ar: "التالي" },
        "nodeType.question.label": { sv: "Kaka" },
      }),
    );

    expect(settings.strings).toEqual({
      "nav.next": { ar: "التالي" },
      "nodeType.question.label": { sv: "Kaka" },
    });
  });
});

describe("but only viewer keys do anything", () => {
  // The boundary is enforced at lookup, not at the door. That is deliberate:
  // the door's job is to lose nothing, and the lookup's job is to decide.
  test("the tool key that survived changes nothing", () => {
    expect(
      uiText("editor.close", { "editor.close": { sv: "Kaka" } }, "sv"),
    ).toBe(t("editor.close", "sv"));
  });

  test("while the viewer key beside it does", () => {
    expect(uiText("nav.next", { "nav.next": { sv: "Vidare" } }, "sv")).toBe(
      "Vidare",
    );
  });
});

describe("junk is still junk", () => {
  // Preserving is for keys we do not recognise, not for values that are not
  // texts at all. Those never had a meaning to lose.
  test("a non-text value is dropped", () => {
    const settings = settingsOf(
      roundTrip({ "nav.next": 42 as unknown as string }),
    );

    expect(settings.strings).toEqual({});
  });
});
