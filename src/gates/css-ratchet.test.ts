/*
 * CSS ratchet — spread may only shrink, never grow.
 *
 * Born out of the 2026-09-02 audit: 73 distinct font sizes, 26
 * `!important`, naked hex colors that dodge the token contract, and
 * `:has()` used where a class would do. Each counter below has a
 * ceiling set to the count at the time it was last lowered. When a
 * cleanup round brings a number down, lower the ceiling to match —
 * that is the ratchet clicking. Never raise a ceiling: whatever made
 * the number grow is the thing to fix.
 *
 * Counting happens on SCSS text via Vite globs — gates never use `node:fs`
 * (see src-root-tidy.test.ts for why gates live here). Every counter reads
 * the same prepared text: comments stripped and multi-line declarations
 * folded onto one line (`readable()` below, and the reasons with it).
 * Three named files define tokens, and only those are exempt from the counters
 * that measure a *value* — there a literal IS the token. The list is explicit
 * rather than a directory rule; `TOKEN_FILES` below says what that cost.
 * `!important`, `:has()` and hex fallbacks are measured everywhere, since no
 * file earns those.
 */
import { describe, expect, it } from "vitest";

const files: Record<string, string> = import.meta.glob("../**/*.scss", {
  query: "?raw",
  import: "default",
  eager: true,
});

/*
 * What every counter reads. Two things happen to the source first, and both
 * were found by counting something that is not there.
 *
 * 1. Comments go. Found by mutation (QA 20/9): `// old: padding: 7px;` and its
 *    block-comment twin were counted as off-scale spacing although nothing
 *    renders them — a matcher reads text, not live CSS. A `//` preceded by a
 *    colon or an open paren is left alone: those are URL schemes, one written
 *    `http://…` (the colon) and one protocol-relative, `url(//…)` (the paren).
 *    `_tick-boxes.scss` carries a `mask: url("data:image/svg+xml,…
 *    http://www.w3.org/2000/svg…")` that the colon-only rule already guarded;
 *    a second mutation (QA 20/9) fed `url(//cdn.example/x.png)` through
 *    `readable()` directly and got `url( }` back — the paren case was still
 *    open, just dormant, because nothing in the corpus uses that form yet. A
 *    declaration's own trailing comment is stripped after the `;`, so the
 *    declaration itself survives.
 *
 * 2. Multi-line declarations fold onto one line. Measured 2026-09-20: 9
 *    `transition` and 9 `box-shadow` declarations are written across several
 *    lines, so a line-based matcher saw a bare `transition:` and missed the
 *    times underneath — a fifth of all motion. Folding a value's newlines into
 *    spaces makes the declaration one line again. It cannot merge two separate
 *    declarations, because a fold stops at the `;` that ends the first.
 *
 * A line still counts once however many declarations it carries. That is the
 * unit throughout: lines, not occurrences.
 */
function readable(text: string): string {
  const uncommented = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:(])\/\/.*$/gm, "$1");
  return uncommented.replace(/:[^;{}]*[;}]/g, (declaration) => declaration.replace(/\n/g, " "));
}

const entries: [string, string][] = Object.entries(files).map(([path, text]) => [
  path,
  readable(text),
]);
/*
 * The files that define tokens. Everything else is a component stylesheet and
 * is measured.
 *
 * The list is written out file by file because the rule it replaces was
 * `path.includes("/styles/")`, and that was wrong in a way nobody could see:
 * it exempted every file under a `styles/` directory, and most of those are
 * components. `src/editor/styles/_dialog-shell.scss` is the look of a dialog,
 * and all of `src/site/styles/` but `demo-tokens.scss` is the example site's
 * own surfaces. Found 2026-09-20 (Fia): two files were swept to the tokens
 * that day, `guide-storage.scss` and `_dialog-shell.scss`, and not one counter
 * moved — the gate had never been looking at them.
 *
 * `src/viewer/styles/_chips.scss`, `_picker.scss` and `_tick-boxes.scss` are
 * shared component partials, not tokens, and they are counted. `palettes.ts`
 * beside the viewer's tokens is TypeScript, which this glob never reads.
 *
 * A directory can grow a file; a list cannot. Adding a token file here is a
 * deliberate line, which is the point.
 */
