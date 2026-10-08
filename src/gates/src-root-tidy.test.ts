import { describe, expect, test } from "vitest";

/**
 * The `src/` root does not fill up again.
 *
 * ## What was measured
 *
 * 53 loose files directly in `src/`: 33 demo pages with their stylesheets, 17
 * tests, and a few library-adjacent modules — three different kinds of thing in
 * one heap. Somebody opening `src/` therefore cannot see what ships in the
 * package and what is only the example site.
 *
 * Nobody put them there on purpose. One file at a time is always reasonable; it
 * is the sum that becomes a junk drawer, and the sum never shows up in a diff.
 *
 * ## Why a list and not a rule
 *
 * "No `.ts` in the root" would be cleaner and impossible to adopt in one step —
 * the demo pages move in their own round, together with their HTML pages and
 * those pages' script tags. The list says what is left to move, and shortens as
 * they do.
 *
 * Adding a line here is deliberately a small friction: putting a new file in
 * the root should cost a thought, not nothing.
 */

/**
 * What sits in the `src/` root today and is accepted for now.
 *
 * Empty, and that is the point: the demo pages moved to `src/site/`, the
 * repo-wide gates to `src/gates/`, the theme into the core beside what uses
 * it, and the remote logger into `src/dev/`. Nothing is left, so nothing is
 * excused. (8/9 the library itself split into `src/viewer/` and `src/editor/`;
 * the root stayed empty.)
 */
const STILL_TO_MOVE: string[] = [];

/*
 * Read through Vite, never `node:fs` — the same rule as every other
 * file-reading check under `src/`. See `CLAUDE.md`.
 */
const inTheRoot = Object.keys(
  import.meta.glob("../*.{ts,tsx,js,mjs,cjs,css,scss,json,html}", { query: "?raw", import: "default", eager: true }),
).map((path) => path.replace("../", ""));

/** `film.ts`, `film.scss` and `film.browser.test.ts` count as one here. */
const stem = (fil: string): string =>
  fil.replace(/\.(browser\.)?test\.ts$/, "").replace(/\.(ts|js|scss|d\.ts)$/, "");

/*
 * A sibling directory that is known not to be empty.
 *
 * The check below wants to find **nothing**, which makes a broken glob look
 * exactly like success. So a glob of the same shape is run against a directory
 * that certainly holds files: if that one comes back empty, the pattern is
 * broken rather than the root being clean.
 */
const siblingGlob = Object.keys(
  import.meta.glob("../viewer/core/*.ts", { query: "?raw", import: "default", eager: true }),
);

describe("the check itself works", () => {
  test("the same pattern finds files where files exist", () => {
    expect(siblingGlob.length, "kanariefågeln tystnade").toBeGreaterThan(20);
  });
});

describe("the src root", () => {
  test("holds nothing new", () => {
    const unlisted = [...new Set(inTheRoot.map(stem))].filter(
      (namn) => !STILL_TO_MOVE.includes(namn),
    );

    expect(
      unlisted,
      `new files in the src root: ${unlisted.join(", ")} — put them in a directory that says what they are`,
    ).toEqual([]);
  });

  test("and the list describes something that exists", () => {
    /*
     * Otherwise the list rots: an entry for a file that has moved says nothing,
     * and a list full of those stops being read. This is what makes the list
     * shorten itself when the demo pages move.
     */
    const stemmar = new Set(inTheRoot.map(stem));
    const gone = STILL_TO_MOVE.filter((namn) => !stemmar.has(namn));

    expect(gone, `entries with no file: ${gone.join(", ")}`).toEqual([]);
  });
});
