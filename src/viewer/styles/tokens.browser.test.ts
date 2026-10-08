import { afterEach, describe, expect, test } from "vitest";

import { contrastRatio } from "../../testing/contrast-ratio";

/*
 * The tokens sit on FlowWeaver's own tags, one step down from `:root`. The test
 * therefore reads them from the opt-in class the test setup put on `<body>` —
 * the same route a host takes to dress a whole area.
 */
function scope(): HTMLElement {
  return document.body;
}

// tokens.scss laddas av test-setup/browser.ts, så :root bär alla tokens här.

function token(name: string): string {
  return getComputedStyle(scope()).getPropertyValue(name).trim();
}

afterEach(() => {
  delete scope().dataset.fwTheme;
});

describe("dark mode (a token swap)", () => {
  test("surfaces, text and borders darken; the solid colours stay", () => {
    scope().dataset.fwTheme = "light";
    const lightSurface = token("--fw-surface");
    const lightText = token("--fw-text");

    scope().dataset.fwTheme = "dark";
    expect(token("--fw-surface")).not.toBe(lightSurface);
    expect(token("--fw-text")).not.toBe(lightText);

    /*
     * Nodhuvudenas solidfärger BYTER sedan 22/9 (alternativ B). Raden sa
     * tidigare att de står kvar och bär vit text i båda lägen; det var sant
     * fram till dess, och det var också felet — fyllningen var enda gruppen
     * utan mörk variant medan allt runt den vände.
     */
    expect(token("--fw-node-content")).toBe("#6c72ea");
    expect(token("--fw-on-node")).toBe("#10131f");
  });

  test("badge ink lightens in dark mode so the glyph carries against the dark tint", () => {
    scope().dataset.fwTheme = "light";
    // I ljust läge är ink = solid (ingen visuell ändring mot tidigare).
    expect(token("--fw-node-content-ink")).toBe(token("--fw-node-content"));

    scope().dataset.fwTheme = "dark";
    // I mörkt läge skiljer sig ink från solid (en ljusare nyans).
    expect(token("--fw-node-content-ink")).not.toBe(token("--fw-node-content"));
    expect(token("--fw-node-end-ink")).not.toBe(token("--fw-node-end"));
  });

  /*
   * Alternativ B, Johan 22/9: fyllningarna får varsin mörk variant med samma
   * nyans, ljusare, så att bläcket kan bli mörkt. Det här vaktar de tre
   * påståenden som bär beslutet — att varianten finns, att den skiljer sig,
   * och att bläcket räcker mot den.
   */
  const FAMILIES = ["content", "rule", "calc", "service", "end"] as const;

  test("varje nodfyllning har en mörk variant, skild från den ljusa", () => {
    scope().dataset.fwTheme = "light";
    const ljusa = FAMILIES.map((f) => token(`--fw-node-${f}`));

    scope().dataset.fwTheme = "dark";
    for (const [index, family] of FAMILIES.entries()) {
      expect(token(`--fw-node-${family}`), `${family} har en egen mörk fyllning`)
        .not.toBe(ljusa[index]);
    }
  });

  test("bläcket på en nod når 4,5:1 mot varje fyllning, i båda lägen", () => {
    for (const läge of ["light", "dark"] as const) {
      scope().dataset.fwTheme = läge;

      const ink = token("--fw-on-node");

      for (const family of FAMILIES) {
        const fill = token(`--fw-node-${family}`);

        expect(
          contrastRatio(ink, fill),
          `${family} i ${läge}: ${ink} mot ${fill}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  /*
   * Brickan är inte bläcket. `--fw-node-marking` är den ljusa rundeln som
   * `--fw-node-header` står mörk på, och den ska INTE vända — gjorde den det
   * blev den nästan svart under en nästan svart glyf (1,3:1, mätt 22/9 innan
   * tokenet delades i två).
   */
  test("märkningen är ljus i båda lägen och bär sin mörka glyf", () => {
    for (const läge of ["light", "dark"] as const) {
      scope().dataset.fwTheme = läge;

      expect(token("--fw-node-marking"), `märkningen i ${läge}`).toBe("#ffffff");
      expect(
        contrastRatio(token("--fw-node-marking"), token("--fw-node-header")),
        `glyfen på märkningen i ${läge}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
