import { describe, expect, test } from "vitest";

import { WORDS } from "./guide-storage-words";

/**
 * Konsekvensmeningen som en läsare möter den, utan att bry sig om vilken del
 * som väger tyngre. Delarna finns för att tiden ska synas (Johan 19/9); det
 * som prövas här är orden.
 */
const somText = (delar: ReturnType<typeof WORDS.takeOverMessage>): string =>
  typeof delar === "string"
    ? delar
    : delar.map((del) => (typeof del === "string" ? del : del.strong)).join("");

/**
 * Att orden håller ihop (berättelse 124, kriterium 22).
 *
 * Johan 18/9: *"fattar man återställ?"* Ett ord fattas när det betyder samma
 * sak varje gång, och den här kontrollen är vad som håller det sant i morgon:
 * synonymer smyger in en i taget, av någon som skriver en enda mening och inte
 * vet att ordet redan var valt.
 *
 * Läser hela ordlistan, inte de nycklar någon kom ihåg att lägga till.
 */

/** Varje sträng i listan, även de som byggs av en funktion. */
const everything = (): string[] =>
  Object.values(WORDS as Record<string, unknown>).flatMap((value) => {
    if (typeof value === "string") {
      return [value];
    }

    // Två anrop per funktion: ett med två tal, ett med tal och klockslag. Det
    // täcker varje mening listan kan bygga.
    const build = value as (...args: unknown[]) => string;

    return [build(3, 2), build(1, "08:52")];
  });

describe("sidans ord", () => {
  test("ingen säger återta eller nollställ", () => {
    const forbidden = everything().filter((text) => /återta|nollställ/i.test(text));

    expect(forbidden, "återställ är ordet — och bara det").toEqual([]);
  });

  /*
   * *Återställ* utan nummer läser som *ångra allt*. Med nummer är det en
   * handling med ett mål: den här versionen, inte "tillbaka".
   */
  test("inget ensamt Återställ — numret följer alltid med", () => {
    /*
     * Ett undantag, listat och inte tillåtet av en regel: raden under
     * historikens rubrik förklarar vad *Återställ* är för något, och där är
     * ordet handlingens namn och inte en knapp. Meningen står ordagrant i
     * berättelsen (kriterium 22).
     *
     * Kontrollen fällde den direkt när den skrevs — vilket är exakt vad den
     * ska göra med varje ny mening som inte tänkt på numret.
     */
    const bare = everything()
      .filter((text) => text !== WORDS.historyNote)
      .filter((text) => /återställ/i.test(text) && !/version \d+/i.test(text));

    expect(bare, "varje knapp och fråga om återställning namnger versionen").toEqual([]);
  });

  test("ingen fråga nöjer sig med Är du säker", () => {
    expect(everything().filter((text) => /är du säker/i.test(text))).toEqual([]);
    /*
     * And the consequence names the work that goes and whether it comes back
     * (B3b, Astra 30/9, bilaga 6). The question is asked only when the working
     * copy differs from the published version; `PUT …/draft` replaces the one
     * working copy, versions are made only by publishing, and `editor.graph =`
     * resets the undo history — so what was changed since cannot be had back.
     */
    expect(WORDS.restoreMessage(3, 2), "frågan säger konsekvensen i stället").toBe(
      "Version 3 ersätter din arbetskopia. Ändringarna i den sedan version 2 går inte att få tillbaka. " +
        "Besökarna ser fortfarande version 2 tills du publicerar.",
    );
  });

  /*
   * Och de tre orden är de tre orden. *Utkast* om arbetskopian var vad sidan sa
   * i går, och två ord om en sak gör att man börjar leta efter skillnaden.
   */
  test("arbetskopian heter arbetskopia, aldrig utkast", () => {
    expect(everything().filter((text) => /utkast/i.test(text))).toEqual([]);
    expect(WORDS.badgeWorkingCopy).toBe("Arbetskopia");
  });

  /*
   * Litet v mitt i en fras. *Version 2* med stort V är radens namn; *återställ
   * version 2* är en mening om den. Kontrollen finns för att ett stort V smyger
   * in varje gång någon klistrar in radens etikett i en knapptext.
   */
  test("version skrivs med litet v inne i en mening", () => {
    expect(WORDS.restore(2)).toBe("Återställ version 2");
    expect(WORDS.restoreTitle(2)).toBe("Återställ version 2?");
    expect(WORDS.statusRestored(2, 1)).toContain("besökarna ser version 1");

    const mittI = everything().filter((text) => /\S.*\bVersion \d+/.test(text));

    expect(mittI, "stort V bara först i en mening").toEqual([]);
  });

  test("de tre orden finns, och de är de som används", () => {
    expect(WORDS.badgePublished).toBe(WORDS.published);
    expect(WORDS.badgeWorkingCopy).toBe(WORDS.workingCopy);
    expect(WORDS.historyCount(4)).toContain("versioner");
    expect(WORDS.historyNote).toContain("Återställ");
  });
});

