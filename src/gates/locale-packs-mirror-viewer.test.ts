import { describe, expect, test } from "vitest";

import { VIEWER_STRINGS } from "../viewer/localization/viewer-strings";

/**
 * Every language pack mirrors the viewer's key list — no more, no fewer.
 *
 * A pack is a file a host would write: one object from viewer key to text.
 * When the viewer gains a key (`choice.left` and `choice.matches` on 29/9),
 * each pack has to gain it too, or a visitor in that language meets the
 * fallback text in the middle of a translated page. The other direction is
 * just as quiet: a key the viewer no longer has — or a misspelt one — is text
 * nobody reads, counted as coverage of something that is not there.
 *
 * The packs are globbed rather than listed, so a new language is held to this
 * the moment its file exists. Tests under `src/` read files through Vite, never
 * `node:fs` — the glob is that.
 *
 * What only one language needs (Finnish is not copied Swedish, say) stays next
 * to that pack, in its own test.
 */

const modules = import.meta.glob(["../locale-packs/*.ts", "!../locale-packs/*.test.ts"], {
  eager: true,
}) as Record<string, Record<string, unknown>>;

// A pack file exports exactly one object; the export's name is its own
// business (`FINNISH_VIEWER_PACK`), so it is found by shape, not by name.
const packs = Object.entries(modules).map(([path, exports]) => {
  const tables = Object.values(exports).filter(
    (value): value is Record<string, string> => typeof value === "object" && value !== null,
  );
  return { name: path.replace("../locale-packs/", ""), tables };
});

const PLACEHOLDER = /\{(\w+)\}/g;
const placeholders = (text: string): string =>
  [...text.matchAll(PLACEHOLDER)].map((match) => match[1]).sort().join(",");

test("there is a pack to check, so an empty directory cannot pass", () => {
  expect(packs.map((pack) => pack.name)).toContain("fi.ts");
});

describe.each(packs)("the language pack $name", ({ name, tables }) => {
  test("exports exactly one table", () => {
    expect(tables.length, `${name} should export one pack object`).toBe(1);
  });

  const pack = tables[0] ?? {};

  test("has every viewer key", () => {
    const missing = Object.keys(VIEWER_STRINGS).filter((key) => !pack[key]?.trim());
    expect(missing, `${name} lacks these viewer keys`).toEqual([]);
  });

  test("has no key the viewer does not have", () => {
    const extra = Object.keys(pack).filter((key) => !(key in VIEWER_STRINGS));
    expect(extra, `${name} has keys the viewer does not (misspelt or removed)`).toEqual([]);
  });

  /*
   * A placeholder is not prose. Dropping `{n}` reads as a finished translation
   * and renders "Kirjoita vähintään merkkiä" to a visitor — the one fault no
   * key count can see. Held against every language the viewer ships, so a
   * placeholder added to the Swedish alone is caught as well.
   */
  test("keeps the placeholders the viewer's text has", () => {
    const wrong = Object.entries(pack)
      .filter(([key, text]) => {
        const entry = VIEWER_STRINGS[key] as Record<string, string> | undefined;
        return entry
          ? Object.values(entry).some((source) => placeholders(source) !== placeholders(text))
          : false;
      })
      .map(([key, text]) => `${key}: "${text}"`);
    expect(wrong, `${name} lost or added placeholders`).toEqual([]);
  });
});
