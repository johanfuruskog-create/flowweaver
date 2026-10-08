import { describe, expect, test } from "vitest";

import "../../viewer/node-types/default-node-types";

import { VIEWER_STRINGS } from "../../viewer/localization/built-in-strings";
import { EDITOR_STRINGS } from "./editor-strings";
import { getNodeTypes } from "../../viewer/node-types/node-type-registry";

/**
 * Swedish and English are complete. They are the two we maintain ourselves.
 *
 * Story 014 draws the line: a third editor language is the host's, registered
 * with `registerLocale`, and putting it in these files would quietly make it
 * ours to keep in step. These two are ours, and "ours" has to mean finished —
 * a key with only Swedish reads as Swedish in an English editor, which is the
 * fault we have now chased across four surfaces.
 *
 * `coverageOf` reports what a *registered* pack covers. Nothing reported what
 * *we* cover, so the answer was whatever the files happened to contain.
 */

const TABLES = [
  ["viewer", VIEWER_STRINGS],
  ["editor", EDITOR_STRINGS],
] as const;

/*
 * A key that was never written is invisible to a check that walks the table.
 *
 * `nodeType.annotation.label` and `nodeType.autocomplete-question.label` did
 * not exist, so `tOr` fell back to the registry's Swedish and the palette read
 * "Anteckning" in an English editor. Every test above passed: there was nothing
 * incomplete, only something absent.
 *
 * The registry is the list of what must exist. Reading it here means a node
 * type registered tomorrow is covered by being registered.
 */
describe("every node type has a name we can translate", () => {
  const types = getNodeTypes().map((entry) => entry.type);

  test("there are types to check, so an empty sweep cannot pass", () => {
    expect(types.length).toBeGreaterThan(10);
  });

  test("each one has a nodeType.<type>.label", () => {
    const missing = types.filter(
      (type) => !(`nodeType.${type}.label` in EDITOR_STRINGS),
    );

    expect(missing).toEqual([]);
  });
});

describe.each(TABLES)("%s strings", (_name, table) => {
  const entries = Object.entries(table);

  test("there are keys to check, so an empty table cannot pass", () => {
    expect(entries.length).toBeGreaterThan(40);
  });

  test.each(["sv", "en"] as const)("every key has %s", (locale) => {
    const missing = entries
      .filter(([, entry]) => !entry[locale]?.trim())
      .map(([key]) => key);

    expect(missing).toEqual([]);
  });

  /*
   * A translation identical to the source is usually a forgotten one. Some
   * genuinely are the same word in both languages, so they are listed rather
   * than allowed by a rule — a list someone has to add to is a list someone
   * has to think about.
   */
  test("no translation is a copy of the Swedish without a reason", () => {
    const SAME_ON_PURPOSE = new Set([
      "editor.nodeTemplates.base.multi-choice",
      // "Start" är samma ord på båda språken — fliken på startnodens axel.
      "editor.node.startBadge",
      /*
       * Two placeholders and a colon. Every word in it comes from elsewhere —
       * the action's own label and the version's name — so there is nothing
       * here to translate, and a Swedish and English copy of a colon would be
       * two places to keep in step for no gain.
       */
      "editor.versions.action",
      /*
       * *Version 4* — samma ord och samma siffra på båda språken. Det som
       * skiljer är var stora bokstäver hamnar i en mening, och det avgörs där
       * meningen byggs, inte här.
       */
      "editor.versions.numbered",
      // Story 084: ordet och numret kommer utifrån — *Barn 2* — inget att översätta.
      "repeat.legend",
    ]);

    const copies = entries
      .filter(([key, entry]) => entry.sv === entry.en && !SAME_ON_PURPOSE.has(key))
      // A word that is spelled the same in both is not a copy: "Page Builder",
      // "JSON", a lone "{n}". Letters are what carry a language.
      .filter(([, entry]) => /[a-zåäö]{4,}/i.test(entry.sv ?? ""))
      .filter(([, entry]) => !/^[A-Z][a-zA-Z ]+$/.test(entry.sv ?? ""))
      .map(([key, entry]) => `${key}: "${entry.sv}"`);

    expect(copies).toEqual([]);
  });

  test("a placeholder in one language is in the other", () => {
    const placeholders = (text: string): string[] =>
      [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();

    const mismatched = entries
      .filter(([, entry]) => {
        const sv = placeholders(entry.sv ?? "");
        const en = placeholders(entry.en ?? "");
        return sv.join(",") !== en.join(",");
      })
      .map(([key, entry]) => `${key}: "${entry.sv}" / "${entry.en}"`);

    expect(mismatched).toEqual([]);
  });
});