// The page tokens moved from src/site/styles to src/host/styles with the guides
// app (7/10) and ship with the open FlowWeaver, so the list is the same in both trees.
const OPEN_TOKEN_FILES = [
  "/host/styles/demo-tokens.scss",
  "/viewer/styles/tokens.scss",
  "/viewer/styles/_tokens-mixins.scss",
];

const TOKEN_FILES = OPEN_TOKEN_FILES;
const outsideTokens = entries.filter(
  ([path]) => !TOKEN_FILES.some((tokenFile) => path.endsWith(tokenFile)),
);

/*
 * The shared focus indicator. It is the one file allowed to draw an outline of
 * its own, because it is the definition every other rule now includes.
 */
const FOCUS_FILE = "/viewer/styles/_focus.scss";
const outsideFocus = entries.filter(([path]) => !path.endsWith(FOCUS_FILE));

function countLines(
  source: [string, string][],
  matches: (line: string) => boolean,
): { total: number; where: string[] } {
  const where: string[] = [];
  let total = 0;
  for (const [path, text] of source) {
    const hits = text.split("\n").filter(matches).length;
    if (hits > 0) {
      total += hits;
      where.push(`${path}: ${hits}`);
    }
  }
  return { total, where };
}

/*
 * Ceilings: the counts when each was last lowered. Only ever decrease.
 *
 * `important` (26 -> 24) and `nakedHex` (4 -> 2) dropped on 2026-09-20 without
 * anyone touching a stylesheet: `readable()` stopped counting commented-out
 * code, and four of those lines were comments. That is the ratchet, not a
 * regression — a ceiling follows the number down the moment the number moves.
 *
 * **The eleven value ceilings went UP on 2026-09-20, and that is not the
 * ratchet running backwards.** It is the same corpus measured for the first
 * time: `TOKEN_FILES` replaced an exemption that hid thirteen component
 * stylesheets, so each of these counters started seeing lines it had never
 * seen. Nothing was added to a stylesheet that day and nothing was allowed
 * back in; the gate simply stopped looking away. Remeasured exactly, so the
 * next literal after this one fails:
 *
 *     counter              before   now
 *     nakedHex                  2     3
 *     fontSizePx               22    33
 *     offScaleSpacing         251   277
 *     literalRadius           142   164
 *     literalShadow            33    34
 *     literalWeight           158   177
 *     literalLineHeight       128   145
 *     literalTracking          41    44
 *     literalMotion            20    23
 *     literalZ                 35    38
 *     fontSizeEm               47    81
 *
 * `important` (24), `has` (3) and `tokenFallbacks` (0) are unchanged: those
 * three always read every file, so no exemption ever narrowed them.
 *
 * The dialog, guides and history sweeps earlier the same day are inside these
 * totals — the numbers they took out are already gone from the "now" column.
 * What the sweeps did to `guide-storage.scss` and `_dialog-shell.scss` shows
 * up here for the first time too, since before this change neither file was
 * counted at all. From here every one of these only goes down.
 *
 * Fourth surface, same day: `editor-toolbar.scss` and `properties-panel.scss`
 * (Fia). Six counters moved:
 *
 *     counter              before   now
 *     offScaleSpacing         277    225
 *     literalShadow            34     33
 *     literalWeight           177    161
 *     literalLineHeight       145    139
 *     literalMotion            23     22
 *     literalZ                 38     36
 *
 * `literalRadius`, `literalTracking` and `fontSizeEm` are unchanged: every
 * radius and tracking literal in the two files was a documented mismatch
 * (left with a comment, same exception `_tokens-mixins.scss` writes for
 * radius), and neither file sizes text in em/rem.
 *
 * Same day, Johan's follow-up: the toolbar's sticky `:host` moved from a
 * literal `20` (matching --fw-z-popover's number, not its role) to
 * `var(--fw-z-sticky)` (10) — checked first, not assumed: a rigged
 * `<guide-editor>` confirmed the list view (z-index 15, the only value
 * between 10 and 20) never shares a pixel with the toolbar's own rectangle,
 * a scrolled canvas, an open menu and a real `showModal()` dialog all still
 * layer correctly. literalZ 36 -> 35.
 *
 * Fifth surface, same day: the site (`src/site/*.scss` and
 * `src/site/styles/*.scss`, minus the token files and the two files already
 * swept that morning, `guides.scss` and `guide-storage.scss`). Twenty-one
 * files, one visit. Eight counters moved:
 *
 *     counter              before   now
 *     offScaleSpacing         225    137
 *     literalRadius           164    128
 *     literalShadow            33     29
 *     literalWeight           161     99
 *     literalLineHeight       139    125
 *     literalTracking          44     33
 *
 * `literalMotion` (22) is unchanged, and `literalZ` stays at the toolbar sweep's 35: no site transition
 * matched the decided 120ms, and no site z-index matched a layer's number
 * cleanly enough to move (the one exact number-match, a dropdown's `z-index:
 * 10`, is semantically a popover and stayed literal with a comment, same
 * reasoning as the toolbar's sticky bar in the fourth sweep). `fontSizeEm`
 * (81) is unchanged: the site's font sizes are out of this sweep's aspect
 * list (radius/shadow/weight/line/tracking/motion/z/control-height) and
 * several site pages size type in rem, which this counter cannot see either
 * way. Two mandated visible changes, both Johan's: the four CTA pills
 * (`.hero__cta`, `.kom-igang__cta`, `.editors__cta`, `.showcase__cta`) moved
 * from 10/999px to `--fw-radius-button` (8), and every exact 700-weight
 * match — heading or not — points at `--fw-weight-heading` now.
 */