/**
 * Vem som sparade, och vad som händer när två gör det (berättelse 127).
 *
 * Två meningar raden kan säga som den inte kunde förut, och båda handlar om en
 * annan människa. Det gör dem känsligare än resten: en rad som säger sitt eget
 * namn varje gång slutar man läsa, och en som inte säger den andres lämnar
 * ingen att fråga.
 */
describe("när någon annan har skrivit", () => {
  test("sparad utan namn är den egna sparningen", () => {
    expect(WORDS.saved("22:50")).toBe("sparad 22:50");
    expect(
      WORDS.saved("22:50", ""),
      "ett tomt namn ritar aldrig ett *av* följt av ingenting",
    ).toBe("sparad 22:50");
  });

  test("och med namn när det var någon annans", () => {
    expect(WORDS.saved("22:50", "Nisse Hult")).toBe("sparad 22:50 av Nisse Hult");
    expect(WORDS.statusSavedAt(3, "22:50", "Nisse Hult")).toBe(
      "Opublicerade ändringar sedan version 3 · sparad 22:50 av Nisse Hult",
    );
    expect(WORDS.statusSavedAtUnknown("22:50", "Nisse Hult")).toBe(
      "Opublicerade ändringar · sparad 22:50 av Nisse Hult",
    );
  });

  /*
   * Krocken säger inte längre hela saken i raden — rutan gör det (berättelse
   * 129). Men raden får inte heller tiga: en sida som slutat spara och inte
   * säger det är en sida man skriver vidare i.
   */
  test("raden efter Avbryt säger att sidan inte sparar, och att valet står kvar", () => {
    expect(WORDS.statusPaused).toContain("Sparar inte");
    expect(WORDS.statusPaused, "det finns ett val att göra, inget att försöka igen").toContain(
      "välj",
    );
    expect(WORDS.statusPaused).not.toMatch(/försök igen/i);
    expect(WORDS.statusPausedAction).toBe("Välj");
  });

  /*
   * Och ingen rad pekar ut kön på någon. Namnet kommer ur leverantörens token
   * och säger ingenting om hur personen ska omtalas — *hans ändringar* om
   * Kim är fel om en verklig människa, varje gång.
   *
   * Raderna om låset är de känsligaste av alla här: varenda en av dem handlar
   * om en namngiven annan människa, och den svenska som ligger närmast till
   * hands — *hon sparade senast*, *tar du över får hon läsläget* — är just den
   * som gissar.
   */
  test("ingen rad gissar någons kön", () => {
    const gendered = [
      ...everything(),
      WORDS.lockedBy("Kim Berg", WORDS.activeAgo(3)),
      WORDS.takeOverTitle("Kim Berg"),
      somText(WORDS.takeOverMessage("Kim Berg", "08:29")),
      WORDS.takenOverTitle("Kim Berg"),
      WORDS.takenOverBySelfTitle,
      WORDS.takenOverRescue,
      WORDS.takenOverReadOnly,
      WORDS.rescueHere,
      WORDS.rescueDrop("Kim Berg"),
      WORDS.rescueKeepCost("Kim Berg", "08:51"),
      WORDS.rescueDropCost("08:49"),
      WORDS.rescueLocked("08:49"),
    ].filter((text) => /\b(hans|hennes|han|hon|honom|henne)\b/i.test(text));

    expect(gendered).toEqual([]);
  });

  test("vägen tillbaka heter samma sak som sidan den leder till", () => {
    expect(WORDS.allGuides, "listan är organisationens, alltså Guider och inte Mina guider").toBe(
      "Guider",
    );
  });
});

