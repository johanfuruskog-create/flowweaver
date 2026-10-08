/*
 * The graphic profile names every token — so the two cannot drift apart.
 *
 * `docs/GRAFISK-PROFIL.md` is the list a designer or a role chooses from:
 * each `--fw-*` token with its value in both themes and when to use it
 * (PRAXIS 39, Johan 30/9). The token file is the code. A token added to the
 * code without a row in the profile is a value nobody was told to choose, and
 * a profile that silently lacks one is a profile nobody can trust — so every
 * token DEFINED in `_tokens-mixins.scss` must appear in the profile by name.
 *
 * "Defined" means a declaration, not a use: `--fw-x:` at the start of a line
 * or after a `;` on the same line. The second form matters — the status and
 * node-family tokens are written several to a line (`--fw-success: …;
 * --fw-success-text: …;`), and a start-of-line match alone missed nine of
 * them (measured 30/9: 101 names by line start, 110 in all). Comments are
 * stripped first, so a token only mentioned in prose does not count as
 * defined. `var(--fw-x)` is a use and never matches: it has no colon after.
 *
 * Only this direction is checked. The profile may name things that are not
 * tokens (a mixin, a literal exception with its reason), and that is the point
 * of it.
 *
 * Read via Vite `?raw`, never `node:fs` — see src-root-tidy.test.ts for why.
 */
import { describe, expect, it } from "vitest";
import tokenSource from "../viewer/styles/_tokens-mixins.scss?raw";
import profile from "../../docs/GRAFISK-PROFIL.md?raw";

function definedTokens(scss: string): string[] {
  const uncommented = scss.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:(])\/\/.*$/gm, "$1");
  const names = new Set<string>();
  for (const match of uncommented.matchAll(/(?:^|;)\s*(--fw-[a-z0-9-]+)\s*:/gm)) {
    names.add(match[1]);
  }
  return [...names].sort();
}

function missingFromProfile(tokens: string[], text: string): string[] {
  // Word-bounded: `--fw-radius-md` must not be satisfied by `--fw-radius-md-x`.
  return tokens.filter((name) => !new RegExp(`${name}(?![a-z0-9-])`).test(text));
}

/*
 * The other direction, for the values the profile prints: every hex the
 * profile shows must be a hex the token file has. The names cannot drift
 * (above); without this the *values* could — a token retuned in code would
 * leave the profile telling Astra and Johan the old colour. Ledarens
 * feedback on the first version, 30/9.
 */
function hexesIn(text: string): string[] {
  return [...new Set([...text.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase()))].sort();
}

describe("grafisk profil", () => {
  it("every colour the profile prints is a colour the token file has", () => {
    const known = new Set(hexesIn(tokenSource));
    const stale = hexesIn(profile).filter((hex) => !known.has(hex));
    expect(stale, `Profilen visar färger som inte finns i tokensfilen: ${stale.join(", ")}`).toEqual([]);
  });

  it("finds the tokens, including those written several to a line", () => {
    const tokens = definedTokens(tokenSource);
    expect(tokens.length).toBeGreaterThan(100);
    expect(tokens).toContain("--fw-success-text");
    expect(tokens).toContain("--fw-node-end-ink");
    expect(definedTokens("/* --fw-ghost: 1px; */ a { color: var(--fw-text); }")).toEqual([]);
  });

  it("names every token the token file defines", () => {
    const missing = missingFromProfile(definedTokens(tokenSource), profile);
    expect(
      missing,
      `Saknas i docs/GRAFISK-PROFIL.md: ${missing.join(", ")}. ` +
        "Lägg till en rad med värde i ljust och mörkt och när tokenet används (PRAXIS 39).",
    ).toEqual([]);
  });
});