/*
 * `fontSizeEm` steg 81 → 83 den 21/9, och det är de enda två raderna som
 * fick höja ett tak i den här omgången: `font-size: 1rem` på visarens och
 * editorns `:host`. Det ÄR beslutet (Johan: *men vi jobbar i rem?*) — grunden
 * återställs till sidans rot så att en värds containrar inte når in medan
 * besökarens egen textstorlek gör det. Samma omgång tog bort tre literala
 * px-storlekar, så `fontSizePx` gick ned lika mycket som det här gick upp.
 *
 * En ratchet som höjs behöver ett skäl skrivet bredvid sig, annars är den
 * bara ett tal någon flyttade. Det här är skälet.
 */
/*
 * `offScaleSpacing` 137 → 139 den 28/9 (Fia, varv 9): Astras exakta spec
 * för plusmenyn (klistrad in ordagrant av Johan, "Följ måtten som de
 * står") ger `.menu` sin egen `padding: 10px 6px` och `.menu__group-label`
 * sin `padding: ... 10px` — två rader, 10 och 6 är inte 0–3 eller en
 * fyra-multipel, och ingen `--fw-space-*` träffar dem (8 och 12 gör, och
 * används där de gör). Varje annan siffra i samma spec som HADE en exakt
 * eller närmast liggande token fick en (se `rich-text-field.scss`:
 * `--fw-font-size-base`, `--fw-weight-strong`, `--fw-text-secondary`,
 * `--fw-radius-xl`, `--fw-space-2/3/4` m.fl.) — de här två är bara det
 * som blev kvar.
 *
 * `literalShadow` steg samma dag till 30 för samma menys tvålagersskugga
 * (ingen `--fw-shadow-*`-token låg nära). Ram och skugga fick sedan två
 * omgångar till samma dag: först egna komponenttokens (avvisat — Johans
 * regel, inga nya färger, inga nya tokens), sedan Astras eget facit,
 * mätt mot varje befintlig kandidat: `--fw-border` (byte från `--fw-
 * border-subtle`, sRGB-summan 16.1 mot 85.5 över båda teman) och
 * `--fw-shadow-raised` (avståndssumman 38 mot `--fw-shadow-floating`s
 * 113 på offset+blur+opacitet, båda teman — floating avvisad av Astra:
 * "dess stora utbredning riskerar att återge den tunga skuggan vi ville
 * minska"). `box-shadow: var(--fw-shadow-raised)` är ingen literal, så
 * taket går ner igen: 30 → 29.
 */
