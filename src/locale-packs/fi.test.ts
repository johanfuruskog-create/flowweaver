import { describe, expect, test } from "vitest";

import { FINNISH_VIEWER_PACK } from "./fi";
import { VIEWER_STRINGS } from "../viewer/localization/built-in-strings";

/**
 * The complete pack has to stay complete.
 *
 * The language example makes a claim with numbers in it — *fifty of fifty, the
 * whole surface a resident meets* — and the page reads the numbers from the
 * running code, so it would happily report 49 of 50 in the same confident tone.
 * A key added to the viewer with no Finnish behind it has to fail in a test,
 * where it is one line to fix, rather than on a page teaching what
 * completeness is.
 *
 * The partial case is demonstrated too, in Arabic. The difference between them
 * is the lesson, so neither may drift into the other.
 *
 * Same keys as the viewer, no extra ones, and the same placeholders are held
 * for every pack by `src/gates/locale-packs-mirror-viewer.test.ts`. What stays
 * here is what only Finnish needs.
 */

describe("the Finnish viewer pack", () => {
  test("there are keys to check, so an empty table cannot pass", () => {
    expect(Object.keys(VIEWER_STRINGS).length).toBeGreaterThan(40);
  });

  // Untranslated is a likelier state than mistranslated, and it hides: the text
  // is there, the count says fifty, and a resident reads Swedish buttons.
  test("is not the Swedish or English text copied across", () => {
    const copied = Object.entries(FINNISH_VIEWER_PACK)
      .filter(([key, text]) => {
        const entry = (VIEWER_STRINGS as Record<string, Record<string, string>>)[key];
        return text === entry?.sv || text === entry?.en;
      })
      // Placeholders and a space — `{word} {n}` — carry no language to copy.
      // Letters are what a translation changes, and a placeholder's name is
      // not a word the reader sees.
      .filter(([, text]) => /[a-zåäö]{4,}/i.test(text.replace(/\{\w+\}/g, "")))
      .map(([key]) => key);

    expect(copied).toEqual([]);
  });
});
