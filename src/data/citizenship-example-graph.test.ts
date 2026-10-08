import { describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";

import { GuideTraversalEngine } from "../viewer/core/guide-traversal-engine";
import { citizenshipExampleGraph } from "./citizenship-example-graph";

/**
 * Den plurala medborgarskapsguiden måste faktiskt gå att gå igenom.
 *
 * Kedjan guiden påstår har tre led, och varje led är ett ställe där en
 * handskriven fixtur går tyst fel: fältet lagrar flera koder i EN variabel,
 * regeln läser den variabeln som en lista, och rätt resultat nås. Inget av
 * felen skulle kasta ett undantag — de skulle skicka alla till standardgrenen,
 * alltså ge sämsta beskedet till den som har rätt till det bästa.
 *
 * Testet skrevs efter att just det felet hittats: `one-of` jämförde hela
 * svarssträngen `"DK\\nTR"` mot sin lista och matchade aldrig.
 */

const engine = (): GuideTraversalEngine =>
  new GuideTraversalEngine(structuredClone(citizenshipExampleGraph));

/** Svarar på medborgarskapsfrågan och returnerar noden man hamnar på. */
function svara(koder: string[]): string {
  const motor = engine();

  /*
   * Paren som svar — etikett och kod tillsammans, ett värde per val. Precis så
   * uppslagsfältet lämnar ifrån sig ett flervärt svar sedan version 9, då
   * koden slutade vara en variabel bredvid. Det är hela poängen med guiden:
   * en regel som testar "Danmark" slutar fungera den dag någon läser den på
   * engelska, för etiketten är översatt och koden är det inte.
   */
  const result = motor.answerValue(
    koder.map((kod) => ({ label: `Land ${kod}`, value: kod })),
  );

  return result.success ? result.node.id : `misslyckades: ${result.error?.code}`;
}

describe("medborgarskapsguiden med flera svar", () => {
  test("frågar efter flera, inte ett", () => {
    const fråga = citizenshipExampleGraph.nodes.find((one) => one.id === "medborgarskap")!;

    expect(fråga.type).toBe("multi-autocomplete-question");
  });

  test("ett nordiskt medborgarskap leder till att ingen ansökan behövs", () => {
    expect(svara(["DK"])).toBe("resultat-norden");
  });

  test("och två nordiska tillsammans", () => {
    expect(svara(["SE", "DK"])).toBe("resultat-norden");
  });

  test("men ett nordiskt OCH ett icke-nordiskt gör det inte", () => {
    /*
     * Johans fråga 31/8: *"kan det vara alla ska vara och alla får inte
     * vara?"* Den som har svenskt och tyskt medborgarskap är inte självklart
     * nordisk, och grenen menade tidigare "något av dina medborgarskap är
     * nordiskt" fast den heter Norden. Med `all-of` menar den vad den heter:
     * varenda ett måste vara det.
     *
     * Det här är berättelse 061:s kriterium, skrivet som två fall så att både
     * det svenska och det danska paret prövas — en `all-of` som råkade läsa
     * BARA första svaret hade sluppit undan med ett.
     */
    expect(svara(["SE", "DE"])).toBe("resultat-ovrigt");
    expect(svara(["DK", "TR"])).toBe("resultat-ovrigt");
  });

  test("utan nordiskt medborgarskap gäller uppehållstillstånd", () => {
    expect(svara(["TR", "DE"])).toBe("resultat-ovrigt");
  });

  test("statslös har sin egen väg", () => {
    expect(svara(["XS"])).toBe("resultat-statslos");
  });
});