/*
 * `literalRadius` 125 → 127 den 28/9 (Fia, UPPDRAG-2026-09-28-ENHETLIGHET
 * Del 2): verktygsradens sex menyer och nodens ⋯/kopplingens meny fick
 * plusmenyns egen radrundning, `7px` — samma literal som `.menu button` i
 * rich-text-field.scss redan bär (dokumenterad där: mitt emellan
 * `--fw-radius-sm` 6 och `--fw-radius-md` 8, ingen token träffar exakt).
 * En rad i `editor-toolbar.scss`, en i `node-editor.scss`, båda med en
 * kommentar som pekar på facit — ingen ny gissning, samma redan
 * dokumenterade avvikelse på två fler ställen.
 *
 * `literalLineHeight` 125 → 126 samma dag (Del 4): de nya flytta-upp/ned-
 * knapparna (`.properties-panel__option-order button`,
 * properties-panel.scss) fick `line-height: 1`, exakt samma nolledningsknep
 * som `.properties-panel__option-drag-handle` bredvid dem redan använder
 * (kommenterat där) — glyfen ska inte göra knappen högre än sin rad.
 */
/*
 * 30/9: five ceilings clicked down to the day's counts (radius 127 → 124,
 * shadow 29 → 26, motion 22 → 21, font-size px 32 → 31, em 83 → 82) and
 * `literalSpacing` added at 651. Measured that morning: the slack under the
 * old ceilings let three new literal radii, three shadows, one font size and
 * one transition in without a word — Johan: "tycker hon går utanför". A
 * ratchet with air under it is a counter, not a gate; the click is what makes
 * the next literal fail on the commit it arrives in (see tools/git-hooks).
 *
 * 30/9 kväll, B8: `literalSpacing` 651 → 638 — the visitor's card padding
 * (28 and 16 → `--fw-space-5` / `--fw-space-4`) and the site's nine 48 px
 * section gaps → `--fw-space-7`; two more had already gone without a click.
 */
const CEILINGS = {
  important: 24,
  nakedHex: 3,
  fontSizePx: 31,
  has: 3,
  tokenFallbacks: 0,
  offScaleSpacing: 139,
  literalSpacing: 638,
  literalRadius: 124,
  literalShadow: 26,
  literalWeight: 99,
  literalLineHeight: 126,
  literalTracking: 33,
  literalMotion: 21,
  literalZ: 35,
  fontSizeEm: 82,
  literalFocus: 5,
};

function assertCeiling(name: keyof typeof CEILINGS, got: { total: number; where: string[] }) {
  expect(
    got.total,
    `${name}: ${got.total} (ceiling ${CEILINGS[name]})\n${got.where.join("\n")}`,
  ).toBeLessThanOrEqual(CEILINGS[name]);
}

/*
 * Spacing that misses the four-pixel grid.
 *
 * Counted on `gap` (including `row-gap`/`column-gap`), `padding` and `margin`
 * with any physical or logical suffix — not `inset`, which positions rather
 * than spaces. A line counts once, however many declarations it carries, the
 * same way the counters above count lines.
 *
 * A px value is off-scale when it is neither 0, 1, 2, 3 nor a multiple of 4.
 * 1-3 are exempt because they are optical, not rhythm: a hairline, the gap
 * between a label and its value, a focus ring. Everything above picks a step
 * from `--fw-space-*` in `src/viewer/styles/_tokens-mixins.scss`, where the
 * measurement behind the scale is written down. Negative margins are measured
 * by their magnitude; a `-6px` pull is as off-grid as a `6px` push.
 *
 * The ceiling is the count on 2026-09-20, the day the scale was added and
 * before any component was swept. It only ever goes down.
 */
