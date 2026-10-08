import { afterEach, describe, expect, test } from "vitest";

import { contrastRatio } from "../../testing/contrast-ratio";
import { applyPalette, palettes } from "./palettes";
import MIXINS from "./_tokens-mixins.scss?raw";

const PALETTES = Object.values(palettes);

/*
 * Every scale on offer passes the same floor as the default tokens — measured
 * on the computed values after the scale is applied, so what is checked is
 * what a host would get, not what the file says. The pairs are those in
 * `contrast.browser.test.ts` that involve the accent or a node family; the
 * rest are untouched by a scale and stay measured by that test.
 */

function token(name: string): string {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

const ACCENT_PAIRS: Array<[string, string]> = [
  ["--fw-primary", "--fw-bg"],
  ["--fw-primary", "--fw-surface"],
  ["--fw-primary", "--fw-primary-surface"],
  ["--fw-on-primary", "--fw-primary"],
  ["--fw-on-node", "--fw-node-content"],
  ["--fw-on-node", "--fw-node-rule"],
  ["--fw-on-node", "--fw-node-calc"],
  ["--fw-on-node", "--fw-node-service"],
  ["--fw-on-node", "--fw-node-end"],
  ["--fw-node-content-ink", "--fw-node-content-tint"],
  ["--fw-node-rule-ink", "--fw-node-rule-tint"],
  ["--fw-node-calc-ink", "--fw-node-calc-tint"],
  ["--fw-node-service-ink", "--fw-node-service-tint"],
  ["--fw-node-end-ink", "--fw-node-end-tint"],
];

afterEach(() => {
  delete document.body.dataset.fwTheme;
  document.head.querySelector("style[data-palette]")?.remove();
});

describe.each(PALETTES.map((palette) => [palette.label, palette] as const))(
  "färgskalan %s",
  (_label, palette) => {
    describe.each([["ljust läge", "light"], ["mörkt läge", "dark"]])("%s", (_mode, theme) => {
      test.each(ACCENT_PAIRS)("%s mot %s klarar AA (4.5:1)", (fg, bg) => {
        applyPalette(palette);
        document.body.dataset.fwTheme = theme;

        expect(token(fg), `saknar token ${fg}`).not.toBe("");
        expect(
          contrastRatio(token(fg), token(bg)),
          `${token(fg)} mot ${token(bg)}`,
        ).toBeGreaterThanOrEqual(4.5);
      });
    });
  },
);

test("sidan runt omkring följer med, som i mörkt läge: accenten sätts på :root i båda lägena", () => {
  const rootToken = (name: string): string =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const before = rootToken("--fw-primary");

  applyPalette(PALETTES[0]);
  expect(rootToken("--fw-primary")).toBe(PALETTES[0].light["--fw-primary"]);
  expect(rootToken("--fw-primary")).not.toBe(before);

  document.documentElement.dataset.theme = "dark";
  expect(rootToken("--fw-primary")).toBe(PALETTES[0].dark["--fw-primary"]);
  delete document.documentElement.dataset.theme;
});

test("skalan byter accenten — annars mäter testet ovan bara standarden", () => {
  const before = token("--fw-primary");

  applyPalette(PALETTES[0]);

  expect(token("--fw-primary")).not.toBe(before);
});

/*
 * The family is the contract (story 140): a scale that leaves one of the nine
 * out leaves that one indigo, and the contrast pairs above never read
 * `-hover`, `-surface-2`, `-border`, `-muted` or the focus ring. The nine are
 * read from the default tokens rather than listed here, so a tenth added there
 * is a tenth every scale must carry.
 */
test("varje skala sätter hela primärfamiljen, i båda lägena", () => {
  const family = new Set(
    [...MIXINS.matchAll(/(--fw-(?:primary(?:-[a-z0-9-]+)?|on-primary|focus-ring))\s*:/g)].map(
      (match) => match[1],
    ),
  );

  expect(family.size, [...family].join(", ")).toBe(9);

  for (const palette of PALETTES) {
    for (const mode of ["light", "dark"] as const) {
      const missing = [...family].filter((name) => !(name in palette[mode]));

      expect(missing, `${palette.id} ${mode}`).toEqual([]);
    }
  }
});
