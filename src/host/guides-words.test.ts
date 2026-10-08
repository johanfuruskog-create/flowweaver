import { describe, expect, test } from "vitest";

import { GUIDES_WORD_KEYS, guideWords } from "./guides-words";
import { WORDS } from "./guide-storage-words";

/**
 * Orden på *Mina guider* (berättelse 126, kriterium 4).
 *
 * ## Varför den här filen finns bredvid `guide-storage-words.test.ts`
 *
 * Två sidor talar nu om samma tre saker — arbetskopian, det publicerade och
 * historiken — och de skrevs av två olika omgångar. Den ordlistan har ett test
 * som fäller synonymer *inom* sig; det här fäller dem **mellan** de två. Ett
 * *Utgiven* på listsidan bredvid ett *Publicerad* i editorn är två ord om en
 * sak, och den som läser dem börjar leta efter skillnaden.
 *
 * Det är precis det fel kodbasen oftast gör: samma sak skriven på två ställen,
 * som glider isär. Här är den skriven på två ställen med flit — sidorna har
 * olika språkaxlar — så kontrollen är vad som håller dem lika.
 */

const sv = guideWords("sv");
const en = guideWords("en");

describe("orden på Mina guider", () => {
  test("båda språken har varje nyckel, och ingen är tom", () => {
    const missing = GUIDES_WORD_KEYS.filter((key) => sv(key).trim() === "" || en(key).trim() === "");

    expect(missing, "en tom sträng ritas som ingenting och märks först i en skärmbild").toEqual([]);
  });

  /*
   * Och de är faktiskt översatta. Samma byte i båda kolumnerna betyder nästan
   * alltid att någon glömde den ena — samma mätning som `site-translation`
   * gör på sidorna, gjord här därför att de här strängarna aldrig står i
   * markupen och alltså är osynliga för den grinden.
   */
  test("engelskan är inte en kopia av svenskan", () => {
    const same = GUIDES_WORD_KEYS.filter((key) => sv(key) === en(key));

    // *1 guide* stavas likadant på båda språken, och det är hela listan.
    expect(same).toEqual(["countOne"]);
  });

  test("de tre orden är editorsidans tre ord", () => {
    expect(sv("published"), "det besökarna ser heter samma sak på båda sidorna").toBe(
      WORDS.published,
    );
  });

  /*
   * Och ordet för motsatsen, som rättades 19/9: editorns rad sa *Ingen version
   * är publicerad än* medan listan sa *Inte publicerad än* om samma guide. Ett
   * tillstånd, ett uttryck — det är hela skälet att den här filen finns.
   */
  test("och det som inte publicerats heter samma sak på båda sidorna", () => {
    expect(WORDS.statusFirst.startsWith(sv("unpublished"))).toBe(true);
  });

  test("ingen synonym för det publicerade", () => {
    const everything = GUIDES_WORD_KEYS.map((key) => sv(key));

    expect(everything.filter((text) => /utgiven|skarp|live/i.test(text))).toEqual([]);
  });

  /*
   * Berättelse 127: listan är organisationens, och tre nya meningar hänger på
   * det. Den som säger *dina guider* över allas är den som får någon att leta
   * efter varför kollegans guide står där.
   */
  test("rubriken och ingressen talar om allas guider, inte mina", () => {
    expect(sv("title")).toBe("Guider");
    expect(en("title")).toBe("Guides");

    const mineish = GUIDES_WORD_KEYS.filter(
      (key) => key !== "onlyMine" && key !== "onlyMineHint" && key !== "noneMine",
    ).filter((key) => /\bdina guider\b|\bmina guider\b/i.test(sv(key)));

    expect(mineish, "bara filtret får tala om mina — resten är allas").toEqual([]);
  });

  test("raden säger vem när värden vet, och bara datumet när den inte gör det", () => {
    expect(sv("changedBy", { when: "17 sep. 2026 22:50", name: "Nisse Hult" })).toBe(
      "Ändrad 17 sep. 2026 22:50 av Nisse Hult",
    );
    expect(en("changedBy", { when: "17 Sep 2026, 22:50", name: "Nisse Hult" })).toBe(
      "Changed 17 Sep 2026, 22:50 by Nisse Hult",
    );
    expect(sv("changed", { when: "17 sep. 2026 22:50" })).toBe("Ändrad 17 sep. 2026 22:50");
  });

  /*
   * Rollerna (berättelse 128). De står på två sidor och måste heta samma sak:
   * en *förvaltare* i remsan över editorn och en *administratör* i listans
   * remsa är två ord om en roll, och den som läser dem börjar leta efter
   * skillnaden — samma fel den här filen finns för.
   */
  test("rollernas ord är editorsidans ord, alla fyra", () => {
    expect(sv("roleReader")).toBe(WORDS.roleReader);
    expect(sv("roleEditor")).toBe(WORDS.roleEditor);
    expect(sv("rolePublisher")).toBe(WORDS.rolePublisher);
    expect(sv("roleAdmin")).toBe(WORDS.roleAdmin);
  });

  test("remsan säger både vem och vad, i båda språken", () => {
    expect(sv("signedInAsRole", { name: "Monika Ågren", role: sv("roleReader") })).toBe(
      "Inloggad som Monika Ågren · läsare",
    );
    expect(en("signedInAsRole", { name: "Monika Ågren", role: en("roleReader") })).toBe(
      "Signed in as Monika Ågren · reader",
    );
  });

  /*
   * Och att knappen saknas sägs i ord (kriterium 6). Meningen måste namnge
   * rollen som får: *Du har inte behörighet* är ett besked man inte kan göra
   * något åt, *bara en förvaltare* är någon att fråga.
   */
  test("den saknade knappen förklaras, och pekar ut vem som får", () => {
    expect(sv("onlyAdminCanCreate")).toContain(sv("roleAdmin"));
    expect(en("onlyAdminCanCreate")).toContain(en("roleAdmin"));
    expect(sv("onlyAdminCanCreate")).not.toMatch(/behörighet|rättighet/i);
  });

  /*
   * Räknaren (18/9, när väljaren blev en vanlig sökruta). Två former, och den
   * andra är hela skälet: *2 guider* över en filtrerad lista svarar på en
   * annan fråga än den man har, nämligen hur många som finns.
   */
  test("räknaren säger hur mycket av allt man ser", () => {
    expect(sv("count", { n: 5 })).toBe("5 guider");
    expect(en("count", { n: 5 })).toBe("5 guides");
    expect(sv("countOne")).toBe("1 guide");
    expect(sv("countFiltered", { n: 2, m: 5 })).toBe("2 av 5 guider");
    expect(en("countFiltered", { n: 2, m: 5 })).toBe("2 of 5 guides");
  });

  /*
   * Och den tomma sökningen säger vad som hände och hur man tar sig ur det.
   * *Ingen guide i listan heter så* stod här medan sökningen var en väljare
   * man valde ur en lista; med ett fritextfält finns ingen lista att peka på.
   */
  test("den tomma sökningen har ett besked och en väg ut", () => {
    expect(sv("noMatches")).toBe("Ingen guide heter så.");
    expect(en("noMatches")).toBe("No guide is called that.");
    expect(sv("clearSearch")).toBe("Rensa sökningen");
  });

  test("filtret har en etikett och en förklaring av vad mina betyder", () => {
    expect(sv("onlyMine")).toBe("Bara mina");
    expect(sv("onlyMineHint")).toMatch(/skapat|ändrat/);
  });

  /*
   * Fyra tomma skärmar, och de säger olika saker. En tom skärm som ljuger om
   * varför är en tom skärm någon svarar på genom att skapa en guide till.
   */
  test("tomma listan och tomma filtret är två olika besked", () => {
    expect(sv("none")).not.toBe(sv("noneMine"));
    expect(sv("noneMine"), "vägen tillbaka står i beskedet").toContain("Bara mina");
    expect(sv("none")).not.toMatch(/\bdu har\b/i);
  });

  test("ingen rad gissar någons kön", () => {
    const gendered = GUIDES_WORD_KEYS.filter((key) =>
      /\b(hans|hennes|han|hon|honom|henne)\b/i.test(sv(key, { name: "Kim", when: "W", label: "L" })),
    );

    expect(gendered).toEqual([]);
  });

  test("platshållarna fylls i, och lämnar inget kvar", () => {
    expect(sv("signedInAs", { name: "Johan Furuskog" })).toBe("Inloggad som Johan Furuskog");
    expect(en("signedInAs", { name: "Johan Furuskog" })).toBe("Signed in as Johan Furuskog");
    expect(sv("openGuide", { name: "Bygglov" })).toBe("Öppna Bygglov");
    expect(sv("changed", { when: "18 sep 2026" })).toBe("Ändrad 18 sep 2026");

    const leftovers = GUIDES_WORD_KEYS.map((key) =>
      sv(key, {
        name: "N",
        when: "W",
        label: "L",
        n: 2,
        m: 5,
        term: "T",
        role: "R",
        // Arbetsanteckningens egna ord (berättelse 130).
        text: "X",
      }),
    ).filter((text) => /\{[a-z]+\}/i.test(text));

    expect(leftovers, "en platshållare som står kvar läses som en bugg i gränssnittet").toEqual([]);
  });
});
