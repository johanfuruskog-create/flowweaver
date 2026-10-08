import { describe, expect, test } from "vitest";

import { evaluateCondition } from "./rule-evaluator";

import type { RuleCondition } from "../types/graph";

/**
 * "Alla är" och "inte alla är" — de två frågorna en lista hade men saknade ord för.
 *
 * ## Varför de behövs
 *
 * `one-of` frågar om NÅGOT av svaren finns i listan, och det är rätt fråga för
 * *har du EU-medborgarskap*. Det är fel fråga för *är du nordisk*: den som har
 * ett danskt och ett turkiskt medborgarskap är inte självklart nordisk, och
 * med bara `one-of` gick den grenen inte att uttrycka. Johans fråga 31/8, i
 * medborgarskapsexemplet: *"kan det vara alla ska vara och alla får inte
 * vara?"* På en mängd finns fyra frågor, och vi hade två.
 *
 * ## Tomt svar är falskt för BÅDA
 *
 * `all-of` är falskt för att ingenting inte är "alla". `not-all-of` är falskt
 * av samma skäl som evaluatorns kommentar ger om tomma poster: den vidaste
 * grenen får inte nås av den som inte har svarat.
 *
 * Det är också den enda punkt där `not-all-of` och `not-one-of` skiljer sig —
 * se ekvivalensen längst ned.
 */

const villkor = (
  value: string,
  operator: RuleCondition["operator"],
): RuleCondition => ({ id: "c", variableName: "land.value", operator, value });

const matchar = (condition: RuleCondition, answer: string | string[]): boolean => {
  const result = evaluateCondition(condition, answer);

  return result.success && result.matches;
};

const NORDEN = "SE,DK,FI,NO,IS";

describe("alla är", () => {
  test("är sant när varje svar finns i listan", () => {
    expect(matchar(villkor(NORDEN, "all-of"), ["SE", "DK"])).toBe(true);
  });

  test("och falskt så snart ett svar saknas i den", () => {
    // Fallet berättelsen är skriven för: svenskt och tyskt medborgarskap.
    expect(matchar(villkor(NORDEN, "all-of"), ["SE", "DE"])).toBe(false);
  });

  test("läser också det radbrytningsseparerade svaret flervalsfrågan lagrar", () => {
    // Flervalsfrågan lagrar `chosen.join("\n")` — mätt i motorn, inte antaget.
    expect(matchar(villkor(NORDEN, "all-of"), "SE\nDK")).toBe(true);
    expect(matchar(villkor(NORDEN, "all-of"), "SE\nDE")).toBe(false);
  });

  test("ignorerar mellanslagen någon skriver runt kommatecknen", () => {
    expect(matchar(villkor("SE, DK , FI", "all-of"), ["DK", "FI"])).toBe(true);
  });

  test("ett tomt svar är inte 'alla'", () => {
    expect(matchar(villkor(NORDEN, "all-of"), "")).toBe(false);
    expect(matchar(villkor(NORDEN, "all-of"), [])).toBe(false);
    // Halvfärdiga svar räknas inte som svar — samma regel som `one-of`.
    expect(matchar(villkor(NORDEN, "all-of"), "\n\n")).toBe(false);
  });

  test("en tom lista att jämföra mot rymmer ingenting", () => {
    // Villkoret är halvfärdigt, och då ska grenen inte tas. Att svara ja hade
    // gjort den vidaste grenen nåbar genom ett skrivfel.
    expect(matchar(villkor("", "all-of"), ["SE"])).toBe(false);
  });
});

describe("inte alla är", () => {
  test("är sant när minst ett svar saknas i listan", () => {
    expect(matchar(villkor(NORDEN, "not-all-of"), ["SE", "DE"])).toBe(true);
  });

  test("och falskt när varenda ett finns där", () => {
    expect(matchar(villkor(NORDEN, "not-all-of"), ["SE", "DK"])).toBe(false);
  });

  test("ett tomt svar når inte den vidaste grenen", () => {
    /*
     * Här skiljer den sig från `not-one-of`, som ÄR sann för den som inte
     * svarat ("hen är inte i listan"). Skillnaden är avsiktlig och skriven i
     * berättelsen: `not-all-of` är den vidare grenen av de två, och den som
     * inte svarat ska inte hamna där.
     */
    expect(matchar(villkor(NORDEN, "not-all-of"), "")).toBe(false);
    expect(matchar(villkor(NORDEN, "not-all-of"), [])).toBe(false);
  });
});

/**
 * Ekvivalensen, skriven som test så den aldrig glider.
 *
 * På ett ENSKILT svar är `all-of` samma fråga som `one-of`, och `not-all-of`
 * samma som `not-one-of`. Det är därför de inte erbjuds på en envärd variabel:
 * de vore dubbletter där.
 *
 * Undantaget är det tomma svaret, som inte är ett enskilt svar utan inget alls.
 * Där skiljer de sig med flit, och det står som eget påstående nedan så att
 * ingen läser tabellen som att den gäller även då.
 */
describe("på ett enskilt svar är de dubbletter", () => {
  const enskilda = ["SE", "DE", "XS", ""];

  test.each(enskilda.filter((one) => one !== ""))(
    "all-of ≡ one-of för %s",
    (svar) => {
      expect(matchar(villkor(NORDEN, "all-of"), svar))
        .toBe(matchar(villkor(NORDEN, "one-of"), svar));
    },
  );

  test.each(enskilda.filter((one) => one !== ""))(
    "not-all-of ≡ not-one-of för %s",
    (svar) => {
      expect(matchar(villkor(NORDEN, "not-all-of"), svar))
        .toBe(matchar(villkor(NORDEN, "not-one-of"), svar));
    },
  );

  test("utom för det tomma svaret, där de skiljer sig med flit", () => {
    expect(matchar(villkor(NORDEN, "not-one-of"), "")).toBe(true);
    expect(matchar(villkor(NORDEN, "not-all-of"), "")).toBe(false);
  });
});

/**
 * Ett villkor med en okänd operator kastas tyst av `RuleCasesService`, så en
 * ny operator som inte står i vitlistan försvinner ur grafen vid inläsning
 * utan ett ljud. Testet ligger här för att felet syns i motorn.
 */
describe("de nya operatorerna överlever inläsningen", () => {
  test("regelns fall behåller ett villkor med all-of", async () => {
    const { RuleCasesService } = await import("../services/rule-cases-service");
    const node = {
      id: "regel",
      type: "rule",
      position: { x: 0, y: 0 },
      data: {
        cases: [{
          id: "norden",
          label: "Norden",
          match: "any",
          conditions: [villkor(NORDEN, "all-of")],
        }],
      },
    } as const;

    const cases = RuleCasesService.getCases(node as never);

    expect(cases[0]?.conditions).toHaveLength(1);
    expect(cases[0]?.conditions[0]?.operator).toBe("all-of");
  });
});