const SPACING_DECLARATION =
  /(?:^|[\s;{])(?:row-gap|column-gap|gap|padding|margin)(?:-[a-z]+(?:-[a-z]+)?)?\s*:\s*([^;{}]*)/g;
const ON_SCALE_BELOW_FOUR = new Set([0, 1, 2, 3]);

function hasOffScaleSpacing(line: string): boolean {
  for (const declaration of line.matchAll(SPACING_DECLARATION)) {
    for (const value of declaration[1].matchAll(/(-?[\d.]+)px/g)) {
      const px = Math.abs(Number(value[1]));
      if (ON_SCALE_BELOW_FOUR.has(px)) continue;
      if (px % 4 !== 0) return true;
    }
  }
  return false;
}

/*
 * Spacing written as a number at all — on the scale or off it.
 *
 * `hasOffScaleSpacing` above catches 7px; this one catches `padding: 8px`,
 * which sits on the grid and still dodges the token. Johan 30/9: "kan vi
 * bygga någon slags css-grind så om Fia går utanför den med t.ex. avstånd så
 * varnar det?" — the off-scale counter stood exactly at its ceiling, but an
 * on-scale literal was not counted anywhere, so a component could be laid
 * out in numbers and the gate stayed quiet. Values under 4 px are the same
 * optical exemption as above; `0` is not spacing. The ceiling is the count on
 * 2026-09-30, the day the counter was added, and only ever goes down.
 */
function hasLiteralSpacing(line: string): boolean {
  for (const declaration of line.matchAll(SPACING_DECLARATION)) {
    for (const value of withoutTokens(declaration[1]).matchAll(/(-?[\d.]+)px/g)) {
      if (Math.abs(Number(value[1])) >= 4) return true;
    }
  }
  return false;
}

/*
 * One counter per aspect, all built the same way: find the declaration, read
 * its value, ask whether the value is a literal where a token belongs. The
 * roles they push toward live in `src/viewer/styles/_tokens-mixins.scss`, and
 * the measurement behind each role is written there, not here.
 *
 * Every ceiling is the count on 2026-09-20 — the day the tokens were added,
 * before a single component was swept. So these numbers are the size of the
 * job, and each one that goes down is a surface that has been through it.
 *
 * What these cannot see, measured rather than assumed: `animation` carries 13
 * durations that `literalMotion` does not read (it asks about `transition`),
 * and inline `style=` attributes in TypeScript are outside the corpus
 * entirely. Both are deliberate scope, and both are worth a counter the day
 * they start to drift.
 */
function declaration(property: string): RegExp {
  return new RegExp(`(?:^|[\\s;{])${property}\\s*:\\s*([^;{}]*)`, "g");
}

/* A declaration is measured by its value, so `var(…)` has to go before a
 * length inside a fallback is mistaken for a literal: `var(--fw-radius-pill,
 * 999px)` already asks for a token and is not the problem this counts. */
function withoutTokens(value: string): string {
  return value.replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, "");
}

function declares(property: string, matches: (value: string) => boolean) {
  const pattern = declaration(property);
  return (line: string): boolean => {
    for (const found of line.matchAll(pattern)) if (matches(found[1])) return true;
    return false;
  };
}

/* The plain case, shared by weight and line height: any value at all, as long
 * as it does not reach for a token. `font-weight: normal` counts — it is the
 * same decision as `400`, written so it does not look like one. */
function isLiteral(value: string): boolean {
  return value.trim() !== "" && !value.includes("var(");
}

/* `50%` is a circle, not a corner, and `0` is the absence of one. Everything
 * else in px picks `--fw-radius-button`, `-field`, `-card`, `-dialog` or
 * `-chip` by role. */
const hasLiteralRadius = declares("border-radius(?:-[a-z-]+)?", (value) =>
  /[\d.]+px/.test(withoutTokens(value)),
);

