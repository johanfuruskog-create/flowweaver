import { describe, expect, test } from "vitest";

/**
 * Samma hjälpare skriven två gånger fälls här.
 *
 * ## Vad som hände
 *
 * `escapeHtml` fanns i **tio** kopior — varje komponent som bygger sin
 * skugg-DOM med en mall-literal hade en egen, alla identiska. Johan frågade
 * varför koden dupliceras så, och svaret var inte ett skäl utan en väg: när
 * man bygger en komponent arbetar man inuti den, och att räcka utanför kostar
 * en sökning medan en kopia kostar fem sekunder.
 *
 * Att den kopierades tio gånger säger också att ingen hittade någon att
 * använda. Nu finns en — och den elfte kopian fälls här i stället för att
 * upptäckas av någon som råkar leta.
 *
 * ## Varför en grind och inte en regel i PRAXIS
 *
 * För att en regel kräver att någon minns den vid rätt ögonblick, och det
 * ögonblicket är mitt i något annat. En grind frågar aldrig.
 *
 * ## Varför den läser filer via Vite
 *
 * Tester under `src/` läser aldrig `node:fs` — se `CLAUDE.md`. `import.meta.glob`
 * ger innehållet vid bygget, vilket också gör att grinden inte kan råka läsa
 * något utanför repot.
 */

const KÄLLOR = import.meta.glob("../**/*.ts", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

/** Hjälpare som ska finnas på ETT ställe, och var det stället är. */
const DELADE: Array<{ namn: string; mönster: RegExp; hem: string }> = [
  {
    namn: "escapeHtml",
    // En egen definition, oavsett vad den heter lokalt: fyra `.replace` i rad
    // som byter ut `&` mot `&amp;` är den här hjälparen och ingen annan.
    mönster: /replace\(\/&\/g,\s*["']&amp;["']\)/,
    hem: "viewer/core/escape-html.ts",
  },
  {
    namn: "interpolate",
    // `{namn}` bytt mot ett värde ur en karta.
    mönster: /replace\(\/\\?\{\(\\w\+\)\\?\}\/g/,
    hem: "viewer/core/ui-strings.ts",
  },
];

describe("hjälpare som ska finnas på ett ställe", () => {
  for (const { namn, mönster, hem } of DELADE) {
    test(`${namn} är inte kopierad`, () => {
      const kopior = Object.entries(KÄLLOR)
        .filter(([väg]) => !väg.includes(".test.") && !väg.includes("/gates/"))
        .filter(([väg]) => !väg.endsWith(`../${hem}`))
        .filter(([, innehåll]) => mönster.test(innehåll))
        .map(([väg]) => väg.replace("../", "src/"));

      expect(
        kopior,
        `${namn} finns i ${hem} — importera den i stället för att skriva en till:\n- ${kopior.join("\n- ")}`,
      ).toEqual([]);
    });
  }
});
