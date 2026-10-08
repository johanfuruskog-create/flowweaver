import { describe, expect, it } from "vitest";

import {
  ROLE_LADDER,
  allows,
  neededRole,
  readRoleConfig,
  roleOf,
} from "../../integrations/reference-receiver/roles.mjs";

/**
 * Rollerna hos referensvärden (berättelse 128).
 *
 * ## Varför det här är ett enhetstest och inte bara rökprovet
 *
 * `smoke:login` kör hela vägen i en riktig webbläsare med fyra personer, och
 * det är den mätning som räknas för Google-fallet: subjekt i `.env`, session i
 * en cookie, `401` på det rollen inte får.
 *
 * Men den kan inte mäta **Entra-fallet**. Attrappleverantören skickar inga
 * `groups`, för Google gör det inte heller, och att lägga till dem där hade
 * varit att mäta en leverantör som inte finns. Gruppmappningen är alltså
 * kod som bara skarp drift annars skulle prova — och det är precis den sorten
 * som ska stå i en grind.
 *
 * ## Det som är värt att pinna, och varför just det
 *
 * Tre saker, och alla tre är beslut snarare än mekanik:
 *
 *  1. **Okänd är läsare.** Följden av att göra fel här är inte ett fel någon
 *     ser — det är en ny provperson som kan ändra en publicerad guide.
 *  2. **Högst vinner**, mellan grupper och mellan de två mappningarna. Den som
 *     står i två grupper är inte mindre än någondera.
 *  3. **Stegen**, hela matrisen. En jämförelse som råkar vara rätt för två
 *     rungor och fel för en tredje är vad ett stickprov missar.
 */

describe("mappningen ur .env", () => {
  /*
   * Migreringen, och den enda kontrollen här som beskriver en verklig morgon:
   * en värd som får en inloggning utan att någon skrivit en rad om roller.
   *
   * Alla är läsare, alltså kan ingen spara — inklusive den som konfigurerade
   * servern. Det är rätt förval och det är en fälla, och `docs/DRIFT.md` säger
   * vilken rad Johan ska skriva innan han rullar ut.
   */
  it("utan mappning är varje inloggad person läsare", () => {
    const config = readRoleConfig({});

    expect(roleOf({ subject: "vem-som-helst" }, config)).toBe("reader");
    expect(roleOf({ subject: "johan", groups: ["nagon-grupp"] }, config)).toBe("reader");
    expect(
      allows(roleOf({ subject: "johan" }, config), "editor"),
      "en läsare sparar ingenting — det är hela följden av en tom rad",
    ).toBe(false);
  });

  it("ROLES namnger personer per subjekt, som hos Google", () => {
    const config = readRoleConfig({
      ROLES: "sub-johan:admin,sub-anna:publisher,sub-nisse:editor",
    });

    expect(roleOf({ subject: "sub-johan" }, config)).toBe("admin");
    expect(roleOf({ subject: "sub-anna" }, config)).toBe("publisher");
    expect(roleOf({ subject: "sub-nisse" }, config)).toBe("editor");
    expect(roleOf({ subject: "sub-monika" }, config), "den som inte står där är läsare").toBe(
      "reader",
    );
  });

  /*
   * Googles subjekt är ett långt tal, Entras en uuid — men ingenting hindrar
   * en leverantör från att mynta något med kolon i. Delningen tar därför det
   * SISTA kolonet: allt före är subjektet, allt efter är rollen.
   */
  it("ett subjekt med kolon i delas på det sista, inte på det första", () => {
    const config = readRoleConfig({ ROLES: "https://issuer/user:42:publisher" });

    expect(roleOf({ subject: "https://issuer/user:42" }, config)).toBe("publisher");
  });

  it("ROLE_* namnger grupper, som hos Entra ID", () => {
    const config = readRoleConfig({
      ROLE_ADMIN: "grupp-forvaltare",
      ROLE_PUBLISHER: "grupp-publicerare",
      ROLE_EDITOR: "grupp-redaktorer, grupp-kommunikation",
    });

    expect(roleOf({ subject: "x", groups: ["grupp-publicerare"] }, config)).toBe("publisher");
    expect(
      roleOf({ subject: "x", groups: ["grupp-kommunikation"] }, config),
      "flera grupper per rung, för en organisation har sällan exakt en",
    ).toBe("editor");
    expect(roleOf({ subject: "x", groups: ["grupp-ingen-kanner"] }, config)).toBe("reader");
  });

  /*
   * Den som står i två grupper är inte mindre än någondera, och ordningen
   * grupperna kommer i tokenet är leverantörens sak. Samma sak mellan de två
   * mappningarna: en handskriven rad får inte tyst degradera någon som redan
   * har mer genom sin grupp.
   */
  it("högsta rungen vinner — mellan grupper och mellan de två mappningarna", () => {
    const config = readRoleConfig({
      ROLES: "sub-anna:editor",
      ROLE_ADMIN: "grupp-forvaltare",
      ROLE_EDITOR: "grupp-redaktorer",
    });

    expect(roleOf({ subject: "x", groups: ["grupp-redaktorer", "grupp-forvaltare"] }, config)).toBe(
      "admin",
    );
    expect(roleOf({ subject: "x", groups: ["grupp-forvaltare", "grupp-redaktorer"] }, config)).toBe(
      "admin",
    );
    expect(roleOf({ subject: "sub-anna", groups: ["grupp-forvaltare"] }, config)).toBe("admin");
  });

  /*
   * En felstavning öppnar ingen dörr. `ROLES=sub:administrator` ser ut att
   * betyda något och betyder ingenting — och det är rätt, för alternativet är
   * en server som gissar vad någon menade med behörigheter.
   *
   * Skiftläge är däremot inte en felstavning. Raden skrivs för hand i en
   * `.env` av en människa, och `ADMIN` är vad den människan menade; det som
   * INTE får hända är att ett ord som liknar en rung blir en.
   */
  it("ett ord som inte är en rung ger ingen rung alls", () => {
    const config = readRoleConfig({ ROLES: "sub-johan:administrator,sub-anna:ADMIN,trasig-rad" });

    expect(roleOf({ subject: "sub-johan" }, config)).toBe("reader");
    expect(roleOf({ subject: "sub-anna" }, config), "en hel rad skriven versalt duger").toBe(
      "admin",
    );
  });
});