/*
 * Elevation only. Two kinds of `box-shadow` are deliberately not counted:
 * `none`, which removes a shadow rather than inventing one, and `inset …`,
 * which draws a border — measured 2026-09-20, there are 4 of those, all of
 * them a left-hand rule or a ring inside an edge.
 *
 * Spread-only rings (`0 0 0 3px rgb(…)`) DO count when they spell their color
 * out, and that is on purpose: a focus ring has a token too (`--fw-focus-ring`),
 * so a literal one is the same drift by another name.
 */
const hasLiteralShadow = declares("box-shadow", (value) => {
  const shadow = value.trim();
  return shadow !== "" && shadow !== "none" && !shadow.includes("var(") && !shadow.startsWith("inset");
});

/* `normal` and `0` are "no tracking", which is the right answer for body copy
 * and needs no token. Anything else is either a caps label or a heading. */
const hasLiteralTracking = declares("letter-spacing", (value) => {
  const tracking = value.replace("!important", "").trim();
  return tracking !== "" && !tracking.includes("var(") && tracking !== "normal" && tracking !== "0";
});

/* A time, in either unit. `transition: none` and a bare property list carry no
 * duration and are nothing to tokenise. */
const hasLiteralMotion = declares(
  "transition(?:-duration)?",
  (value) => !value.includes("var(") && /[\d.]+m?s\b/.test(value),
);

/* `0`, `auto` and `-1` are not layers — they are "stay where you are" and
 * "go behind my own background". The five layers are the named ones. */
const hasLiteralZ = declares("z-index", (value) => {
  const level = value.trim();
  return level !== "" && !level.includes("var(") && level !== "0" && level !== "auto" && level !== "-1";
});

/*
 * The px ramp has a counter above; this is its blind side. Measured
 * 2026-09-20: 67 lines outside `styles/` size text in em or rem, which the
 * px counter never saw, so the eight-step ramp was guarding rather less than
 * it looked. Every step of the ramp is px, so any em or rem value is off it
 * by construction — including the ones inside a `clamp()`.
 */
const hasEmFontSize = declares("font-size", (value) => /[\d.]+r?em\b/.test(withoutTokens(value)));

describe("readable()", () => {
  /*
   * QA 2026-09-20, mutation-testing the counters: the existing protection
   * covers a `//` preceded by `:` (a scheme URL, `http://…`) but a
   * protocol-relative URL's `//` is preceded by `(`, one character short of
   * that guard. Found by feeding `background: url(//cdn.example/x.png);`
   * through readable() directly and reading the result, not by a corpus
   * file — none in the tree uses that form yet, so no ceiling would have
   * caught the regression. Keep this as its own case so the next `//` bug
   * has one too.
   */
  it("does not clip a protocol-relative url as a line comment", () => {
    const source = `.a {\n  background: url(//cdn.example/x.png);\n}\n`;
    expect(readable(source)).toBe(source);
  });

  it("still leaves a scheme url's // alone", () => {
    const source = `.a {\n  background: url(http://cdn.example/x.png);\n}\n`;
    expect(readable(source)).toBe(source);
  });

  it("still strips a genuine line comment", () => {
    const source = `// transition: all 1s\n.a {\n  color: red;\n}\n`;
    expect(readable(source)).toBe(`\n.a {\n  color: red;\n}\n`);
  });
});