/**
 * Låset, och orden som beskriver det (berättelse 129).
 *
 * Tre sorters meningar, och alla tre handlar om en annan människa: vem som
 * håller guiden, vad ett övertagande kostar, och vad som hände med det man
 * själv skrev. Det är den känsligaste texten på sidan — se
 * könsgissningskontrollen ovan — och den som lättast blir en återvändsgränd.
 */
describe("när någon annan håller guiden", () => {
  /*
   * Ett namn och en relativ tid (129:s skärning, punkt 1). Raden svarar på en
   * fråga — *sitter någon här nu?* — och tre klockslag var tre uppgifter att
   * jämföra innan man visste om man skulle bry sig.
   */
  test("raden säger vem som håller guiden och hur länge sedan hen rörde den", () => {
    expect(WORDS.lockedBy("Anna Andersson", WORDS.activeAgo(3))).toBe(
      "Låst av Anna Andersson · aktiv för 3 minuter sedan",
    );
  });

  /*
   * Och **inga klockslag**: det är hela skärningen, och en rad som smyger
   * tillbaka ett *sedan 08:15* har gått tillbaka till det Johan bad oss skära
   * bort. Mätt som mönster och inte som exakt sträng — det är formen som är
   * regeln.
   */
  test("och inte ett enda klockslag", () => {
    for (const minuter of [0, 1, 3, 12]) {
      expect(WORDS.lockedBy("Anna Andersson", WORDS.activeAgo(minuter))).not.toMatch(
        /\d{1,2}[:.]\d{2}/,
      );
    }
  });

  /*
   * *nyss* under en minut: *för 0 minuter sedan* är en siffra som säger mindre
   * än ett ord. Och *en* i ental, som svenskan skriver det i löptext.
   */
  test("den relativa tiden har ett ord för nyss och skriver ental med bokstäver", () => {
    expect(WORDS.activeAgo(0)).toBe("nyss");
    expect(WORDS.activeAgo(1)).toBe("för en minut sedan");
    expect(WORDS.activeAgo(12)).toBe("för 12 minuter sedan");
  });

  /*
   * En värd som inte ger någon aktivitetstid ska inte ge en rad som slutar på
   * ett tomt *aktiv*. Samma regel som *av* utan namn: säg en sak mindre.
   */
  test("och utan tid säger raden bara vem", () => {
    expect(WORDS.lockedBy("Anna Andersson", "")).toBe("Låst av Anna Andersson");
  });

  /*
   * Rutan hos den som förlorade låset (129:s skärning, punkt 2): rubriken är
   * händelsen, meningen konsekvensen, och knappen är en enda. Inget klockslag
   * — att det hände just nu är hela nyheten.
   */
  test("den som förlorar låset möter en händelse, en konsekvens och ett OK", () => {
    expect(WORDS.takenOverTitle("Anna Andersson")).toBe("Anna Andersson tog över guiden.");
    expect(WORDS.takenOverTitle("Anna Andersson")).not.toMatch(/\d{1,2}[:.]\d{2}/);
    expect(WORDS.takenOverRescue).toBe("Dina ändringar finns kvar i den här webbläsaren.");
    expect(WORDS.takenOverOk).toBe("OK");
  });

  /*
   * Och utan osparat arbete lovas ingen kopia: en mening om en säkerhetskopia
   * som inte skrevs är ett löfte sidan inte kan hålla.
   */
  test("utan osparat arbete säger rutan vad som gäller i stället", () => {
    expect(WORDS.takenOverReadOnly).not.toContain("webbläsaren");
    expect(WORDS.takenOverReadOnly).toContain("läsläge");
  });

  /*
   * Frågan före ett övertagande säger konsekvensen — och säger att den är
   * liten. Utan *som mest några sekunder* är *går förlorat* allt man läser,
   * och då vågar ingen.
   */
  /*
   * Tre delar som gör var sitt jobb (Johan 19/9 natt). Kontrollen mäter alla
   * tre, för formen var en enda av dem: ett stycke på fem rader under en
   * rubrik som var ett påstående.
   */
  test("rubriken är frågan, och den namnger vem man tar över från", () => {
    expect(WORDS.takeOverTitle("Anna Andersson")).toBe(
      "Ta över guiden från Anna Andersson?",
    );
    expect(WORDS.takeOverTitle("Anna Andersson").endsWith("?"), "en fråga, inget påstående").toBe(
      true,
    );
  });

  test("fakta är etiketter och inte prosa", () => {
    expect(WORDS.takeOverSavedLabel).toBe("Sparade senast");
    expect(WORDS.takeOverActiveLabel).toBe("Aktiv senast");
    expect(WORDS.takeOverNothingSaved, "ett värde och inte en tom ruta").toBe("Inget sparat än");
  });

  test("konsekvensen är en mening, med hela namnet och utan autosparens takt", () => {
    const mening = somText(WORDS.takeOverMessage("Anna Andersson", "08:29"));

    expect(mening).toBe(
      "Anna Andersson får läsläge. Det som skrivits efter 08:29 går förlorat — som mest några sekunder.",
    );
    expect(mening, "storleken på det som kan gå förlorat är hela beslutet").toContain(
      "några sekunder",
    );
    expect(mening, "takten är ett skäl, inte ett faktum den som väljer behöver").not.toContain(
      "var tredje sekund",
    );
  });

  /*
   * Och tiden är den framhävda delen — samma uppgift som i raderna ovanför, och
   * i löptext läses den förbi (Johan 19/9).
   */
  test("och tiden i meningen är den del som väger tyngre", () => {
    const delar = WORDS.takeOverMessage("Anna Andersson", "08:29");

    expect(Array.isArray(delar)).toBe(true);
    expect(
      Array.isArray(delar) ? delar.filter((del) => typeof del !== "string") : [],
      "exakt en framhävd del, och det är klockslaget",
    ).toEqual([{ strong: "08:29" }]);
  });

  test("och utan sparning säger den inte efter ingenting, och framhäver ingenting", () => {
    const delar = WORDS.takeOverMessage("Anna Andersson", "");

    expect(somText(delar)).toBe(
      "Anna Andersson får läsläge. Det som skrivits går förlorat — som mest några sekunder.",
    );
    expect(
      Array.isArray(delar) ? delar.every((del) => typeof del === "string") : false,
      "ingen tid, ingenting att framhäva",
    ).toBe(true);
  });

  /*
   * Raden efter omladdning säger **var arbetet ligger** och inget mer (129:s
   * skärning, punkt 3). Den var en fråga till 19/9, och frågan sa samma sak
   * som knapparna säger — med priset under var och en av dem blev det tre
   * lager om ett val.
   */
  test("det som inte hann sparas säger var det ligger, och valen står för sig själva", () => {
    expect(WORDS.rescueHere).toBe("Dina ändringar finns kvar i den här webbläsaren.");
    expect(WORDS.rescueKeep).toBe("Fortsätt där jag var");
    expect(WORDS.rescueDrop("Anna Andersson")).toBe("Börja från Anna Anderssons version");
  });

  /*
   * Samma första mening i alla fyra lägen — får redigera, måste ta över, får
   * vänta, eller just miste om låset (förlorarrutan). Det är samma besked;
   * det som skiljer är vad man får göra åt det, och det står i valen eller i
   * rutans knapp. Skilda formuleringar hade fått den som möter fler än ett av
   * dem att leta efter skillnaden (UX-genomgången 129–131, punkt 3).
   */
  test("och samma första mening oavsett om man får redigera, ta över, vänta eller just förlorat låset", () => {
    const first = (text: string): string => `${text.split(". ")[0]}.`;

    expect(WORDS.rescueLocked("")).toBe(WORDS.rescueHere);
    expect(first(WORDS.rescueWaiting)).toBe(WORDS.rescueHere);
    expect(WORDS.takenOverRescue).toBe(WORDS.rescueHere);
  });

  /*
   * Ett namn på s får inget till s i svenskan. Regeln finns för att den annars
   * skrivs fel av den som skriver nästa mening — *Nilss version* — och det är
   * ett fel som bara syns för den det gäller.
   */
  test("och genitiven blir inte Nilss", () => {
    expect(WORDS.rescueDrop("Nils Lax")).toBe("Börja från Nils Lax version");
  });

  /*
   * Hos en värd som inte vet vem: ingen påhittad person, och inget *av* eller
   * genitiv följt av ingenting.
   */
  test("utan namn namnges ingen", () => {
    expect(WORDS.rescueDrop("")).toBe("Börja från den sparade versionen");
    expect(WORDS.rescueDrop("")).not.toMatch(/\s+s version/);
    expect(WORDS.rescueKeepCost("", "08:51")).toBe("Den sparade versionens ändringar ersätts.");
  });

  /*
   * Och priset under var sin knapp (Johan 19/9: *"När jag trycker Fortsätt där
   * jag var försvinner Annas ändringar"*). Den som väljer ska se vad valet
   * kostar utan att först ha tryckt.
   */
  test("varje knapp säger vad som förloras, med tiden som gör det gripbart", () => {
    expect(WORDS.rescueKeepCost("Anna Andersson", "08:51")).toBe(
      "Anna Anderssons ändringar sedan 08:51 ersätts. Anna Andersson får välja vid sin nästa sparning.",
    );
    expect(WORDS.rescueDropCost("08:49")).toBe(
      "Dina ändringar från 08:49 följer inte med, men finns kvar i historiken.",
    );
  });

  /*
   * **Ingenting kastas** (Johan 20/9: *"lite förvirrande att det står dina
   * ändringar kastas"*). Sedan 131 gäller att inget går förlorat — kopian
   * läggs i historiken innan raden släpper den — och då får ingen mening i
   * raden lova motsatsen.
   *
   * Mätt över hela ordlistan och inte bara på den ena meningen: ordet ska inte
   * heller smyga in i en annan rad. *Kasta ändringarna* i menyn är undantaget,
   * och det är ett medvetet val med en egen fråga.
   */
  test("ingen rad i räddningen säger att något kastas", () => {
    const iRaden = [
      WORDS.rescueHere,
      WORDS.rescueLocked("08:49"),
      WORDS.rescueWaiting,
      WORDS.rescueMerge,
      WORDS.rescueMergeCost("Anna Andersson"),
      WORDS.rescueKeep,
      WORDS.rescueDrop("Anna Andersson"),
      WORDS.rescueKeepCost("Anna Andersson", "08:51"),
      WORDS.rescueDropCost("08:49"),
      WORDS.rescueDropCost(""),
    ];

    expect(iRaden.filter((text) => /kasta/i.test(text))).toEqual([]);
    expect(WORDS.discard, "men menyns egna val heter fortfarande det").toBe("Kasta ändringarna");
  });

  /*
   * Ingen annan att förlora något: då är det den sparade versionen som
   * ersätts, och ingen som behöver välja något efteråt. Och har värden inget
   * sparat alls kostar valet ingenting — då står där inget.
   */
  test("utan namn förloras ingens arbete, och utan sparning inget alls", () => {
    expect(WORDS.rescueKeepCost("", "08:51")).toBe("Den sparade versionens ändringar ersätts.");
    expect(WORDS.rescueKeepCost("", "08:51")).not.toMatch(/får välja/);
    expect(WORDS.rescueKeepCost("Anna Andersson", "")).toBe("");
    expect(WORDS.rescueDropCost("")).toBe(
      "Dina ändringar följer inte med, men finns kvar i historiken.",
    );
  });

  /*
   * Och raden när någon annan håller låset: den säger **var arbetet ligger**,
   * och ingenting mer.
   *
   * Den pekade på *Ta över* till 20/9, och skälet höll så länge det enda valet
   * var *Fortsätt där jag var* — den skriver rakt in i guiden. Sammanslagningen
   * gör inte det: den fryser båda kopiorna och behåller båda, och går därför
   * direkt (Johan 20/9: *"varför inte bara kunna få Slå ihop ändringar där och
   * då?"*). *Ta över* behövs för att fortsätta **redigera** efteråt, inte för
   * att rädda det som ligger här — och en rad som säger det är en rad som
   * skickar folk en omväg.
   */
  test("i låst läge säger raden var arbetet ligger, och skickar ingen omväg", () => {
    expect(WORDS.rescueLocked("08:49")).toBe(
      "Dina ändringar från 08:49 finns kvar i den här webbläsaren.",
    );
    expect(WORDS.rescueLocked(""), "utan tid hittas ingen på").toBe(WORDS.rescueHere);
    expect(WORDS.rescueLocked("08:49")).not.toContain("Ta över");
    expect(WORDS.rescueLocked("08:49")).not.toContain(WORDS.rescueKeep);
  });

  /*
   * Och ett ord per tillstånd — men **två tillstånd**, rättat efter bilderna
   * (Johan 18/9 kväll). *Skrivskyddad* stod på fyra ställen om samma sak och
   * är struket; kvar står *Låst* med hänglås om en guide någon annan håller,
   * och *Läsläge* utan ikon om en äldre version. Hänglåset betyder en annan
   * människa, och bakom en gammal version finns ingen.
   */
  test("två tillstånd, två ord — och skrivskyddad finns inte kvar någonstans", () => {
    expect(WORDS.badgeLocked, "någon annan håller guiden just nu").toBe("Låst");
    expect(WORDS.badgeReadOnly, "en äldre version, och ingen annan människa").toBe("Läsläge");
    expect(WORDS.badgeLocked).not.toBe(WORDS.badgeReadOnly);
    expect(everything().filter((text) => /skrivskyddad/i.test(text))).toEqual([]);
  });
});

