import { describe, expect, test } from "vitest";

import { FormattedTextService } from "./formatted-text-service";

/**
 * Raderna står kvar som redaktören skrev dem.
 *
 * ## Varför det här är ett kontrakt och inte en detalj
 *
 * En **enkel radbrytning blir `<br>`**, en **tom rad blir ett nytt stycke**.
 * Det avviker med flit från vanlig markdown, där en enkel radbrytning ignoreras
 * och två mellanslag i radslutet krävs för att få en.
 *
 * Avvikelsen är rätt här: en redaktör som skriver en adress på tre rader har
 * aldrig hört ordet markdown och menar tre rader. Att slå ihop dem vore att
 * svara på en fråga hen inte ställt.
 *
 * Men just för att det är en avvikelse är det osynligt. Ingenting i
 * verktygsraden nämner det, och nästa som rör renderaren kan mycket väl
 * "rätta" beteendet till markdowns. Då står tre kommuners öppettider på en
 * rad, och det upptäcks av en besökare.
 *
 * ## Vad testet inte påstår
 *
 * Att `<br>` är rätt HTML för allt det används till. En adress är egentligen
 * ett stycke med radbrytningar, och en öppettidstabell är egentligen en
 * tabell — men tabeller hör inte hemma i formatet (se berättelse 058), och en
 * adress med `<br>` är det närmaste man kommer utan att be redaktören lära sig
 * något nytt.
 */

const FORMAT = ["bold", "italic", "link", "bullet-list", "numbered-list"] as const;

const html = (text: string): string =>
  FormattedTextService.render(text, [...FORMAT]).html;

describe("radbrytningar", () => {
  test("en enkel radbrytning blir en radbrytning", () => {
    expect(html("Öppettider\nMåndag–torsdag 8–16")).toBe(
      "<p>Öppettider<br>Måndag–torsdag 8–16</p>",
    );
  });

  test("en tom rad blir ett nytt stycke", () => {
    expect(html("Först\n\nSedan")).toBe("<p>Först</p><p>Sedan</p>");
  });

  test("och en adress på tre rader står på tre rader", () => {
    /*
     * Fallet som gav upphov till testet. Slås raderna ihop står gatan, orten
     * och postnumret i en enda mening.
     */
    expect(html("Besöksadress\nStorgatan 1\n852 30 Sundsvall")).toBe(
      "<p>Besöksadress<br>Storgatan 1<br>852 30 Sundsvall</p>",
    );
  });

  test("flera tomma rader ger inte flera tomma stycken", () => {
    // Annars blir ett extra tangenttryck ett osynligt hål i texten.
    expect(html("Först\n\n\n\nSedan")).toBe("<p>Först</p><p>Sedan</p>");
  });

  test("inledande och avslutande tomrum ger inga tomma stycken", () => {
    expect(html("\n\nText\n\n")).toBe("<p>Text</p>");
  });
});

describe("radbrytningar tillsammans med listor", () => {
  test("en lista bryter stycket före sig", () => {
    expect(html("Ta med:\n- pass\n- kvitto")).toBe(
      "<p>Ta med:</p><ul><li>pass</li><li>kvitto</li></ul>",
    );
  });

  test("och texten efter listan blir ett eget stycke", () => {
    expect(html("- pass\n- kvitto\nAllt är obligatoriskt")).toBe(
      "<ul><li>pass</li><li>kvitto</li></ul><p>Allt är obligatoriskt</p>",
    );
  });

  test("en punktlista och en numrerad blir två listor", () => {
    // Annars ärver den andra listans punkter den förstas sort.
    expect(html("- ett\n1. två")).toBe("<ul><li>ett</li></ul><ol><li>två</li></ol>");
  });
});

describe("inline-läget, som rubriker använder", () => {
  test("ger ingen blockmarkup", () => {
    /*
     * Ett `<p>` inuti ett `<h2>` är ogiltig markup. Rubriken får sina
     * inline-format, inget annat.
     */
    const rubrik = FormattedTextService.render(
      "Jag godkänner [villkoren](/villkor)",
      ["bold", "italic", "link"],
      {},
      undefined,
      undefined,
      true,
    ).html;

    expect(rubrik).not.toContain("<p>");
    expect(rubrik).toContain("<a ");
  });

  test("och en radbrytning i en rubrik blir ett mellanslag", () => {
    // En rubrik är en rad. Bryts den blir det två rubriker i ögat, en i koden.
    const rubrik = FormattedTextService.render(
      "Två\nrader",
      ["bold", "italic"],
      {},
      undefined,
      undefined,
      true,
    ).html;

    expect(rubrik).toBe("Två rader");
  });
});
