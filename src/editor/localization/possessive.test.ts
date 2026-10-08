import { describe, expect, test } from "vitest";

import { possessive } from "./possessive";

/**
 * Genitivregeln, som två ytor delar (berättelse 129).
 *
 * Krockrutan säger *Ladda om och se Anna Anderssons ändringar* och värdsidans
 * rad frågar *börja från Anna Anderssons version?* — om samma person, i samma
 * ögonblick. Skrivs regeln på två ställen stavar de en dag olika, och det syns
 * bara för den som heter så.
 *
 * Det är därför det här är en regel och inte en sträng: ett `+ "s"` är rätt
 * för de flesta namn och fel för några, och det är precis de få som märker det.
 */
describe("namn i genitiv", () => {
  test("svenskan lägger till ett s", () => {
    expect(possessive("Anna Andersson", "sv")).toBe("Anna Anderssons");
    expect(possessive("Johan Furuskog", "sv")).toBe("Johan Furuskogs");
  });

  /*
   * Och inte på ett namn som redan slutar på s-ljud. *Nilss version* är fel
   * svenska; *Nils version* är rätt, och det är hela skälet att funktionen
   * finns i stället för en sammanfogning på plats.
   */
  test("men inte på ett namn som redan slutar på s, x eller z", () => {
    expect(possessive("Nils", "sv")).toBe("Nils");
    expect(possessive("Alex", "sv")).toBe("Alex");
    expect(possessive("Fritz", "sv")).toBe("Fritz");
    expect(possessive("Nisse Hult", "sv"), "bara sista bokstaven avgör").toBe("Nisse Hults");
  });

  /*
   * Engelskan gör något annat, och det är andra halvan av varför regeln inte
   * kan stå i en sträng: `{name}s` hade varit fel engelska för varje namn.
   */
  test("engelskan sätter apostrof, och släpper s:et efter ett s-ljud", () => {
    expect(possessive("Anna Andersson", "en")).toBe("Anna Andersson's");
    expect(possessive("Nils", "en")).toBe("Nils'");
  });

  /*
   * Ett tomt namn ger en tom sträng och aldrig ett ensamt `s`. Den som anropar
   * har då ingen att namnge, och en genitiv av ingenting är det värsta av
   * svaren: *s ändringar*.
   */
  test("utan namn blir det ingenting, aldrig ett ensamt s", () => {
    expect(possessive("", "sv")).toBe("");
    expect(possessive("   ", "sv")).toBe("");
    expect(possessive("", "en")).toBe("");
  });

  /*
   * Och det som kommer in är en värds sessionsuppgift, alltså vad som helst i
   * en JavaScript-värld. Ett kast här hade slagit ut hela krockrutan i stället
   * för att stava ett namn konstigt.
   */
  test("något som inte är en sträng kastar inte", () => {
    expect(possessive(undefined as unknown as string, "sv")).toBe("");
    expect(possessive(42 as unknown as string, "sv")).toBe("42s");
  });
});