describe("css ratchet", () => {
  it("finds the stylesheet corpus", () => {
    expect(entries.length).toBeGreaterThan(30);
  });

  /*
   * The exemption has to keep hitting every file it names. A renamed or moved
   * token file makes its entry match nothing, and no ceiling would say so:
   * measured 2026-09-20 by pointing each entry at a name that does not exist,
   * `tokens.scss` and `demo-tokens.scss` move not one counter (their values
   * sit in properties nothing here reads), and `_tokens-mixins.scss` moves
   * only `nakedHex`. So without this the list could rot entry by entry in the
   * same silence that hid thirteen component stylesheets until that day.
   */
  it("exempts exactly the files that define tokens", () => {
    expect(entries.length - outsideTokens.length).toBe(TOKEN_FILES.length);
  });

  it("!important does not spread", () => {
    assertCeiling("important", countLines(entries, (l) => l.includes("!important")));
  });

  it("naked hex colors stay out of component styles", () => {
    assertCeiling(
      "nakedHex",
      countLines(outsideTokens, (l) => /#[0-9a-fA-F]{3,8}\b/.test(l) && !l.includes("var(--fw")),
    );
  });

  /*
   * Hand-rolled focus rings.
   *
   * Every `:focus-visible` in the package and on the site went through
   * `@include focus.ring` on 21/9 — 83 of them, from 93 hand-written
   * `outline` lines. The five that are left are not focus at all: a selected
   * page field, a selected connection colour, a minimap node marked as an
   * error, and two outline rows carrying selection and current-step. They draw
   * an outline to mean something else, and they say so where they stand.
   *
   * Counted as *any* outline outside the shared definition rather than as
   * "focus outlines", because a line cannot see the selector above it — and
   * because the thing worth catching is a new one being hand-written at all.
   * Whoever adds one either includes the mixin or raises this with a reason.
   */
  it("focus rings come from the one definition", () => {
    assertCeiling(
      "literalFocus",
      /*
       * `outline:(?!\s*none)` och inte `outline:\s*(?!none)`. Den andra ser
       * rätt ut och räknar fem `outline: none` ändå: `\s*` backar ett steg,
       * lookaheaden landar på " non" i stället för "none" och släpper igenom.
       * Grinden fällde sig själv på det första gången den kördes.
       */
      countLines(outsideFocus, (l) => /^\s*outline:(?!\s*none)/.test(l)),
    );
  });

  it("literal px font sizes stay out of component styles", () => {
    assertCeiling(
      "fontSizePx",
      countLines(outsideTokens, (l) => /font-size:\s*[\d.]+px/.test(l)),
    );
  });

  it(":has() does not spread", () => {
    assertCeiling("has", countLines(entries, (l) => l.includes(":has(")));
  });

  it("token fallbacks with hex duplicates do not spread", () => {
    assertCeiling(
      "tokenFallbacks",
      countLines(entries, (l) => /var\(--fw-[a-z-]+,\s*#[0-9a-fA-F]{3,8}\)/.test(l)),
    );
  });

  it("spacing off the four-pixel scale does not spread", () => {
    assertCeiling("offScaleSpacing", countLines(outsideTokens, hasOffScaleSpacing));
  });

  it("spacing written as a number does not spread, on the scale or off it", () => {
    assertCeiling("literalSpacing", countLines(outsideTokens, hasLiteralSpacing));
  });

  it("literal corner radii stay out of component styles", () => {
    assertCeiling("literalRadius", countLines(outsideTokens, hasLiteralRadius));
  });

  it("literal shadows stay out of component styles", () => {
    assertCeiling("literalShadow", countLines(outsideTokens, hasLiteralShadow));
  });

  it("literal font weights stay out of component styles", () => {
    assertCeiling("literalWeight", countLines(outsideTokens, declares("font-weight", isLiteral)));
  });

  it("literal line heights stay out of component styles", () => {
    assertCeiling(
      "literalLineHeight",
      countLines(outsideTokens, declares("line-height", isLiteral)),
    );
  });

  it("literal letter spacing stays out of component styles", () => {
    assertCeiling("literalTracking", countLines(outsideTokens, hasLiteralTracking));
  });

  it("literal transition times stay out of component styles", () => {
    assertCeiling("literalMotion", countLines(outsideTokens, hasLiteralMotion));
  });

  it("literal stacking levels stay out of component styles", () => {
    assertCeiling("literalZ", countLines(outsideTokens, hasLiteralZ));
  });

  it("em and rem font sizes stay out of component styles", () => {
    assertCeiling("fontSizeEm", countLines(outsideTokens, hasEmFontSize));
  });
});
