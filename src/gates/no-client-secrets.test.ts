import { describe, expect, it } from "vitest";

/**
 * Inga hemligheter i klienten — mätt, inte lovat.
 *
 * `docs/VARDSYSTEM-KONTRAKT.md` lovar värden att ingenting av deras bakgrund
 * följer med ut i besökarens webbläsare, och `DRIFT.md` säger att nycklarna
 * bor i `.env` på servern. Ett löfte i ett dokument stoppar ingenting; det här
 * läser de **byggda bundlarna** och fäller det som letat sig in.
 *
 * ## Vad som läses
 *
 * `dist-lib/` — visaren, editorn och deras globala varianter, alltså exakt de
 * filer en värd lägger i en script-tagg. Bygg dem med `npm run build:lib`
 * innan provet körs; utan dem faller provet på att det inte hade något att
 * mäta, vilket är rätt svar på frågan *fann du något?* när man inte letat.
 *
 * ## Vad som fälls, och varför just det
 *
 * Preciserat 22/9 efter Astras granskning. Grinden letar efter **tre saker**,
 * och lika viktigt är vad den inte letar efter:
 *
 * - **Serverhemligheter**: namnen ur `.env` (`RESEND_API_KEY`,
 *   `SESSION_SECRET`, `OIDC_CLIENT_SECRET` …), ordet `RESEND`, och Resends
 *   nyckelprefix `re_`. Det är de enda riktiga hemligheterna i uppsättningen.
 * - **Privata adresser**: serverns IP och interna värdnamn. En intern adress i
 *   bundeln betyder att biblioteket ringer någon vi inte kan se.
 * - **Inbyggda autentiseringsuppgifter**: en `Authorization`-rubrik med ett
 *   värde inbakat i koden, eller `@flowweaver.se`-adresser utom `hello@`.
 *
 * **Och inte:** `api.flowweaver.se` är en publik adress och ingen hemlighet —
 * att fälla den hade gjort grinden till en regel om arkitektur, vilket
 * `adapter-only.test.ts` redan är och gör bättre. Inte heller sessionens
 * token, som lever i minnet under en session och aldrig finns i källan.
 *
 * ## Den fällan en mutation går i
 *
 * Provet läser **bygget**, inte källan, och buntaren slänger det ingen
 * använder. Mätt 22/9: `const SMUGGLED = "RESEND_API_KEY=…"` i en klientfil
 * gick rakt igenom, tre gånger i rad — inte för att grinden var blind utan
 * för att konstanten aldrig kom med i bundeln. Den som vill se provet falla
 * måste smuggla in strängen i något som **skeppas**, till exempel en text i
 * ordlistan. Det är rätt beteende: en konstant som inte följer med läcker
 * ingenting. Men det ser ut som en trasig grind tills man vet varför.
 *
 * ## Vad provet inte är
 *
 * Det är ingen hemlighetsskanner. Det letar efter de former vi vet kan hamna
 * fel i just det här repot, och ett nytt sätt att läcka kräver en ny rad här.
 * Ett prov som påstod mer än det ser vore sämre än inget (PRAXIS 4, andra
 * frågan: vad kan grinden över huvud taget se?).
 */

/*
 * `dist-lib` ligger utanför `src/`, så den läses som text via Vite i stället
 * för med `node:fs` — samma väg som varje annan filläsande grind här.
 */
const bundles: Record<string, string> = import.meta.glob("../../dist-lib/*.js", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Mönstren, med namnet som hamnar i felmeddelandet. */
const FORBIDDEN: Array<[string, RegExp]> = [
  /*
   * Namnen ur `.env`, som de står där. Ett namn i klienten betyder att någon
   * läst en servervariabel i kod som skeppas — värdet behöver inte ens följa
   * med för att det ska vara fel.
   */
  ["ett .env-namn", /\b(RESEND_API_KEY|RESEND_FROM|RESEND_KEY|SESSION_SECRET|OIDC_CLIENT_SECRET|RECEIVER_TEST_ADDRESS)\b/],
  ["utskickstjänsten (RESEND)", /\bRESEND\b/],
  ["ett Resend-nyckelvärde", /\bre_[A-Za-z0-9]{8,}/],
  ["en api-nyckel", /\bapi[_\s-]?key\b/i],
  ["serverns IP", /\b46\.246\.\d{1,3}\.\d{1,3}\b/],
  /*
   * En inbyggd autentiseringsuppgift: `Authorization` med ett värde i koden.
   * Att `Authorization` NÄMNS är rätt och nödvändigt — kontraktet handlar om
   * den — så mönstret kräver ett värde efter `Bearer` eller `Basic`.
   */
  ["en inbyggd autentiseringsuppgift", /(Bearer|Basic)\s+[A-Za-z0-9._~+/-]{12,}/],
  /*
   * Adresser på vår egen domän utom den publika. Negativ lookbehind på `hello`
   * i stället för ett filter efteråt: en träff ska bära adressen som den står,
   * så felmeddelandet går att söka på.
   */
  ["en intern adress", /(?<!hello)@flowweaver\.se/i],
];

describe("inga hemligheter i klienten", () => {
  /*
   * Att det fanns något att mäta. En glob som slutar matcha — ett bygge som
   * inte körts, en katalog som bytt namn — ger noll filer och noll träffar,
   * och noll träffar läser som "rent". Samma sjuka som fällde `site-translation`.
   */
  it("läser de byggda bundlarna", () => {
    const names = Object.keys(bundles);

    expect(
      names.length,
      "kör `npm run build:lib` först — annars mäter provet ingenting",
    ).toBeGreaterThanOrEqual(4);
    expect(names.some((name) => name.includes("viewer"))).toBe(true);
    expect(names.some((name) => name.includes("editor"))).toBe(true);
  });

  it("bär varken nyckel, serveradress eller intern e-postadress", () => {
    const found: string[] = [];

    for (const [path, text] of Object.entries(bundles)) {
      for (const [what, pattern] of FORBIDDEN) {
        const hit = pattern.exec(text);

        if (hit) {
          found.push(`${path.split("/").pop()}: ${what} — "${hit[0]}"`);
        }
      }
    }

    expect(found, found.join("\n")).toEqual([]);
  });
});
