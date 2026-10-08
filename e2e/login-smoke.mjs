/**
 * Redaktören loggar in hos värden — hela vägen, i en riktig webbläsare.
 *
 *     npm run smoke:login        # startar allt själv, ~40 s
 *
 * ## Varför det här inte går att mäta med `fetch` i node
 *
 * Berättelse 126 flyttar legitimationen från ett huvud till en **cookie**, och
 * en cookie är precis den sortens sak node:s `fetch` inte har en åsikt om. Node
 * bryr sig inte om `SameSite`, inte om `Secure`, inte om
 * `Access-Control-Allow-Credentials` och inte om att `*` är förbjudet bredvid
 * credentials. Kodbasen har redan betalat för den läxan en gång: 17/9 var
 * `smoke:storage` grön medan förhandsförfrågan avvisade `PUT` — arbetskopians
 * enda väg — och serverns logg såg tom ut hela tiden.
 *
 * Så det här är körningen där en riktig webbläsare gör hela flödet: en
 * omdirigering till leverantören, tillbaka med en kod, en cookie satt av ett
 * ursprung och skickad till ett annat, och en lista som är organisationens.
 *
 * ## Varför leverantören är en attrapp
 *
 * Google är den första riktiga leverantören, och Googles inloggning går inte
 * att köra i Playwright — botskyddet stoppar den, och det ska det. Två
 * mätningar behövs därför och de svarar på olika saker:
 *
 *  - **den här**, mot `tools/mock-oidc.mjs`, körd vid varje ändring: *fungerar
 *    flödet — varje omdirigering, cookie och huvud av det?*
 *  - **Johans**, i en webbläsare efter utrullningen, en gång: *godtar Google
 *    vår klient?*
 *
 * Attrappen signerar med en riktig RS256-nyckel och kräver PKCE, så det som
 * mäts här är mottagarens verkliga verifiering och inte en genväg runt den.
 *
 * ## Vad som mäts, och varför just det
 *
 * Avvisningarna är poängen, som i `smoke:storage`. En inloggning som fungerar
 * är den lätta halvan; det som avgör om någon annans arbete är skyddat är vad
 * som händer när fel person frågar:
 *
 *  - **utloggad ser en knapp och inget annat** — inte en tom lista, som läses
 *    som "du har inga guider", och utloggad når ingen guide alls;
 *  - **`Avbryt` hos leverantören** lämnar en utloggad på sidan man kom från,
 *    inte på en tom skärm;
 *  - **utloggning** tar cookien, och sidan är tillbaka i sitt första läge.
 *
 * ## Och sedan berättelse 127: vem, av flera personer
 *
 * Listan är organisationens, vilket gör *vem ändrade senast* till en fråga som
 * har ett svar — och till något som bara går att mäta med **flera** inloggade i
 * samma körning. Johan bygger, Anna tittar, Nisse skriver:
 *
 *  - **Anna ser Johans guide** i listan, utan att någon delat något;
 *  - **raden säger *Ändrad 17 sep. 2026 22:50 av Johan Furuskog***, i sajtens egen
 *    datumform och aldrig som ISO;
 *  - **filtret *Bara mina*** tömmer Annas skärm och säger varför;
 *  - **editorns rad säger *sparad 22:50 av Nisse Hult*** för Anna — och bara
 *    *sparad 22:50* för Nisse själv, för ett eget namn varje gång är en rad
 *    man slutar läsa;
 *  - **`409`** när Nisse hinner spara medan Annas sida står öppen: raden
 *    namnger honom, säger att sidan ska laddas om, och **autosparen stannar**
 *    — mätt genom att Nisses text ligger kvar hos värden efteråt.
 *
 * Och en sak till, som bara går att se här: **versionen bär *av Johan
 * Furuskog***. Namnet skrivs av servern ur sessionen, aldrig av editorn, så
 * kedjan från id-token till historikrad går genom allt det här och ingen
 * mindre körning.
 *
 * ## Och berättelse 128: fyra roller, som en stege
 *
 * Rollen kommer ur `.env` hos mottagaren och inte ur leverantören — Google
 * säger ingenting om grupper, så attrappen säger det inte heller. Miljön här
 * namnger tre av de fyra; Monika står inte där, och **det är mätningen**: den
 * som ingen skrivit in är läsare.
 *
 * Fyra personer och två halvor, för de svarar på olika saker:
 *
 *  - **Värden är skyddet.** Varje skrivande väg prövas av var och en av de
 *    fyra. Sedan A8 (22/9) svarar avvisningen efter sin betydelse: `401` utan
 *    eller med ogiltig autentisering, `403` när identiteten är giltig men
 *    rollen inte räcker. Inget av svaren skiljer sig beroende på vad som
 *    finns — rollen prövas före uppslaget, vilket mäts genom att en läsare får
 *    samma `403` på ett id som inte finns som på ett som gör det.
 *  - **Sidan är vyn.** Läsaren får ingen palett — mätt som **paletten**, inte
 *    som attributet — och ingen *Publicera*; redaktören får ingen *Publicera*
 *    men en rad som säger varför; *Ny guide* och mallbiblioteket står bara hos
 *    förvaltaren.
 *
 * ## Och berättelse 129: låset, som bara två fönster kan visa
 *
 * Ett lås är per definition en sak mellan två sittningar, och det går inte att
 * mäta i ett prov med en. Här finns fyra webbläsarkontexter, alltså fyra
 * personer, och det är därför hela kedjan ryms:
 *
 *  - **Anna öppnar först** och håller låset; **Nisse** (redaktör) får läsläge,
 *    raden med tre tider och ingen knapp; **Johan** (förvaltare) får knappen
 *    och frågan som säger vad ett övertagande kostar.
 *  - **Annas fönster** går i läsläge vid sin nästa aktivitet — inte förr, för
 *    låset förnyas bara av aktivitet — och det hon inte hunnit spara ligger i
 *    webbläsarens lagring efteråt.
 *  - **Krockrutan** ersätter 127:s rad, och det som mäts är ordningen: kopian
 *    ligger i lagringen MEDAN rutan står öppen, alltså innan något valts.
 *  - **Ett orört fönster tappar låset.** Provet väntar in värdens klocka på
 *    riktigt — mottagaren kör med `LOCK_MINUTES` nedskruvat till sekunder,
 *    samma variabel som i drift, ingen stubbe.
 *
 * Följden för allt annat i filen: två fönster kan inte längre stå öppna i
 * redigeringsläge samtidigt, så varje person som ska mäta något i editorn
 * öppnar guiden medan den är **ledig** (`lämnaGuiden`). En kontroll som mäter
 * en palett i läsläge är grön av fel skäl.
 *
 * ## Vad provet INTE kan se (praxis 4, andra frågan)
 *
 * - **Att Google godtar klienten.** Attrappen säger ja till allt vår klient
 *   skickar; en felregistrerad `redirect_uri` syns först hos Google.
 * - **`Secure` på cookien i praktiken.** Webbläsaren kör mot `http://localhost`,
 *   där en `Secure`-cookie aldrig skickas — så flödet MÅSTE köra utan den här.
 *   Att den sätts på https mäts därför en trappa ned, med ett rakt anrop och
 *   `X-Forwarded-Proto: https`, alltså precis det Caddy skickar. Utan den
 *   kontrollen hade sessionen kunnat resa i klartext i skarp drift och allt
 *   här hade varit grönt.
 * - **Att `SameSite=Lax` räcker över `flowweaver.se` ↔ `api.flowweaver.se`.**
 *   Här är det två portar på samma värdnamn, vilket är samma site på ett
 *   enklare sätt än i drift.
 */
import { chromium } from "playwright-core";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { holdBrowserSuiteLock } from "../tools/hold-browser-suite-lock.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const OIDC_PORT = 4330;
const API_PORT = 4332;
const SITE_PORT = 5198;
const SITE = process.env.BASE_URL ?? `http://localhost:${SITE_PORT}`;
/*
 * **The open repo runs this against its demo** (open-core step 7, 2026-10-07).
 *
 * The guides app moved to `src/host/` and ships with the open FlowWeaver, but
 * the example site's two pages do not. Where they are missing, the same flow
 * runs against `demo/guides.html` and `demo/guide-storage.html`, served by
 * `tools/serve-demo.mjs` — the same app, the same receiver, the same checks.
 * `FLOWWEAVER_DEMO=1` picks the demo here as well, which is how the working
 * repo measures that the open one passes.
 */
const DEMO = process.env.FLOWWEAVER_DEMO === "1" || !existsSync(join(root, "guides/index.html"));
const GUIDES_PATH = DEMO ? "/demo/guides.html" : "/guides/";
const EDITOR_PATH = DEMO ? "/demo/guide-storage.html" : "/dev/guide-storage.html";
const API = `http://localhost:${API_PORT}`;
const ISSUER = `http://localhost:${OIDC_PORT}`;
/** Speglar DRAFT_INTERVAL i src/host/guide-storage.ts. */
const DRAFT_INTERVAL_MS = 3000;
/**
 * Låsets livslängd i den här körningen (berättelse 129).
 *
 * Trettio sekunder, satt genom `LOCK_MINUTES` — **samma variabel som i drift**,
 * som tillåter decimaler just för det här (`locks.mjs`). Ingen egen provväg att
 * glömma bort, och ingen stubbad klocka: kriterium 7 säger att provet ska vänta
 * in värdens egen tid, och det är det enda sättet att mäta att ett orört
 * fönster faktiskt tappar låset.
 *
 * Kort nog att vänta ut en gång, långt nog att sidbytena mellan kontrollerna
 * ryms utan att låset hinner löpa ut i mätningar som inte handlar om det.
 */
const LOCK_MS = 30_000;