describe("stegen", () => {
  it("har fyra rungor i ordning, lägst först", () => {
    expect(ROLE_LADDER).toEqual(["reader", "editor", "publisher", "admin"]);
  });

  it("varje roll får allt under sig och inget över", () => {
    const matrix = ROLE_LADDER.map((role) => ROLE_LADDER.map((needed) => allows(role, needed)));

    expect(matrix).toEqual([
      [true, false, false, false],
      [true, true, false, false],
      [true, true, true, false],
      [true, true, true, true],
    ]);
  });

  it("och ett namn som inte är en rung räcker aldrig till något", () => {
    expect(allows("superuser", "reader")).toBe(false);
    expect(allows("admin", "superuser")).toBe(false);
  });
});

describe("vilken rung en väg kräver", () => {
  /*
   * Att läsa är bottensteget, hela vägen: listan, guiden, en version. En
   * läsare som inte kan öppna något är ingen roll, bara en utloggning med
   * extra steg.
   */
  it("allt som läser är läsarens", () => {
    expect(neededRole("GET", undefined)).toBe("reader");
    expect(neededRole("GET", "versions")).toBe("reader");
    expect(neededRole("GET", "current")).toBe("reader");
  });

  it("arbetskopian är redaktörens, båda vägarna", () => {
    expect(neededRole("PUT", "draft")).toBe("editor");
    expect(neededRole("DELETE", "draft")).toBe("editor");
  });

  /*
   * Att frysa en version och att peka ut vilken besökarna ser är samma beslut
   * sett från två håll — *det här är vad besökarna får* — så de är en rung.
   */
  it("att publicera och att byta publicerad version är publicerarens", () => {
    expect(neededRole("POST", "versions")).toBe("publisher");
    expect(neededRole("POST", "current")).toBe("publisher");
  });

  /*
   * Och en metod ingen tänkt på landar på redaktören, alltså över läsaren. En
   * väg som läggs till i morgon utan att någon läser den här filen ska avvisa
   * en läsare, inte släppa in hen.
   */
  it("en okänd skrivande väg är åtminstone redaktörens", () => {
    expect(allows("reader", neededRole("PATCH", "nagot-nytt"))).toBe(false);
  });
});