/**
 * Guiden ingen publicerat än (rättad 19/9).
 *
 * Johan mätte en ny guide som bar brickan *Publicerad* medan beskedet sa att
 * ingen version fanns. Brickan är rättad i `guide-storage.ts`; det här håller
 * orden: ett tillstånd, ett uttryck, och tiden med när det finns en.
 */
describe("innan något publicerats", () => {
  test("beskedet säger inte publicerad än, och säger tiden när det finns en", () => {
    expect(WORDS.statusFirstSavedAt("06:05")).toBe("Inte publicerad än · sparad 06:05");
    expect(
      WORDS.statusFirstSavedAt("06:05", "Nisse Hult"),
      "samma regel som överallt: namnet bara när sparningen var någon annans",
    ).toBe("Inte publicerad än · sparad 06:05 av Nisse Hult");
  });

  test("och utan sparning säger den vad som kommer att hända i stället", () => {
    expect(WORDS.statusFirst).toBe("Inte publicerad än · det du bygger blir den första");
  });

  /*
   * Ett tillstånd, ett uttryck. *Ingen version är publicerad än* stod här till
   * 19/9 medan listan sa *Inte publicerad än* om samma sak, och två
   * formuleringar om en sak får den som läser dem att leta efter skillnaden.
   */
  test("och det är samma ord båda meningarna börjar med", () => {
    expect(WORDS.statusFirst.startsWith("Inte publicerad än")).toBe(true);
    expect(WORDS.statusFirstSavedAt("06:05").startsWith("Inte publicerad än")).toBe(true);
  });

  /*
   * Och aldrig ordet för motsatsen. En guide utan publicerad version kan inte
   * vara publicerad, och brickan sa det i två månader.
   */
  test("ingen av dem lånar ordet Publicerad", () => {
    expect(WORDS.statusFirst).not.toContain(WORDS.published);
    expect(WORDS.statusFirstSavedAt("06:05")).not.toContain(WORDS.published);
  });
});
