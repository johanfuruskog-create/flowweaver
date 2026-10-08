import { describe, expect, test } from "vitest";

import rootPackage from "../../package.json";

/**
 * The finished product has no dependencies on other npm libraries.
 *
 * Johan's decision (2026-08-31, written into CLAUDE.md's build ladder): what
 * ships — the viewer, the editor, the bundles — leans on the browser or on
 * our own code, never on node_modules. `dependencies` is empty today, and
 * this gate is what keeps "empty" from quietly becoming "one harmless
 * little library": the day somebody adds one, the build goes red and the
 * conversation happens BEFORE the dependency is load-bearing.
 *
 * `devDependencies` are deliberately out of scope — Vite, Playwright and
 * sass are the build environment, not the product. The integration
 * examples' host requirements (Sitevision's React) live in their own
 * package.json files and are the host's, not the product's.
 *
 * ## Re-running the mutation check (praxis 16)
 *
 * The gate reads the MANIFEST, not node_modules — so the mutation is one
 * line of JSON and nothing needs installing. Plant it, watch this fail
 * with the rule's own sentence, revert:
 *
 *     add `"dependencies": { "gate-canary": "1.0.0" }` to package.json
 *     npx vitest run src/gates/zero-dependencies.test.ts   → red
 *     git checkout package.json                            → green
 *
 * Last run 2026-08-31: fell exactly so. What the gate cannot see — code
 * smuggled INTO the bundles — is `smoke:lib`'s job, which runs them
 * standalone.
 */
describe("the shipped product's dependencies", () => {
  test("there are none, and none can arrive unnoticed", () => {
    const dependencies = (rootPackage as { dependencies?: Record<string, string> }).dependencies ?? {};

    expect(
      Object.keys(dependencies),
      "dependencies i package.json ska vara tom — produkten skeppas utan npm-beroenden (CLAUDE.md, byggstegen)",
    ).toEqual([]);
  });
});
