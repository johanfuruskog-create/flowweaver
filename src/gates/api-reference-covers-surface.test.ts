import { describe, expect, test } from "vitest";

import surface from "../entries/public-surface.snapshot.json";
import { API_SECTIONS } from "../data/api-reference";
import type { ApiSection } from "../data/api-reference-types";

/*
 * The API reference (/api.html) describes every name a host can reach — and
 * nothing else (Johan 8/10). The names are frozen in
 * `public-surface.snapshot.json`; the descriptions live in
 * `src/data/api-reference.ts`. Two lists of the same names drift unless
 * something compares them, so this does, both ways: a name added to the
 * surface without a description fails here, and so does a description of a
 * name that is gone. The reference cannot be a second copy that quietly lags.
 *
 * Element sections are named by their tag; "events" holds the events and the
 * two export sections hold what the entries export.
 *
 * PRO's reference is checked the same way against what PRO's entries add on
 * top of the open ones. The open repo has neither, and that half stands down.
 */
type Snapshot = {
  elements: Array<{ tag: string; attributes: string[]; members: string[] }>;
  events: string[];
  exports: Record<string, string[]>;
};
const SNAPSHOT = surface as Snapshot;

function surfaceKeys(): Set<string> {
  const keys = new Set<string>();
  for (const element of SNAPSHOT.elements) {
    for (const name of [...element.attributes, ...element.members]) keys.add(`${element.tag}:${name}`);
  }
  for (const name of SNAPSHOT.events) keys.add(`event:${name}`);
  for (const names of Object.values(SNAPSHOT.exports)) for (const name of names) keys.add(`export:${name}`);
  return keys;
}

function referenceKeys(sections: ApiSection[]): Set<string> {
  const keys = new Set<string>();
  for (const section of sections) {
    for (const entry of section.entries) {
      if (entry.kind === "note") continue;
      const scope = section.id === "events" ? "event" : section.id.endsWith("-exports") ? "export" : section.id;
      keys.add(`${scope}:${entry.name}`);
    }
  }
  return keys;
}

const difference = (a: Set<string>, b: Set<string>): string[] => [...a].filter((key) => !b.has(key)).sort();

describe("the API reference covers the frozen surface", () => {
  const frozen = surfaceKeys();
  const described = referenceKeys(API_SECTIONS);

  test("the surface was read", () => {
    expect(frozen.size).toBeGreaterThan(150);
  });

  test("every name a host can reach is described", () => {
    expect(difference(frozen, described)).toEqual([]);
  });

  test("nothing is described that a host cannot reach", () => {
    expect(difference(described, frozen)).toEqual([]);
  });

  test("every description says something in both languages", () => {
    const empty = API_SECTIONS.flatMap((section) =>
      section.entries.filter((entry) => !entry.text.sv.trim() || !entry.text.en.trim()).map((entry) => `${section.id}:${entry.name}`),
    );
    expect(empty).toEqual([]);
  });
});

const proReference = Object.values(
  import.meta.glob("../pro/data/api-reference-pro.ts", { eager: true }),
)[0] as { PRO_API_SECTIONS: ApiSection[] } | undefined;
const proEntries = Object.values(
  import.meta.glob(["../entries/pro-viewer.ts", "../entries/pro-editor.ts"], { eager: true, query: "?raw", import: "default" }),
) as string[];

describe.runIf(Boolean(proReference))("PRO's reference covers what PRO's entries add", () => {
  test("the same names, both ways", () => {
    const added = new Set(
      proEntries.flatMap((source) =>
        [...source.matchAll(/export (?:type )?\{([^}]*)\}/g)].flatMap((block) =>
          block[1].split(",").map((name) => name.trim()).filter(Boolean).map((name) => `export:${name}`),
        ),
      ),
    );
    expect(added.size).toBeGreaterThan(5);
    const described = referenceKeys(proReference!.PRO_API_SECTIONS);
    expect(difference(added, described)).toEqual([]);
    expect(difference(described, added)).toEqual([]);
  });
});
