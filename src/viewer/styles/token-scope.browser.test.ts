import { describe, expect, test } from "vitest";

import tokens from "./tokens.scss?inline";

/**
 * Every selector we put in the host's document is scoped to our own tags.
 *
 * Story 012, criterion 6 — and a correction. I claimed more than once that this
 * gate existed and that it "measures every selector rather than looking for a
 * leftover `:root`". It did not exist. What existed was an effect check in
 * `smoke:lib` — no FlowWeaver tokens resolve on the host's `documentElement` —
 * which catches a `:root` regression but says nothing about a rule that leaks
 * without setting a token.
 *
 * ## Why this file and not the components
 *
 * The components' styles go into shadow roots, which scope them by
 * construction. `tokens.scss` is the one stylesheet we write into the host's
 * *document*, via `applyTokens`. It is therefore the only place a selector of
 * ours can reach their page at all — and it is where both leaks came from:
 * `:root` tokens repainting their scrollbars, and `[data-theme]` colliding with
 * a convention that is theirs to use.
 *
 * ## Measured, not searched
 *
 * A check that greps for `:root` finds the leak we already had. This one reads
 * every selector the sheet emits and requires each to name one of our tags, so
 * the next leak is caught in a shape nobody predicted.
 */

/** Compiled selectors, with at-rule wrappers and declarations stripped out. */
function selectorsIn(css: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors: string[] = [];

  for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    /*
     * Statement at-rules — `@charset`, `@use` — end in a semicolon and are not
     * brace-delimited, so they arrive glued to whatever selector follows them.
     * The first version of this reader skipped the whole head because it began
     * with `@`, which took `:root` along with it: the gate was green for
     * exactly the leak it exists to catch, and a sabotage found that rather
     * than a review.
     */
    const head = match[1].split(";").pop()?.trim() ?? "";

    // Block at-rules like `@media` wrap other rules; their head is not a
    // selector, and the rules inside are matched separately.
    if (head === "" || head.startsWith("@")) {
      continue;
    }
    for (const part of head.split(",")) {
      const selector = part.trim();
      if (selector !== "") {
        selectors.push(selector);
      }
    }
  }

  return selectors;
}

/**
 * Ours, and the opt-in class a host puts on an area they want dressed.
 *
 * Every element a host mounts on its own has to be here. `guide-versions` was
 * not, and a control without tokens is not half-dressed but undressed: every
 * `var(--fw-…)` resolved to nothing, so the menu's background was transparent
 * and the page beneath showed through it. No test saw it — a `var()` with no
 * value simply disappears — and a screenshot did.
 */
const OURS = /(^|[\s,(])(guide-editor|guide-preview|guide-versions|\.flowweaver-scope)\b/;

describe("the stylesheet we put in the host's document", () => {
  test("has selectors to check, so an empty sheet cannot pass", () => {
    expect(selectorsIn(tokens).length).toBeGreaterThan(2);
  });

  test("names one of our tags in every selector", () => {
    const escaping = selectorsIn(tokens).filter(
      (selector) => !OURS.test(selector),
    );

    expect(escaping).toEqual([]);
  });

  // The leak that shipped. `:root` reaches everything the host has.
  test("never reaches :root, html or body", () => {
    const global = selectorsIn(tokens).filter((selector) =>
      /(^|[\s,])(:root|html|body)\b/.test(selector),
    );

    expect(global).toEqual([]);
  });

  // The other leak that shipped. `data-theme` is a convention a host may use
  // themselves, so our rules must not hang off it.
  test("themes on our own attribute, not on data-theme", () => {
    const theirs = selectorsIn(tokens).filter((selector) =>
      /\[data-theme\b/.test(selector),
    );

    expect(theirs).toEqual([]);
  });

  test("and does theme on ours, so the attribute is not merely absent", () => {
    expect(tokens).toContain("data-fw-theme");
  });
});

describe("the check reads what is emitted", () => {
  /*
   * A gate that greps the source finds the leak we already had. These prove the
   * reader is looking at compiled selectors, so the next leak is caught in a
   * shape nobody predicted.
   */
  test("an unscoped rule would be reported", () => {
    expect(
      selectorsIn("button { color: red } guide-editor { color: blue }").filter(
        (selector) => !OURS.test(selector),
      ),
    ).toEqual(["button"]);
  });

  test("a rule inside a media query is read, not skipped", () => {
    expect(
      selectorsIn("@media (min-width: 10px) { body { color: red } }").filter(
        (selector) => !OURS.test(selector),
      ),
    ).toEqual(["body"]);
  });

  test("a descendant of ours is ours", () => {
    expect(
      selectorsIn("guide-editor .thing { color: red }").filter(
        (selector) => !OURS.test(selector),
      ),
    ).toEqual([]);
  });
});
