import { describe, expect, test } from "vitest";

import { CURRENT_GRAPH_VERSION, graphMigrations } from "../viewer/core/graph-migrations";

/**
 * The JSON contract names the format's version. That makes it a second copy.
 *
 * `docs/JSON-KONTRAKT.md` said version 3 — in the example at the top and in
 * *Versionering* — while the code had gone to 10 (review 8/10). Seven
 * migrations had raised `CURRENT_GRAPH_VERSION` and none of them had a reason
 * to open the document. Nothing could have caught it but a reader, and the
 * reader trusted it.
 *
 * So every version number the document states is read here and compared with
 * the code. What each version changed is not checked, because the document no
 * longer lists it: it points at the migration chain, where the description sits
 * beside the step that does it.
 */

// Through Vite rather than node:fs, like the other file-reading gates. A glob
// that matched nothing would leave the document empty, and the count below
// fails instead of passing on nothing.
const doc = Object.values(
  import.meta.glob("../../docs/JSON-KONTRAKT.md", { query: "?raw", import: "default", eager: true }),
)[0] as string | undefined;

describe("JSON-KONTRAKT states the format version the code has", () => {
  test("the document was read", () => {
    expect(doc?.length ?? 0).toBeGreaterThan(1000);
  });

  test("the code's version is the last migration's", () => {
    // Guards the comparison below: if CURRENT ran ahead of the chain, matching
    // the document to it would pin the document to a wrong number.
    expect(graphMigrations.at(-1)?.to).toBe(CURRENT_GRAPH_VERSION);
  });

  test("every version the document states is CURRENT_GRAPH_VERSION", () => {
    const stated = [
      // The example's `"version": N` at the top level.
      ...[...(doc ?? "").matchAll(/"version":\s*(\d+)/g)].map((m) => Number(m[1])),
      // *Versionering*: `(nuvarande: **N**)`.
      ...[...(doc ?? "").matchAll(/nuvarande:\s*\*\*(\d+)\*\*/g)].map((m) => Number(m[1])),
    ];

    // Both places, or the gate checks less than it says.
    expect(stated.length).toBeGreaterThanOrEqual(2);
    expect(stated).toEqual(stated.map(() => CURRENT_GRAPH_VERSION));
  });
});