const checks = [];
const check = (namn, ok, detalj = "") => {
  checks.push({ namn, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${namn}${detalj ? `  — ${detalj}` : ""}`);
};

/**
 * Skärmbilder av de ytor 129:s skärning byggde om — av provet, inte för hand.
 *
 * `FLOWWEAVER_SHOTS=<katalog> npm run smoke:login` lägger en bild per yta i
 * båda teman. Av som förval: en vanlig körning ska inte skriva filer.
 *
 * **Här och inte i ett eget skript.** Ytorna finns bara mitt i ett flöde med
 * fyra inloggade personer, ett levande lås och ett övertagande — och ett andra
 * skript som ställer upp samma sak är ett andra skript som slutar stämma med
 * det första. Samma skäl som filmerna körs om i stället för att klippas
 * (CLAUDE.md): en bild av ett gränssnitt som ändrats är en lögn med tidsstämpel.
 *
 * Temat sätts som en besökare sätter det — `data-theme` på roten
 * (`theme-persistence.ts`) — och ställs tillbaka efteråt, så nästa kontroll
 * mäter samma sida som före bilden.
 */
const SHOTS = process.env.FLOWWEAVER_SHOTS ?? "";
/**
 * Bredderna. 900 alltid; 390 bara när ytan är **besökarens** eller en dialog
 * som måste gå att läsa i en telefon.
 *
 * Editorns rad fotograferas aldrig i 390 (Johan 15/9: *"den är inte designad
 * för det"*), men en modal ruta är en ruta — och sammanslagningens två spalter
 * är just det som måste mätas i en smal skärm, för de faller i en kolumn där.
 */
const bild = async (page, namn, bredder = [900]) => {
  if (SHOTS === "") return;

  mkdirSync(SHOTS, { recursive: true });

  /*
   * Höjden följer det som ska synas, inte en siffra vald på förhand.
   *
   * En rad bor överst på sidan; en modal `<dialog>` ligger mitt i rutan, i
   * top layer. Första försöket klippte 900×320 från toppen åt båda, och
   * bilden av rutan visade en dimmad sida utan ruta — precis det fel
   * berättelsen om slutkortet varnar för (`demo-slutkort-top-layer`):
   * överlägget ligger inte där man tror.
   */
  const höjd = await page.evaluate(() => {
    const öppen = [
      ...document.querySelectorAll("confirmation-dialog, conflict-dialog, merge-dialog"),
    ].some(
      (one) => one.shadowRoot?.querySelector("dialog")?.open === true,
    );

    return öppen ? window.innerHeight : 320;
  });

  const rutan = page.viewportSize();

  for (const bredd of bredder) {
    /*
     * Rutan sätts till bildens bredd, alltid — också för 900.
     *
     * En modal `<dialog>` centreras i **fönstret**, inte i klippet: med en
     * bredare ruta hamnade högra halvan av sammanslagningsrutan utanför
     * bilden, och en skärmbild som klipper av det som ska granskas är värre
     * än ingen. Sett i bild 19/9.
     */
    await page.setViewportSize({ width: bredd, height: rutan?.height ?? 900 });
    await page.waitForTimeout(250);

    for (const tema of ["light", "dark"]) {
      await page.evaluate((one) => {
        document.documentElement.dataset.theme = one;
      }, tema);
      await page.waitForTimeout(150);
      await page.screenshot({
        path: join(SHOTS, `${namn}-${bredd}${tema === "dark" ? "-morkt" : ""}.png`),
        clip: { x: 0, y: 0, width: bredd, height: bredd === 900 ? höjd : (rutan?.height ?? 900) },
      });
    }
  }

  if (rutan) {
    await page.setViewportSize(rutan);
    await page.waitForTimeout(250);
  }

  await page.evaluate(() => {
    delete document.documentElement.dataset.theme;
  });
  await page.waitForTimeout(150);
};

const work = mkdtempSync(join(tmpdir(), "flowweaver-login-"));

/*
 * Serverns miljö. `FLOWWEAVER_IGNORE_ENV_FILE` är inte en formalitet: utan den
 * skulle maskinens egen `.env` fylla i riktiga nycklar, och provet hade kört
 * mot något annat än det säger sig köra mot.
 */
const env = {
  ...process.env,
  FLOWWEAVER_TYST: "1",
  FLOWWEAVER_IGNORE_ENV_FILE: "1",
  FLOWWEAVER_DB: join(work, "flowweaver.sqlite"),
  OUTBOX_DIR: join(work, "outbox"),
  ALLOWED_ORIGINS: SITE,
  OIDC_ISSUER: ISSUER,
  OIDC_CLIENT_ID: "flowweaver-smoke",
  // En attrapphemlighet mot en attrappleverantör. Riktiga nycklar bor i `.env`
  // på servern och aldrig i ett testfall (docs/DRIFT.md).
  OIDC_CLIENT_SECRET: "attrapp-hemlighet",
  SESSION_SECRET: "attrapp-sessionsnyckel-som-ar-lagom-lang",
  /*
   * Rollerna, i mottagarens `.env`-form och inte i leverantörens (berättelse
   * 128).
   *
   * Det är hela poängen med var den här raden står. Google säger ingenting om
   * grupper, så en attrapp som hittade på ett `role`-claim hade mätt en
   * leverantör som inte finns — och dolt att mappningen är driftarens arbete.
   * Subjekten är attrappens, som Googles är Googles.
   *
   * **Monika står inte här**, och det är en kontroll och inte en glömska: den
   * som ingen skrivit in är läsare, vilket är förvalet hela berättelsen vilar
   * på. Mutationen som fäller det är att lägga till henne.
   */
  ROLES: [
    "mock-johan-furuskog:admin",
    "mock-anna-andersson:publisher",
    "mock-nisse-hult:editor",
  ].join(","),
  /* Se `LOCK_MS`: värdens tid, nedskruvad, i minuter med decimaler. */
  LOCK_MINUTES: String(LOCK_MS / 60_000),
};

/*
 * **Låset först, portarna sedan** (18/9).
 *
 * Låset togs tidigare precis före `chromium.launch()`, alltså långt efter att
 * det här provet redan tagit sina fasta portar. Två roller som startade samtidigt
 * slogs därför om portarna i stället för att ställa sig i kö: den ena fick
 * *Port 5198 is already in use*, körde vidare mot den andras server, och gick
 * röd på saker som inte hade med koden att göra — och när den andra städade upp
 * försvann servern mitt under den första. Mätt två gånger samma kväll.
 *
 * En port är lika mycket maskinens som en webbläsare är, så låset omsluter
 * hela körningen. `holdBrowserSuiteLock` släpper det på varje väg ut, också en
 * uncaught exception.
 */
await holdBrowserSuiteLock();

const provider = spawn(process.execPath, [join(root, "tools/mock-oidc.mjs"), String(OIDC_PORT)], {
  env,
  stdio: "ignore",
});
/*
 * Mottagaren körs **pratsam** och dess utskrift samlas upp.
 *
 * Inte för att provet vill läsa loggar, utan för att en rad i den är en
 * instruktion i `docs/DRIFT.md`: subjektet — det enda som duger som `owner` på
 * en guide — står ingen annanstans. `/auth/me` ger namn och adress, aldrig
 * id:t. Ett runbook-steg som pekar på en rad ingen mäter är ett steg som
 * slutar fungera utan att någon märker det.
 *
 * Utskriften går till en sträng och inte till terminalen, så provet är lika
 * tyst som förut.
 */
const receiver = spawn(
  process.execPath,
  [join(root, "integrations/reference-receiver/server.mjs"), String(API_PORT)],
  { env: { ...env, FLOWWEAVER_TYST: "" }, stdio: ["ignore", "pipe", "pipe"] },
);
let receiverLog = "";

receiver.stdout.on("data", (chunk) => {
  receiverLog += chunk.toString();
});
/*
 * Vite startas **direkt** och inte genom `npx`.
 *
 * `npx` är ett skal runt kommandot, så `site.kill()` dödade skalet och lämnade
 * vite kvar — på en `--strictPort`-port. Nästa körning fick då sin egen vite
 * dödad av *Port 5198 is already in use* medan `waitFor(SITE)` ändå svarade ja,
 * för den gamla servern stod ju där. Mätt 18/9: fem kvarglömda vite-processer
 * från fem körningar under dagen, och två röda körningar som inte hade något
 * med koden att göra.
 */
const site = process.env.BASE_URL
  ? null
  : DEMO
    ? spawn(process.execPath, [join(root, "tools/serve-demo.mjs"), String(SITE_PORT)], {
        cwd: root,
        env,
        stdio: "ignore",
      })
    : spawn(process.execPath, [join(root, "node_modules/vite/bin/vite.js"), "--port", String(SITE_PORT), "--strictPort"], {
        cwd: root,
        env,
        stdio: "ignore",
      });

/*
 * `anyAnswer`: the server is up when it answers at all. The storage host is
 * asked that way, on `/auth/me` — signed out it answers `401`, which is the
 * answer of a server that is up. It used to be asked on `/recipients`, a route
 * of FlowWeaver PRO's; in the open repo that is a `404`, and the smoke reported
 * the host as never started (measured 7/10, in the exported tree).
 */
const waitFor = async (url, { anyAnswer = false } = {}) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const answer = await fetch(url);
      if (answer.ok || anyAnswer) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
};

let browser;

try {
  const up =
    (await waitFor(`${ISSUER}/.well-known/openid-configuration`)) &&
    (await waitFor(`${API}/auth/me`, { anyAnswer: true })) &&
    (await waitFor(SITE));

  if (!up) {
    check("leverantören, värden och sajten svarar", false, "kom aldrig upp");
    throw new Error("servrarna startade inte");
  }

  check("leverantören, värden och sajten svarar", true);

  browser = await chromium.launch();

  const trouble = [];

  /** En egen webbläsarkontext — alltså en egen cookie-burk, alltså en egen person. */
  const person = async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    page.on("console", (message) => {
      /*
       * `401`, `403`, `404` och `409` räknas inte som fel här, och det är inte
       * en uppmjukning. Provet FRAMKALLAR avvisningar med flit — utloggad, en
       * krock mellan två som sparar, och sedan berättelse 128 fyra roller mot
       * fem skrivande vägar plus ett id som inte finns — och en webbläsare
       * loggar varje avvisat svar som ett konsolfel. `403` kom till med A8
       * (22/9), när rollavslag slutade svara `401`.
       * En kontroll som räknade dem hade varit röd för att provet gjorde sitt
       * jobb, vilket är en kontroll man snart slutar läsa. Allt annat räknas:
       * ett skriptfel, ett blockerat anrop, ett svar med fel status.
       */
      if (message.type() === "error" && !/status of (401|403|404|409)/.test(message.text())) {
        trouble.push(message.text().slice(0, 140));
      }
    });
    page.on("requestfailed", (request) => {
      if (request.failure()?.errorText !== "net::ERR_ABORTED") {
        trouble.push(`blockerad: ${request.url()}`);
      }
    });

    return page;
  };

  const guidesPage = `${SITE}${GUIDES_PATH}?api=${encodeURIComponent(API)}`;

  const openGuides = async (page) => {
    await page.goto(guidesPage, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
  };

  /** Vad listsidan visar just nu. */
  const listState = (page) =>
    page.evaluate(() => {
      const text = (id) => (document.getElementById(id)?.textContent ?? "").replace(/\s+/g, " ").trim();

      return {
        utloggadSynlig: document.getElementById("signed-out")?.hidden === false,
        inloggadSynlig: document.getElementById("signed-in")?.hidden === false,
        knapp: text("login"),
        vem: text("who"),
        besked: document.getElementById("notice")?.hidden === false ? text("notice") : "",
        inget: document.getElementById("nothing")?.hidden === false ? text("nothing") : "",
        rader: [...document.querySelectorAll("#list .guides__link")].map((one) => one.textContent ?? ""),
        meta: [...document.querySelectorAll("#list .guides__meta")].map((one) =>
          (one.textContent ?? "").replace(/\s+/g, " ").trim(),
        ),
        sökSynlig: document.getElementById("search")?.hidden === false,
        /*
         * *Ny guide* mäts som en RUTA och inte som ett attribut (berättelse
         * 128). Knappen bär `display` i en klassregel, precis som väljaren och
         * etiketten bredvid den, och den fällan har den här filen redan gått i
         * tre gånger: `hidden` förlorar mot `display`, och ett prov som läser
         * flaggan är grönt medan knappen står kvar på skärmen.
         */
        nyRuta: (() => {
          const r = document.getElementById("new")?.getBoundingClientRect();

          return r ? `${Math.round(r.width)}x${Math.round(r.height)}` : "finns inte";
        })(),
        nyBesked:
          document.getElementById("create-note")?.hidden === false ? text("create-note") : "",
        /* Räknaren under sökrutan, och vad som står i fältet just nu. */
        räknare: text("count"),
        sökterm: document.getElementById("search")?.value ?? "(inget fält)",
        // Filtret: finns det, och står det på? (berättelse 127)
        filterSynlig: document.getElementById("filter")?.hidden === false,
        filterEtikett: text("only-mine-label"),
        filterPå: document.getElementById("only-mine")?.checked === true,
      };
    });

  /** Klicka *Bara mina*, och låt sidan rita om sig. */
  const väljBaraMina = async (page, på) => {
    await page.evaluate((want) => {
      const box = document.getElementById("only-mine");

      if (box.checked !== want) {
        box.click();
      }
    }, på);
    await page.waitForTimeout(300);
  };

  /**
   * Genom leverantörens sida, som en människa gör det.
   *
   * Länkarna klickas och ingenting byggs ihop för hand: det som ska mätas är
   * att omdirigeringarna hänger ihop, och en körning som hoppar över en av dem
   * mäter inte det.
   */
  const signIn = async (page, whoId) => {
    await page.locator("#login").click();
    await page.waitForURL(/\/authorize/, { timeout: 10_000 });
    await page.locator(`#${whoId}`).click();
    await page.waitForURL((url) => url.pathname === GUIDES_PATH, { timeout: 10_000 });
    await page.waitForTimeout(600);
  };

  /* ── 1. Utloggad: en knapp, och inget annat ───────────────────────────── */

  const johan = await person();

  await openGuides(johan);

  const utloggad = await listState(johan);

  check(
    "utloggad ser knappen Logga in och ingen lista",
    utloggad.utloggadSynlig &&
      !utloggad.inloggadSynlig &&
      utloggad.knapp === "Logga in" &&
      utloggad.rader.length === 0,
    JSON.stringify(utloggad),
  );
  check(
    "och ingen tom lista som läses som att man inte har några guider",
    utloggad.inget === "",
    utloggad.inget || "inget besked",
  );

  /* ── 2. Avbryt hos leverantören lämnar en där man var ─────────────────── */

  await johan.locator("#login").click();
  await johan.waitForURL(/\/authorize/, { timeout: 10_000 });
  await johan.locator("#deny").click();
  await johan.waitForURL((url) => url.pathname === GUIDES_PATH, { timeout: 10_000 });
  await johan.waitForTimeout(500);

  const efterAvbryt = await listState(johan);

  check(
    "Avbryt hos leverantören lämnar en utloggad på sidan man kom från",
    efterAvbryt.utloggadSynlig && !efterAvbryt.inloggadSynlig,
    JSON.stringify({ ut: efterAvbryt.utloggadSynlig, in: efterAvbryt.inloggadSynlig }),
  );

  /* ── 3. Inloggning ────────────────────────────────────────────────────── */

  await signIn(johan, "as-johan");

  const inloggad = await listState(johan);

  check(
    "inloggad säger vem man är, med namnet ur tokenet och rollen ur .env",
    inloggad.inloggadSynlig && inloggad.vem === "Inloggad som Johan Furuskog · förvaltare",
    JSON.stringify({ vem: inloggad.vem, in: inloggad.inloggadSynlig }),
  );
  check(
    "en nyinloggad förvaltare har inga guider, och sidan säger det",
    inloggad.rader.length === 0 && inloggad.inget.includes("inga guider än"),
    JSON.stringify({ rader: inloggad.rader, inget: inloggad.inget }),
  );

  /*
   * Och sökrutan finns inte alls över ett tomt konto — varken fältet eller
   * dess etikett.
   *
   * Rutorna mäts och inte flaggorna. Båda elementen bär `display` i en
   * klassregel, som vinner över `hidden`, och etiketten ligger dessutom som
   * ett eget rutnätsobjekt bredvid rutan i stället för inuti den — så att
   * gömma det ena och glömma det andra lämnar *Sök på titel* stående över
   * ingenting.
   */
  const tomSök = await johan.evaluate(() => {
    const box = (id) => {
      const el = document.getElementById(id);
      const r = el?.getBoundingClientRect();

      return r ? `${Math.round(r.width)}x${Math.round(r.height)}` : "finns inte";
    };

    return { ruta: box("search-box"), etikett: box("search-label") };
  });

  check(
    "och sökrutan tar ingen plats över ett tomt konto, etiketten med",
    tomSök.ruta === "0x0" && tomSök.etikett === "0x0",
    JSON.stringify(tomSök),
  );

  /*
   * Cookien är HttpOnly. Mätt och inte antaget: det är hela skälet att den är
   * en cookie och inte ett token i sidan — ett token sidan kan läsa är ett
   * token ett injicerat skript kan ta.
   */
  const cookies = await johan.context().cookies(API);
  const session = cookies.find((one) => one.name === "fw_session");

  check(
    "sessionen är en HttpOnly-cookie med SameSite=Lax",
    Boolean(session) && session.httpOnly === true && session.sameSite === "Lax",
    JSON.stringify(session ? { httpOnly: session.httpOnly, sameSite: session.sameSite } : "ingen cookie"),
  );
  check(
    "och inget skript på sidan kan läsa den",
    (await johan.evaluate(() => document.cookie)) === "",
    await johan.evaluate(() => document.cookie),
  );

  /*
   * Och `Secure` när värden står bakom https — det webbläsaren ovan omöjligen
   * kan visa, för en `Secure`-cookie skickas aldrig till `http://localhost` och
   * hela provet hade slutat fungera. Ett rakt anrop med `X-Forwarded-Proto`,
   * alltså precis huvudet Caddy sätter.
   */
  const bakomCaddy = await fetch(`${API}/auth/login?return=${encodeURIComponent(SITE)}`, {
    headers: { "x-forwarded-proto": "https" },
    redirect: "manual",
  });
  const satt = (bakomCaddy.headers.getSetCookie?.() ?? []).join(" | ");

  check(
    "bakom https bär den påbörjade inloggningen Secure",
    /Secure/.test(satt) && /HttpOnly/.test(satt) && /SameSite=Lax/.test(satt),
    satt.replace(/=[^;]+/, "=…").slice(0, 120) || "ingen cookie",
  );

  /* ── 4. Ny guide, och rakt in i editorn ───────────────────────────────── */

  await johan.locator("#new").click();
  await johan.waitForURL(/guide-storage\.html/, { timeout: 10_000 });
  await johan.waitForTimeout(1200);

  const guideId = new URL(johan.url()).searchParams.get("guide") ?? "";

  check("Ny guide öppnar editorn på en guide med ett id", guideId !== "", guideId.slice(0, 12));
  check(
    "och ingen hemlighet står i adressen",
    !johan.url().includes("key="),
    johan.url().replace(SITE, "").slice(0, 90),
  );

  const iRemsan = await johan.evaluate(() => ({
    vem: (document.getElementById("who-name")?.textContent ?? "").trim(),
    vemSynlig: document.getElementById("who")?.hidden === false,
    ut: (document.getElementById("signout")?.textContent ?? "").trim(),
    tillbaka: (document.getElementById("back-link")?.textContent ?? "").trim(),
    /* Remsan är sidans, inte editorns: den ligger utanför `<guide-editor>`. */
    iEditorn: document.querySelector("guide-editor")?.contains(document.getElementById("who")) ?? true,
    besked: (document.getElementById("status")?.textContent ?? "").replace(/\s+/g, " ").trim(),
  }));

  check(
    "sidans remsa säger vem som är inloggad, med vägen ut bredvid",
    iRemsan.vemSynlig &&
      iRemsan.vem === "Inloggad som Johan Furuskog · förvaltare" &&
      iRemsan.ut === "Logga ut",
    JSON.stringify(iRemsan),
  );
  check(
    "och vägen tillbaka är listan man kom ifrån, inte startsidan",
    iRemsan.tillbaka === "Guider" && iRemsan.iEditorn === false,
    JSON.stringify({ tillbaka: iRemsan.tillbaka, iEditorn: iRemsan.iEditorn }),
  );

  /*
   * Och *Logga ut* får plats för sin fokusring.
   *
   * Sidan hade ingen marginal i sidled, så remsans högra kant låg mot
   * fönsterkanten. En knapp som slutar exakt där ser hel ut — men ringen
   * (`outline: 3px` med `outline-offset: 2px`) ritas fem pixlar utanför och
   * syns aldrig för den som går på tangentbord. Rutan mäts därför med ringen
   * inräknad, inte bara knappen: knappen var innanför hela tiden.
   */
  const ringen = await johan.evaluate(() => {
    const ut = document.getElementById("signout")?.getBoundingClientRect();
    const tillbaka = document.getElementById("back-link")?.getBoundingClientRect();
    if (!ut || !tillbaka) return { mätt: false };

    return {
      mätt: true,
      högerLuft: Math.round(window.innerWidth - ut.right),
      vänsterLuft: Math.round(tillbaka.left),
    };
  });

  /*
   * Fem pixlar, hämtade ur regeln och inte ur den beräknade stilen: ringen är
   * `outline: 3px` med `outline-offset: 2px` i `guide-storage.scss`, och en
   * oskarpt fokuserad knapp rapporterar offset 0 — en mätning av den hade
   * godkänt noll pixlars luft.
   */
  const RING = 5;

  check(
    "och Logga ut har plats för sin fokusring innanför fönstret",
    ringen.mätt === true && ringen.högerLuft >= RING && ringen.vänsterLuft >= RING,
    JSON.stringify({ ...ringen, behövs: RING }),
  );

  /*
   * Och historikpopovern kan inte nå identiteten.
   *
   * Det här är felet flytten gjordes för. Johans skärmbild 18/9 kväll visade
   * popovern liggande över editorns rad med namnet avklippt till *m Johan
   * Furuskog* — identiteten satt då i raden, och popovern hänger under sin
   * knapp som sitter i samma rad. Med remsan uppe på sidan kan rutorna inte
   * överlappa, och det är rutorna som mäts: att elementet flyttat är ett
   * påstående om DOM, att det inte kan skymmas är ett påstående om skärmen.
   */
  await johan.evaluate(() => document.getElementById("history")?.click());
  await johan.waitForTimeout(600);

  const överlapp = await johan.evaluate(() => {
    const who = document.getElementById("who")?.getBoundingClientRect();
    const pop = document.getElementById("history-popover")?.getBoundingClientRect();

    if (!who || !pop) return { öppen: false };

    return {
      öppen: document.getElementById("history-popover")?.hidden === false,
      krockar: who.left < pop.right && pop.left < who.right && who.top < pop.bottom && pop.top < who.bottom,
      remsanBotten: Math.round(who.bottom),
      popoverTopp: Math.round(pop.top),
    };
  });

  await johan.keyboard.press("Escape");
  await johan.waitForTimeout(300);

  check(
    "och historikpopovern kan inte lägga sig över identiteten",
    överlapp.öppen === true && överlapp.krockar === false && överlapp.remsanBotten <= överlapp.popoverTopp,
    JSON.stringify(överlapp),
  );

  /* ── 5. Bygg något, publicera, och se vem som frös det ────────────────── */

  await johan.evaluate(() => {
    const editor = document.getElementById("editor");

    editor.graph = {
      startNodeId: "q",
      meta: { ...(editor.getData().meta ?? {}), name: "Bygglov i Överby" },
      nodes: [
        {
          id: "q",
          type: "question",
          position: { x: 80, y: 80 },
          data: {
            title: "Hur stor är tomten?",
            variableName: "tomt",
            options: [
              { id: "ja", label: "Ja", value: "ja" },
              { id: "nej", label: "Nej", value: "nej" },
            ],
          },
        },
        { id: "r", type: "result", position: { x: 520, y: 80 }, data: { title: "Du kan söka bygglov" } },
      ],
      connections: [
        { id: "c-ja", from: { nodeId: "q", portId: "ja" }, to: { nodeId: "r", portId: "input" } },
        { id: "c-nej", from: { nodeId: "q", portId: "nej" }, to: { nodeId: "r", portId: "input" } },
      ],
    };
    editor.dispatchEvent(
      new CustomEvent("graph-changed", {
        detail: { graph: editor.getData(), reason: "node-updated" },
        bubbles: true,
        composed: true,
      }),
    );
  });
  await johan.waitForTimeout(DRAFT_INTERVAL_MS + 600);

  await johan.evaluate(() => document.getElementById("publish")?.click());
  await johan.waitForTimeout(700);
  await johan.evaluate(() => {
    const dialog = document.querySelector("publish-dialog").shadowRoot;

    dialog.querySelector("[data-input]").value = "Första version";
    dialog.querySelector('[data-action="confirm"]').click();
  });
  await johan.waitForTimeout(1800);

  await johan.evaluate(() => document.getElementById("history")?.click());
  await johan.waitForTimeout(500);

  const historik = await johan.evaluate(() => ({
    rader: [...(document.getElementById("versions")?.shadowRoot?.querySelectorAll("tbody tr") ?? [])].map(
      (row) => (row.textContent ?? "").replace(/\s+/g, " ").trim(),
    ),
    av: [...(document.getElementById("versions")?.shadowRoot?.querySelectorAll("[data-by]") ?? [])].map(
      (one) => (one.textContent ?? "").trim(),
    ),
  }));

  check(
    "historiken säger vem som frös versionen",
    historik.av.includes("av Johan Furuskog"),
    JSON.stringify(historik),
  );

  /* ── 6. Tillbaka till listan: guiden står där, med sin titel ──────────── */

  await openGuides(johan);

  const medGuide = await listState(johan);

  check(
    "guiden står i listan med sin titel, inte med sitt id",
    medGuide.rader.length === 1 && medGuide.rader[0] === "Bygglov i Överby",
    JSON.stringify(medGuide.rader),
  );
  check(
    "och raden säger att den är publicerad",
    (medGuide.meta[0] ?? "").startsWith("Publicerad"),
    medGuide.meta[0] ?? "ingen rad",
  );

  /*
   * Och vem som ändrade den (berättelse 127, kriterium 3 och 5).
   *
   * Namnet kommer ur sessionen hos värden, inte ur sidan. Datumet mäts mot
   * formen och inte mot en sträng: *2026-09-17* är svenskans egen korta
   * datumform, och den läses som en maskinsträng bredvid ett namn — så en ISO-
   * stämpel i raden är ett fel även när den är rätt tidpunkt.
   */
  check(
    "raden säger vem som ändrade guiden senast",
    (medGuide.meta[0] ?? "").includes("av Johan Furuskog"),
    medGuide.meta[0] ?? "ingen rad",
  );
  check(
    "och datumet står i sajtens form, aldrig som ISO",
    /Ändrad \d{1,2} \w+\.? \d{4}[ ,]+\d{2}[:.]\d{2} av Johan Furuskog/.test(medGuide.meta[0] ?? "") &&
      !/\d{4}-\d{2}-\d{2}/.test(medGuide.meta[0] ?? ""),
    medGuide.meta[0] ?? "ingen rad",
  );

  /* ── 7. Sök på titel: en vanlig sökning som filtrerar listan ──────────── */

  /*
   * En guide till, så det finns något att smalna av. Den skapas genom värdens
   * egen väg och inte genom knappen, för knappen tar en till editorn — och det
   * som mäts här är sökningen, inte navigeringen.
   */
  await johan.evaluate(
    async (base) => {
      await fetch(`${base}/guides`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Parkeringstillstånd" }),
      });
    },
    API,
  );
  await openGuides(johan);

  const tvåGuider = await listState(johan);

  check(
    "två guider, båda med namn",
    tvåGuider.rader.length === 2 && tvåGuider.rader.includes("Parkeringstillstånd"),
    JSON.stringify(tvåGuider.rader),
  );

  /*
   * *Ny guide* står i linje med sökrutans överkant.
   *
   * Johans skärmbild 18/9: knappen låg sexton pixlar för lågt, med sin
   * överkant i höjd med räknaren *3 guider* under fältet. Orsaken var en
   * flexrad med `align-items: flex-end`.
   *
   * Överkanterna mäts och inte underkanterna. Raden bär en räknare under
   * fältet, och den byter höjd när texten blir *2 av 5 guider* i stället för
   * *5 guider* — en jämförelse av underkanter hade alltså gått sönder av att
   * någon skrev en bokstav.
   */
  const iLinje = await johan.evaluate(() => {
    const knapp = document.getElementById("new")?.getBoundingClientRect();
    const ruta = document.getElementById("search")?.getBoundingClientRect();

    return knapp && ruta
      ? { skillnad: Math.round(Math.abs(knapp.top - ruta.top)), knapp: Math.round(knapp.top), ruta: Math.round(ruta.top) }
      : { skillnad: -1 };
  });

  check(
    "Ny guide står i linje med sökrutans överkant",
    iLinje.skillnad >= 0 && iLinje.skillnad <= 2,
    JSON.stringify(iLinje),
  );

  /*
   * Och räknaren innan något smalnat av. Den mäts före sökningen för att det
   * annars inte går att se att den ÄNDRADES — en räknare som råkar säga rätt
   * sak hela tiden är en räknare ingen kontroll märker att den står stilla.
   */
  check(
    "räknaren säger hur många guider som finns",
    tvåGuider.räknare === "2 guider",
    tvåGuider.räknare || "ingen räknare",
  );

  /*
   * Det Johan bad om: skriv, och listan under ändras (18/9).
   *
   * Tangent för tangent genom `type()` och inte genom att sätta `value` — en
   * tilldelning i JavaScript skickar inget `input`-event, så en kontroll som
   * gjorde så hade varit grön mot ett fält ingen kan skriva i. Vilket är exakt
   * felet som fanns här: väljarens ruta såg ut som ett sökfält, och det gick
   * inte att skriva i den.
   */
  await johan.locator("#search").click();
  await johan.keyboard.type("bygg");
  await johan.waitForTimeout(300);

  const filtrerad = await listState(johan);

  check(
    "en skriven titel smalnar listan medan man skriver",
    filtrerad.rader.length === 1 && filtrerad.rader[0] === "Bygglov i Överby",
    JSON.stringify({ rader: filtrerad.rader, term: filtrerad.sökterm }),
  );
  check(
    "och räknaren säger hur mycket av allt som blev kvar",
    filtrerad.räknare === "1 av 2 guider",
    filtrerad.räknare || "ingen räknare",
  );

  /* Skiftläge räknas inte, och delsträngen behöver inte stå först. */
  await johan.locator("#search").fill("");
  await johan.locator("#search").click();
  await johan.keyboard.type("ÖVERBY");
  await johan.waitForTimeout(300);

  const versaler = await listState(johan);

  check(
    "sökningen är skiftlägesokänslig och träffar mitt i titeln",
    versaler.rader.length === 1 && versaler.rader[0] === "Bygglov i Överby",
    JSON.stringify(versaler.rader),
  );

  /* Ingen träff: beskedet, och en väg tillbaka som går att trycka på. */
  await johan.locator("#search").fill("");
  await johan.locator("#search").click();
  await johan.keyboard.type("xyzzy");
  await johan.waitForTimeout(300);

  const ingenTräff = await listState(johan);
  const rensaKnapp = await johan.evaluate(() => {
    const el = document.querySelector("#nothing .guides__clear");
    const r = el?.getBoundingClientRect();

    return r ? { text: el.textContent.trim(), ruta: `${Math.round(r.width)}x${Math.round(r.height)}` } : null;
  });

  check(
    "ingen träff säger det, och erbjuder ett sätt att rensa",
    ingenTräff.rader.length === 0 &&
      ingenTräff.inget.includes("Ingen guide heter så.") &&
      rensaKnapp !== null &&
      rensaKnapp.ruta !== "0x0",
    JSON.stringify({ inget: ingenTräff.inget, knapp: rensaKnapp }),
  );
  check(
    "och räknaren säger noll av allt, inte ingenting",
    ingenTräff.räknare === "0 av 2 guider",
    ingenTräff.räknare || "ingen räknare",
  );

  await johan.evaluate(() => document.querySelector("#nothing .guides__clear")?.click());
  await johan.waitForTimeout(300);

  const efterRensning = await listState(johan);

  check(
    "Rensa sökningen ger alla guider tillbaka, och tömmer fältet",
    efterRensning.rader.length === 2 &&
      efterRensning.sökterm === "" &&
      efterRensning.räknare === "2 guider",
    JSON.stringify({ rader: efterRensning.rader, term: efterRensning.sökterm, räknare: efterRensning.räknare }),
  );

  /*
   * Escape gör samma sak från fältet, utan att man behöver hitta knappen.
   *
   * **Vad den här kontrollen inte kan se** (praxis 4, andra frågan): den
   * förblir grön om sidans egen Escape-hanterare tas bort. Mätt genom att ta
   * bort den — Chromium rensar ett `type="search"`-fält på Escape av sig själv
   * och skickar ett `input`-event, så utfallet blir detsamma. Hanteraren finns
   * för webbläsare som inte gör det, och det går inte att mäta här.
   *
   * Kontrollen står kvar ändå, för det den mäter är kravet: Escape rensar. Att
   * kravet i just den här webbläsaren uppfylls av webbläsaren är ett svar på
   * frågan, inte ett hål i den.
   */
  await johan.locator("#search").click();
  await johan.keyboard.type("bygg");
  await johan.waitForTimeout(300);
  await johan.keyboard.press("Escape");
  await johan.waitForTimeout(300);

  const efterEscape = await listState(johan);

  check(
    "Escape rensar fältet och listan med det",
    efterEscape.rader.length === 2 && efterEscape.sökterm === "",
    JSON.stringify({ rader: efterEscape.rader, term: efterEscape.sökterm }),
  );

  /* ── 8. Anna ser Johans guider — listan är organisationens ────────────── */

  /*
   * Berättelse 127, kriterium 1. Fram till den här körningen såg varje redaktör
   * bara sina egna guider, och då hade *vem ändrade senast* ingen att visa: man
   * var alltid själv den enda som rört något man kunde se.
   *
   * Anna har aldrig skapat något och ingen har delat något med henne. Hon ska
   * ändå se Johans båda guider, för en guide i ett CMS är sajtens innehåll och
   * inte en persons.
   */
  const anna = await person();

  await openGuides(anna);
  await signIn(anna, "as-anna");

  const annasLista = await listState(anna);

  check(
    "en annan inloggad redaktör ser organisationens guider, inte en tom lista",
    annasLista.vem === "Inloggad som Anna Andersson · publicerare" &&
      annasLista.rader.length === 2 &&
      annasLista.rader.includes("Bygglov i Överby"),
    JSON.stringify({ vem: annasLista.vem, rader: annasLista.rader }),
  );
  check(
    "och raden säger att det var Johan som ändrade dem",
    (annasLista.meta.find((one) => one.includes("av ")) ?? "").includes("av Johan Furuskog"),
    JSON.stringify(annasLista.meta),
  );

  /*
   * Och Anna når guiden på riktigt — läsa och skriva. Läsningen och skrivningen
   * går genom samma vakt, vilket gör det lätt att tro att en mätning av den ena
   * mäter den andra. Den gör inte det: en vakt som råkar hoppas över för en
   * metod går igenom varje kontroll som bara läser.
   */
  const som = (page) => (method, path, body) =>
    page.evaluate(
      async ([base, p, m, b]) => {
        const answer = await fetch(`${base}${p}`, {
          method: m,
          credentials: "include",
          headers: { "content-type": "application/json" },
          ...(b === null ? {} : { body: JSON.stringify(b) }),
        });

        return { status: answer.status, text: (await answer.text()).slice(0, 160) };
      },
      [API, path, method, body ?? null],
    );
  const somAnna = som(anna);

  const annaLäser = await somAnna("GET", `/guides/${guideId}`);

  check(
    "Anna kan öppna Johans guide",
    annaLäser.status === 200,
    `${annaLäser.status} ${annaLäser.text.slice(0, 80)}`,
  );

  /* ── 8b. Bara mina — filtret, av som standard ─────────────────────────── */

  check(
    "filtret finns och står av",
    annasLista.filterSynlig === true &&
      annasLista.filterPå === false &&
      annasLista.filterEtikett === "Bara mina",
    JSON.stringify({
      synlig: annasLista.filterSynlig,
      på: annasLista.filterPå,
      etikett: annasLista.filterEtikett,
    }),
  );

  await väljBaraMina(anna, true);

  const annasEgna = await listState(anna);

  check(
    "Bara mina tömmer listan för den som inte skapat något",
    annasEgna.rader.length === 0 && annasEgna.inget.includes("inga egna guider"),
    JSON.stringify({ rader: annasEgna.rader, inget: annasEgna.inget }),
  );
  check(
    "och beskedet säger vägen tillbaka, inte att det inte finns några guider",
    annasEgna.inget.includes("Bara mina") && !annasEgna.inget.includes("Ny guide skapar"),
    annasEgna.inget || "inget besked",
  );
  check(
    "kryssrutan står kvar när filtret tömt skärmen",
    annasEgna.filterSynlig === true,
    JSON.stringify({ synlig: annasEgna.filterSynlig }),
  );

  await väljBaraMina(anna, false);

  const annasAllaIgen = await listState(anna);

  check(
    "och att ta bort filtret ger allas guider tillbaka",
    annasAllaIgen.rader.length === 2,
    JSON.stringify(annasAllaIgen.rader),
  );

  /* Och för Johan, som skapat båda, är *Bara mina* ingen skillnad alls. */
  await openGuides(johan);
  await väljBaraMina(johan, true);

  const nissesEgna = await listState(johan);

  check(
    "för den som skapat guiderna smalnar Bara mina ingenting",
    nissesEgna.rader.length === 2,
    JSON.stringify(nissesEgna.rader),
  );

  await väljBaraMina(johan, false);

  /* ── 8c. Editorns rad: sparad … av, bara när det är någon annans ──────── */

  /*
   * Kriterium 3, den andra halvan. Nisse sparar en arbetskopia; Anna öppnar
   * samma guide och ska se *sparad HH:MM av Nisse Hult*. Nisse själv ska se
   * *sparad HH:MM* och inget namn — ett eget namn varje gång är en rad man
   * slutar läsa, och då står den där även den dagen den bär ett annat.
   *
   * Nisse är **redaktör** sedan berättelse 128, och det är precis rätt person
   * för den här halvan: han får skriva arbetskopian och inget mer. Kedjan i
   * berättelsen går genom just det — Nisse ändrar, raden säger *sparad av
   * Nisse Hult*, och Anna publicerar det hon ser.
   */
  const nisse = await person();

  await openGuides(nisse);
  await signIn(nisse, "as-nisse");

  const nissesUtkast = {
    startNodeId: "q",
    meta: { name: "Bygglov i Överby" },
    nodes: [
      {
        id: "q",
        type: "question",
        position: { x: 80, y: 80 },
        data: { title: "Nisses fråga", variableName: "tomt", options: [{ id: "ja", label: "Ja", value: "ja" }] },
      },
    ],
    connections: [],
  };

  const nisseSparar = async (graf) =>
    nisse.evaluate(
      async ([base, id, g]) => {
        const läst = await (await fetch(`${base}/guides/${id}`, { credentials: "include" })).json();
        const answer = await fetch(`${base}/guides/${id}/draft`, {
          method: "PUT",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ graph: g, draftSavedAt: läst.draftSavedAt ?? "" }),
        });

        return { status: answer.status, ...(await answer.json()) };
      },
      [API, guideId, graf],
    );

  const förstaSparningen = await nisseSparar(nissesUtkast);

  check(
    "Nisse — redaktör — sparar en arbetskopia",
    förstaSparningen.status === 200 && typeof förstaSparningen.savedAt === "string",
    JSON.stringify(förstaSparningen).slice(0, 120),
  );

  const editorsRad = (page) =>
    page.evaluate(() => (document.getElementById("status")?.textContent ?? "").replace(/\s+/g, " ").trim());

  /**
   * Öppnar guiden och **väntar in att sidan är klar**, inte en fast tid.
   *
   * Raden ritas först när allt före den är gjort: `/auth/me`, låset, guiden,
   * versionslistan. Den fasta väntan på 1,5 s räckte till 18/9 kväll, då låset
   * la till en tur till uppstarten — och då hann provets ändring ibland före
   * `edit()`, som skrev över den med guiden från värden. Raden sa sedan *sparad
   * ·* utan klockslag, vilket såg ut som en trasig autospar men var en
   * kapplöpning i provet.
   */
  const öppnaGuiden = async (page) => {
    await page.goto(`${SITE}${EDITOR_PATH}?guide=${guideId}&api=${encodeURIComponent(API)}`, {
      waitUntil: "networkidle",
    });
    await page
      .waitForFunction(() => (document.getElementById("status")?.textContent ?? "").trim() !== "", null, {
        timeout: 15_000,
      })
      .catch(() => undefined);
    await page.waitForTimeout(400);
  };

  /*
   * **Nisse först, Anna sedan** — och ordningen är låsets (berättelse 129).
   *
   * Sidan tar låset när den öppnar guiden för redigering, så två fönster kan
   * inte längre stå öppna i redigeringsläge samtidigt. Den som öppnar först
   * håller det; den andre får läsläge, vilket mäts i 8f. Här ska raden mätas,
   * och då måste var och en öppna guiden medan den är ledig.
   *
   * Nisse lämnar guiden genom att gå till listan, som en människa gör — och
   * det är samtidigt kontrollen av att `pagehide` och *Guider*-länken släpper
   * låset. Gjorde de inte det hade Annas rad nedan sagt *Låst av Nisse Hult*.
   */
  await öppnaGuiden(nisse);

  const nissesRad = await editorsRad(nisse);

  check(
    "och bara sparad … för den som skrev den själv",
    /sparad \d{2}[:.]\d{2}/.test(nissesRad) && !/ av /.test(nissesRad),
    nissesRad || "ingen rad",
  );

  await openGuides(nisse);
  await öppnaGuiden(anna);

  const annasRad = await editorsRad(anna);

  check(
    "editorns rad säger sparad … av Nisse Hult för den som inte skrev den",
    /sparad \d{2}[:.]\d{2} av Nisse Hult/.test(annasRad),
    annasRad || "ingen rad",
  );
  check(
    "och låset släpptes när Nisse gick till listan — annars vore Annas rad en låsrad",
    !/Låst av/.test(annasRad),
    annasRad || "ingen rad",
  );

  /* ── 8d. Låset: läsläge, Ta över, och den som förlorar det ───────────── */

  /*
   * Berättelse 129, kriterium 2 och 3.
   *
   * Anna håller låset sedan hon öppnade guiden ovan. Nu ska tre saker synas,
   * och de svarar på olika frågor:
   *
   *  - **Nisse (redaktör)** får läsläge och raden med tiderna, men ingen knapp
   *    — övertagande är publicerarens, och en knapp som bara ger ett `401` är
   *    värre än ingen knapp;
   *  - **Johan (förvaltare)** får knappen, och dialogen säger vad den kostar
   *    Anna innan han trycker;
   *  - **Annas fönster** går i läsläge vid sin nästa aktivitet, med en rad som
   *    säger vem och när — och det hon inte hunnit spara ligger i webbläsaren.
   *
   * Och en sak till, som bara syns här: **ingenting sägs två gånger**. Brickan
   * säger *Läsläge*, raden säger vem, canvasens märke säger läsläge — och
   * panelens ruta om samma sak är borta, för sidan sätter `mode-notice="off"`.
   */

  /** Vad editorsidan visar just nu — rutor och renderad text, aldrig attribut. */
  const editorLäge = (page) =>
    page.evaluate(() => {
      const ruta = (element) => {
        const box = element?.getBoundingClientRect();

        return box ? `${Math.round(box.width)}x${Math.round(box.height)}` : "finns inte";
      };
      const editor = document.getElementById("editor");
      const inuti = editor?.shadowRoot ?? null;
      /*
       * Märket bor i `node-editor`s eget skuggträd, ett steg in — mätt, inte
       * antaget: en första version av den här raden letade i `guide-editor`s
       * och rapporterade "inget märke" om en canvas som sa LÄSLÄGE.
       */
      const plakett = inuti
        ?.querySelector("node-editor")
        ?.shadowRoot?.querySelector("[data-mode-plaque]");
      const panelen = inuti?.querySelector("properties-panel");
      const panel = panelen?.shadowRoot ?? null;

      return {
        rad: (document.getElementById("status")?.textContent ?? "").replace(/\s+/g, " ").trim(),
        bricka: (document.getElementById("badge-text")?.textContent ?? "").trim(),
        // Hänglåset RITAS bara i det låsta läget — de andra märkena är prickar.
        hänglås: Boolean(document.querySelector("#mark svg")?.checkVisibility?.()),
        /*
         * Knappen mäts som en RUTA och inte som `hidden`: `display` i en
         * klassregel vinner över flaggan, och den fällan har den här filen
         * redan gått i tre gånger.
         */
        taÖver: ruta(document.getElementById("takeover")),
        publicera: ruta(document.getElementById("publish")),
        välj: ruta(document.getElementById("choose")),
        /* Canvasens märke: *läsläge* för den som tittar på grafen. */
        märke: plakett && plakett.hidden === false ? (plakett.textContent ?? "").trim() : "",
        /*
         * Panelens ruta om samma sak — ska INTE finnas här (`mode-notice="off"`).
         *
         * Och skillnaden mellan *borta* och *ingen panel alls* sägs, för en
         * kontroll som inte hittar panelen är grön av fel skäl.
         */
        panelruta: !panel ? "ingen panel" : panel.querySelector("[data-mode-notice]") ? "finns" : "borta",
        räddning: (document.getElementById("rescue")?.hidden === false
          ? (document.getElementById("rescue-text")?.textContent ?? "")
          : ""
        ).trim(),
        räddningKnappar: [
          ruta(document.getElementById("rescue-keep")),
          ruta(document.getElementById("rescue-drop")),
        ],
        /* *Slå ihop* (131), förstahandsvalet när kopian bär sin utgångspunkt.
           Mätt som RUTA och inte som `hidden` — PRAXIS 36. */
        räddningSlåIhop: ruta(document.getElementById("rescue-merge")),
        räddningSlåIhopText: (document.getElementById("rescue-merge")?.textContent ?? "").trim(),
        räddningSlåIhopPris: (
          document.getElementById("rescue-merge-cost")?.textContent ?? ""
        ).trim(),
        /* Knapparnas egna ord: raden slutade fråga i 129:s skärning, så det är
           här *vems version* numera står. */
        räddningKnappTexter: [
          (document.getElementById("rescue-keep")?.textContent ?? "").trim(),
          (document.getElementById("rescue-drop")?.textContent ?? "").trim(),
        ],
        /*
         * Priset under var sin knapp (Johan 19/9: *"När jag trycker Fortsätt
         * där jag var försvinner Annas ändringar"*). Läses ur sina egna
         * element och inte ur radens text: det är kopplingen knapp–pris som är
         * hela poängen, och en mening i frågan hade sett likadan ut här.
         */
        räddningPriser: [
          (document.getElementById("rescue-keep-cost")?.textContent ?? "").trim(),
          (document.getElementById("rescue-drop-cost")?.textContent ?? "").trim(),
        ],
      };
    });

  /** Webbläsarkopian, rå ur lagringen — finns den, och vad bär den? */
  const webbläsarkopian = (page) =>
    page.evaluate((id) => {
      const raw = localStorage.getItem(`flowweaver.guide-rescue:${id}`);

      if (!raw) return null;

      const held = JSON.parse(raw);

      return { titel: held?.graph?.nodes?.[0]?.data?.title ?? "", tid: held?.at ?? "" };
    }, guideId);

  /** En ändring i editorn, som en människa gör den — och alltså aktivitet. */
  const ändra = (page, titel, nod = 0) =>
    page.evaluate(([text, index]) => {
      const editor = document.getElementById("editor");
      const graph = editor.getData();

      graph.nodes[index].data.title = text;
      editor.graph = graph;
      editor.dispatchEvent(
        new CustomEvent("graph-changed", {
          detail: { graph: editor.getData(), reason: "node-updated" },
          bubbles: true,
          composed: true,
        }),
      );
    }, [titel, nod]);

  await öppnaGuiden(nisse);

  const nissesLåsta = await editorLäge(nisse);

  check(
    "en redaktör som öppnar en låst guide får läsläge och raden med vem",
    /^Låst av Anna Andersson · aktiv (nyss|för (en|\d+) minuter? sedan)$/.test(nissesLåsta.rad) &&
      /*
       * Brickan säger **Låst** och inte *Läsläge* (Johan 18/9 kväll): hänglåset
       * betyder en annan människa, och *Läsläge* är vad en äldre version får.
       * Canvasens märke säger läsläge i båda — det är editorns tillstånd.
       */
      nissesLåsta.bricka === "Låst" &&
      nissesLåsta.märke === "Läsläge",
    JSON.stringify(nissesLåsta),
  );
  /*
   * 129:s skärning, punkt 1: **inga klockslag i raden.** Den sa *sedan 08:15 ·
   * sparade senast 08:29 · aktiv senast 08:31*, tre uppgifter att jämföra
   * innan man visste om man skulle bry sig, och Johan efter mätningen 19/9:
   * *"lite skakigt."* Raden svarar nu på en fråga — sitter någon här nu? — och
   * de två faktaraderna står i Ta över-dialogen, där de behövs.
   *
   * Mätt som mönster: ett klockslag var som helst i raden fäller. Mutationen
   * som visade att den biter: `WORDS.lockedBy` tillbaka till formen med tre
   * tider.
   */
  check(
    "och inte ett enda klockslag — de två faktaraderna bor i Ta över-dialogen",
    !/\d{1,2}[:.]\d{2}/.test(nissesLåsta.rad) && !/sparade senast/.test(nissesLåsta.rad),
    nissesLåsta.rad,
  );
  await bild(nisse, "las-rad");

  check(
    "men ingen Ta över-knapp för en redaktör, och inget Publicera i en låst guide",
    nissesLåsta.taÖver === "0x0" && nissesLåsta.publicera === "0x0",
    JSON.stringify({ taÖver: nissesLåsta.taÖver, publicera: nissesLåsta.publicera }),
  );
  check(
    "hänglåset står i brickan bredvid ordet",
    nissesLåsta.hänglås === true,
    String(nissesLåsta.hänglås),
  );
  check(
    "och ingenting sägs två gånger — panelens ruta om läsläget är borta när raden finns",
    nissesLåsta.panelruta === "borta",
    nissesLåsta.panelruta,
  );

  /*
   * Annas lås tas om, så att det säkert lever när Johan möter det. Hennes sida
   * har stått orörd medan Nisse öppnade guiden, och låset förnyas bara av
   * aktivitet — vilket är precis vad 8g mäter längre ned.
   */
  await öppnaGuiden(anna);
  await öppnaGuiden(johan);

  const johansLåsta = await editorLäge(johan);

  check(
    "en förvaltare får Ta över, med en yta som går att träffa",
    Number(johansLåsta.taÖver.split("x")[1] ?? 0) >= 44 && johansLåsta.taÖver !== "0x0",
    JSON.stringify({ taÖver: johansLåsta.taÖver, rad: johansLåsta.rad }),
  );

  await johan.evaluate(() => document.getElementById("takeover").click());
  await johan.waitForTimeout(400);

  /**
   * Rutan som `confirmation-dialog` visar just nu — frågan före ett
   * övertagande, och sedan 129:s skärning också beskedet till den som
   * förlorade låset. En hjälpare och inte två: det ÄR samma element, och två
   * avläsningar av ett skuggträd är två som glider isär.
   */
  const bekräftelserutan = (page) =>
    page.evaluate(() => {
    const inuti = document.querySelector("confirmation-dialog")?.shadowRoot ?? null;
    const ruta = inuti?.querySelector("dialog");
    const knapp = inuti?.querySelector('[data-action="confirm"]');
    const avbrytKnapp = inuti?.querySelector('[data-action="cancel"]');
    const box = knapp?.getBoundingClientRect();
    const avbrytBox = avbrytKnapp?.getBoundingClientRect();

    return {
      öppen: ruta?.open === true,
      rubrik: (inuti?.querySelector("[data-title]")?.textContent ?? "").trim(),
      text: (inuti?.querySelector("[data-message]")?.textContent ?? "").replace(/\s+/g, " ").trim(),
      /*
       * Fakta som **rader**, inte som prosa (Johan 19/9 natt). Paren läses ur
       * `dt`/`dd` och inte ur en textsträng: det är den strukturen som gör att
       * en skärmläsare säger *Sparade senast, 00:29* i stället för en mening
       * man måste ta sig igenom, och en `<div>`-attrapp hade sett likadan ut
       * i en skärmbild.
       */
      /*
       * Tiden i konsekvensmeningen ska väga lika mycket som tiderna i raderna
       * — mätt som ett `strong`-element och inte som en fetare stil, för det
       * är strukturen som bär det vidare till den som lyssnar (Johan 19/9).
       */
      framhävt: [...(inuti?.querySelectorAll("[data-message] strong") ?? [])].map((one) =>
        (one.textContent ?? "").trim(),
      ),
      fakta: [...(inuti?.querySelectorAll("[data-facts] dt") ?? [])].map((dt) => [
        (dt.textContent ?? "").trim(),
        (dt.nextElementSibling?.tagName ?? "") === "DD"
          ? (dt.nextElementSibling?.textContent ?? "").trim()
          : "(ingen dd)",
      ]),
      knapp: (knapp?.textContent ?? "").trim(),
      avbryt: (inuti?.querySelector('[data-action="cancel"]')?.textContent ?? "").trim(),
      /*
       * En **fylld knapp**, inte ett fält (Johan 18/9: *"knapparna som mer ser
       * ut som inputfält"*). Mätt som en bakgrund som inte är sidans: ett
       * inmatningsfält står på ytan, en fylld knapp har en egen.
       */
      fylld: knapp ? getComputedStyle(knapp).backgroundColor : "",
      höjd: box ? Math.round(box.height) : 0,
      /*
       * Avbryt mäts som en **ruta** och inte som `hidden` (PRAXIS 36): en ruta
       * med ett val göms genom flaggan, och en `display` i skalets stilmall
       * hade vunnit över den utan att flaggan blev falsk. Den här filen har
       * gått i den fällan förut.
       */
      avbrytRuta: avbrytBox
        ? `${Math.round(avbrytBox.width)}x${Math.round(avbrytBox.height)}`
        : "finns inte",
      /* Vilken knapp fokus står på när rutan öppnas — den enda som finns. */
      fokus: (inuti?.activeElement?.dataset?.action ?? "ingen"),
    };
    });

  const övertagandefrågan = await bekräftelserutan(johan);

  check(
    "Ta över frågar först, och rubriken ÄR frågan",
    övertagandefrågan.öppen &&
      övertagandefrågan.rubrik === "Ta över guiden från Anna Andersson?",
    JSON.stringify({ öppen: övertagandefrågan.öppen, rubrik: övertagandefrågan.rubrik }),
  );
  check(
    "tiderna står som två rader med etikett och värde, inte i en mening",
    övertagandefrågan.fakta.length === 2 &&
      övertagandefrågan.fakta[0][0] === "Sparade senast" &&
      övertagandefrågan.fakta[1][0] === "Aktiv senast" &&
      övertagandefrågan.fakta.every(([, värde]) => /^\d{2}[:.]\d{2}$/.test(värde)),
    JSON.stringify(övertagandefrågan.fakta),
  );
  check(
    "och tiden i meningen är framhävd, som tiderna i raderna",
    övertagandefrågan.framhävt.length === 1 &&
      /^\d{2}[:.]\d{2}$/.test(övertagandefrågan.framhävt[0]),
    JSON.stringify(övertagandefrågan.framhävt),
  );
  check(
    "och konsekvensen är en mening, utan autosparens takt",
    /får läsläge/.test(övertagandefrågan.text) &&
      /några sekunder/.test(övertagandefrågan.text) &&
      !/var tredje sekund/.test(övertagandefrågan.text),
    övertagandefrågan.text.slice(0, 160),
  );
  check(
    "knappen är en fylld knapp bredvid Avbryt, aldrig ett fält",
    övertagandefrågan.knapp === "Ta över" &&
      övertagandefrågan.avbryt === "Avbryt" &&
      övertagandefrågan.höjd >= 36 &&
      !/rgba\(0, 0, 0, 0\)/.test(övertagandefrågan.fylld),
    JSON.stringify({ fylld: övertagandefrågan.fylld, höjd: övertagandefrågan.höjd }),
  );

  await johan.evaluate(() =>
    document.querySelector("confirmation-dialog").shadowRoot.querySelector('[data-action="confirm"]').click(),
  );
  await johan.waitForTimeout(1500);

  const johanEfterÖvertagande = await editorLäge(johan);

  check(
    "efter övertagandet redigerar Johan, och raden är en vanlig rad igen",
    !/Låst av/.test(johanEfterÖvertagande.rad) && johanEfterÖvertagande.märke === "",
    JSON.stringify(johanEfterÖvertagande).slice(0, 200),
  );

  /*
   * Och Annas fönster, som inte fått veta något ännu: låset förnyas bara vid
   * aktivitet, så beskedet kommer när hon rör guiden — inte förr, och det är
   * hela skillnaden mot en sida som pollar.
   */
  await ändra(anna, "Annas ord som aldrig hann sparas");
  await anna.waitForTimeout(DRAFT_INTERVAL_MS + 1500);

  /*
   * 129:s skärning, punkt 2: **en ruta, en mening, en knapp.**
   *
   * Beskedet stod i raden till 19/9, och en rad är lätt att missa — särskilt
   * den som byter text i samma ögonblick som editorn slutar gå att skriva i.
   * Den som satt och skrev märkte först att tangenterna inte längre gjorde
   * något. Nu avbryter en ruta, säger händelsen, och har en väg vidare.
   *
   * Mätt medan rutan står öppen, för det är där den gör sitt jobb.
   */
  const annasRuta = await bekräftelserutan(anna);

  check(
    "den som förlorar låset möter en ruta som säger vad som hände",
    annasRuta.öppen &&
      annasRuta.rubrik === "Johan Furuskog tog över guiden." &&
      /Dina ändringar finns kvar i den här webbläsaren/.test(annasRuta.text),
    JSON.stringify({ öppen: annasRuta.öppen, rubrik: annasRuta.rubrik, text: annasRuta.text }),
  );
  /*
   * **En** knapp, och fokus på den.
   *
   * Avbryt mäts som en ruta och inte som flaggan `hidden`: en `display` i en
   * klassregel vinner över användaragentens `[hidden]`, och då hade knappen
   * stått kvar synlig med flaggan korrekt satt hela tiden (PRAXIS 36). Mätt
   * genom att ta bort `cancelButton.hidden`-raden: rutan fick två knappar och
   * kontrollen föll.
   */
  check(
    "och rutan har ett enda val, OK, med fokus på det",
    annasRuta.knapp === "OK" &&
      annasRuta.avbrytRuta === "0x0" &&
      annasRuta.fokus === "confirm",
    JSON.stringify({
      knapp: annasRuta.knapp,
      avbryt: annasRuta.avbrytRuta,
      fokus: annasRuta.fokus,
    }),
  );
  /* Och inget klockslag: att det hände just nu är hela nyheten. */
  check(
    "rutan säger ingen tid att jämföra med",
    !/\d{1,2}[:.]\d{2}/.test(`${annasRuta.rubrik} ${annasRuta.text}`),
    `${annasRuta.rubrik} ${annasRuta.text}`,
  );

  /*
   * **En röst i taget** (Johan 19/9, av bilden `forlorarruta-900.png`).
   *
   * Rutan säger *Dina ändringar finns kvar i den här webbläsaren* — samma
   * mening som räddningsraden sedan UX-genomgången 129–131 (den sa *osparade
   * ändringar* till dess, en avvikande ord för samma fakta) — och
   * räddningsraden bakom rutan sa nästan samma mening samtidigt. Samma regel
   * som redan gällde krockrutan: raden göms medan en ruta frågar eller säger
   * samma sak, och kommer tillbaka när den är besvarad.
   *
   * **Båda halvorna mäts.** En kontroll som bara ser att raden är borta medan
   * rutan står öppen blir grön den dag raden aldrig kommer tillbaka — och då
   * är arbetet i webbläsaren omöjligt att nå. Mutationen som fäller den
   * första: ta bort `!takenOverOpen` ur `rescueVisible`.
   */
  const raddningsradenBakomRutan = await editorLäge(anna);

  check(
    "EN RÖST I TAGET: räddningsraden är gömd medan rutan står öppen",
    raddningsradenBakomRutan.räddning === "",
    JSON.stringify({
      rad: raddningsradenBakomRutan.räddning,
      ruta: annasRuta.rubrik,
    }),
  );

  await bild(anna, "forlorarruta");

  /* OK, och sedan läsläget som följer med (tillägget 19/9, mätt i 8d2). */
  await anna.evaluate(() =>
    document
      .querySelector("confirmation-dialog")
      .shadowRoot.querySelector('[data-action="confirm"]')
      .click(),
  );
  await anna.waitForTimeout(400);

  const annaEfterÖvertagande = await editorLäge(anna);
  const annasKopia = await webbläsarkopian(anna);

  /*
   * Och efter OK står läsläget kvar, med **tillståndet** i raden: vem som
   * håller guiden nu. Händelsen sa rutan, en gång — raden bär inte längre
   * *Johan Furuskog tog över guiden 09:41* till nästa omladdning och tränger
   * därmed inte undan den uppgift raden finns för.
   */
  /* Och den andra halvan: raden kommer tillbaka när rutan är besvarad. */
  check(
    "och den kommer tillbaka efter OK, med var arbetet ligger",
    /^Dina ändringar från \d{2}[:.]\d{2} finns kvar i den här webbläsaren\.$/.test(
      annaEfterÖvertagande.räddning,
    ),
    annaEfterÖvertagande.räddning || "ingen rad",
  );

  check(
    "efter OK står läsläget kvar, och raden säger vem som håller guiden nu",
    /^Låst av Johan Furuskog · aktiv (nyss|för (en|\d+) minuter? sedan)$/.test(
      annaEfterÖvertagande.rad,
    ) && annaEfterÖvertagande.bricka === "Låst",
    JSON.stringify(annaEfterÖvertagande).slice(0, 200),
  );
  check(
    "och det hon skrev ligger kvar i webbläsaren, inte i en exportfil",
    annasKopia?.titel === "Annas ord som aldrig hann sparas",
    JSON.stringify(annasKopia),
  );
  /*
   * **Slå ihop går direkt i låst läge** (Johan 20/9: *"varför inte bara kunna
   * få Slå ihop ändringar där och då?"*).
   *
   * Raden skickade till *Ta över* till 20/9, och skälet höll så länge det
   * enda valet var *Fortsätt där jag var* — den skriver rakt in i guiden och
   * ersätter den andres arbete utan att någon sett vad som försvinner.
   *
   * Sammanslagningen gör inte det: den fryser båda kopiorna, tar hens senast
   * sparade graf som ena sidan och min som andra, och behåller båda. Låset
   * finns för att två inte ska skriva på varandra **utan att veta det**.
   *
   * Mutationen som fäller det: `canMerge` tillbaka till `mayAnswer`, alltså
   * bara när ingen annan håller låset. Då saknar raden sin knapp.
   */
  check(
    "raden erbjuder Slå ihop direkt, utan att först ta över",
    /^Dina ändringar från \d{2}[:.]\d{2} finns kvar i den här webbläsaren\.$/.test(
      annaEfterÖvertagande.räddning,
    ) &&
      !/Ta över/.test(annaEfterÖvertagande.räddning) &&
      Number(annaEfterÖvertagande.räddningSlåIhop.split("x")[1] ?? 0) >= 44,
    JSON.stringify({
      text: annaEfterÖvertagande.räddning,
      slåIhop: annaEfterÖvertagande.räddningSlåIhop,
    }),
  );
  /*
   * Och *Fortsätt där jag var* står inte bredvid: den skriver över den andres
   * arbete utan att visa vad som försvinner, och ett val som gör mindre än ett
   * annat ska inte stå bredvid det.
   */
  check(
    "och Fortsätt där jag var står inte bredvid, men Börja från gör det",
    annaEfterÖvertagande.räddningKnappar[0] === "0x0" &&
      Number(annaEfterÖvertagande.räddningKnappar[1].split("x")[1] ?? 0) >= 44,
    JSON.stringify(annaEfterÖvertagande.räddningKnappar),
  );
  /*
   * **Ingenting kastas** (Johan 20/9: *"lite förvirrande att det står dina
   * ändringar kastas"*). Sedan 131 gäller att inget går förlorat, och då får
   * ingen knapp i raden säga *kastas*.
   */
  check(
    "och ingen knapp säger kastas — allt hamnar någonstans",
    annaEfterÖvertagande.räddningPriser[1] ===
      "Dina ändringar följer inte med, men finns kvar i historiken." &&
      !/kastas/.test(annaEfterÖvertagande.räddningPriser.join(" ")),
    JSON.stringify(annaEfterÖvertagande.räddningPriser),
  );

  /*
   * Och det som faktiskt räknas: hennes skrivning nådde aldrig värden. Raden är
   * halva svaret — en sida som säger läsläge och ändå sparar har sagt något
   * annat än den gör.
   */
  const hosVärden = async (nod = 0) =>
    nisse.evaluate(
      async ([base, id, index]) => {
        const body = await (await fetch(`${base}/guides/${id}`, { credentials: "include" })).json();

        return String(body.draft?.nodes?.[index]?.data?.title ?? "ingen arbetskopia");
      },
      [API, guideId, nod],
    );

  check(
    "och ingenting av det nådde värden — autosparen är frånkopplad, inte pausad",
    (await hosVärden()) !== "Annas ord som aldrig hann sparas",
    await hosVärden(),
  );

  /** Krockrutan: står den öppen, vad säger den, och hur ser valen ut? */
  const krockrutan = (page) =>
    page.evaluate(() => {
      const inuti = document.querySelector("conflict-dialog")?.shadowRoot ?? null;
      const ruta = inuti?.querySelector("dialog");
      const rubrik = inuti?.querySelector("[data-title]");

      return {
        öppen: ruta?.open === true,
        rubrik: (rubrik?.textContent ?? "").trim(),
        text: (inuti?.querySelector("[data-body]")?.textContent ?? "").replace(/\s+/g, " ").trim(),
        /* Fokus på rubriken: det första att LÄSA, inte det första att trycka på. */
        fokusPåRubriken: inuti?.activeElement === rubrik,
        val: [...(inuti?.querySelectorAll("[data-choice]") ?? [])].map((knapp) => {
          const box = knapp.getBoundingClientRect();

          return {
            namn: knapp.dataset.choice,
            etikett: (knapp.querySelector(".conflict-dialog__label")?.textContent ?? "").trim(),
            följd: (knapp.querySelector(".conflict-dialog__note")?.textContent ?? "").trim(),
            fylld: knapp.classList.contains("conflict-dialog__choice--primary"),
            höjd: Math.round(box.height),
          };
        }),
      };
    });

  const väljIRutan = async (page, val) => {
    await page.evaluate((one) => {
      document
        .querySelector("conflict-dialog")
        .shadowRoot.querySelector(`[data-choice="${one}"]`)
        .click();
    }, val);
    await page.waitForTimeout(600);
  };

  /** Sammanslagningsrutan (berättelse 131): rader, spalter, val och knappar. */
  const sammanslagningen = (page) =>
    page.evaluate(() => {
      const inuti = document.querySelector("merge-dialog")?.shadowRoot ?? null;
      const ruta = inuti?.querySelector("dialog");
      const bekräfta = inuti?.querySelector('[data-action="confirm"]');

      return {
        öppen: ruta?.open === true,
        rubrik: (inuti?.querySelector("[data-title]")?.textContent ?? "").trim(),
        räknaren: (inuti?.querySelector("[data-count]")?.textContent ?? "").trim(),
        /* `aria-disabled` och aldrig `disabled`: en avstängd knapp kan inte ta
           fokus, så skälet den bär är oläsbart för den som inte ser färgen. */
        bekräftaSpärrad: bekräfta?.getAttribute("aria-disabled") === "true",
        spalter: [...(inuti?.querySelectorAll(".merge-dialog__column-label") ?? [])].map((one) =>
          (one.textContent ?? "").trim(),
        ),
        krockar: [...(inuti?.querySelectorAll("[data-overlaps-list] [data-row]") ?? [])].map(
          (rad) => ({
            id: rad.dataset.row,
            rubrik: (rad.querySelector(".merge-dialog__row-title")?.textContent ?? "").trim(),
            knappar: [...rad.querySelectorAll("[data-pick]")].map((knapp) => ({
              sida: knapp.dataset.pick,
              etikett: (knapp.textContent ?? "").trim(),
              vald: knapp.getAttribute("aria-checked") === "true",
              höjd: Math.round(knapp.getBoundingClientRect().height),
            })),
          }),
        ),
        följer: [...(inuti?.querySelectorAll("[data-rest-list] [data-row]") ?? [])].map((rad) =>
          (rad.querySelector(".merge-dialog__row-title")?.textContent ?? "").trim(),
        ),
      };
    });

  const väljISammanslagningen = async (page, rad, sida) => {
    await page.evaluate(([one, which]) => {
      document
        .querySelector("merge-dialog")
        .shadowRoot.querySelector(`[data-row="${CSS.escape(one)}"] [data-pick="${which}"]`)
        .click();
    }, [rad, sida]);
    await page.waitForTimeout(200);
  };

  /*
   * Bekräfta, och vänta in **skrivningen** — inte en klocka.
   *
   * Här stod `waitForTimeout(1800)`, och 7/10 räckte det inte: en körning mot
   * demon hade sänt båda frysningarna men inte hunnit till skrivningen när
   * provet läste historiken, och tolv kontroller efter den gick röda på en
   * sammanslagning som bara var långsam. Körningen direkt efter var grön.
   * Varje sammanslagning slutar i en `PUT …/draft` (också den som krockar
   * igen och får `409`), så svaret på den är beskedet att sidan är klar —
   * plus en kort stund för sidan att rita om sig efter svaret.
   */
  const bekräftaSammanslagningen = async (page) => {
    const skrivningen = page
      .waitForResponse((response) => response.request().method() === "PUT" && response.url().includes("/draft"), {
        timeout: 15_000,
      })
      .catch(() => null);

    await page.evaluate(() => {
      document
        .querySelector("merge-dialog")
        .shadowRoot.querySelector('[data-action="confirm"]')
        .click();
    });
    await skrivningen;
    await page.waitForTimeout(600);
  };

  /** Historikens rader, som värden ger dem — inklusive krockfrysningarna. */
  const historiken = () =>
    nisse.evaluate(
      async ([base, id]) => {
        const body = await (await fetch(`${base}/guides/${id}`, { credentials: "include" })).json();

        return (body.versions ?? []).map((one) => ({
          reason: one.reason ?? "",
          label: one.label ?? "",
          number: one.number ?? null,
          by: one.by?.name ?? "",
          /* Vems kopia det är, som värden avgör det (berättelse 131, 20/9). */
          me: one.by?.me === true,
          current: one.current === true,
        }));
      },
      [API, guideId],
    );


  /* ── 8d2. Läsläget följer med (tillägget 19/9) ───────────────────────── */

  /*
   * Johan: *"kan min session få en signal?"* Anna står i läsläge sedan
   * övertagandet ovan. Johan skriver, och hennes fönster ska visa det inom tio
   * sekunder **utan omladdning** — det är hela skillnaden mot i går, då hennes
   * skärm stod still tills hon själv tänkte på att ladda om.
   *
   * Frågan är `GET /guides/<id>?since=<stämpel>`, och värden svarar `204` utan
   * kropp när inget hänt.
   *
   * **Båda fönstren frågar, och det är inte samma fråga en gång för mycket.**
   * Den som läser vill se vad den andre skriver. Den som tror sig hålla låset
   * vill veta att det inte längre är så — och det var precis det som fattades
   * när Johan mätte 19/9: ett stillastående fönster upptäckte aldrig ett
   * övertagande, för förnyelsen är det enda som frågar och den sker bara vid
   * aktivitet. Svaret är tomt i båda fallen så länge ingenting hänt.
   *
   * Mutationerna provet skrevs mot: (1) `since` utelämnad i frågan — då bär
   * varje runda hela guiden, mätt som svarets längd i `smoke:storage`;
   * (2) pollningen igång bara i läsläge — då ligger det andra övertagandet i
   * 8e2 kvar och förloraren sitter still i en editor hen inte får skriva i;
   * (3) pollningen som inte slutar när låset blir mitt, mätt i 8e2.
   */
  const frågorFrån = (page) => {
    const list = [];

    page.on("response", (answer) => {
      if (answer.url().includes("since=")) {
        list.push(answer.status());
      }
    });

    return list;
  };

  const johansFrågor = frågorFrån(johan);
  const annasFrågor = frågorFrån(anna);

  // En stämpel i Annas fönster: överlever den, har sidan inte laddats om.
  await anna.evaluate(() => {
    window.__kvarSedanFöre = true;
  });

  /*
   * Och var noden står på skärmen, före och efter.
   *
   * Den som tittar har panorerat och zoomat dit hen ville. En omritning som
   * flyttar vyn var tionde sekund är värre än ingen uppdatering alls — då
   * följer man inte med, man blir flyttad.
   */
  const nodensPlats = (page) =>
    page.evaluate(() => {
      const nod = document
        .getElementById("editor")
        ?.shadowRoot?.querySelector("node-editor")
        ?.shadowRoot?.querySelector("flow-node");
      const box = nod?.getBoundingClientRect();

      return box ? `${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)}` : "ingen nod";
    });

  const annasVyFöre = await nodensPlats(anna);

  await ändra(johan, "Johans ord medan Anna tittar på");
  await johan.waitForTimeout(DRAFT_INTERVAL_MS + 1500);

  /*
   * Väntaren tittar på **grafen**, inte på raden.
   *
   * Den väntade på *sparade HH:MM* i raden till 19/9 — och den meningen finns
   * inte längre (se kontrollen om tillståndet nedan). Att vänta på den text
   * som faktiskt kom in är dessutom det provet handlar om: pollningen ska ge
   * den andres arbete utan omladdning.
   */
  const annaFöljdeMed = await anna
    .waitForFunction(
      () =>
        document.getElementById("editor")?.getData?.()?.nodes?.[0]?.data?.title ===
        "Johans ord medan Anna tittar på",
      null,
      { timeout: 20_000 },
    )
    .then(() => true)
    .catch(() => false);

  const annasVy = await anna.evaluate(() => ({
    rad: (document.getElementById("status")?.textContent ?? "").trim(),
    titel: document.getElementById("editor")?.getData?.()?.nodes?.[0]?.data?.title ?? "",
    kvar: window.__kvarSedanFöre === true,
    läge: document.getElementById("editor")?.getAttribute("mode") ?? "",
  }));

  check(
    "läsläget följer med: den andres text kommer fram utan omladdning",
    annaFöljdeMed &&
      annasVy.titel === "Johans ord medan Anna tittar på" &&
      annasVy.kvar === true &&
      annasVy.läge === "readonly",
    JSON.stringify(annasVy),
  );
  check(
    "och vyn står kvar där den som tittar ställde den",
    (await nodensPlats(anna)) === annasVyFöre && annasVyFöre !== "ingen nod",
    JSON.stringify({ före: annasVyFöre, efter: await nodensPlats(anna) }),
  );
  /*
   * **Raden bär tillståndet, också efter en inkommen sparning.**
   *
   * Den sa *Johan Furuskog sparade 00:48* till 19/9, och Johan mätte skarpt
   * vad det blev: brickan sa *Låst* medan raden under sa något helt annat, och
   * bakom en öppen ruta som sa en tredje sak. Två meningar som slåss om samma
   * rad är precis det skärningen tog bort.
   *
   * En sparning ÄR aktivitet, så den syns i *aktiv nyss* — och att den gör det
   * är halva kontrollen: utan att låset läses om i pollningen hade raden sagt
   * *aktiv för fyra minuter sedan* om någon som just skrev.
   *
   * Mutationen som fäller det: låt `followed` vinna i raden igen, eller sluta
   * skriva om `lockedBy` i `followOnce`.
   */
  check(
    "raden bär tillståndet efter en inkommen sparning: Låst av … · aktiv nyss",
    annasVy.rad === "Låst av Johan Furuskog · aktiv nyss",
    annasVy.rad,
  );
  check(
    "och ingen egen mening om sparningen — en sparning är aktivitet",
    !/sparade/.test(annasVy.rad) && !/\d{1,2}[:.]\d{2}/.test(annasVy.rad),
    annasVy.rad,
  );
  check(
    "båda fönstren frågar, och den som redigerar får ett tomt svar",
    annasFrågor.length > 0 &&
      johansFrågor.length > 0 &&
      johansFrågor.every((status) => status === 204),
    JSON.stringify({ johan: johansFrågor, anna: annasFrågor }),
  );

  /*
   * Och en flik som inte syns frågar ingenting.
   *
   * `visibilityState` går inte att ställa från en Playwright-sida, så den
   * skrivs över och signalen skickas — det är sidans egen väg som mäts, inte
   * webbläsarens. Fönstret väntar sedan en hel rundas längd: en timer som
   * lever vidare i bakgrunden syns bara i trafiken, aldrig i en flagga.
   */
  const annasFrågorFöreDold = annasFrågor.length;

  await anna.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await anna.waitForTimeout(12_000);

  const tystIBakgrunden = annasFrågor.length === annasFrågorFöreDold;

  await anna.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  check(
    "en flik som inte syns frågar ingenting alls",
    tystIBakgrunden,
    JSON.stringify({ före: annasFrågorFöreDold, efter: annasFrågor.length }),
  );

  /* ── 8e. Listan säger det innan man öppnar ───────────────────────────── */

  /*
   * *Låst av Johan Furuskog* under titeln, med hänglåset före — och **bara för
   * den som inte håller låset**.
   *
   * Johan håller det sedan övertagandet ovan. Nisse ska se raden i listan;
   * Johan själv ska inte, av samma skäl som *sparad av* aldrig säger ens eget
   * namn (berättelse 127): en rad som säger sitt eget namn varje gång är en rad
   * man slutar läsa, och då står den där även den dagen den bär ett annat.
   *
   * Johans lista öppnas i en **andra flik** i samma webbläsarkontext. Att
   * skicka hans editorsida till listan hade släppt låset på vägen — `pagehide`
   * gör precis det — och då hade provet mätt en guide ingen håller.
   *
   * Mutationen som fäller det: ta bort `held.me !== true` i `guides.ts`. Då
   * står raden i allas listor, också i innehavarens egen.
   */
  const låsradIListan = (page) =>
    page.evaluate(() => {
      const rad = document.querySelector("#list .guides__lock");
      const svg = rad?.querySelector("svg");

      return {
        text: (rad?.textContent ?? "").replace(/\s+/g, " ").trim(),
        hänglås: Boolean(svg?.checkVisibility?.()),
      };
    });

  await openGuides(nisse);

  const nissesLista = await låsradIListan(nisse);

  check(
    "listan säger Låst av … under titeln, med hänglåset före",
    nissesLista.text === "Låst av Johan Furuskog" && nissesLista.hänglås === true,
    JSON.stringify(nissesLista),
  );

  const johansAndraFlik = await johan.context().newPage();

  await johansAndraFlik.goto(guidesPage, { waitUntil: "networkidle" });
  await johansAndraFlik.waitForTimeout(600);

  const johansLista = await låsradIListan(johansAndraFlik);

  check(
    "men inte i innehavarens egen lista — sitt eget namn läser man inte",
    johansLista.text === "",
    JSON.stringify(johansLista),
  );

  await johansAndraFlik.close();

  /* ── 8e2. Efter Ta över står frågan där igen ──────────────────────────── */

  /*
   * Den andra halvan av samma sak: raden i låst läge skickade Anna till
   * *Ta över*, och efter den ska vägen tillbaka in i kopian finnas.
   *
   * Anna tar över från Johan, och hennes egen kopia ligger kvar i webbläsaren
   * hela vägen — ingenting har svarat på frågan, så frågan ska ställas nu. Med
   * båda knapparna, och med priset under var och en av dem.
   *
   * Sedan lämnas världen som den var: Anna kastar kopian (som inte skriver
   * något) och går till listan, vilket släpper låset — och Johans nästa
   * sparning tar det lediga låset tillbaka utan att någon behöver trycka på
   * något. Det är förnyelsen vid aktivitet som gör det, och att den fungerar
   * åt det hållet mäts här på köpet.
   */
  await anna.evaluate(() => document.getElementById("takeover").click());
  await anna.waitForTimeout(400);
  await anna.evaluate(() =>
    document.querySelector("confirmation-dialog").shadowRoot.querySelector('[data-action="confirm"]').click(),
  );
  await anna.waitForTimeout(1500);

  const annaEfterEgetÖvertagande = await editorLäge(anna);

  /*
   * 129:s skärning, punkt 3: raden säger **var arbetet ligger**, och valen står
   * för sig själva med sitt pris under. Den var en fråga till 19/9 — och
   * frågan sa samma sak som knapparna säger, en gång till och i en annan
   * ordning. Tre lager om ett val är det Johan kallade skakigt.
   *
   * Priserna behålls med flit (Fables avsteg från UX:s B): en tyst räddning
   * utan kostnad är tyst förlust i förklädnad, och nästa kontroll mäter dem.
   */
  check(
    "efter Ta över står raden där igen, med båda valen",
    annaEfterEgetÖvertagande.räddning === "Dina ändringar finns kvar i den här webbläsaren." &&
      Number(annaEfterEgetÖvertagande.räddningSlåIhop.split("x")[1] ?? 0) >= 44 &&
      Number(annaEfterEgetÖvertagande.räddningKnappar[1].split("x")[1] ?? 0) >= 44,
    JSON.stringify({
      rad: annaEfterEgetÖvertagande.rad,
      räddning: annaEfterEgetÖvertagande.räddning,
      slåIhop: annaEfterEgetÖvertagande.räddningSlåIhop,
      knappar: annaEfterEgetÖvertagande.räddningKnappar,
    }),
  );

  /*
   * Och var knapp säger vad den kostar, under sig. Tiden i *Dina ändringar
   * från 08:49 kastas* är kopians egen — den som inte vet när något lades
   * undan vågar inte kasta det.
   *
   * Mutationen som fäller det: skriv priserna i radens text i stället för
   * under sina knappar. Då står orden kvar på sidan och kopplingen är borta.
   */
  check(
    "och under var knapp står vad valet ger — inget säger kastas",
    /behålls\.$/.test(annaEfterEgetÖvertagande.räddningSlåIhopPris) &&
      /^Dina ändringar från \d{2}[:.]\d{2} följer inte med, men finns kvar i historiken\.$/.test(
        annaEfterEgetÖvertagande.räddningPriser[1],
      ),
    JSON.stringify([
      annaEfterEgetÖvertagande.räddningSlåIhopPris,
      annaEfterEgetÖvertagande.räddningPriser[1],
    ]),
  );

  /*
   * ── Börja från: kopian sparas undan, den kastas inte (131, 20/9) ──────
   *
   * Johan: *"lite förvirrande att det står dina ändringar kastas."* Sedan 131
   * gäller att inget går förlorat, och då får ingen knapp i raden kasta något.
   * Knappen lägger kopian i historiken — samma väg och samma etikett som
   * sammanslagningens två — och börjar sedan från den andres version.
   *
   * Mätt på **innehållet** i historiken och inte på antalet rader: en rad till
   * kan komma från vad som helst, och det som ska finnas kvar är hennes text.
   */
  const raderFöreBörjaFrån = (await historiken()).filter((one) => one.reason === "conflict").length;

  await anna.evaluate(() => document.getElementById("rescue-drop").click());
  await anna.waitForTimeout(1200);

  const annaEfterKasta = await editorLäge(anna);
  const raderEfterBörjaFrån = (await historiken()).filter((one) => one.reason === "conflict");
  const annasTextIHistoriken = await nisse.evaluate(
    async ([base, id, före]) => {
      const body = await (await fetch(`${base}/guides/${id}`, { credentials: "include" })).json();
      const krock = (body.versions ?? []).filter((one) => one.reason === "conflict");
      const nyaste = krock[0];

      if (!nyaste || krock.length <= före) return "ingen ny rad";

      const öppnad = await (
        await fetch(`${base}/guides/${id}/versions/${nyaste.id}`, { credentials: "include" })
      ).json();

      return String(öppnad.graph?.nodes?.[0]?.data?.title ?? "ingen graf");
    },
    [API, guideId, raderFöreBörjaFrån],
  );

  check(
    "att börja från den andres version tar bort kopian, och frågan med den",
    annaEfterKasta.räddning === "" && (await webbläsarkopian(anna)) === null,
    JSON.stringify({ räddning: annaEfterKasta.räddning, kopia: await webbläsarkopian(anna) }),
  );
  /*
   * Och det som gör meningen under knappen sann. Mutationen som fäller det:
   * ta bort `store.saveSnapshot` ur knappen — då försvinner texten spårlöst,
   * precis som före 131, medan knappen lovar motsatsen.
   */
  check(
    "INGENTING KASTAS: kopian ligger i historiken som en krockfrysning, med min text",
    raderEfterBörjaFrån.length === raderFöreBörjaFrån + 1 &&
      raderEfterBörjaFrån[0].reason === "conflict" &&
      /*
       * Och den bär **Annas** namn: det var hennes kopia hon lade undan.
       * Mätt på namnet och inte på `me`, för historiken läses här av Nisse —
       * `me` är alltid relativt den som frågar, och det är hela poängen med
       * att värden avgör det.
       */
      raderEfterBörjaFrån[0].by === "Anna Andersson" &&
      annasTextIHistoriken === "Annas ord som aldrig hann sparas",
    JSON.stringify({
      före: raderFöreBörjaFrån,
      efter: raderEfterBörjaFrån.length,
      av: raderEfterBörjaFrån[0]?.by,
      text: annasTextIHistoriken,
    }),
  );

  /*
   * ── Den låsta slår ihop, och den som håller låset förlorar ingenting ──
   *
   * Berättelse 131, tillägget 20/9. Johan: *"varför inte bara kunna få Slå
   * ihop ändringar där och då?"* Hela kedjan mäts här, för det är den som
   * avgör om tillägget är säkert:
   *
   *  1. Anna håller låset och redigerar. Johan står i läsläge med en kopia.
   *  2. Johan slår ihop — utan att ta över. Båda kopiorna hamnar i
   *     historiken, och arbetskopian blir sammanslagningen.
   *  3. Annas nästa sparning möter krockrutan, för hennes stämpel är gammal.
   *  4. Hon slår ihop i sin tur, och hennes nya ändringar läggs ovanpå.
   *
   * Inget steg förlorar något, och det mäts på **innehåll** hos värden.
   *
   * **Johans kopia riggas i lagringen** i stället för att framkallas genom ett
   * tredje övertagande. Formen är känd (`webbläsarkopian` läser samma nyckel)
   * och det som mäts ligger efter den: raden läser kopian ur lagringen, och
   * sammanslagningen räknar mot den utgångspunkt kopian bär. Ett tredje
   * övertagande hade mätt övertagandet en gång till.
   */
  const värdensDraft = await nisse.evaluate(
    async ([base, id]) => {
      const body = await (await fetch(`${base}/guides/${id}`, { credentials: "include" })).json();

      return body.draft;
    },
    [API, guideId],
  );

  await johan.evaluate(
    ([id, draft]) => {
      const mine = JSON.parse(JSON.stringify(draft));

      mine.nodes[0].data.title = "Johans osparade medan Anna håller låset";
      localStorage.setItem(
        `flowweaver.guide-rescue:${id}`,
        JSON.stringify({ graph: mine, at: new Date().toISOString(), base: draft }),
      );
    },
    [guideId, värdensDraft],
  );

  await johan.reload({ waitUntil: "networkidle" });
  await johan.waitForTimeout(1800);

  /*
   * Och Anna, som håller låset, lägger till ett **eget steg**. Olika saker:
   * hans kopia rör frågan, hennes tillägg är en ny nod. Ett nytt steg och inte
   * en andra nod i guiden, för guiden har bara en vid det här laget.
   */
  await anna.evaluate(() => {
    const editor = document.getElementById("editor");
    const graph = editor.getData();

    graph.nodes.push({
      id: "annas-nya-steg",
      type: "result",
      position: { x: 900, y: 500 },
      data: { title: "Annas resultattext medan Johan tittar" },
    });
    editor.graph = graph;
    editor.dispatchEvent(
      new CustomEvent("graph-changed", {
        detail: { graph: editor.getData(), reason: "node-updated" },
        bubbles: true,
        composed: true,
      }),
    );
  });
  await anna.waitForTimeout(DRAFT_INTERVAL_MS + 1500);

  const johanLåstMedKopia = await editorLäge(johan);

  check(
    "den låsta får Slå ihop utan att ta över, och ingen mening om att ta över",
    johanLåstMedKopia.bricka === "Låst" &&
      /^Dina ändringar från \d{2}[:.]\d{2} finns kvar i den här webbläsaren\.$/.test(
        johanLåstMedKopia.räddning,
      ) &&
      !/Ta över/.test(johanLåstMedKopia.räddning) &&
      Number(johanLåstMedKopia.räddningSlåIhop.split("x")[1] ?? 0) >= 44,
    JSON.stringify({
      bricka: johanLåstMedKopia.bricka,
      räddning: johanLåstMedKopia.räddning,
      slåIhop: johanLåstMedKopia.räddningSlåIhop,
    }),
  );

  await johan.evaluate(() => document.getElementById("rescue-merge").click());
  await johan.waitForTimeout(1800);

  const johansRutaILåstLäge = await sammanslagningen(johan);
  const kopiorFöreLåstMerge = (await historiken()).filter((one) => one.reason === "conflict").length;

  check(
    "och rutan öppnas med Annas ändring mot hans, utan val när de rört olika saker",
    johansRutaILåstLäge.öppen && johansRutaILåstLäge.krockar.length === 0,
    JSON.stringify({
      öppen: johansRutaILåstLäge.öppen,
      krockar: johansRutaILåstLäge.krockar.length,
      räknaren: johansRutaILåstLäge.räknaren,
    }),
  );

  await bekräftaSammanslagningen(johan);

  const efterLåstMerge = await nisse.evaluate(
    async ([base, id]) => {
      const body = await (await fetch(`${base}/guides/${id}`, { credentials: "include" })).json();

      return (body.draft?.nodes ?? []).map((one) => String(one.data?.title ?? ""));
    },
    [API, guideId],
  );
  const kopiorEfterLåstMerge = (await historiken()).filter((one) => one.reason === "conflict");

  check(
    "sammanslagningen skrivs fastän någon annan håller låset — låset var aldrig skyddet",
    efterLåstMerge.includes("Johans osparade medan Anna håller låset") &&
      efterLåstMerge.includes("Annas resultattext medan Johan tittar"),
    JSON.stringify(efterLåstMerge),
  );
  check(
    "och båda kopiorna ligger i historiken före skrivningen",
    kopiorEfterLåstMerge.length === kopiorFöreLåstMerge + 2,
    JSON.stringify({ före: kopiorFöreLåstMerge, efter: kopiorEfterLåstMerge.length }),
  );

  const johanEfterLåstMerge = await editorLäge(johan);

  check(
    "och han står kvar i läsläge, med raden som säger vem som håller guiden",
    johanEfterLåstMerge.bricka === "Låst" &&
      /^Låst av Anna Andersson · aktiv /.test(johanEfterLåstMerge.rad) &&
      johanEfterLåstMerge.räddning === "",
    JSON.stringify({ bricka: johanEfterLåstMerge.bricka, rad: johanEfterLåstMerge.rad }),
  );

  /*
   * Och den som håller låset förlorar ingenting: hennes stämpel är gammal, så
   * hennes nästa sparning möter krockrutan — med *Slå ihop* överst — och
   * hennes nya ändringar läggs ovanpå det sammanslagna.
   */
  await anna.evaluate(() => {
    const editor = document.getElementById("editor");
    const graph = editor.getData();
    const eget = graph.nodes.find((one) => one.id === "annas-nya-steg");

    eget.data.title = "Annas nya text efter Johans sammanslagning";
    editor.graph = graph;
    editor.dispatchEvent(
      new CustomEvent("graph-changed", {
        detail: { graph: editor.getData(), reason: "node-updated" },
        bubbles: true,
        composed: true,
      }),
    );
  });
  await anna.waitForTimeout(DRAFT_INTERVAL_MS + 1500);

  check(
    "och den som håller låset möter krockrutan vid sin nästa sparning",
    (await krockrutan(anna)).öppen === true,
    JSON.stringify(await krockrutan(anna)).slice(0, 140),
  );

  await väljIRutan(anna, "merge");
  await anna.waitForTimeout(1500);

  const annasRutaEfterKedjan = await sammanslagningen(anna);

  for (const rad of annasRutaEfterKedjan.krockar) {
    await väljISammanslagningen(anna, rad.id, "mine");
  }

  await bekräftaSammanslagningen(anna);

  const efterAnnasAndraMerge = await nisse.evaluate(
    async ([base, id]) => {
      const body = await (await fetch(`${base}/guides/${id}`, { credentials: "include" })).json();

      return (body.draft?.nodes ?? []).map((one) => String(one.data?.title ?? ""));
    },
    [API, guideId],
  );

  check(
    "INGET FÖRLORAT I KEDJAN: hennes nya text ovanpå, och hans står kvar",
    efterAnnasAndraMerge.includes("Annas nya text efter Johans sammanslagning") &&
      efterAnnasAndraMerge.includes("Johans osparade medan Anna håller låset"),
    JSON.stringify(efterAnnasAndraMerge),
  );

  /*
   * ── Det ANDRA övertagandet, och förloraren som sitter still ───────────
   *
   * Johan mätte det skarpt 19/9: *"När man tar över uppdateras det först, men
   * om den andra tar över igen blir det ingen automatisk uppdatering."*
   *
   * Orsaken var inte att pollningen startade fel. Mätt i en webbläsare med två
   * övertaganden fram och tillbaka startade den varje gång ett fönster HAMNADE
   * i läsläge — men ett stillastående fönster hamnade aldrig där. Förnyelsen
   * är det enda som upptäcker ett övertagande, och den sker bara vid aktivitet;
   * den som inte rörde tangentbordet satt kvar i en editor hen inte längre
   * fick skriva i, och såg ingenting.
   *
   * Här rör ingen Johans fönster. Anna skriver, och hans sida ska på egen hand
   * gå i läsläge och visa hennes text. **Ingen `ändra(johan, …)` får smyga sig
   * in i det här stycket** — då mäter provet den gamla vägen igen.
   */
  const johansTitel = () =>
    johan.evaluate(
      () => document.getElementById("editor")?.getData?.()?.nodes?.[0]?.data?.title ?? "",
    );

  await ändra(anna, "Annas ord som Johan ska se utan att röra något");
  await anna.waitForTimeout(DRAFT_INTERVAL_MS + 1500);

  const johanFöljdeMed = await johan
    .waitForFunction(
      () =>
        document.getElementById("editor")?.getData?.()?.nodes?.[0]?.data?.title ===
        "Annas ord som Johan ska se utan att röra något",
      null,
      { timeout: 20_000 },
    )
    .then(() => true)
    .catch(() => false);

  const johansAndraVarv = { ...(await editorLäge(johan)), titel: await johansTitel() };

  check(
    "andra övertagandet: förloraren följer med utan att ha rört något",
    johanFöljdeMed &&
      johansAndraVarv.titel === "Annas ord som Johan ska se utan att röra något" &&
      johansAndraVarv.rad === "Låst av Anna Andersson · aktiv nyss",
    JSON.stringify({ rad: johansAndraVarv.rad, titel: johansAndraVarv.titel }),
  );
  check(
    "och hans fönster står i läsläge med en väg tillbaka, inte i en editor han inte får skriva i",
    johansAndraVarv.bricka === "Låst" && johansAndraVarv.taÖver !== "0x0",
    JSON.stringify({ bricka: johansAndraVarv.bricka, taÖver: johansAndraVarv.taÖver }),
  );

  /*
   * Och kostnaden står still: Annas fönster håller låset och frågar vidare,
   * men varje svar är tomt. Det är `204` som gör pollningen billig — en runda
   * som bär hela guiden var tionde sekund är precis det Johan bad oss undvika.
   */
  const annasFrågorFöreTystnaden = annasFrågor.length;

  await anna.waitForTimeout(12_000);

  check(
    "frågan fortsätter medan guiden är öppen, och svaret är tomt",
    annasFrågor.length > annasFrågorFöreTystnaden &&
      annasFrågor.slice(annasFrågorFöreTystnaden).every((status) => status === 204),
    JSON.stringify(annasFrågor.slice(annasFrågorFöreTystnaden)),
  );

  await openGuides(anna);
  await anna.waitForTimeout(800);

  const låsetEfterAttHonLämnat = await nisse.evaluate(
    async ([base, id]) => {
      const body = await (await fetch(`${base}/guides/${id}`, { credentials: "include" })).json();

      return body.lock ? body.lock.name : null;
    },
    [API, guideId],
  );

  check(
    "den som lämnar guiden släpper låset — guiden står ledig hos värden",
    låsetEfterAttHonLämnat === null,
    JSON.stringify({ lås: låsetEfterAttHonLämnat }),
  );

  /*
   * ── Låset som raden bygger på är det FÄRSKA, inte det senast lästa ─────
   *
   * Raden säger *Låst av Anna Andersson · aktiv nyss*, och båda halvorna
   * kommer ur låset. Pollningen måste därför läsa om det: annars står namnet
   * och tiden kvar från den runda då fönstret senast hämtade guiden, och
   * raden säger *aktiv för sju minuter sedan* om någon som just skrev.
   *
   * **Tiden går inte att mäta i ett prov som tar sekunder** — *nyss* är sant
   * både med och utan uppdatering, vilket mättes: mutationen som tar bort
   * omläsningen fällde ingenting alls. Det som däremot biter i samma kodrad
   * är NAMNET. Anna har just släppt låset; Nisse tar det och skriver, och
   * Johans fönster — som inte rörts — ska byta namn i raden vid nästa runda.
   *
   * Mutationen som fäller det: sluta skriva om `lockedBy` i `followOnce`. Då
   * står Annas namn kvar i Johans rad om en guide Nisse sitter i.
   */
  const nissesLås = await nisse.evaluate(
    async ([base, id]) => {
      const answer = await fetch(`${base}/guides/${id}/lock`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ window: "nisses-fonster" }),
      });

      return answer.status;
    },
    [API, guideId],
  );

  /* Skrivningen inline: `nisseSkriver` deklareras längre ned i filen. */
  await nisse.evaluate(
    async ([base, id]) => {
      const läst = await (await fetch(`${base}/guides/${id}`, { credentials: "include" })).json();
      const graph = läst.draft;

      graph.nodes[0].data.title = "Nisses ord medan Johan tittar";

      await fetch(`${base}/guides/${id}/draft`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ graph, draftSavedAt: läst.draftSavedAt ?? "" }),
      });
    },
    [API, guideId],
  );

  const johansRadByttNamn = await johan
    .waitForFunction(
      () => /^Låst av Nisse Hult · aktiv /.test(
        (document.getElementById("status")?.textContent ?? "").trim(),
      ),
      null,
      { timeout: 20_000 },
    )
    .then(() => true)
    .catch(() => false);

  const johansRadEfterBytet = await editorLäge(johan);

  check(
    "raden bygger på det färska låset: nytt namn hos den som bara tittar",
    nissesLås === 200 &&
      johansRadByttNamn &&
      johansRadEfterBytet.rad === "Låst av Nisse Hult · aktiv nyss",
    JSON.stringify({ lås: nissesLås, rad: johansRadEfterBytet.rad }),
  );

  /* Och Nisse lämnar guiden igen, så nästa steg möter den som det var. */
  await nisse.evaluate(
    async ([base, id]) => {
      await fetch(`${base}/guides/${id}/lock?window=nisses-fonster`, {
        method: "DELETE",
        credentials: "include",
      });
    },
    [API, guideId],
  );
  await johan.waitForTimeout(600);

  /*
   * Och Johan tar tillbaka guiden. Hans fönster står i läsläge sedan hennes
   * övertagande, så vägen in är knappen — inte en sparning som smyger förbi.
   */
  await johan.evaluate(() => document.getElementById("takeover").click());
  await johan.waitForTimeout(400);
  await johan.evaluate(() =>
    document.querySelector("confirmation-dialog").shadowRoot.querySelector('[data-action="confirm"]').click(),
  );
  await johan.waitForTimeout(1500);
  await ändra(johan, "Johans ord när låset kommit tillbaka");
  await johan.waitForTimeout(DRAFT_INTERVAL_MS + 1500);

  const johanEfterAttAnnaLämnat = await editorLäge(johan);

  check(
    "och den som tagit tillbaka guiden får skriva i den igen",
    !/Låst av|tog över/.test(johanEfterAttAnnaLämnat.rad) &&
      (await hosVärden()) === "Johans ord när låset kommit tillbaka",
    JSON.stringify({ rad: johanEfterAttAnnaLämnat.rad, hos: await hosVärden() }),
  );

  /* ── 8f. Krockrutan: tre val, och kopian ligger före rutan ────────────── */

  /*
   * Kriterium 4, och den enda ytan i berättelsen som är ny kod i biblioteket.
   *
   * Johan håller låset och arbetar. Nisse skriver till guiden vid sidan av —
   * skrivvägarna kräver inte låset, för `409` på stämpeln är skyddet — och
   * Johans nästa sparning avvisas. Då kommer rutan, och inte 127:s rad.
   *
   * Mutationerna provet skrevs mot: (1) lägg kopian i webbläsaren EFTER valet
   * i stället för före — då är den borta för den som stänger fönstret medan
   * rutan står öppen, och kontrollen mitt i rutan faller; (2) skriv *Behåll
   * mina* utan att först hämta värdens stämpel — då avvisas den om och om igen
   * och Johans text når aldrig fram.
   */
  const nisseSkriver = async (titel, nod = 0) =>
    nisse.evaluate(
      async ([base, id, text, index]) => {
        const läst = await (await fetch(`${base}/guides/${id}`, { credentials: "include" })).json();
        const graph = läst.draft;

        graph.nodes[index].data.title = text;

        const answer = await fetch(`${base}/guides/${id}/draft`, {
          method: "PUT",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ graph, draftSavedAt: läst.draftSavedAt ?? "" }),
        });

        return { status: answer.status, ...(await answer.json()) };
      },
      [API, guideId, titel, nod],
    );

  /*
   * Varje `PUT …/draft` som går från Johans sida, med villkoret i kroppen.
   * Mätt på tråden, för det är där skillnaden mellan *med* och *utan villkor*
   * finns — sidan ser likadan ut i båda fallen ända tills någons text är borta.
   */
  const johansSkrivningar = [];
  /*
   * Ordningen mellan frysningen och skrivningen (131, *"Kan vi helt undvika
   * bortfall?"*) — mätt på TRÅDEN och inte på slutresultatet. Ett test som
   * bara läser historiken efteråt ser samma sak vare sig frysningen körs
   * före eller efter skrivningen, för i den lyckade vägen finns båda till
   * slut. Mutationen som fäller det: byt ordning i `guide-storage.ts` så att
   * `saveDraft` går före `saveSnapshot` — säkerheten (frysningen stoppar
   * skrivningen om den misslyckas) tystnar utan att en enda check rör sig,
   * och det är precis den luckan den här listan täpper.
   */
  const johansVägordning = [];

  johan.on("request", (request) => {
    if (request.method() === "PUT" && request.url().includes("/draft")) {
      johansVägordning.push("draft");

      try {
        johansSkrivningar.push(JSON.parse(request.postData() ?? "{}"));
      } catch {
        johansSkrivningar.push({});
      }
    }

    if (request.method() === "POST" && request.url().includes("/snapshots")) {
      johansVägordning.push("snapshot");
    }
  });

  const nissesTredje = await nisseSkriver("Nisses tredje fråga");

  check(
    "Nisse skriver till guiden utan att hålla låset — skrivvägarna kräver det inte",
    nissesTredje.status === 200,
    JSON.stringify(nissesTredje).slice(0, 100),
  );

  await ändra(johan, "Johans ändring under krocken");
  await johan.waitForTimeout(DRAFT_INTERVAL_MS + 1500);

  const rutan = await krockrutan(johan);
  const kopianMedanRutanStårÖppen = await webbläsarkopian(johan);

  await bild(johan, "krockruta", [900, 390]);

  check(
    "en avvisad sparning ger en ruta, inte en rad — och rubriken säger vem och när",
    rutan.öppen && /^Nisse Hult sparade \d{2}[:.]\d{2} medan du arbetade\.$/.test(rutan.rubrik),
    JSON.stringify({ öppen: rutan.öppen, rubrik: rutan.rubrik }),
  );
  /*
   * Meningen får inte säga att ingenting slås ihop: förstahandsvalet heter
   * *Slå ihop ändringar*. Två påståenden som inte kan vara sanna samtidigt är
   * värre än ett som säger mindre — sett i bild 19/9, när 131 bytte valet men
   * inte meningen ovanför.
   */
  check(
    "rutan säger att ingenting är sparat än, och inte att ingenting slås ihop",
    /Ingenting är sparat än/.test(rutan.text) && !/[Ii]ngen sammanslagning/.test(rutan.text),
    rutan.text,
  );
  check(
    "fokus ligger på rubriken — det första att läsa, inte det första att trycka på",
    rutan.fokusPåRubriken === true,
    String(rutan.fokusPåRubriken),
  );
  /*
   * Krockrutan efter 131 (Johan 19/9: *"om vi gör diffen, vad rekommenderar du
   * då?"*): **Slå ihop ändringar** är enda förstahandsvalet, och *Behåll mina
   * ändringar* är borta — det var samma sak som *Min* på varje rad i
   * sammanslagningen, fast utan att se vad man skriver över.
   *
   * Mutationen som fäller det: lägg tillbaka `keep` bland valen.
   */
  check(
    "tre val, och bara Slå ihop är fyllt — det finns en knapp att trycka utan att förstå resten",
    rutan.val.length === 3 &&
      rutan.val.map((one) => one.namn).join(",") === "merge,reload,cancel" &&
      rutan.val[0].fylld === true &&
      rutan.val.filter((one) => one.fylld).length === 1,
    JSON.stringify(rutan.val.map((one) => [one.namn, one.fylld, one.höjd])),
  );
  check(
    "och Behåll mina ändringar finns inte längre",
    rutan.val.every((one) => one.namn !== "keep") &&
      !/Behåll mina/.test(rutan.val.map((one) => one.etikett).join(" ")),
    JSON.stringify(rutan.val.map((one) => one.etikett)),
  );
  check(
    "förstahandsvalet är Slå ihop, och säger att ingenting går förlorat",
    rutan.val[0].etikett === "Slå ihop ändringar" &&
      /Båda kopiorna sparas i historiken/.test(rutan.val[0].följd),
    JSON.stringify([rutan.val[0].etikett, rutan.val[0].följd]),
  );
  check(
    "och Ladda om står kvar som tyst val, och namnger den som hann före i genitiv",
    rutan.val[1].etikett === "Ladda om och se Nisse Hults ändringar" &&
      rutan.val[1].fylld === false,
    JSON.stringify([rutan.val[1].etikett, rutan.val[1].fylld]),
  );
  check(
    "varje val säger sin följd, och varje yta går att träffa",
    rutan.val.every((one) => one.följd !== "" && one.höjd >= 44),
    JSON.stringify(rutan.val.map((one) => [one.namn, one.höjd, one.följd.slice(0, 40)])),
  );
  check(
    "KOPIAN LIGGER I WEBBLÄSAREN INNAN RUTAN VISAS — inte efter valet",
    kopianMedanRutanStårÖppen?.titel === "Johans ändring under krocken",
    JSON.stringify(kopianMedanRutanStårÖppen),
  );
  check(
    "och ingenting är skrivet hos värden medan rutan står öppen",
    (await hosVärden()) === "Nisses tredje fråga",
    await hosVärden(),
  );

  /* Avbryt: inget händer, och raden säger att sidan inte sparar. */
  await väljIRutan(johan, "cancel");

  const efterAvbrytIRutan = await editorLäge(johan);

  check(
    "Avbryt lämnar autosparen av, och raden säger det med en väg tillbaka",
    efterAvbrytIRutan.rad === "Sparar inte — välj i rutan" && efterAvbrytIRutan.välj !== "0x0",
    JSON.stringify({ rad: efterAvbrytIRutan.rad, välj: efterAvbrytIRutan.välj }),
  );

  await johan.evaluate(() => document.getElementById("choose").click());
  await johan.waitForTimeout(500);

  check(
    "och Välj öppnar samma ruta igen",
    (await krockrutan(johan)).öppen === true,
    JSON.stringify(await krockrutan(johan)).slice(0, 120),
  );

  /*
   * ── Slå ihop ändringar (berättelse 131, kriterium 5 och 6) ────────────
   *
   * Johan och Nisse har rört **samma** nod — Johan skrev *Johans ändring under
   * krocken* i frågan, Nisse *Nisses tredje fråga* i samma — så det här är det
   * sällsynta fallet: ett val. Det vanliga fallet, olika noder, mäts längre ned
   * med Anna som tredje person.
   *
   * Vad som mäts, och alla tre är berättelsens egna mutationer:
   *
   *  1. rutan vägrar bekräftas medan ett val saknas, och **säger hur många**;
   *  2. **båda kopiorna fryses** i historiken innan något skrivs — utan det
   *     finns den förlorande texten ingenstans efteråt;
   *  3. skrivningen bär värdens **aktuella stämpel** — utan villkoret hade en
   *     tredje persons text försvunnit tyst.
   */
  const stämpelnHosVärden = await nisse.evaluate(
    async ([base, id]) =>
      String((await (await fetch(`${base}/guides/${id}`, { credentials: "include" })).json()).draftSavedAt ?? ""),
    [API, guideId],
  );
  const historikenFöre = await historiken();

  johansSkrivningar.length = 0;
  johansVägordning.length = 0;
  await väljIRutan(johan, "merge");
  await johan.waitForTimeout(1200);

  const rutanMedEttVal = await sammanslagningen(johan);

  await bild(johan, "sammanslagning-ett-val", [900, 390]);

  check(
    "Slå ihop öppnar granskningens ruta, med två spalter som säger vems är vems",
    rutanMedEttVal.öppen &&
      rutanMedEttVal.rubrik === "Slå ihop ändringar" &&
      rutanMedEttVal.spalter.includes("Nisse Hult ändrade") &&
      rutanMedEttVal.spalter.includes("Du ändrade"),
    JSON.stringify({ rubrik: rutanMedEttVal.rubrik, spalter: rutanMedEttVal.spalter }),
  );
  check(
    "samma nod ändrad av båda är en markerad rad, med två val och ingen förvald",
    rutanMedEttVal.krockar.length === 1 &&
      rutanMedEttVal.krockar[0].knappar.map((one) => one.etikett).join(",") ===
        "Nisse Hults,Min" &&
      rutanMedEttVal.krockar[0].knappar.every((one) => one.vald === false) &&
      rutanMedEttVal.krockar[0].knappar.every((one) => one.höjd >= 44),
    JSON.stringify(rutanMedEttVal.krockar),
  );
  check(
    "och Bekräfta vägrar medan valet saknas, och raden säger hur många som är kvar",
    rutanMedEttVal.bekräftaSpärrad === true && rutanMedEttVal.räknaren === "1 val kvar att göra.",
    JSON.stringify({
      spärrad: rutanMedEttVal.bekräftaSpärrad,
      räknaren: rutanMedEttVal.räknaren,
    }),
  );

  await väljISammanslagningen(johan, rutanMedEttVal.krockar[0].id, "mine");

  const rutanEfterValet = await sammanslagningen(johan);

  check(
    "efter valet är raden klar och Bekräfta går att trycka på",
    rutanEfterValet.räknaren === "Allt är valt." && rutanEfterValet.bekräftaSpärrad === false,
    JSON.stringify({
      räknaren: rutanEfterValet.räknaren,
      spärrad: rutanEfterValet.bekräftaSpärrad,
    }),
  );

  await bekräftaSammanslagningen(johan);

  const historikenEfter = await historiken();
  const frysta = historikenEfter.filter((one) => one.reason === "conflict");

  check(
    "INGET GÅR FÖRLORAT: båda kopiorna ligger i historiken före skrivningen",
    frysta.length === historikenFöre.filter((one) => one.reason === "conflict").length + 2 &&
      frysta.every((one) => one.label === "" && one.number === null),
    JSON.stringify(frysta),
  );
  /*
   * **Och de säger vems kopia de är** (Johan 20/9).
   *
   * Den som trycker på knappen skriver båda raderna, och med `by` ur
   * sessionen fick den andres arbete fel namn: Johan såg sitt eget arbete stå
   * som Annas i historiken. Nu slår värden upp namnet ur `side` — `mine` är
   * sessionen, `theirs` är `draftSavedBy`.
   *
   * Mätt som **två olika** och inte mot ett namn: det som gick sönder var att
   * de var lika, och en kontroll som letar efter ett visst namn hade varit
   * grön även när båda bar det.
   *
   * Mutationen som fäller det: sätt `by` ur sessionen på båda igen.
   */
  const tvåNyaste = frysta.slice(0, 2);

  check(
    "och de säger vems kopia de är — inte vem som råkade slå ihop",
    tvåNyaste.length === 2 &&
      tvåNyaste.every((one) => one.by !== "") &&
      tvåNyaste[0].by !== tvåNyaste[1].by,
    JSON.stringify(tvåNyaste.map((one) => [one.by, one.me])),
  );
  check(
    "och de är opublicerade — current är orörd",
    frysta.every((one) => one.current === false) &&
      historikenEfter.find((one) => one.current)?.reason === "",
    JSON.stringify(historikenEfter.map((one) => [one.reason || "-", one.current])),
  );
  check(
    "och på TRÅDEN: båda frysningarna går ut före skrivningen, inte bara i historiken efteråt",
    johansVägordning.filter((one) => one === "snapshot").length === 2 &&
      johansVägordning.indexOf("draft") === 2 &&
      johansVägordning[0] === "snapshot" &&
      johansVägordning[1] === "snapshot",
    JSON.stringify(johansVägordning),
  );
  check(
    "sammanslagningen skriver med värdens aktuella stämpel — aldrig utan villkor",
    johansSkrivningar.length > 0 &&
      johansSkrivningar.every((one) => typeof one.draftSavedAt === "string") &&
      johansSkrivningar.some((one) => one.draftSavedAt === stämpelnHosVärden),
    JSON.stringify(johansSkrivningar.map((one) => one.draftSavedAt)).slice(0, 160),
  );
  check(
    "och det valda värdet är det som gäller hos värden efteråt",
    (await hosVärden()) === "Johans ändring under krocken",
    await hosVärden(),
  );

  const efterSammanslagning = await editorLäge(johan);

  check(
    "rutan är besvarad: raden sparar igen, och frågan om det osparade är borta",
    efterSammanslagning.rad !== "Sparar inte — välj i rutan" &&
      efterSammanslagning.räddning === "",
    JSON.stringify({ rad: efterSammanslagning.rad, räddning: efterSammanslagning.räddning }),
  );

  /*
   * ── Och det VANLIGA fallet: olika noder, noll val ─────────────────────
   *
   * Kriterium 5 med tre personer. Nisse skriver i resultatnoden, Johan i
   * frågan — de har rört olika saker, och då finns ingenting att välja.
   * Båda ändringarna ska finnas hos värden efteråt, mätt på innehåll.
   */
  await nisseSkriver("Nisses text som inte krockar");
  await johan.evaluate(() => {
    const editor = document.getElementById("editor");
    const graph = editor.getData();

    graph.nodes.push({
      id: "johans-nya-steg",
      type: "result",
      position: { x: 900, y: 300 },
      data: { title: "Johans nya steg" },
    });
    editor.graph = graph;
    editor.dispatchEvent(
      new CustomEvent("graph-changed", {
        detail: { graph: editor.getData(), reason: "node-updated" },
        bubbles: true,
        composed: true,
      }),
    );
  });
  await johan.waitForTimeout(DRAFT_INTERVAL_MS + 1500);

  check(
    "en krock mot en annan nod ger rutan som vanligt",
    (await krockrutan(johan)).öppen === true,
    JSON.stringify(await krockrutan(johan)).slice(0, 120),
  );

  await väljIRutan(johan, "merge");
  await johan.waitForTimeout(1200);

  const utanVal = await sammanslagningen(johan);

  await bild(johan, "sammanslagning-noll-val", [900, 390]);

  check(
    "olika noder: ingenting att välja, och rutan säger det",
    utanVal.öppen &&
      utanVal.krockar.length === 0 &&
      utanVal.räknaren === "Ni har ändrat olika saker. Allt följer med — inget att välja." &&
      utanVal.bekräftaSpärrad === false,
    JSON.stringify({ krockar: utanVal.krockar.length, räknaren: utanVal.räknaren }),
  );
  check(
    "och båda ändringarna står i listan över det som följer med",
    utanVal.följer.length === 2,
    JSON.stringify(utanVal.följer),
  );

  await bekräftaSammanslagningen(johan);

  const efterVanligaFallet = await nisse.evaluate(
    async ([base, id]) => {
      const body = await (await fetch(`${base}/guides/${id}`, { credentials: "include" })).json();

      return (body.draft?.nodes ?? []).map((one) => [one.id, String(one.data?.title ?? "")]);
    },
    [API, guideId],
  );

  check(
    "BÅDAS ARBETE FINNS KVAR: Nisses text och Johans nya steg, i samma guide",
    efterVanligaFallet.some(([, titel]) => titel === "Nisses text som inte krockar") &&
      efterVanligaFallet.some(([nodId]) => nodId === "johans-nya-steg"),
    JSON.stringify(efterVanligaFallet),
  );

  /* Och vägen Ladda om, som är den rutan pekar ut först. */
  await nisseSkriver("Nisses fjärde fråga");
  await ändra(johan, "Johans andra ändring under krocken");
  await johan.waitForTimeout(DRAFT_INTERVAL_MS + 1500);

  check(
    "en andra krock ger rutan igen i stället för en tyst överskrivning",
    (await krockrutan(johan)).öppen === true,
    JSON.stringify(await krockrutan(johan)).slice(0, 120),
  );

  await väljIRutan(johan, "reload");
  await johan.waitForLoadState("networkidle");
  await johan.waitForTimeout(1800);

  const efterOmladdning = await editorLäge(johan);

  check(
    "Ladda om förlorar ingenting: raden om det osparade möter en på andra sidan",
    efterOmladdning.räddning === "Dina ändringar finns kvar i den här webbläsaren.",
    efterOmladdning.räddning || "ingen rad",
  );
  await bild(johan, "raddningsrad");

  /*
   * ── Räddningsradens förstahandsval efter 131 ──────────────────────────
   *
   * *Slå ihop* i stället för *Fortsätt där jag var*, och aldrig bredvid det:
   * *Fortsätt* är samma sak som *Min* på varje rad i sammanslagningen, fast
   * utan att se vad man skriver över.
   *
   * Det **kräver att utgångspunkten finns**, och det var mätningen: efter en
   * omladdning är den i minnet värdens nuvarande graf, alltså värdelös som
   * startpunkt. Därför bär webbläsarkopian sin egen (`guide-rescue.ts`).
   *
   * Mutationen som fäller det: sluta skriva `base` i kopian — då står det
   * gamla valet där i stället, och kontrollen faller på knapparnas namn.
   */
  check(
    "raden erbjuder Slå ihop, med en yta som går att träffa",
    efterOmladdning.räddningSlåIhop !== "0x0" &&
      Number(efterOmladdning.räddningSlåIhop.split("x")[1] ?? 0) >= 44 &&
      efterOmladdning.räddningSlåIhopText === "Slå ihop ändringar",
    JSON.stringify({
      ruta: efterOmladdning.räddningSlåIhop,
      text: efterOmladdning.räddningSlåIhopText,
    }),
  );
  check(
    "och Fortsätt där jag var står INTE bredvid det — ett val som gör mindre",
    efterOmladdning.räddningKnappar[0] === "0x0",
    JSON.stringify({
      fortsätt: efterOmladdning.räddningKnappar[0],
      slåIhop: efterOmladdning.räddningSlåIhop,
    }),
  );
  /*
   * Och namnet står kvar där det gör nytta: i knapparna och i priserna. Raden
   * slutade fråga, men valen ska fortfarande säga **vems** arbete det gäller.
   *
   * Mutationen som fäller det: `WORDS.rescueDrop` utan namnet.
   */
  check(
    "valen säger vems arbete det gäller, och vad de kostar",
    /Både Nisse Hults och dina ändringar behålls\./.test(
      efterOmladdning.räddningSlåIhopPris,
    ) &&
      /^Börja från Nisse Hults version$/.test(efterOmladdning.räddningKnappTexter[1]) &&
      /^Dina ändringar från \d{2}[:.]\d{2} följer inte med, men finns kvar i historiken\.$/.test(
        efterOmladdning.räddningPriser[1],
      ),
    JSON.stringify({
      slåIhop: efterOmladdning.räddningSlåIhopPris,
      knappar: efterOmladdning.räddningKnappTexter,
      priser: efterOmladdning.räddningPriser,
    }),
  );

  /* Och vägen hela varvet: Slå ihop ur räddningsraden räddar bådas arbete. */
  await johan.evaluate(() => document.getElementById("rescue-merge").click());
  await johan.waitForTimeout(1500);

  const rutanUrRäddningsraden = await sammanslagningen(johan);

  check(
    "Slå ihop ur räddningsraden öppnar samma ruta, räknad mot kopians utgångspunkt",
    rutanUrRäddningsraden.öppen === true,
    JSON.stringify({
      öppen: rutanUrRäddningsraden.öppen,
      krockar: rutanUrRäddningsraden.krockar.length,
      räknaren: rutanUrRäddningsraden.räknaren,
    }),
  );

  for (const rad of rutanUrRäddningsraden.krockar) {
    await väljISammanslagningen(johan, rad.id, "mine");
  }

  await bekräftaSammanslagningen(johan);
  await johan.waitForTimeout(1500);

  const efterHämta = await editorLäge(johan);

  check(
    "Slå ihop ur räddningsraden lägger tillbaka det som inte hann sparas",
    (await hosVärden()) === "Johans andra ändring under krocken",
    await hosVärden(),
  );
  check(
    "och frågan står inte kvar och frågar igen",
    efterHämta.räddning === "" && (await webbläsarkopian(johan)) === null,
    JSON.stringify({ rad: efterHämta.räddning, kopia: await webbläsarkopian(johan) }),
  );

  /* ── 8g. Ett lås som ingen rör släpper själv ──────────────────────────── */

  /*
   * Kriterium 2, och det som gör att ett stängt laptoplock inte stoppar en
   * publicering. Johans fönster står öppet och orört; låset förnyas **bara**
   * av aktivitet, så det ska löpa ut av sig självt.
   *
   * Provet väntar in värdens klocka på riktigt — ingen stubbe, ingen
   * framflyttad tid. Mottagaren kör med `LOCK_MINUTES` i sekunder, samma
   * variabel som i drift (`locks.mjs`).
   *
   * Mutationen som fäller det: förnya på en timer i stället för vid aktivitet.
   * Då lever låset för evigt i ett fönster ingen sitter vid, och Nisse nedan
   * får läsläge.
   */
  await johan.waitForTimeout(LOCK_MS + 2000);

  await öppnaGuiden(nisse);

  const nisseEfterUtgång = await editorLäge(nisse);

  check(
    "ett orört fönster tappar låset, och nästa får redigera utan att ta över",
    !/Låst av/.test(nisseEfterUtgång.rad) && nisseEfterUtgång.märke === "",
    JSON.stringify(nisseEfterUtgång).slice(0, 200),
  );

  /*
   * Och guiden lämnas ledig till resten av körningen.
   *
   * Sedan låset finns kan två fönster inte längre stå öppna i redigeringsläge
   * samtidigt, och kontrollerna längre ned öppnar guiden som fyra olika
   * personer i tur och ordning. Var och en måste möta en ledig guide — annars
   * mäter de läsläge och går gröna av fel skäl.
   */
  const lämnaGuiden = (page) => openGuides(page);

  await lämnaGuiden(nisse);

  /* ── 8h. Utloggad når fortfarande ingenting ───────────────────────────── */

  /*
   * Listan är allas, och det är fortfarande *allas hos värden*. Den som inte
   * loggat in är ingen, och för den är svaret 401: det som saknas ÄR
   * autentiseringen, och `403` hade sagt att identiteten dög men rollen inte —
   * vilket vore fel i sak och skulle få klienten att sluta erbjuda inloggning.
   */
  const utomstående = await person();

  // Sidan först: en tom flik har inget ursprung, och då är svaret inte värdens
  // utan webbläsarens (mätt: *Failed to fetch* innan raden fanns).
  await openGuides(utomstående);

  const utanSession = await utomstående.evaluate(
    async ([base, id]) => {
      const svar = await fetch(`${base}/guides/${id}`, { credentials: "include" });
      const lista = await fetch(`${base}/guides`, { credentials: "include" });

      return {
        guide: svar.status,
        lista: lista.status,
        text: (await svar.text()).slice(0, 120),
      };
    },
    [API, guideId],
  );

  check(
    "utan inloggning är både guiden och listan 401, aldrig 403",
    utanSession.guide === 401 && utanSession.lista === 401,
    JSON.stringify(utanSession),
  );
  check(
    "och svaret säger ingenting om vad som var fel",
    !/owner|ägare|editors|session/i.test(utanSession.text),
    utanSession.text,
  );

  /* ── 8i. Avsikten: anteckningen och vilkas ändringar (berättelse 130) ── */

  /*
   * Johan: *"Om inte Anna hade tänkt klart och inte vill att det skulle
   * publiceras?"* Versionerna skyddar innehållet, krocken skyddar arbetet. Det
   * här är avsikten — en mening från en människa till nästa, och en rad som
   * säger vilkas ändringar man står i begrepp att publicera.
   *
   * Fyra ytor ritar samma anteckning, och alla fyra mäts: raden i editorn,
   * listan, granskningsrutan och Ta över-dialogen. En anteckning som syns på
   * tre av fyra är en anteckning man missar precis där den behövdes.
   */
  const skrivAnteckning = async (page, text) => {
    await page.evaluate(() => document.getElementById("more").click());
    await page.waitForTimeout(200);
    await page.evaluate(() => document.getElementById("note").click());
    await page.waitForTimeout(300);
    await page.evaluate((ord) => {
      const inuti = document.querySelector("prompt-dialog").shadowRoot;

      inuti.querySelector("[data-input]").value = ord;
      inuti.querySelector('[data-action="confirm"]').click();
    }, text);
    await page.waitForTimeout(600);
  };

  const anteckningsraden = (page) =>
    page.evaluate(() => {
      const rad = document.getElementById("note-line");
      const meny = document.getElementById("note");

      return {
        text: rad?.hidden === false ? (rad.textContent ?? "").trim() : "",
        menyval: meny?.hidden === false ? (meny.textContent ?? "").trim() : "",
      };
    });

  await öppnaGuiden(johan);
  await ändra(johan, "Guiden som inte är klar");
  await johan.waitForTimeout(DRAFT_INTERVAL_MS + 1200);
  await skrivAnteckning(johan, "Inte klar — juristen ska läsa resultattexterna");

  const johansAnteckning = await anteckningsraden(johan);

  check(
    "den som arbetar i guiden skriver en anteckning, och raden säger vem, när och vad",
    /^Johan Furuskog \d{2}[:.]\d{2}: ”Inte klar — juristen ska läsa resultattexterna”$/.test(
      johansAnteckning.text,
    ),
    JSON.stringify(johansAnteckning),
  );
  check(
    "och dörren säger vad som finns bakom den nu när det finns en",
    johansAnteckning.menyval === "Ändra anteckningen till kollegor",
    johansAnteckning.menyval,
  );

  /*
   * Orden är någons egna och ritas som text, aldrig som markup (K11). Raden
   * skrivs med `textContent` i koden, men en anteckning utan `<`-tecken
   * hade gått lika grön genom `innerHTML` — checken ovan mäter bara ordet,
   * inte hur det hamnade i DOM:en. Provet skriver om anteckningen med en
   * tagg i, och kräver att den syns som tecken, inte som ett element.
   *
   * Mutationen som fäller det: `noteLine.textContent` bytt mot
   * `noteLine.innerHTML` i `guide-storage.ts` (sett falla 19/9 — QA).
   */
  await skrivAnteckning(johan, "<b>Fetstil</b> ska synas som tecken");

  const anteckningMedMarkup = await johan.evaluate(() => {
    const rad = document.getElementById("note-line");

    return { text: (rad?.textContent ?? "").trim(), barn: rad?.children.length ?? -1 };
  });

  check(
    "och en tagg i anteckningen blir tecken på raden, aldrig ett element",
    anteckningMedMarkup.barn === 0 && anteckningMedMarkup.text.includes("<b>Fetstil</b>"),
    JSON.stringify(anteckningMedMarkup),
  );

  /* Tillbaka till den anteckning resten av provet väntar sig. */
  await skrivAnteckning(johan, "Inte klar — juristen ska läsa resultattexterna");

  /* Den syns för den som öppnar guiden, och i listan innan man öppnat den. */
  await öppnaGuiden(nisse);

  const nissesAnteckning = await anteckningsraden(nisse);

  check(
    "och alla som öppnar guiden ser den — det är hela poängen med den",
    /^Johan Furuskog \d{2}[:.]\d{2}: ”Inte klar/.test(nissesAnteckning.text),
    JSON.stringify(nissesAnteckning),
  );
  check(
    "men en redaktör som varken skrev den eller håller guiden får inte ändra den",
    nissesAnteckning.menyval === "",
    JSON.stringify(nissesAnteckning),
  );

  await openGuides(nisse);

  const listansAnteckning = await nisse.evaluate(() => {
    const rad = document.querySelector("#list .guides__note");

    return (rad?.textContent ?? "").replace(/\s+/g, " ").trim();
  });

  check(
    "listan bär den under titeln, så ingen öppnar guiden för att publicera i onödan",
    listansAnteckning === "Johan Furuskog: ”Inte klar — juristen ska läsa resultattexterna”",
    listansAnteckning || "ingen rad",
  );

  /* Granskningen: vilkas ändringar det är, och anteckningen som en varning. */
  await johan.evaluate(() => document.getElementById("publish").click());
  await johan.waitForTimeout(700);

  const granskningen = await johan.evaluate(() => {
    const inuti = document.querySelector("publish-dialog")?.shadowRoot ?? null;
    const ruta = inuti?.querySelector("[data-draft-note]");

    return {
      öppen: inuti?.querySelector("dialog")?.open === true,
      vilka: (inuti?.querySelector("[data-contributors]")?.textContent ?? "").trim(),
      anteckning: ruta?.hidden === false,
      rubrik: (inuti?.querySelector("[data-draft-note-title]")?.textContent ?? "").trim(),
      orden: (inuti?.querySelector("[data-draft-note-text]")?.textContent ?? "").trim(),
      frågan: (inuti?.querySelector("[data-draft-note-ask]")?.textContent ?? "").trim(),
      knapp: (inuti?.querySelector('[data-action="confirm"]')?.textContent ?? "").trim(),
    };
  });

  check(
    "granskningen säger vilkas ändringar den innehåller",
    granskningen.öppen && /^Sedan version \d+ har .* ändrat guiden\.$/.test(granskningen.vilka),
    JSON.stringify({ öppen: granskningen.öppen, vilka: granskningen.vilka }),
  );
  check(
    "och anteckningen står där som en varning som inte stoppar något",
    granskningen.anteckning &&
      /^Johan Furuskog skrev \d{2}[:.]\d{2}$/.test(granskningen.rubrik) &&
      granskningen.orden === "Inte klar — juristen ska läsa resultattexterna" &&
      granskningen.frågan === "Publicera ändå?" &&
      granskningen.knapp === "Publicera",
    JSON.stringify(granskningen),
  );

  await johan.evaluate(() =>
    document.querySelector("publish-dialog").shadowRoot.querySelector('[data-action="cancel"]').click(),
  );
  await johan.waitForTimeout(400);

  /*
   * Och där någon tar över: *"om någon skriver så lär man inte bara ta över"*
   * (Johan 19/9). Citatet står ovanför fakta, för det färgar allt under sig.
   */
  await öppnaGuiden(anna);
  await anna.evaluate(() => document.getElementById("takeover").click());
  await anna.waitForTimeout(500);

  const övertagandetMedAnteckning = await anna.evaluate(() => {
    const inuti = document.querySelector("confirmation-dialog")?.shadowRoot ?? null;
    const citat = inuti?.querySelector("[data-quote]");
    const fakta = inuti?.querySelector("[data-facts]");

    return {
      rubrik: (inuti?.querySelector("[data-title]")?.textContent ?? "").trim(),
      citat: citat?.hidden === false,
      vem: (inuti?.querySelector("[data-quote-title]")?.textContent ?? "").trim(),
      orden: (inuti?.querySelector("[data-quote-text]")?.textContent ?? "").trim(),
      /* Ovanför fakta, inte under: det är ordningen som gör den läst. */
      före:
        citat && fakta
          ? citat.getBoundingClientRect().top < fakta.getBoundingClientRect().top
          : false,
    };
  });

  check(
    "Ta över-rutan bär anteckningen som ett citat ovanför fakta",
    övertagandetMedAnteckning.citat &&
      /^Johan Furuskog skrev \d{2}[:.]\d{2}$/.test(övertagandetMedAnteckning.vem) &&
      övertagandetMedAnteckning.orden === "Inte klar — juristen ska läsa resultattexterna" &&
      övertagandetMedAnteckning.före,
    JSON.stringify(övertagandetMedAnteckning),
  );

  await anna.evaluate(() =>
    document.querySelector("confirmation-dialog").shadowRoot.querySelector('[data-action="cancel"]').click(),
  );
  await anna.waitForTimeout(300);
  await openGuides(anna);

  /*
   * Och den som skrev den tar bort den — med en fråga före, och anteckningen
   * citerad i den. En tömd text hade varit en dörr för lite: `prompt-dialog`
   * läser tomt som *Avbryt*, och det är rätt för varje annan fråga verktyget
   * ställer.
   */
  /*
   * A step in the editor's history before the removal, taken the way the
   * canvas takes one — so the Ctrl+Z further down has something to undo, and
   * the measurement shows that the key reached the history at all.
   */
  const noderFöreSteget = await johan.evaluate(() => {
    const editor = document.getElementById("editor");
    const graph = editor.getData();

    editor.shadowRoot.querySelector("node-editor").duplicateNodeById(graph.nodes[0].id);

    return graph.nodes.length;
  });

  await johan.evaluate(() => document.getElementById("more").click());
  await johan.waitForTimeout(200);
  await johan.evaluate(() => document.getElementById("note-remove").click());
  await johan.waitForTimeout(400);

  const fråganFöreBorttagning = await johan.evaluate(() => {
    const inuti = document.querySelector("confirmation-dialog")?.shadowRoot ?? null;

    return {
      rubrik: (inuti?.querySelector("[data-title]")?.textContent ?? "").trim(),
      orden: (inuti?.querySelector("[data-quote-text]")?.textContent ?? "").trim(),
      ton: inuti?.querySelector('[data-action="confirm"]')?.dataset.tone ?? "",
    };
  });

  check(
    "borttagandet frågar först, i rött, med orden som ska försvinna på skärmen",
    fråganFöreBorttagning.rubrik === "Ta bort anteckningen?" &&
      fråganFöreBorttagning.ton === "danger" &&
      fråganFöreBorttagning.orden === "Inte klar — juristen ska läsa resultattexterna",
    JSON.stringify(fråganFöreBorttagning),
  );

  await johan.evaluate(() =>
    document.querySelector("confirmation-dialog").shadowRoot.querySelector('[data-action="confirm"]').click(),
  );
  await johan.waitForTimeout(700);

  const efterBorttagning = await anteckningsraden(johan);

  check(
    "och sedan är den borta, och dörren heter det den gör igen",
    efterBorttagning.text === "" &&
      efterBorttagning.menyval === "Skriv en anteckning till kollegor",
    JSON.stringify(efterBorttagning),
  );

  /*
   * And Ctrl+Z does not bring it back (B3b, Astra 30/9, bilaga 6): the note
   * is not part of the graph, so the editor's history never held it, and the
   * host has no way to restore one — `PUT …/note` with an empty text deletes
   * it. That is why *Ta bort anteckningen* asks in the red: the words go with
   * no reliable undo. Measured 30/9 before the question was settled; if
   * this ever turns, the tone in `guide-storage.ts` turns with it.
   */
  const noderEfterSteget = await johan.evaluate(() => document.getElementById("editor").getData().nodes.length);

  await johan.evaluate(() =>
    document
      .getElementById("editor")
      .dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, composed: true })),
  );
  await johan.waitForTimeout(700);

  const efterÅngra = {
    ...(await anteckningsraden(johan)),
    noder: await johan.evaluate(() => document.getElementById("editor").getData().nodes.length),
  };

  check(
    "och Ctrl+Z tar inte tillbaka den — ångrandet når historiken, anteckningen står inte i den",
    noderEfterSteget === noderFöreSteget + 1 &&
      efterÅngra.noder === noderFöreSteget &&
      efterÅngra.text === "" &&
      efterÅngra.menyval === "Skriv en anteckning till kollegor",
    JSON.stringify({ ...efterÅngra, noderFöreSteget, noderEfterSteget }),
  );

  await lämnaGuiden(johan);

  /* ── 9. Hemligheten gäller inte längre (kriterium 3) ──────────────────── */

  /*
   * En värd väljer ETT sätt, aldrig två.
   *
   * Hemligheten myntas här av `guides.mjs new`, alltså precis som på en värd
   * utan leverantör, och den är i den meningen helt riktig. Med en leverantör
   * inkopplad ska den ändå avvisas: två legitimationer är två saker att få
   * rätt, och hemligheten är den som reser i adresser och skärmbilder.
   *
   * Kontrollen finns för att det motsatta felet är tyst. En server som tog emot
   * båda hade gått grön på allt ovan, och den gamla vägen in hade legat kvar
   * öppen utan att någon rad någonstans sa det.
   */
  const minted = spawnSync(
    process.execPath,
    [join(root, "integrations/reference-receiver/guides.mjs"), "new", "--note", "Gammal väg"],
    { encoding: "utf8", env },
  );
  const oldId = minted.stdout.match(/^id:\s*(\S+)$/m)?.[1] ?? "";
  const oldSecret = minted.stdout.match(/^hemlighet:\s*(\S+)$/m)?.[1] ?? "";

  check("guides.mjs new ger fortfarande id och hemlighet", oldId !== "" && oldSecret !== "");

  const withSecret = await fetch(`${API}/guides/${oldId}`, {
    headers: { authorization: `Bearer ${oldSecret}` },
  });

  check(
    "en riktig hemlighet avvisas när värden har inloggning",
    withSecret.status === 401,
    String(withSecret.status),
  );

  /*
   * Och guiden syns för alla — utan att någon kört något (berättelse 127,
   * kriterium 6 och migreringen).
   *
   * Det här är Johans egen övergång, mätt: en guide myntad med `guides.mjs new`
   * innan inloggningen slogs på har ingen `owner`. Före 127 var den därmed
   * osynlig för alla och bara nåbar med sin hemlighet — en återvändsgränd som
   * `guides.mjs owner` fanns för att ta sig ur. Nu är listan organisationens,
   * och en guide utan ägare är en guide som alla ser.
   *
   * Raden säger då bara datumet: det finns ingen att namnge, och ett *av* följt
   * av ingenting är sämre än ingen rad.
   */
  await openGuides(johan);

  const utanÄgare = await listState(johan);
  const gammalRad = utanÄgare.meta[utanÄgare.rader.indexOf("Gammal väg")] ?? "";

  check(
    "en guide från före inloggningen syns i listan utan att någon kört något",
    utanÄgare.rader.length === 3 && utanÄgare.rader.includes("Gammal väg"),
    JSON.stringify(utanÄgare.rader),
  );
  check(
    "och dess rad säger bara datumet — aldrig ett av utan namn",
    gammalRad !== "" && !/\bav\b/.test(gammalRad),
    gammalRad || "ingen rad",
  );

  /*
   * Men den är inte *Johans*: `Bara mina` ska inte plocka upp en guide ingen
   * skapat och ingen ändrat. Det är skillnaden mellan ett filter och en lista
   * som råkar vara lika lång.
   */
  await väljBaraMina(johan, true);

  const nissesEfterGammal = await listState(johan);

  check(
    "och Bara mina plockar inte upp en guide ingen skapat",
    !nissesEfterGammal.rader.includes("Gammal väg"),
    JSON.stringify(nissesEfterGammal.rader),
  );

  await väljBaraMina(johan, false);

  /*
   * `guides.mjs owner` finns kvar och gör vad den alltid gjort — sätter *skapad
   * av*. Den behövs inte längre för att guiden ska synas, och det är hela
   * skillnaden berättelsen gör för driften (`docs/DRIFT.md`).
   *
   * Att subjektet FINNS i mottagarens logg mäts ändå, för det är det runbooken
   * lovar och det enda stället det står.
   */
  const subjektet = receiverLog.match(/^inloggad (\S+)/m)?.[1] ?? "";

  check(
    "mottagarens logg säger vem som loggade in, med subjektet först",
    subjektet !== "" && /^inloggad \S+ \(.+\)$/m.test(receiverLog),
    receiverLog.split("\n").find((one) => one.startsWith("inloggad")) ?? "ingen sådan rad",
  );

  const gavÄgare = spawnSync(
    process.execPath,
    [join(root, "integrations/reference-receiver/guides.mjs"), "owner", oldId, subjektet],
    { encoding: "utf8", env },
  );

  await openGuides(johan);
  await väljBaraMina(johan, true);

  const medGammal = await listState(johan);

  check(
    "guides.mjs owner sätter skapad av, och då räknas guiden som ens egen",
    gavÄgare.status === 0 && medGammal.rader.includes("Gammal väg"),
    JSON.stringify({ kod: gavÄgare.status, rader: medGammal.rader }),
  );

  await väljBaraMina(johan, false);

  /* ── 10. Rollerna: stegen, hos värden och på sidan (berättelse 128) ───── */

  /*
   * Här nere och inte tidigare, av ett skäl som är mätbart: det som mäts
   * skriver. Anna publicerar, Johan skapar en guide, och båda hade ändrat
   * siffrorna varje kontroll ovanför räknar på. Ett prov vars förberedelser
   * stör sina egna mätningar är ett prov man börjar läsa i fel ordning.
   */

  /* ── 10a. Remsan säger vem OCH vad, för alla fyra ─────────────────────── */

  /*
   * Monika är den enda av de fyra som INTE står i `ROLES`, och därför den enda
   * som mäter förvalet: den som ingen skrivit in är läsare. En mock som gav
   * henne en roll hade gjort hela avsnittet till en uppvisning.
   */
  const monika = await person();

  await openGuides(monika);
  await signIn(monika, "as-monika");

  /*
   * Alla fyra tillbaka på listan först. Anna och Nisse stod kvar i editorn
   * efter krocken ovan, och `listState` på en editorsida läser ingenting och
   * svarar ändå — den sortens tomma svar som ser ut som ett fel i sidan.
   */
  for (const page of [johan, anna, nisse]) {
    await openGuides(page);
  }

  const remsor = {
    johan: (await listState(johan)).vem,
    anna: (await listState(anna)).vem,
    nisse: (await listState(nisse)).vem,
    monika: (await listState(monika)).vem,
  };

  check(
    "remsan säger både vem man är och vad man är, för alla fyra",
    remsor.johan === "Inloggad som Johan Furuskog · förvaltare" &&
      remsor.anna === "Inloggad som Anna Andersson · publicerare" &&
      remsor.nisse === "Inloggad som Nisse Hult · redaktör",
    JSON.stringify(remsor),
  );
  check(
    "och den som ingen skrivit in i .env är läsare",
    remsor.monika === "Inloggad som Monika Ågren · läsare",
    remsor.monika || "ingen remsa",
  );

  /* ── 10b. Ny guide står bara hos förvaltaren, och saknaden sägs i ord ─── */

  const nyGuideHos = {
    johan: await listState(johan),
    anna: await listState(anna),
    monika: await listState(monika),
  };

  check(
    "Ny guide står hos förvaltaren och ingen annan",
    nyGuideHos.johan.nyRuta !== "0x0" &&
      nyGuideHos.johan.nyRuta !== "finns inte" &&
      nyGuideHos.anna.nyRuta === "0x0" &&
      nyGuideHos.monika.nyRuta === "0x0",
    JSON.stringify({
      johan: nyGuideHos.johan.nyRuta,
      anna: nyGuideHos.anna.nyRuta,
      monika: nyGuideHos.monika.nyRuta,
    }),
  );
  check(
    "och att den saknas sägs i ord, aldrig bara genom att den är borta (K-kraven)",
    nyGuideHos.anna.nyBesked === "Bara en förvaltare kan skapa nya guider." &&
      nyGuideHos.monika.nyBesked === nyGuideHos.anna.nyBesked &&
      nyGuideHos.johan.nyBesked === "",
    JSON.stringify({ anna: nyGuideHos.anna.nyBesked, johan: nyGuideHos.johan.nyBesked }),
  );

  /* ── 10c. Värden är skyddet: varje roll mot varje skrivande väg ───────── */

  /*
   * Kriterium 2, hela matrisen. Sidan är en vy och kan kringgås — den här
   * halvan är det som faktiskt håller, och den mäts genom att fråga värden
   * rakt av, förbi varje knapp som är gömd.
   *
   * Vägarna körs i den ordning som gör minst oreda: skrivningarna som ska
   * avvisas först, de som ska lyckas sist.
   */
  /*
   * `snapshots` (berättelse 131) står sist och med flit: den kräver
   * **redaktör**, inte publicerare (`roles.mjs`, `neededRole`) — motsatsen
   * till `versions` och `current` två rader ovanför. Utan en egen rad hade en
   * mutation som lyfte kravet till publicerare varit osynlig här: Nisse är den
   * enda av de fyra som skiljer editor från publisher, och han är den som
   * redan får `200` på draften — precis den rad `nissesSvar` läser.
   */
  const skrivvägar = (id) => [
    ["PUT", `/guides/${id}/draft`, { graph: nissesUtkast }],
    ["DELETE", `/guides/${id}/draft`, null],
    ["POST", `/guides/${id}/versions`, { graph: nissesUtkast }],
    ["POST", `/guides/${id}/current`, { versionId: "finns-inte" }],
    ["POST", "/guides", { name: "Rollprov" }],
    ["POST", `/guides/${id}/snapshots`, { graph: nissesUtkast, label: "Rollprov" }],
  ];

  /** Vad var och en får: en lista statusar i vägarnas ordning. */
  const svaren = async (page) => {
    const out = [];

    for (const [method, path, body] of skrivvägar(guideId)) {
      out.push((await som(page)(method, path, body)).status);
    }

    return out;
  };

  const monikasSvar = await svaren(monika);

  /*
   * `403` och inte `401` sedan A8 (Johans ja 22/9). Identiteten är giltig —
   * Monika är inloggad — och det är rollen som inte räcker. Skillnaden är inte
   * kosmetisk: klienten erbjuder inloggning på `401`, och att göra det här
   * hade skickat henne ut och tillbaka till samma nej.
   */
  check(
    "läsaren avvisas på allt som skriver, och alltid med 403",
    monikasSvar.every((status) => status === 403),
    JSON.stringify(monikasSvar),
  );

  /*
   * QA (uppdrag 22/9, mätning 4c): avvisningen bär en KOD, inte bara en
   * statusrad — `forbidden`, ur listan i `docs/VARDSYSTEM-KONTRAKT.md`
   * (avsnittet *Fel*), samma kod på varje väg och aldrig en gissad svensk
   * mening. Skrivet mot `unauthorized`/401 innan A8 fanns i det här trädet;
   * rättat till `forbidden`/403 efter ombasering mot Teds 55b7f69d — en
   * giltig identitet med otillräcklig roll är just det A8 skiljer ut, inte
   * "ingen känner igen dig" (`unauthorized`, mätt i 4a ovan). Mutationen
   * som fäller det: byt ett av de tre `send(403, { error: "forbidden" })`
   * i `server.mjs` mot en fri text.
   */
  const monikasFörstaKod = await som(monika)("PUT", `/guides/${guideId}/draft`, { graph: nissesUtkast });

  check(
    "och den bär koden forbidden, samma kod på varje väg — inte unauthorized (A8)",
    JSON.parse(monikasFörstaKod.text || "{}")?.error === "forbidden",
    monikasFörstaKod.text,
  );

  const nissesSvar = await svaren(nisse);

  check(
    "redaktören får skriva arbetskopian men inte publicera",
    nissesSvar[0] === 200 && nissesSvar[1] === 200 && nissesSvar[2] === 403 &&
      nissesSvar[3] === 403 && nissesSvar[4] === 403,
    JSON.stringify(nissesSvar),
  );
  /*
   * Och krockfrysningen (131) är redaktörens väg, inte publicerarens — den
   * enda skrivvägen i matrisen som INTE ligger ovanför editor. Mutationen
   * som fäller det: höj `snapshots` till publisher i `neededRole`, och Nisse
   * går från 200 till 401 här medan resten av matrisen är oförändrad.
   */
  check(
    "och krockfrysningen (snapshots) går för redaktören — den kräver inte publicerare",
    nissesSvar[5] === 200,
    JSON.stringify(nissesSvar),
  );

  /*
   * Publiceraren nekas ingenting utom att skapa en guide. `POST …/current`
   * pekar på en version som inte finns och svarar därför `404` — vilket är
   * precis rätt sorts svar att få: det säger att rollen släppte igenom och att
   * det var innehållet som var fel.
   */
  const annasSvar = await svaren(anna);

  check(
    "publiceraren nekas ingenting utom att skapa en guide",
    annasSvar[0] === 200 && annasSvar[1] === 200 && annasSvar[2] === 200 &&
      annasSvar[3] === 404 && annasSvar[4] === 403,
    JSON.stringify(annasSvar),
  );

  const johansSvar = await svaren(johan);

  check(
    "förvaltaren nekas ingenting alls",
    johansSvar[0] === 200 && johansSvar[1] === 200 && johansSvar[2] === 200 &&
      johansSvar[3] === 404 && johansSvar[4] === 200,
    JSON.stringify(johansSvar),
  );

  /* ── 10d. Rollen prövas FÖRE uppslaget ────────────────────────────────── */

  /*
   * Annars skulle avvisningen skilja sig åt beroende på vad som finns: `404`
   * för ett id som inte finns, `401` för ett som gör det — och då har den som
   * inte får skriva lärt sig vilka guider värden har, bara genom att försöka.
   * Samma regel som i berättelse 126, och mutationen som fäller det är att
   * flytta rollkontrollen under `store.get`.
   *
   * Johans rad bredvid är vad som gör Monikas mätbar: uppslaget SKER, och
   * svarar `404` för den som fick komma så långt.
   */
  const okäntId = "finns-inte-har-aldrig-funnits";
  const monikaMotOkänt = await som(monika)("PUT", `/guides/${okäntId}/draft`, { graph: nissesUtkast });
  const johanMotOkänt = await som(johan)("PUT", `/guides/${okäntId}/draft`, { graph: nissesUtkast });

  check(
    "en läsare får samma 403 på ett id som inte finns som på ett som gör det",
    monikaMotOkänt.status === 403 && monikasSvar[0] === 403,
    JSON.stringify({ okänt: monikaMotOkänt.status, känt: monikasSvar[0] }),
  );
  check(
    "och uppslaget sker ändå — förvaltaren får 404 på samma id",
    johanMotOkänt.status === 404,
    String(johanMotOkänt.status),
  );

  /* ── 10e. Sidan är vyn: läsarens editor ───────────────────────────────── */

  /*
   * Paletten mäts som en RUTA, inte som `mode`-attributet. Det är hela
   * skillnaden mellan ett påstående om DOM och ett påstående om skärmen — och
   * mutationen berättelsen pekar ut (*sidan sätter administrator för alla*)
   * hade gått igenom varje kontroll som läser attributet.
   */
  const paletten = (page) =>
    page.evaluate(() => {
      const el = document.querySelector("guide-editor")?.shadowRoot?.querySelector("node-palette");
      const r = el?.getBoundingClientRect();

      return r ? `${Math.round(r.width)}x${Math.round(r.height)}` : "finns inte";
    });

  const knappRuta = (page, id) =>
    page.evaluate((which) => {
      const r = document.getElementById(which)?.getBoundingClientRect();

      return r ? `${Math.round(r.width)}x${Math.round(r.height)}` : "finns inte";
    }, id);

  await öppnaGuiden(monika);

  const monikasEditor = {
    palett: await paletten(monika),
    publicera: await knappRuta(monika, "publish"),
    läge: await monika.evaluate(() => document.getElementById("editor")?.getAttribute("mode")),
  };

  check(
    "läsaren får ingen palett, och ingen Publicera",
    monikasEditor.palett === "0x0" && monikasEditor.publicera === "0x0",
    JSON.stringify(monikasEditor),
  );

  await öppnaGuiden(johan);

  const johansPalett = await paletten(johan);

  check(
    "och förvaltaren får sin — kontrollen mäter alltså något",
    johansPalett !== "0x0" && johansPalett !== "finns inte",
    johansPalett,
  );

  /* ── 10f. Redaktörens rad säger varför Publicera inte står där ────────── */

  // Förvaltaren lämnar guiden först, så redaktören möter den ledig och inte
  // låst — se `lämnaGuiden` ovan.
  await lämnaGuiden(johan);
  await öppnaGuiden(nisse);

  await nisse.evaluate(() => {
    const editor = document.getElementById("editor");
    const graph = editor.getData();

    graph.nodes[0].data.title = "Nisse ändrar igen";
    editor.graph = graph;
    editor.dispatchEvent(
      new CustomEvent("graph-changed", {
        detail: { graph: editor.getData(), reason: "node-updated" },
        bubbles: true,
        composed: true,
      }),
    );
  });
  /*
   * Väntar på **sparningen** och inte på klockan.
   *
   * En fast väntan på 4,2 s räckte till 18/9 kväll, då låsets förnyelse la en
   * tur till före varje skrivning. Raden sa då *sparad ·* utan klockslag —
   * vilket såg ut som en trasig autospar men var provet som mätte för tidigt.
   */
  const nissesSkrivningar = [];

  nisse.on("request", (request) => {
    if (request.method() === "PUT" && request.url().includes("/draft")) {
      nissesSkrivningar.push(new Date().toISOString());
    }
  });

  await nisse
    .waitForFunction(
      () => /sparad \d{2}[:.]\d{2}/.test(document.getElementById("status")?.textContent ?? ""),
      null,
      { timeout: 15_000 },
    )
    .catch(() => undefined);

  const nissesRollrad = await editorsRad(nisse);
  const nissesPublicera = await knappRuta(nisse, "publish");
  const nissesPalett = await paletten(nisse);

  check(
    "redaktören har en palett och sparar sin arbetskopia",
    nissesPalett !== "0x0" &&
      nissesPalett !== "finns inte" &&
      /sparad \d{2}[:.]\d{2}/.test(nissesRollrad),
    JSON.stringify({ palett: nissesPalett, rad: nissesRollrad, skrivningar: nissesSkrivningar }),
  );
  check(
    "men ingen Publicera — och raden säger varför, när det finns något att publicera",
    nissesPublicera === "0x0" && nissesRollrad.includes("Bara en publicerare kan publicera"),
    JSON.stringify({ knapp: nissesPublicera, rad: nissesRollrad }),
  );

  /*
   * Och publiceraren har knappen och ingen sådan rad. Utan den här halvan
   * mäter kontrollen ovan bara att en sträng finns i en fil.
   */
  await lämnaGuiden(nisse);
  await öppnaGuiden(anna);

  const annasRollrad = await editorsRad(anna);
  const annasPublicera = await knappRuta(anna, "publish");

  check(
    "publiceraren har knappen, och raden förklarar ingenting den inte behöver",
    annasPublicera !== "0x0" &&
      annasPublicera !== "finns inte" &&
      !annasRollrad.includes("Bara en publicerare"),
    JSON.stringify({ knapp: annasPublicera, rad: annasRollrad }),
  );

  /* ── 10g. Mallbiblioteket är förvaltarens (kriterium 4, sedan 004) ────── */

  /*
   * Fanns sedan berättelse 004 och styrs av `canManageTemplates(mode)` i
   * biblioteket. Det som är nytt är att läget nu kommer ur en roll, så det som
   * mäts här är att kedjan `.env` → `/auth/me` → `mode` → menyraden håller
   * hela vägen — inte att biblioteket gör vad det alltid gjort.
   */
  const mallraden = async (page) => {
    await page.evaluate(() => {
      const toolbar = document
        .querySelector("guide-editor")
        ?.shadowRoot?.querySelector("editor-toolbar");

      toolbar?.shadowRoot?.querySelector('[data-menu-trigger="guide"]')?.click();
    });
    await page.waitForTimeout(300);

    return page.evaluate(() => {
      const toolbar = document
        .querySelector("guide-editor")
        ?.shadowRoot?.querySelector("editor-toolbar");
      const item = toolbar?.shadowRoot?.querySelector('[data-action="manage-node-types"]');
      const r = item?.getBoundingClientRect();

      return r ? `${Math.round(r.width)}x${Math.round(r.height)}` : "finns inte";
    });
  };

  /*
   * Anna mäts medan hon står i guiden, Johan efter att hon lämnat den — sedan
   * låset finns kan bara en av dem ha den öppen i redigeringsläge åt gången,
   * och en menyrad mätt i läsläge hade varit borta av fel skäl.
   */
  const mallarAnna = await mallraden(anna);

  await lämnaGuiden(anna);
  await öppnaGuiden(johan);

  const mallar = { johan: await mallraden(johan), anna: mallarAnna };

  check(
    "mallbiblioteket står i menyn hos förvaltaren och ingen annan",
    mallar.johan !== "0x0" && mallar.johan !== "finns inte" && mallar.anna === "0x0",
    JSON.stringify(mallar),
  );

  /*
   * ── En publicering är ingen krock (berättelse 131, Johans mätning 20/9) ─
   *
   * Han publicerade; Anna, som arbetade i samma kopia, fick krockrutan vid sin
   * nästa sparning — *Johan sparade 07:12 medan du arbetade* — fast han inte
   * ändrat någonting, bara publicerat det hon bygger på. Slog hon ihop fanns
   * inga skillnader att välja mellan.
   *
   * Här mäts kedjan från sidans håll, vilket är det som saknades: Johan står
   * i guiden, Anna publicerar hans kopia utifrån — precis som editorn gör det,
   * inklusive att arbetskopian tas bort efteråt — och Johans nästa ändring ska
   * gå igenom utan en ruta.
   *
   * Mutationen som fäller det: matchningen mot den publicerade stämpeln
   * borttagen i `conflictWith`. Då kommer rutan igen, med en tom stämpel i
   * svaret.
   */
  const johansStämpelFöre = await johan.evaluate(
    async ([base, id]) =>
      String(
        (await (await fetch(`${base}/guides/${id}`, { credentials: "include" })).json())
          .draftSavedAt ?? "",
      ),
    [API, guideId],
  );

  const annasPublicering = await anna.evaluate(
    async ([base, id, stämpel]) => {
      const läst = await (await fetch(`${base}/guides/${id}`, { credentials: "include" })).json();
      const fryst = await fetch(`${base}/guides/${id}/versions`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ graph: läst.draft, note: "Annas publicering", draftSavedAt: stämpel }),
      });
      const version = await fryst.json();

      await fetch(`${base}/guides/${id}/current`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ versionId: version.version?.id }),
      });
      /* Och det editorn gör sist: det som publicerats är inte längre
         opublicerat, så arbetskopian tas bort. */
      await fetch(`${base}/guides/${id}/draft`, { method: "DELETE", credentials: "include" });

      return fryst.status;
    },
    [API, guideId, johansStämpelFöre],
  );

  await ändra(johan, "Johans ändring efter Annas publicering");
  await johan.waitForTimeout(DRAFT_INTERVAL_MS + 2000);

  const efterPubliceringen = await editorLäge(johan);

  check(
    "en publicering av den kopia jag står i ger INGEN krockruta",
    annasPublicering === 200 && (await krockrutan(johan)).öppen === false,
    JSON.stringify({
      publicering: annasPublicering,
      ruta: (await krockrutan(johan)).rubrik || "ingen",
    }),
  );
  check(
    "och raden fortsätter som vanligt, med opublicerade ändringar sedan versionen",
    /^Opublicerade ändringar sedan version \d+ · sparad \d{2}[:.]\d{2}/.test(
      efterPubliceringen.rad,
    ),
    efterPubliceringen.rad,
  );
  check(
    "och ändringen nådde värden — sidan sparade, den pausade inte",
    (await hosVärden()) === "Johans ändring efter Annas publicering",
    await hosVärden(),
  );

  /*
   * ── En session värden inte längre känner igen (uppdrag 22/9, mätning 4a) ─
   *
   * `smoke:storage` och raderna ovan bevisar 401 UTAN session, mätt med
   * `fetch` rakt mot servern. Det som saknades var samma sak sedd genom
   * EDITORN: en cookie värden inte längre godtar (utgången, eller — som här
   * — en som aldrig var giltig) ska ge samma `401`, och statusraden ska säga
   * det med ord, aldrig tyst fortsätta som om sparningen gick bra.
   *
   * Johans fönster står redan öppet på guiden. Cookien byts ut mot en
   * trasig och läggs sedan tillbaka, så resten av provet (utloggningen
   * nedan) möter samma inloggade Johan som innan.
   *
   * Mutationen som fäller det: ta bort 401-grenen i `ServerGraphStore` som
   * översätter statusen till `SIGN_IN_AGAIN`, så raden i stället säger
   * "Kunde inte spara: Värden svarade 401" — sant, men inte vad kontraktet
   * (`docs/LAGRING-KONTRAKT.md`, *Identitet*) lovar redaktören.
   */
  const johansSessionscookie = (await johan.context().cookies(API)).find(
    (one) => one.name === "fw_session",
  );

  await johan.context().addCookies([
    { ...johansSessionscookie, value: "en-cookie-varden-aldrig-signerat" },
  ]);
  await ändra(johan, "Ändring med en session värden inte längre känner igen");
  await johan.waitForTimeout(DRAFT_INTERVAL_MS + 1500);

  const trasigSession = await editorLäge(johan);

  check(
    "en session värden inte längre godtar ger 401, och raden säger Logga in igen — aldrig tyst",
    trasigSession.rad.includes("Logga in igen"),
    trasigSession.rad || "ingen rad",
  );

  // Cookien tillbaka, så utloggningen nedan möter samma Johan som innan.
  await johan.context().addCookies([johansSessionscookie]);

  await monika.context().close();
  await nisse.context().close();
  await utomstående.context().close();
  await anna.context().close();

  /* ── 11. Utloggning ──────────────────────────────────────────────────── */

  await openGuides(johan);
  await johan.locator("#logout").click();
  await johan.waitForTimeout(1200);

  const efterUtloggning = await listState(johan);
  const kvarvarande = await johan.context().cookies(API);

  check(
    "utloggning tar en tillbaka till knappen, och listan är borta",
    efterUtloggning.utloggadSynlig && !efterUtloggning.inloggadSynlig && efterUtloggning.rader.length === 0,
    JSON.stringify(efterUtloggning),
  );
  check(
    "och sessionscookien är borta",
    !kvarvarande.some((one) => one.name === "fw_session" && one.value !== ""),
    JSON.stringify(kvarvarande.map((one) => one.name)),
  );

  await johan.context().close();

  check(
    "inga konsolfel och inga blockerade anrop under hela vägen",
    trouble.length === 0,
    trouble.slice(0, 3).join(" | "),
  );
} finally {
  await browser?.close();
  provider.kill();
  receiver.kill();
  site?.kill();
}

const failed = checks.filter((one) => !one.ok);

console.log(`\n${checks.length - failed.length}/${checks.length} godkända`);
process.exit(failed.length ? 1 : 0);
