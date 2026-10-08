/**
 * A runnable receiver for the submission contract — the whole form flow with
 * no Sitevision anywhere.
 *
 *     npm run receiver                          # förvald port 4320
 *     node integrations/reference-receiver/server.mjs 4320
 *
 * ## Why this exists
 *
 * `docs/INLAMNING-KONTRAKT.md` describes a server nobody could start. The
 * contract was written, the node was built, the payload's *shape* was agreed —
 * and the receiving half existed twice without ever having been a server: once
 * inside a browser page (`src/site/submission-reference-provider.ts`, which
 * mints a number and forgets it) and once inside Sitevision, where it only
 * runs on a platform this repository does not have. A contract with no
 * runnable side is a contract that is right until the first time somebody
 * checks.
 *
 * So this is that side, on a second host, over HTTP:
 *
 *     GET  /recipients   the catalog's visible half — {id, label}, never more
 *     POST /submit       the contract's payload in, { reference } out
 *
 * Point a page's receiver at it and the whole path runs for real — a guide
 * answered in a browser, an errand landing as a file on a disk, a reference
 * the visitor could read out over a phone.
 *
 * ## What it is not
 *
 * Not a case system, and it says so rather than implying it. No
 * authentication, no rate limiting, no deploy — the same limits as the mock
 * BFF (`tools/mock-bff.mjs`), and the same purpose: a reference a host can
 * read, and a local test tool. Rate limiting per IP is named in the contract
 * as the host's job precisely because every host already has a place for it,
 * and none of them is here.
 *
 * ## The register
 *
 * With `FLOWWEAVER_DB` set it also keeps every delivered errand as a row in a
 * small SQLite file — the register (`store.mjs`), read from a terminal with
 * `cases.mjs`. Without it the receiver behaves exactly as before, the same way
 * it behaves without a Resend key. The row is what was *received*; the outbox
 * file is what was *sent*. Two questions, two records, and `cases.mjs remove`
 * takes both so that tidying one never leaves the other lying about.
 *
 * There is still no read route. Reading somebody's errand over HTTP needs to
 * know who is asking, and identity is a later and much larger question.
 *
 * ## The rules it enforces, all from the contract
 *
 *  - **Addresses are not in the contract.** The catalog `{id, name, address}`
 *    is a JSON file next to this one; what leaves for a client is `{id,
 *    label}`. Resolution id→address happens here, at submission, which is why
 *    an internal address cannot exist in a guide's JSON, in the editor's
 *    picker, or in a visitor's network traffic.
 *  - **A tidied id goes to the designated default row**, stamped with the id
 *    that went missing. An errand must never vanish because a list was tidied.
 *  - **Robots are refused and told nothing.** Filled honeypot, or a run-through
 *    faster than 1 500 ms. The reason stays in this process.
 *  - **No captcha, ever.** It punishes disabled people harder than robots.
 *
 * ## Mail
 *
 * By default every delivery is written to `outbox/` as a readable text file —
 * gitignored, because it holds whatever visitors typed. Put `RESEND_API_KEY`
 * in `.env` (also gitignored; `.env.example` is the map) and the same mail
 * goes out through Resend's HTTP API as well, with the file kept as the
 * receipt. Without a key: files only, and no errors — the flow is complete
 * either way.
 */
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvFile } from "./env.mjs";
import {
  LOGIN_COOKIE,
  SESSION_COOKIE,
  SESSION_SECONDS,
  beginLogin,
  clearCookie,
  finishLogin,
  newGuideId,
  readAllowedOrigins,
  readAuthConfig,
  readCookie,
  readSigned,
  safeReturn,
  setCookie,
  sign,
} from "./auth.mjs";
import { liveLock, lockMinutes, publicLock, takenLock } from "./locks.mjs";
import { allows, neededRole, readRoleConfig, roleOf } from "./roles.mjs";
import { MAX_PAYLOAD_BYTES } from "./limits.mjs";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Vilken version som kör — läst en gång vid start, aldrig per begäran.
 *
 * ## Varför den finns
 *
 * Servern byggs inte, den rsyncas. Alltså finns ingen version i koden att
 * läsa: filerna på servern kan vara vilken commit som helst, och en avvikelse
 * mot dokumenten betyder antingen att dokumenten har fel eller att
 * utrullningen är gammal. De två går inte att skilja åt utifrån. I del C var
 * fyra av avvikelserna det senare, och varje timme som lades på dem var en
 * timme lagd på rätt kod.
 *
 * ## Varför en fil och inte en miljövariabel
 *
 * En miljövariabel sätts av den som startar tjänsten, alltså av `.env` eller
 * unit-filen — två ställen som INTE följer med i en utrullning, och som
 * därför skulle säga fel version efter första gången någon glömmer dem.
 * `version.json` skrivs av `tools/rollout-receiver.sh` i samma steg som
 * kopierar koden, så filen och koden kan inte glida isär: de kommer med samma
 * rsync eller ingen av dem.
 *
 * Saknas filen är svaret `null`, och det är det ärliga svaret. En lokal
 * körning har ingen utrullning, och att hitta på ett värde ur `git` här hade
 * gjort svaret till ett påstående om arbetskopian och inte om servern.
 */
const VERSION = (() => {
  try {
    const raw = readFileSync(join(here, "version.json"), "utf8");
    const parsed = JSON.parse(raw);

    /*
     * Formen prövas, inte bara filens existens. En halvskriven eller trasig
     * fil ska ge samma `null` som ingen fil alls — ett fält som säger
     * `{"commit": undefined}` är sämre än inget fält, för det ser ut som ett
     * svar.
     */
    return typeof parsed?.commit === "string" && parsed.commit !== ""
      ? {
          commit: parsed.commit,
          rolledOutAt: typeof parsed.rolledOutAt === "string" ? parsed.rolledOutAt : null,
        }
      : null;
  } catch {
    return null;
  }
})();

/*
 * `.env` first, so everything below can read it. The reading itself is in
 * `env.mjs`, shared with `cases.mjs` so the two programs can never disagree
 * about where the outbox and the register are.
 */
loadEnvFile();

/**
 * A guide's own size limit, separate from a submission's.
 *
 * 256 kB is ten times the biggest guide anybody has built here (~23 kB of
 * JSON). A limit exists because the guides share a disk with the visitors'
 * errands, and whoever fills it takes both down. Images are links in a guide,
 * never embedded, so the number does not have to grow with them.
 */
const MAX_GRAPH_BYTES = 256 * 1024;

/**
 * How long a guide's title may be in the register.
 *
 * The title exists so a list can be read and searched, and 200 characters is
 * already three lines of one. The cap is here rather than in the graph because
 * the graph is stored verbatim — the contract promises that — so this trims
 * only the copy kept for the list, and the guide keeps whatever it was called.
 */
const TITLE_MAX = 200;

const shortTitle = (text) => String(text).trim().slice(0, TITLE_MAX);

const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4320);


/**
 * CORS is off unless an origin is named — the same stance as the Mongo example
 * (`integrations/node-mongo`), and for a stronger reason here: this endpoint
 * accepts *writes* on behalf of a visitor. An example that shipped open would
 * be copied open. `FLOWWEAVER_ORIGIN=http://localhost:5173` is what the dev
 * server needs; `ALLOWED_ORIGINS` names more than one for a host that serves
 * the site from two addresses.
 *
 * Since story 126 the answer is the **requesting** origin when it is on the
 * list, never a wildcard and never a fixed string echoed at everybody. That is
 * not tidiness: the editor now sends its session cookie with
 * `credentials: "include"`, and a browser refuses `*` outright beside
 * `Access-Control-Allow-Credentials: true`. `Vary: Origin` goes with it so a
 * cache between here and the browser cannot hand one site's answer to another.
 */
const ORIGINS = readAllowedOrigins();
const ORIGIN = ORIGINS[0] ?? "";

/**
 * Who may log in, and how. Empty `.env` means the guide secret is the identity,
 * exactly as before story 126; a configured provider means the secret is
 * refused. A host chooses one, never both — see `docs/LAGRING-KONTRAKT.md`.
 */
const AUTH = readAuthConfig();

/**
 * Hur länge ett lås på en guide lever utan aktivitet (berättelse 129).
 *
 * Läses en gång vid start, som allt annat här. Skälen till formen — varför
 * decimaler tillåts och varför ett passerat lås aldrig städas — står i
 * `locks.mjs`.
 */
const LOCK_MINUTES = lockMinutes();
/**
 * Bygger den här värden ett lås alls? (berättelse 129, tillägget 20/9)
 *
 * `LOCK_MINUTES=0` betyder nej, och då är värden precis en värd som inte
 * byggt låset: vägarna svarar `404` och guiden bär inget `lock`. Kontraktet
 * säger att det är ett fullgott svar, och sidan arbetar då som före 129 —
 * mätt: `guideLock.take()` ger `kind: "none"` på allt som inte är `ok`, och
 * sidan lämnar då `holding` falskt och `lockedBy` null.
 */
const LOCKS_ON = LOCK_MINUTES > 0;

/**
 * Who is what, out of `.env` (story 128).
 *
 * Read once at startup, like everything else here, and applied per request: the
 * role is derived from the session rather than frozen into it, so correcting a
 * line and restarting is the whole of changing somebody's role.
 *
 * Read whether or not a provider is configured. A host without one has no
 * sessions to give a role to, and the mapping is then simply never consulted —
 * but reading it anyway means the startup line can say what is configured
 * rather than what is in use, which is what somebody comparing two servers
 * needs to see.
 */
const ROLES = readRoleConfig();


/**
 * The register, when `.env` names a file. Empty means no register at all —
 * not a register at some default path — so a receiver that was never
 * configured for one cannot quietly start keeping personal data on disk in a
 * second place.
 *
 * A file that cannot be opened is loud and not fatal: an errand still gets
 * delivered by a receiver whose disk is full or whose permissions are wrong,
 * and refusing to start would turn a lost register into a lost service.
 */
const DB_FILE = (process.env.FLOWWEAVER_DB ?? "").trim();
let store = null;

/** Registrets nyckelform, hämtad ur `store.mjs` när det öppnas. */
let entryKey = (kind, id) => `${kind}/${id}`;
try {
  /*
   * Registret laddas först när det ska användas.
   *
   * `store.mjs` importerar `node:sqlite`, och Node skriver en
   * `ExperimentalWarning` för den modulen så fort den laddas — även när ingen
   * `FLOWWEAVER_DB` är satt och registret alltså är av. En varning vid varje
   * start om en funktion man inte bett om är en varning man lär sig läsa förbi,
   * och nästa varning blir osynlig med den.
   *
   * Dynamisk import i stället för `--no-warnings` i systemd-enheten: flaggan
   * hade tystat varje varning Node kan tänkas ha om den här processen, inte
   * bara den här. Ett tyst fel är dyrare än en meddelad experimentflagga.
   */
  if (DB_FILE !== "") {
    /*
     * `entryKey` kommer ur samma import och inte ur en egen rad: nyckelns form
     * är registrets och ska inte finnas skriven på två ställen. En sträng som
     * `submission/${id}` byggd här hade gått sönder tyst den dag formen byter.
     */
    const store_module = await import("./store.mjs");

    entryKey = store_module.entryKey;
    store = store_module.openStore(resolve(DB_FILE));
  }
} catch (error) {
  console.error(`Registret gick inte att öppna (${DB_FILE}): ${error.message}`);
  console.error("Mottagaren kör vidare utan register — ärenden levereras, men skrivs inte ned.");
}

/**
 * Read per request rather than at startup: editing the catalog is the most
 * common thing anybody does with this, and needing a restart to see it would
 * make the file feel like configuration instead of a list.
 */
/**
 * One address from the environment, for trying this on your own machine.
 *
 * `RECEIVER_TEST_ADDRESS` in `.env` adds a row and makes it the default. It
 * exists because the honest alternative — hand-editing a JSON catalogue every
 * time you want a mail to reach you — is the kind of friction that ends with
 * somebody putting their real address in the tracked file instead.
 *
 * It is deliberately **additive**: the fictional rows stay, so the "unknown id
 * lands on the default row, stamped" behaviour is still there to see. And it is
 * deliberately an address rather than a whole catalogue — the moment this grows
 * into "configure recipients from the environment" it has become a second
 * catalogue mechanism, and the file is the first.
 *
 * The address lives in `.env`, gitignored, on the machine that sends. Never in
 * the repository, and never anywhere the browser can read it: the contract's
 * whole point is that the client sends an id.
 */
/**
 * Vägarna som finns, som en okänd väg räknar upp dem.
 *
 * Ett ställe, för listan skickas nu från två: den sista `no-route` längst ned,
 * och en adress med ett extra segment i guidevägarna. Två kopior av en
 * väglista är två listor att glömma när en väg tillkommer, och den som glömts
 * ser ut som en väg som inte finns.
 */
/*
 * FlowWeaver PRO's half of the receiver — the submission routes, the catalog,
 * delivery by Resend or to the outbox — lives in `submission-routes.mjs`
 * (open-core step 5, 2026-10-06). Present, it is loaded and its routes answer;
 * absent, as in the open FlowWeaver, this is a storage host and nothing else,
 * and `/recipients` and `/submit` are routes that do not exist. A module that
 * is there but broken still fails loudly: only "not found" is the open case.
 */
let submission = null;
let SUBMISSION_ROUTES = [];
try {
  const module = await import("./submission-routes.mjs");
  submission = module.createSubmissionRoutes({
    here,
    readBody,
    getStore: () => store,
    getEntryKey: () => entryKey,
  });
  SUBMISSION_ROUTES = module.SUBMISSION_ROUTES;
} catch (error) {
  if (error?.code !== "ERR_MODULE_NOT_FOUND" || !String(error?.message).includes("submission-routes")) {
    throw error;
  }
}

const ROUTES = [
  ...SUBMISSION_ROUTES,
  "GET /auth/login?return=<adress>",
  "GET /auth/callback",
  "POST /auth/logout",
  "GET /auth/me",
  "GET /guides",
  "POST /guides",
  "GET /guides/<id>",
  "PUT /guides/<id>/draft",
  "DELETE /guides/<id>/draft",
  "POST /guides/<id>/lock",
  "DELETE /guides/<id>/lock",
  "PUT /guides/<id>/note",
  "POST /guides/<id>/versions",
  "POST /guides/<id>/snapshots",
  "GET /guides/<id>/versions/<vid>",
  "POST /guides/<id>/current",
];

/**
 * The body, with the contract's size rule applied while it arrives.
 *
 * Over the limit, the chunks stop being kept but the request is still read to
 * its end before answering. Cutting the socket mid-upload is what a server
 * *wants* to do, and it hands the client an ECONNRESET instead of the 413 that
 * would have told it what happened — measured, not reasoned: the first version
 * did exactly that and the smoke check crashed rather than failed. Memory
 * stays bounded either way, which was the actual worry.
 */
function readBody(request, limit = MAX_PAYLOAD_BYTES) {
  return new Promise((accept, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;

    request.on("data", (chunk) => {
      size += chunk.length;

      if (size > limit) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }

      chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) {
        reject(Object.assign(new Error("nyttolasten är för stor"), { tooLarge: true }));
        return;
      }

      accept(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", reject);
  });
}

/**
 * A small JSON body, or `null`.
 *
 * For the routes where the body is a handful of fields rather than a graph: a
 * missing or broken one is the same as an empty one there, because every field
 * in them is optional and the route has a sensible answer without any of them.
 * `readGraph` inside the storage routes is the strict counterpart, and it has
 * to be — a draft that arrives unreadable must say `400` rather than quietly
 * saving nothing.
 */
async function readJson(request, limit) {
  try {
    return JSON.parse(await readBody(request, limit));
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);
  /*
   * What this host is reachable as, from the request itself.
   *
   * Behind Caddy the socket is plain HTTP on localhost, so the scheme has to
   * come from `X-Forwarded-Proto` — and the redirect address the provider was
   * given has to be byte-identical to the one sent in the code exchange, or the
   * exchange is refused. `OIDC_REDIRECT_URI` overrides it for a deployment
   * where the headers cannot be trusted; a wrong host here fails at the
   * provider, which only accepts addresses somebody registered.
   */
  const proto = String(request.headers["x-forwarded-proto"] ?? "").split(",")[0].trim() || "http";
  const selfBase = `${proto}://${request.headers.host ?? `localhost:${PORT}`}`;
  const secureCookies = proto === "https";
  /** The origin asking, when a browser is asking. */
  const asking = String(request.headers.origin ?? "");
  const allowedOrigin = asking === "" ? ORIGIN : ORIGINS.includes(asking) ? asking : "";
  const send = (status, body, extra = {}) => {
    const headers = { "content-type": "application/json; charset=utf-8", ...extra };

    if (allowedOrigin) {
      headers["access-control-allow-origin"] = allowedOrigin;
      /*
       * The session cookie only travels when the answer says it may. Without
       * this line `credentials: "include"` sends nothing and every route reads
       * as logged out — with no error anywhere, because the request succeeds.
       */
      headers["access-control-allow-credentials"] = "true";
      headers.vary = "Origin";
      // `authorization` as well as `content-type` since story 124: the storage
      // adapter carries the guide's secret as a Bearer token, and a browser
      // will not send a header the preflight did not allow.
      headers["access-control-allow-headers"] = "content-type, authorization";
      /*
       * `PUT` hör till sedan lagringskontraktet (berättelse 124):
       * `PUT /guides/<id>/draft` är arbetskopians väg. Utan den i
       * förhandsförfrågan avvisar webbläsaren skrivningen innan den skickas,
       * och serverns egen logg ser tom ut — mätt i en riktig webbläsare, för
       * `fetch` i node bryr sig inte om CORS och provet var grönt hela tiden.
       */
      headers["access-control-allow-methods"] = "GET,PUT,POST,DELETE,OPTIONS";
    }

    /*
     * `204` är ett svar utan kropp, och då hör ingen `content-type` dit: det
     * finns ingen kropp att ha en typ på. Node skickar heller ingen längd på
     * en 204, så det räcker att inte skriva något.
     */
    if (status === 204) {
      delete headers["content-type"];
    }

    response.writeHead(status, headers);
    response.end(status === 204 ? undefined : JSON.stringify(body));

    if (!process.env.FLOWWEAVER_TYST) {
      console.log(`${status} ${request.method} ${url.pathname}`);
    }
  };

  if (request.method === "OPTIONS") {
    send(204, {});
    return;
  }

  /* ── The editor's login (docs/STORIES/126, docs/LAGRING-KONTRAKT.md) ──── */

  /**
   * Who is asking, out of the signed cookie — or `null`.
   *
   * `null` covers a host with no provider configured as well as a browser with
   * no session, and the routes below treat those the same way on purpose: both
   * mean *this request carries no identity*, and what happens next is decided
   * by whether a guide can be opened another way.
   */
  const whoIsAsking = () =>
    AUTH.on ? readSigned(readCookie(request.headers.cookie, SESSION_COOKIE), AUTH.sessionSecret) : null;

  const redirect = (to, extra = {}) => {
    response.writeHead(302, { location: to, ...extra });
    response.end();

    if (!process.env.FLOWWEAVER_TYST) {
      console.log(`302 ${request.method} ${url.pathname}`);
    }
  };

  if (url.pathname.startsWith("/auth/")) {
    /*
     * A host without a provider has no login to offer, and says so rather than
     * showing a door that leads nowhere. 404 and not 501: for this host these
     * routes genuinely do not exist, and the page asks about them before it
     * draws anything (`GET /auth/me`).
     */
    if (!AUTH.on) {
      send(404, { error: "no-login" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/auth/me") {
      const session = whoIsAsking();

      if (!session) {
        send(401, { error: "unauthorized" });
        return;
      }

      /*
       * The name and the address, and not the subject: the page shows *Inloggad
       * som …*, and an opaque id is nothing anybody recognises themselves by.
       *
       * And the role, so the page can set the editor's mode without guessing
       * (story 128). It is the **page** the answer is for, not the guard: this
       * host refuses on its own account whatever a page believes, and a page
       * that had to work the role out from a failed write would have to fail
       * first to find out.
       */
      send(200, {
        name: session.name ?? "",
        email: session.email ?? "",
        role: roleOf(session, ROLES),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/auth/login") {
      const returnTo = safeReturn(url.searchParams.get("return"), ORIGINS);
      const redirectUri = AUTH.redirectUri || `${selfBase}/auth/callback`;

      try {
        const started = await beginLogin({ config: AUTH, redirectUri, returnTo });

        /*
         * The pending login rides in a cookie rather than in a map on this
         * process. Two reasons, and the second is the one that matters: a map
         * is lost on every restart, so a deploy in the middle of somebody's
         * login is a login that dies with no explanation — and a map is state
         * with a lifetime, which means a cleaner, which means a bug in the
         * cleaner. A signed cookie expires by arithmetic.
         */
        redirect(started.location, {
          "set-cookie": setCookie(LOGIN_COOKIE, sign(started.pending, AUTH.sessionSecret), {
            maxAge: 600,
            secure: secureCookies,
          }),
        });
      } catch (error) {
        console.error(`Inloggningen kunde inte startas: ${error.message}`);
        send(502, { error: "provider" });
      }

      return;
    }

    if (request.method === "GET" && url.pathname === "/auth/callback") {
      const returnOf = (pending) => safeReturn(pending?.returnTo, ORIGINS);
      const pending = readSigned(readCookie(request.headers.cookie, LOGIN_COOKIE), AUTH.sessionSecret);
      const drop = clearCookie(LOGIN_COOKIE, { secure: secureCookies });

      /*
       * Declining is not a failure. The provider says `error=access_denied`
       * when somebody presses Avbryt, and the only right answer is to put them
       * back where they started — logged out, on a page with a Logga in button,
       * which is exactly the state they asked for.
       */
      if (url.searchParams.get("error")) {
        redirect(returnOf(pending), { "set-cookie": drop });
        return;
      }

      try {
        const done = await finishLogin({
          config: AUTH,
          pending,
          code: url.searchParams.get("code"),
          state: url.searchParams.get("state"),
        });

        if (!done.ok) {
          /*
           * The reason goes in the log and not to the browser. "The token was
           * issued for another client" tells the person reading it nothing they
           * can act on and tells somebody probing rather a lot.
           */
          console.error(`Inloggningen avvisades: ${done.why}`);
          redirect(returnOf(pending), { "set-cookie": drop });
          return;
        }

        response.writeHead(302, {
          location: returnOf(pending),
          "set-cookie": [
            drop,
            setCookie(SESSION_COOKIE, sign(done.session, AUTH.sessionSecret), {
              maxAge: SESSION_SECONDS,
              secure: secureCookies,
            }),
          ],
        });
        response.end();

        /*
         * Raden driftaren letar efter, och den säger båda halvorna.
         *
         * `subject` är det värdens katalog kallar personen — ogenomskinligt,
         * och det enda som duger som `owner` på en guide. Namnet står bredvid
         * för att en logg med tre inloggningar annars inte går att koppla till
         * rätt person. `docs/DRIFT.md` pekar hit när en guide som myntats på
         * kommandoraden ska få en ägare.
         */
        if (!process.env.FLOWWEAVER_TYST) {
          console.log(`inloggad ${done.session.subject} (${done.session.name || "utan namn"})`);
        }
      } catch (error) {
        console.error(`Inloggningen gick inte att slutföra: ${error.message}`);
        redirect(returnOf(pending), { "set-cookie": drop });
      }

      return;
    }

    if (request.method === "POST" && url.pathname === "/auth/logout") {
      /*
       * POST and not GET, because a logout a link can trigger is a logout
       * somebody else's page can trigger. Nothing is deleted on this side —
       * there is nothing to delete — so logging out is emptying the cookie.
       */
      send(200, { ok: true }, { "set-cookie": clearCookie(SESSION_COOKIE, { secure: secureCookies }) });
      return;
    }

    send(404, { error: "no-route", message: `no route for ${request.method} ${url.pathname}` });
    return;
  }

  // FlowWeaver PRO's routes — GET /recipients, POST /submit — when
  // submission-routes.mjs is beside this file (see the loader above ROUTES).
  if (submission && (await submission.handle({ request, url, send }))) {
    return;
  }

  /* ── The storage contract (docs/LAGRING-KONTRAKT.md, story 124) ──────── */

  /**
   * What to call a guide in a list, out of the graph the editor sent.
   *
   * `meta.name` is either a string or one string per locale, because a guide
   * written in two languages has two names. The list picks Swedish first and
   * then whatever is there — a row with no title at all is worse than a row
   * with the wrong language's title, and *sök på titel* needs something to
   * search.
   */
  const titleOf = (graph) => {
    const name = graph?.meta?.name;

    if (typeof name === "string") {
      return shortTitle(name);
    }

    if (name && typeof name === "object") {
      return shortTitle(String(name.sv ?? name.en ?? Object.values(name)[0] ?? ""));
    }

    return "";
  };

  /**
   * May this session touch this guide?
   *
   * **Anybody who may log in here may touch any guide here** (story 127). That
   * is what a CMS does, and the reason is in the story: a guide is the site's
   * content, not a person's. The question *who changed this last* has nobody to
   * name in a world where every editor sees only their own guides.
   *
   * It is the **host's** choice and not the contract's: `GET /guides` gives the
   * guides the asker may see, and who that is is decided here. A host with
   * several organisations in one installation would answer differently, and
   * `docs/LAGRING-KONTRAKT.md` says so.
   *
   * `owner` therefore no longer gates anything — it is *created by*, kept
   * because a host moving between storages has to know what travels with a
   * guide. `editors` is gone: it was written down as a sharing list in story
   * 126 and no surface ever wrote to it, so the second real case that would
   * have promoted it never came (PRAXIS 34). Sharing is now what the list is.
   *
   * A guide minted before any of this (`guides.mjs new`, no `owner`) is
   * therefore visible to every editor without anybody running a command.
   */
  const mayTouch = (session) => Boolean(session?.subject);

  /** Who is writing, as both records keep it. Empty on a host without a login. */
  const whoOf = (session) =>
    session?.subject ? { subject: session.subject, name: String(session.name ?? "") } : null;

  /**
   * Vilka som skrivit i arbetskopian sedan den senast publicerade versionen
   * (berättelse 130).
   *
   * **En rad per person, inte per sparning.** Autosparen skriver var tredje
   * sekund; en logg hade blivit tusen rader om en eftermiddag, och frågan
   * granskningen ställer är *vilkas ändringar ligger i det jag publicerar* —
   * en lista på namn, inte en historik. Tiden är personens **senaste**
   * sparning, för det är den som säger hur färskt arbetet är.
   *
   * Listan töms när en version fryses: då är arbetskopian publicerad, och
   * nästa fråga gäller vad som hänt sedan dess.
   */
  const withEditor = (held, who, at) => [
    ...(Array.isArray(held) ? held : []).filter((one) => one?.subject !== who.subject),
    { subject: who.subject, name: who.name, at },
  ];

  /**
   * Arbetsanteckningen och skribenterna, som en sida får se dem.
   *
   * Namnet och aldrig subjektet, och `me` avgörs här — samma regel som
   * `draftSavedBy` och låset: sidan lär sig aldrig sitt eget subjekt, och en
   * namnjämförelse hade gett fel svar för en av två med samma namn.
   */
  const publicEditors = (held, subject) =>
    (Array.isArray(held) ? held : [])
      .filter((one) => typeof one?.name === "string" && one.name !== "")
      .map((one) => ({ name: one.name, me: one.subject === subject, at: String(one.at ?? "") }));

  const publicNote = (held, subject) =>
    held && typeof held.text === "string" && held.text !== ""
      ? {
          text: held.text,
          at: String(held.at ?? ""),
          by: {
            name: String(held.by?.name ?? ""),
            me: String(held.by?.subject ?? "") === subject,
          },
        }
      : null;

  if (url.pathname === "/guides" && (request.method === "GET" || request.method === "POST")) {
    const session = whoIsAsking();
    /*
     * The subject is read **here**, beside the refusal, and not down in the
     * branch that needs it.
     *
     * Both routes need to know who is asking, and there is no answer for
     * somebody who is nobody: a list of *your* guides is empty in a way that
     * cannot be distinguished from "you have none", and creating one means
     * deciding who owns it. 401 rather than 404 because the route exists and
     * the caller is the thing that is missing — the id-hiding rule applies to
     * a *named* guide, and nothing is named yet.
     *
     * Reading it here is what makes the refusal load-bearing rather than
     * merely early. `POST` used to reach for `session.subject` twenty lines
     * further down, which meant the guard above was the only thing standing
     * between a missing session and a crash — and a guard that has to be
     * remembered is a guard somebody eventually moves. Now the value and the
     * refusal are one line apart, and an empty subject is refused as well: a
     * session that cannot name anybody cannot own anything.
     */
    const subject = String(session?.subject ?? "");

    if (subject === "") {
      send(401, { error: "unauthorized" });
      return;
    }

    /*
     * And creating one is the top rung (story 128).
     *
     * Refused **here**, before the register is even consulted, for the same
     * reason the guide routes below refuse before they look a guide up: an
     * answer that differs by what exists is an answer that teaches somebody
     * what exists. Reading the list is the bottom rung, so `GET` passes.
     */
    if (!allows(roleOf(session, ROLES), request.method === "POST" ? "admin" : "reader")) {
      // Identiteten är giltig, rollen räcker inte: `403`, samma regel som
      // guidevägarna nedan sedan A8 (22/9).
      send(403, { error: "forbidden" });
      return;
    }

    if (!store) {
      send(503, { error: "no-storage" });
      return;
    }

    if (request.method === "GET") {
      /*
       * Every guide this host keeps, to everybody who may log in (story 127).
       *
       * `updatedBy` carries the **name** and not the subject: the page draws
       * *av Nisse Hult*, and a subject on the wire would be an opaque identity
       * in a screenshot for no gain. `mine` is the one thing the page cannot
       * work out for itself — it never learns its own subject — so the host
       * answers it, and *Bara mina* filters on that word alone.
       */
      const all = store
        .list({ kind: "guide" })
        .map((entry) => ({
          id: entry.value.id,
          name: String(entry.value.name ?? entry.value.note ?? ""),
          current: String(entry.value.current ?? ""),
          updatedAt: entry.updatedAt,
          ...(entry.value.updatedBy?.name ? { updatedBy: { name: entry.value.updatedBy.name } } : {}),
          /*
           * Och vem som arbetar i den just nu (berättelse 129).
           *
           * Vid inläsningen och inte löpande — listan är ingen närvarovy, och
           * en rad som uppdaterar sig själv är en rad som behöver en
           * uppkoppling för att inte ljuga. Ett lås som löpt ut syns inte alls,
           * för `liveLock` läser tiden och inte fältet.
           */
          ...(() => {
            /* Och ingenting alls när värden inte bygger låset (LOCK_MINUTES=0). */
            const held = LOCKS_ON ? liveLock(entry.value) : null;

            return held ? { lock: publicLock(held, subject) } : {};
          })(),
          /*
           * Och arbetsanteckningen, som listan visar dämpad under titeln
           * (berättelse 130). Den som ser *Inte klar — juristen ska läsa* i
           * listan öppnar inte guiden för att publicera den.
           */
          ...(() => {
            const note = publicNote(entry.value.draftNote, subject);

            return note ? { draftNote: note } : {};
          })(),
          mine: entry.value.owner === subject || entry.value.updatedBy?.subject === subject,
        }));

      send(200, { guides: all });
      return;
    }

    const body = await readJson(request, MAX_GRAPH_BYTES);
    const id = newGuideId();
    const name = typeof body?.name === "string" ? shortTitle(body.name) : "";

    /*
     * Created here, and with no secret at all.
     *
     * `guides.mjs new` mints one because a host without a provider has nothing
     * else to prove ownership with. A host with a login has the owner, and a
     * second way in would be a second way in — the whole objection to the
     * secret was that it travels.
     */
    store.put({
      kind: "guide",
      id,
      value: {
        id,
        name,
        // *Skapad av*, and nothing more: it decides no visibility (see
        // `mayTouch`), and `updatedBy` follows so a guide nobody has written in
        // yet still says who it came from.
        owner: subject,
        updatedBy: whoOf(session),
        current: "",
        createdAt: new Date().toISOString(),
      },
    });

    send(200, { guide: { id, name, current: "", updatedAt: new Date().toISOString() } });
    return;
  }

  const guidePath = url.pathname.match(
    /^\/guides\/([^/]+)(?:\/(draft|versions|snapshots|current|lock|note)(?:\/([^/]+))?)?$/,
  );

  if (guidePath) {
    const [, guideId, section, versionId] = guidePath;

    /*
     * Ett sista segment hör till **en** väg, och alla andra är inga vägar.
     *
     * Rutten ovan tillåter `/<sektion>/<något>` för varje sektion, men bara
     * `GET …/versions/<vid>` läser segmentet. Resten av blocket plockade isär
     * adressen och ignorerade det, så `POST /guides/<id>/versions/<vid>` gick
     * rakt in i frysningen: en värd som trodde sig skriva **till** en
     * befintlig version fick tyst en ny, med nästa nummer, och svaret såg ut
     * som en lyckad publicering. Mätt av Per 22/9. Versionerna är
     * oföränderliga — då är en adress som ser ut att ändra en ett fel att
     * svara på, inte något att tolka välvilligt. Samma sak gällde
     * `PUT …/draft/<vid>`, som skrev arbetskopian som om segmentet inte fanns.
     *
     * Två svar, efter vad adressen är:
     *
     *  - `versions/<vid>` **finns**, med `GET`. En annan metod på den är
     *    `405 no-method`, precis vad koden betyder i `errors.mjs`.
     *  - `draft/<vid>`, `lock/<vid>` och de andra finns inte med någon metod
     *    alls. Det är `404 no-route`, och svaret räknar upp `ROUTES` på samma
     *    sätt som varje annan okänd väg.
     *
     * Före behörighetsprövningen med flit: det här är ett påstående om
     * **adressen**, och det är sant oavsett vem som frågar. Ingenting röjs —
     * svaret är detsamma för en guide som finns och en som inte gör det.
     */
    if (versionId !== undefined) {
      if (section === "versions") {
        if (request.method !== "GET") {
          send(405, {
            error: "no-method",
            message: `${request.method} is not allowed on ${url.pathname}`,
          });
          return;
        }
      } else {
        // Samma form som den sista `no-route`: ett svar som räknar upp vad
        // som finns säger också vilken version som räknar upp det. Två
        // kroppar under samma kod är samma sorts glidning som två väglistor.
        send(404, {
          error: "no-route",
          message: `no route for ${request.method} ${url.pathname}`,
          version: VERSION,
          finns: ROUTES,
        });
        return;
      }
    }

    /*
     * Who may touch this guide — and a host answers that **one** way.
     *
     * With a provider configured it is the session, and the guide secret is
     * refused however good it is: two ways in is two things to get wrong, and
     * the secret is the one that travels in addresses and screenshots. Without
     * a provider it is the secret, exactly as before story 126, so a reference
     * host with an empty `.env` is unchanged.
     *
     * **Tre svar, efter sin betydelse** (Johans ja 22/9, Astras skäl):
     *
     *  - `401 unauthorized` — ingen eller ogiltig autentisering. Klienten
     *    erbjuder inloggning, för det är vad som saknas.
     *  - `403 forbidden` — identiteten är giltig, rollen räcker inte. Klienten
     *    förklarar begränsningen och erbjuder **inte** ny inloggning: att
     *    logga in igen som samma person ger samma roll, och en knapp som
     *    lovar något annat är en lögn som tar tid att genomskåda.
     *  - `404 no-guide` — guiden finns inte, eller får inte synas för den som
     *    frågar. Att dölja existens är standardens sätt, och det gör `401`
     *    inte bättre.
     *
     * Fram till 22/9 svarade rollavslag `401` med flit, för att inte lära ut
     * vad som finns. Skälet höll, men priset var värre än problemet: klienten
     * kan inte skilja *du är utloggad* från *du får inte*, och startade
     * återinloggning för ett rättighetsfel. Existens döljs nu där den ska
     * döljas — i `404` — och rollen svarar med sitt eget ord.
     */
    const session = whoIsAsking();

    /*
     * Inloggningen och **rollen** prövas här, före uppslaget (berättelse 128).
     *
     * Ordningen är inte en städning. Rollen prövas **före** uppslaget, så att
     * svaret inte beror på vad som finns: en redaktör utan skrivrätt får samma
     * `403` oavsett om guiden existerar, och lär sig alltså ingenting om
     * värdens innehåll genom att försöka. Samma regel som i 126.
     *
     * Ägarskapet gallrar ingenting sedan 127 (`mayTouch`), men det som ligger
     * NEDANFÖR den här raden gör det — registret, guiden, hemligheten — och
     * rollen ska inte kunna hamna efter något av det. Mutationen som fäller
     * det: flytta blocket under `store.get`, och avslaget börjar skilja på
     * vad som finns.
     */
    if (AUTH.on) {
      if (!mayTouch(session)) {
        send(401, { error: "unauthorized" });
        return;
      }

      if (!allows(roleOf(session, ROLES), neededRole(request.method, section))) {
        send(403, { error: "forbidden" });
        return;
      }
    }

    /*
     * Without a register there is nowhere to keep a guide, and saying so is
     * the only honest answer: a 404 would read as "no such guide" and send
     * somebody looking for an id that was never the problem.
     */
    if (!store) {
      send(503, { error: "no-storage" });
      return;
    }

    const held = store.get(`guide/${guideId}`);

    if (!held) {
      // A guide that does not exist is never invented on the spot: an id typed
      // wrong must not quietly become a second guide nobody can find again.
      send(404, { error: "no-guide" });
      return;
    }

    const guide = held.value ?? {};

    /*
     * Hemligheten, på en värd utan leverantör. Den kan inte prövas förrän
     * guiden är läst — hashen bor i den — och det är hela skälet att den står
     * kvar här nere medan rollen flyttat upp. Utan leverantör finns inga
     * roller: den som har hemligheten har hela guiden, som det dokumenterade
     * andra sättet att köra det här.
     */
    if (!AUTH.on) {
      const offered = /^Bearer (.+)$/.exec(request.headers.authorization ?? "")?.[1] ?? "";
      const wanted = String(guide.secretHash ?? "");
      const given = createHash("sha256").update(offered).digest("hex");

      if (
        offered === "" ||
        wanted.length !== given.length ||
        !timingSafeEqual(Buffer.from(given), Buffer.from(wanted))
      ) {
        send(401, { error: "unauthorized" });
        return;
      }
    }

    const versionRows = () =>
      versionsOf()
        .sort((a, b) => (b.value?.savedAt ?? 0) - (a.value?.savedAt ?? 0))
        .map((entry) => ({
          id: entry.value.id,
          ...(typeof entry.value.number === "number" ? { number: entry.value.number } : {}),
          ...(entry.value.label ? { label: entry.value.label } : {}),
          ...(entry.value.note ? { note: entry.value.note } : {}),
          /* Varför posten finns, när den inte är en publicering (131). */
          ...(entry.value.reason ? { reason: entry.value.reason } : {}),
          /*
           * Who froze it, when this host knows. Written out of the session and
           * never out of the request body: the editor cannot know it better
           * than the server, and a field a client can set is a field a client
           * can set to somebody else's name.
           *
           * Absent on a host without a login, and the history then simply has
           * no *av …* line rather than an empty one.
           */
          /*
           * Och **om det är den som frågar**. Samma regel som `draftSavedBy`
           * och `draftEditors`: värden avgör, sidan lyder, och ingen
           * namnjämförelse görs någonstans. Raden behöver det för att kunna
           * säga *din kopia* om en krockfrysning (berättelse 131).
           */
          ...(entry.value.by?.subject
            ? {
                by: {
                  ...entry.value.by,
                  me: entry.value.by.subject === String(session?.subject ?? ""),
                },
              }
            : {}),
          savedAt: entry.value.savedAt,
          current: entry.value.id === guide.current,
        }));

    /**
     * Guidens versioner, med löpnumret på plats.
     *
     * `number` är **vårt**, sätts när versionen fryses och ändras aldrig — inte
     * heller när äldre versioner gallras. Då hoppar numren, och det är hela
     * poängen: *"gå tillbaka till version 3"* ska betyda samma sak i morgon
     * (`docs/LAGRING-KONTRAKT.md`, regel 4).
     *
     * Versioner frysta innan fältet fanns saknar det. De får sitt nummer här,
     * **en gång**, ur `savedAt`-ordningen, och det skrivs tillbaka — en
     * migrering vid läsning, av samma sort som editorns graf-migreringar: äldre
     * data läses som den var och skrivs som den ska vara.
     */
    const versionsOf = () => {
      const entries = store
        .list({ kind: "version" })
        .filter((entry) => entry.value?.guideId === guideId);
      /*
       * Krockfrysningar (131) numreras ALDRIG, inte heller här. De saknar
       * nummer för att de inte är publiceringar — och en migrering som fyller
       * i hålet hade gett dem ett vid nästa läsning och därmed återinfört
       * precis det `POST …/snapshots` undviker.
       */
      const numberable = entries.filter((entry) => entry.value?.reason !== "conflict");
      const missing = numberable.filter((entry) => typeof entry.value?.number !== "number");

      if (missing.length > 0) {
        const byAge = [...numberable].sort((a, b) => (a.value?.savedAt ?? 0) - (b.value?.savedAt ?? 0));

        byAge.forEach((entry, index) => {
          if (typeof entry.value?.number === "number") {
            return;
          }

          entry.value = { ...entry.value, number: index + 1 };
          store.put({ kind: "version", id: entry.value.id, value: entry.value });
        });
      }

      return entries;
    };

    /** A graph, read with the storage limit rather than the submission one. */
    const readGraph = async () => {
      try {
        return { ok: true, value: JSON.parse(await readBody(request, MAX_GRAPH_BYTES)) };
      } catch (error) {
        return { ok: false, tooLarge: Boolean(error?.tooLarge) };
      }
    };

    const isGraph = (value) =>
      value !== null && typeof value === "object" && Array.isArray(value.nodes);

    /**
     * Har någon annan skrivit sedan klienten läste? (berättelse 127)
     *
     * `draftSavedAt` i kroppen är stämpeln klienten fick, tillbakaskickad
     * orörd — `If-Unmodified-Since`-tanken som ett fält, så att kontraktet
     * förblir JSON. Jämförelsen är **likhet och inte ålder**: en tom sträng
     * betyder *det fanns ingen arbetskopia när jag läste*, och en som ändå
     * ligger där är lika mycket någon annans arbete som en nyare är.
     *
     * Ett utelämnat fält skriver utan villkor. Det är den gamla regeln, och
     * den står kvar för en klient som inte känner till den nya — men den är
     * också exakt det fel mutationskontrollen framkallar, så den syns i
     * kontraktet i stället för att tigas ihjäl.
     */
    const conflictWith = (envelope) => {
      if (typeof envelope?.draftSavedAt !== "string") {
        return null;
      }

      const held = String(guide.draftSavedAt ?? "");

      if (envelope.draftSavedAt === held) {
        return null;
      }

      /*
       * **En publicering är ingen krock** (berättelse 131, Johans mätning
       * 20/9).
       *
       * Han publicerade; Anna, som arbetade i samma kopia, fick `409` vid sin
       * nästa sparning och en ruta som sa *Johan sparade 07:12 medan du
       * arbetade* — fast han inte ändrat någonting, bara publicerat det hon
       * bygger på. Slog hon ihop fanns inga skillnader att välja mellan.
       *
       * Orsaken, mätt och inte gissad: publiceringen i sig rör inte stämpeln,
       * men editorn tar bort arbetskopian efteråt (`DELETE …/draft`) — det som
       * publicerats är inte längre opublicerat. Då är `draftSavedAt` tom, och
       * varje stämpel skiljer sig från tomhet.
       *
       * Så värden minns vilken stämpel den kopia hade som frystes.
       * Villkoret är två delar, och båda behövs:
       *
       *  - **ingen arbetskopia finns** (`held === ""`) — finns det en har
       *    någon skrivit sedan dess, och då är det en riktig krock;
       *  - **stämpeln är den publicerades** — någon annans äldre stämpel är
       *    fortfarande en krock.
       *
       * Minnet nollas av nästa `PUT …/draft`, så det gäller bara från
       * publiceringen till att någon skriver igen. Utan det hade en tredje
       * person med en riktigt gammal stämpel sluppit igenom dagen någon kastat
       * ändringarna ovanpå en publicering.
       */
      if (held === "" && envelope.draftSavedAt === String(guide.publishedDraftSavedAt ?? "\u0000")) {
        return null;
      }

      return {
        error: "conflict",
        draftSavedAt: held,
        // Namnet och inte subjektet: raden säger *Nisse Hult sparade 22:51*,
        // och ett opakt id i en skärmbild hjälper ingen.
        ...(guide.draftSavedBy?.name ? { draftSavedBy: { name: guide.draftSavedBy.name } } : {}),
      };
    };

    /* ── Låset: vem arbetar i guiden just nu (berättelse 129) ──────────── */

    /**
     * Låset på den här guiden om det lever, annars `null`.
     *
     * En funktion och inte ett värde: den läses både av vägarna nedan och av
     * `GET /guides/<id>`, och emellan dem hinner en `store.put` ändra svaret.
     */
    const lockNow = () => (LOCKS_ON ? liveLock(guide) : null);

    if (section === "lock") {
      /*
       * En värd utan leverantör har ingen att låsa åt.
       *
       * Hemligheten per guide är hela legitimationen där, och den är en
       * *guides* legitimation och inte en persons — två flikar med samma
       * hemlighet är samma "vem". Ett lås mellan dem hade varit ett lås mot
       * sig själv, alltså ett tillstånd som aldrig kan betyda något.
       *
       * `404` och inte `501`, av samma skäl som `/auth/*`: för den här värden
       * finns vägen genuint inte, och sidan frågar innan den ritar något.
       */
      if (!AUTH.on || !LOCKS_ON) {
        send(404, { error: "no-lock" });
        return;
      }

      const subject = String(session?.subject ?? "");
      const held = lockNow();

      if (request.method === "DELETE") {
        /*
         * Man släpper sitt eget lås, aldrig någon annans.
         *
         * Sidan gör det på `pagehide` och vid *Guider*-länken, alltså i ett
         * ögonblick då den inte kan invänta ett svar. Att den som råkar ha
         * guiden öppen då skulle kunna släppa Annas lås vore ett övertagande
         * utan dialog — och svaret bär därför det lås som faktiskt ligger
         * kvar, hellre än ett `null` som vore osant.
         *
         * `?window=` av samma skäl som `window` i kroppen ovan: den som stänger
         * fliken på jobbdatorn ska inte släppa låset hon tog på den hemma.
         * Utelämnad matchar vilket fönster som helst — en klient från före
         * fältet släpper sitt eget lås precis som förut.
         */
        const window = url.searchParams.get("window") ?? "";

        if (held && held.subject === subject && (window === "" || held.window === window)) {
          const { lock, ...rest } = guide;

          void lock;
          store.put({ kind: "guide", id: guideId, value: rest });
          send(200, { lock: null });
          return;
        }

        send(200, { lock: held ? publicLock(held, subject) : null });
        return;
      }

      if (request.method !== "POST") {
        send(404, { error: "no-route" });
        return;
      }

      const wish = await readJson(request, MAX_GRAPH_BYTES);
      const window = String(wish?.window ?? "");

      /*
       * Någon annan — eller något annat fönster — håller ett levande lås.
       *
       * `409` med låset i svaret, av samma skäl som krocken i berättelse 127
       * bär `draftSavedBy`: ett avslag som inte namnger den andre lämnar
       * redaktören med en sida som inte får arbeta och ingen att fråga.
       *
       * Att **fönstret** och inte bara subjektet jämförs är vad som gör en
       * förnyelse till en förnyelse. En sida som bara jämförde subjekt hade
       * tagit tillbaka sitt eget lås från sin egen andra dator vid nästa
       * tangenttryck, i all evighet — se `takenLock`.
       */
      if (held && (held.subject !== subject || held.window !== window)) {
        if (wish?.takeOver !== true) {
          send(409, { error: "locked", lock: publicLock(held, subject) });
          return;
        }

        /*
         * Och övertagandet är publicerarens (berättelse 128, stegen).
         *
         * Skälet står i 129: att ta över är det enda i editorn som kan kosta
         * någon annan arbete, och det ska ligga hos dem som också får
         * publicera. En redaktör väntar ut låset eller frågar.
         *
         * **Sitt eget lås tar man alltid över**, från vilken dator som helst:
         * det kostar ingen annan något, och alternativet vore att en redaktör
         * som bytt dator fick vänta ut sig själv.
         *
         * `403` sedan A8 (22/9): identiteten är giltig — redaktören är
         * inloggad och har rätt att vara här — och det är rollen som inte
         * räcker. `401` sa tidigare att autentiseringen var problemet, och
         * fick klienten att erbjuda en inloggning som ger samma svar igen.
         *
         * Ingenting avslöjas av det: att ett lås finns har svaret redan sagt
         * med `409` en rad upp, och vem som håller det står i det svaret.
         */
        if (held.subject !== subject && !allows(roleOf(session, ROLES), "publisher")) {
          send(403, { error: "forbidden" });
          return;
        }
      }

      const taken = takenLock({
        held,
        subject,
        window,
        name: String(session?.name ?? ""),
        minutes: LOCK_MINUTES,
      });

      store.put({ kind: "guide", id: guideId, value: { ...guide, lock: taken } });
      send(200, { lock: publicLock(taken, subject) });
      return;
    }

    /* ── Arbetsanteckningen (berättelse 130) ───────────────────────────── */

    /*
     * *Inte klar — juristen ska läsa resultattexterna.*
     *
     * En mening från en människa till nästa, på arbetskopian. Johan: *"Om inte
     * Anna hade tänkt klart och inte vill att det skulle publiceras?"*
     * Versionerna skyddar innehållet och krocken skyddar arbetet; det som
     * saknades var **avsikten**.
     *
     * ## Varför en egen väg och inte ett fält på `PUT …/draft`
     *
     * Den som skriver anteckningen ändrar inte guiden. Ett fält på
     * arbetskopians väg hade betytt att en mening kräver en hel graf — och att
     * den som skriver den samtidigt skriver över vad någon annan hunnit spara,
     * eller möts av en `409` om något om en sak hen inte rörde. Vägen är
     * fyrtio rader och kontraktet en rad längre; alternativet hade varit
     * billigare att skriva och dyrare att förklara.
     *
     * ## Varför låset inte krävs
     *
     * Samma regel som överallt annars här: **låset är inte skyddet**
     * (`docs/LAGRING-KONTRAKT.md`, regel 3). Sidan erbjuder anteckningen till
     * den som håller guiden, för det är hen som vet vad som inte är klart —
     * men ett värdkrav på låset hade gjort låset till en rättighet, och den
     * dagen låset löper ut mitt i en mening vore meningen omöjlig att skriva.
     *
     * ## Vem som får ta bort
     *
     * Den som skrev den, och en publicerare. Att ta bort någon annans
     * anteckning är att ta bort hens invändning, och det hör till samma rung
     * som att publicera förbi den. En tom text ÄR borttagandet: två vägar för
     * *det gäller inte längre* hade varit en väg för mycket.
     */
    if (section === "note") {
      /*
       * En värd utan leverantör har ingen att skriva under. Samma svar som
       * låset ger, och av samma skäl: för den värden finns vägen genuint inte.
       */
      if (!AUTH.on) {
        send(404, { error: "no-note" });
        return;
      }

      if (request.method !== "PUT") {
        send(404, { error: "no-route" });
        return;
      }

      const subject = String(session?.subject ?? "");
      const wish = await readJson(request, MAX_GRAPH_BYTES);
      /*
       * En rad, och värdens form på den. Radbrytningar blir mellanslag och
       * längden kapas: fältet ritas på fyra ytor — raden, listan, granskningen
       * och Ta över-rutan — och en anteckning som är ett stycke är ett stycke
       * på alla fyra.
       */
      const text = String(wish?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
      const held = guide.draftNote ?? null;

      if (
        held?.text &&
        String(held.by?.subject ?? "") !== subject &&
        !allows(roleOf(session, ROLES), "publisher")
      ) {
        send(401, { error: "unauthorized" });
        return;
      }

      if (text === "") {
        const { draftNote, ...withoutNote } = guide;

        void draftNote;
        store.put({ kind: "guide", id: guideId, value: withoutNote });
        send(200, { draftNote: null });
        return;
      }

      /*
       * Tiden och namnet är värdens, som varenda annan tid i det här
       * kontraktet. En klient som skickar dem ska ignoreras: två webbläsare
       * har två klockor, och ett namn en klient sätter är ett namn en klient
       * kan sätta till någon annans.
       */
      const note = { text, at: new Date().toISOString(), by: whoOf(session) };

      store.put({ kind: "guide", id: guideId, value: { ...guide, draftNote: note } });
      send(200, { draftNote: publicNote(note, subject) });
      return;
    }

    if (request.method === "GET" && section === undefined) {
      /*
       * `?since=<stämpel>` — har arbetskopian ändrats sedan dess?
       *
       * Den som står i läsläge medan någon annan arbetar frågar om och om
       * igen (berättelse 129, tillägget 19/9). Utan den här frågan hade varje
       * runda burit hela guiden — en graf på tiotals kilobyte var tionde
       * sekund, för att svara *nej, inget har hänt*.
       *
       * Jämförelsen är **likhet och inte ålder**, samma regel som den
       * villkorade skrivningen: stämpeln är en identitet på en arbetskopia,
       * inte en position på en tidslinje. En klient som skickar en stämpel vi
       * aldrig haft får guiden — det är det säkra svaret.
       *
       * Utelämnat `since` betyder *ge mig guiden*, som förut. Fältet är
       * valfritt i båda ändar: en klient som inte känner till det frågar som
       * den alltid gjort, och en värd som inte svarar `204` svarar med guiden,
       * vilket också är sant.
       */
      const since = url.searchParams.get("since");

      if (since !== null && since === String(guide.draftSavedAt ?? "")) {
        send(204);
        return;
      }

      const held = lockNow();

      send(200, {
        current: guide.current ?? "",
        /*
         * Låset följer med guiden, så sidan vet innan den ritar något om den
         * ska öppna för redigering eller för läsning (berättelse 129). Utan
         * fältet alls när ingen håller det — ett `null` att tolka är en till
         * sak att tolka.
         */
        ...(held ? { lock: publicLock(held, String(session?.subject ?? "")) } : {}),
        /*
         * Anteckningen följer med guiden och inte med arbetskopian: den som
         * öppnar en guide vars arbetskopia just publicerats ska ändå se en
         * anteckning som skrivits efteråt. (I praktiken tas den bort vid
         * publicering — men det är publiceringens beslut, inte det här
         * svarets.)
         */
        ...(() => {
          const note = publicNote(guide.draftNote, String(session?.subject ?? ""));

          return note ? { draftNote: note } : {};
        })(),
        ...(guide.draft
          ? {
              draft: guide.draft,
              draftSavedAt: guide.draftSavedAt,
              /*
               * Vilkas ändringar arbetskopian innehåller sedan förra versionen
               * (berättelse 130). Bara namn och tid — granskningen skriver
               * *Anna Andersson (08:29) och du*, och `me` är värdens svar.
               */
              ...(() => {
                const editors = publicEditors(guide.draftEditors, String(session?.subject ?? ""));

                return editors.length > 0 ? { draftEditors: editors } : {};
              })(),
              /*
               * Vem som skrev den — och om det var den som frågar.
               *
               * `me` avgörs här för att sidan aldrig får veta sitt eget
               * subjekt: den vet vad den heter, och två Anna Andersson på en
               * kommun hade gjort ett namnjämförande till fel svar för någon.
               * Raden visar namnet bara när `me` är falskt.
               */
              ...(guide.draftSavedBy?.name
                ? {
                    draftSavedBy: {
                      name: guide.draftSavedBy.name,
                      me: guide.draftSavedBy.subject === String(session?.subject ?? ""),
                    },
                  }
                : {}),
            }
          : {}),
        versions: versionRows(),
      });
      return;
    }

    if (request.method === "PUT" && section === "draft") {
      const body = await readGraph();
      /*
       * Kuvertet, och grafen inuti det (berättelse 127).
       *
       * Kroppen VAR grafen fram till villkoret; en kropp som är en graf är
       * alltså en klient från före det, och den skriver utan villkor precis
       * som förut. Att skilja dem åt på `nodes` och inte på ett versionsfält
       * är hela skillnaden mellan ett tillägg och en flaggdag.
       */
      const envelope = body.ok && !isGraph(body.value) ? body.value : null;
      const sentGraph = envelope ? envelope.graph : body.value;

      if (!body.ok || !isGraph(sentGraph)) {
        send(body.tooLarge ? 413 : 400, { error: "graph" });
        return;
      }

      const clash = conflictWith(envelope);

      if (clash) {
        send(409, clash);
        return;
      }

      const savedAt = new Date().toISOString();

      // One working copy, overwritten. Nothing is stacked here; a version is
      // the deliberate act, and it has its own route.
      //
      // The title follows the working copy, because *Guider* is searched by
      // title and a list that shows what a guide was called last week is a
      // list somebody cannot find anything in. An empty title leaves the old
      // one standing rather than blanking the row.
      const title = titleOf(sentGraph);
      const who = whoOf(session);

      store.put({
        kind: "guide",
        id: guideId,
        value: {
          ...guide,
          ...(title === "" ? {} : { name: title }),
          /*
           * Och minnet av den publicerade kopians stämpel är förbrukat: det
           * finns en arbetskopia igen, och från och med nu är en äldre stämpel
           * en riktig krock (berättelse 131, 20/9). Se `conflictWith`.
           */
          publishedDraftSavedAt: undefined,
          draft: sentGraph,
          draftSavedAt: savedAt,
          // Båda, och av samma sessionsuppgift: den ena svarar *vem håller på
          // med arbetskopian*, den andra *vem rörde guiden sist* — och den
          // andra frågan ställs av listan, som aldrig ser arbetskopian.
          ...(who ? { draftSavedBy: who, updatedBy: who } : {}),
          /*
           * Och vilkas ändringar arbetskopian innehåller (berättelse 130).
           *
           * En rad per person med hens senaste sparning — granskningen frågar
           * *vems ändringar publicerar jag*, och det är en lista på namn.
           * Utan inloggning finns ingen att skriva, och då finns inte fältet.
           */
          ...(who ? { draftEditors: withEditor(guide.draftEditors, who, savedAt) } : {}),
        },
      });
      send(200, { savedAt });
      return;
    }

    if (request.method === "DELETE" && section === "draft") {
      /*
       * Att kasta arbetskopian är att säga att det inte FINNS någon — inte att
       * skriva en som råkar vara lika med den publicerade. Skillnaden är hela
       * skälet till att vägen finns: sidan frågar `GET /guides/<id>` om det
       * finns opublicerade ändringar, och en tom arbetskopia som ändå ligger
       * där svarar fel på den frågan.
       *
       * Att kasta en som inte finns är också ett ja. En redaktör som trycker
       * *Kasta ändringarna* två gånger har fått sin vilja igenom båda
       * gångerna, och ett fel i andra trycket vore ett fel om ingenting.
       */
      const { draft, draftSavedAt, draftSavedBy, ...rest } = guide;

      void draft;
      void draftSavedAt;
      // Vem som skrev den följer med den: en *sparad av* om en arbetskopia som
      // inte finns är en upplysning om ingenting.
      void draftSavedBy;

      const whoDiscarded = whoOf(session);

      store.put({
        kind: "guide",
        id: guideId,
        value: { ...rest, ...(whoDiscarded ? { updatedBy: whoDiscarded } : {}) },
      });
      send(200, { draft: null });
      return;
    }

    /*
     * ── Frysning vid krock (berättelse 131) ────────────────────────────────
     *
     * *"Kan vi helt undvika bortfall?"* (Johan 19/9). Sammanslagningen tar bort
     * bortfallet överallt utom där två rört samma sak — där måste en text
     * vinna. Det sista bortfallet tas bort här: **innan den sammanslagna
     * grafen skrivs fryser värden båda kopiorna**, och den text som förlorade
     * valet ligger kvar i sin egen post. Historiken är oföränderlig och
     * *Återställ* finns.
     *
     * ## Varför en egen väg och inte en flagga på `POST …/versions`
     *
     * Mätt 19/9, och det avgörande är **rollen**: `versions` kräver publicerare
     * (`neededRole`), för att frysa en version är att säga *det här är vad
     * besökarna får*. En krockfrysning säger motsatsen — *vi är inte överens
     * än* — och måste gå för den som just skrev i arbetskopian, alltså en
     * redaktör. En flagga hade krävt att rollkontrollen ovanför lärde sig
     * läsa kroppen, och en rollkontroll som beror på innehållet i en kropp är
     * en rollkontroll man får läsa två gånger.
     *
     * Och fyra saker till skiljer, som alla hade blivit villkor inne i
     * publiceringen: den avvisar inte på stämpeln (att frysa något man inte
     * sett är poängen här), den flyttar inte `current`, den nollställer inte
     * 130:s avsiktsfält, och den numrerar inte.
     *
     * ## Varför ingen numrering
     *
     * `number` är publiceringarnas namn — *"gå tillbaka till version 3"* ska
     * betyda samma sak i morgon (kontraktets regel 4). Två nya nummer per
     * krock hade gjort de flesta nummer till något som aldrig visats för en
     * besökare. Raden får i stället en `label`, och `guide-versions` rubricerar
     * ur den när numret saknas.
     *
     * ## Varför etiketten inte bär ett klockslag
     *
     * Berättelsen skrev *Sparad vid krock 09:41*. Mätt 17/9: en väggklocka
     * myntad här myntas i SERVERNS tidszon, medan listan ritar `savedAt` i
     * LÄSARENS — en fryst version sa 13:05 som namn och 15:05 i kolumnen
     * bredvid. Etiketten säger därför bara VAD posten är; NÄR står i kolumnen,
     * i läsarens klocka, en gång.
     */
    if (request.method === "POST" && section === "snapshots") {
      const body = await readGraph();

      if (!body.ok || !isGraph(body.value?.graph)) {
        send(body.tooLarge ? 413 : 400, { error: "graph" });
        return;
      }

      /*
       * **Vems kopia är det här?**
       *
       * Sammanslagningen fryser två grafer, och den som trycker på knappen
       * skriver båda. Att sätta `by` ur sessionen på båda gav två rader med
       * samma namn — Johan mätte det 20/9: hans eget arbete stod som Annas,
       * för hon var den som slog ihop.
       *
       * Klienten säger därför **vilken sida** kopian är, aldrig vems den är.
       * Namnet slår värden upp själv: `mine` är sessionen, `theirs` är
       * `draftSavedBy` — värdens egen uppgift om vem som senast skrev i
       * arbetskopian. Ett fält en klient sätter är ett fält en klient kan
       * sätta till någon annans namn (berättelse 126); ett val mellan två
       * namn värden redan har är något annat.
       */
      const side = body.value?.side === "theirs" ? "theirs" : "mine";
      const owner =
        side === "theirs"
          ? guide.draftSavedBy?.subject
            ? { subject: guide.draftSavedBy.subject, name: String(guide.draftSavedBy.name ?? "") }
            : null
          : session?.subject
            ? { subject: session.subject, name: String(session.name ?? "") }
            : null;

      const snapshotId = `v-${randomUUID()}`;
      const snapshot = {
        id: snapshotId,
        guideId,
        /*
         * Varför posten finns, som värdens eget ord. En klient kan inte sätta
         * det: en post som säger sig vara en krockfrysning ska ha blivit till
         * genom att någon krockade.
         */
        reason: "conflict",
        /*
         * **Ingen etikett.** Den byggs av editorn ur `reason` och `by`, för
         * raden ska kunna säga *din kopia* — och vem *du* är beror på vem som
         * läser. En lagrad etikett hade sagt *din* om någon annans arbete
         * första gången en kollega öppnade historiken.
         */
        ...(owner ? { by: owner } : {}),
        savedAt: Date.now(),
        /*
         * Grafen ordagrant, utan `meta.versionId`. Posten är ingen version en
         * besökare kan få, så ett ärende ska aldrig kunna peka på den som sin
         * `serviceVersion` (berättelse 123).
         */
        graph: body.value.graph,
      };

      store.put({ kind: "version", id: snapshot.id, value: snapshot });

      /*
       * Guiden rörs INTE: inte `current`, inte `name`, inte `updatedBy`, och
       * inte 130:s avsiktsfält. Ingen har publicerat något, och ingen har ens
       * sparat — två kopior lades undan medan någon bestämmer sig.
       */
      send(200, {
        version: {
          id: snapshot.id,
          reason: snapshot.reason,
          ...(snapshot.by
            ? { by: { ...snapshot.by, me: snapshot.by.subject === String(session?.subject ?? "") } }
            : {}),
          savedAt: snapshot.savedAt,
          current: false,
        },
      });
      return;
    }

    if (request.method === "POST" && section === "versions") {
      const body = await readGraph();

      if (!body.ok || !isGraph(body.value?.graph)) {
        send(body.tooLarge ? 413 : 400, { error: "graph" });
        return;
      }

      /*
       * Publiceringen går samma väg som arbetskopian: att frysa något någon
       * annan hunnit ändra är att publicera en text man inte har sett.
       */
      const versionClash = conflictWith(body.value);

      if (versionClash) {
        send(409, versionClash);
        return;
      }

      const savedAt = Date.now();
      const versionOwnId = `v-${randomUUID()}`;
      /*
       * `max + 1`, inte `antal + 1`. Skillnaden syns först när något gallrats:
       * med antalet skulle den fjärde frysningen efter en borttagen version bli
       * en andra "3", och två versioner med samma nummer är värre än ett hopp.
       */
      const number =
        versionsOf().reduce((high, entry) => Math.max(high, entry.value?.number ?? 0), 0) + 1;
      const version = {
        id: versionOwnId,
        guideId,
        number,
        /*
         * Inget namn. En väggklocka myntad här myntas i SERVERNS tidszon,
         * medan listan ritar `savedAt` i LÄSARENS — en fryst version sa
         * 13:05 som namn och 15:05 i kolumnen bredvid (mätt 17/9). En version
         * ingen döpt heter när den sparades, och det säger `<guide-versions>`
         * en gång, ur `savedAt`.
         */
        ...(typeof body.value.note === "string" && body.value.note !== ""
          ? { note: body.value.note }
          : {}),
        /*
         * Vem som frös den, ur sessionen och aldrig ur kroppen.
         *
         * Editorn skickar det aldrig och ska inte kunna: den vet det inte
         * bättre än servern, och ett fält en klient sätter är ett fält en
         * klient kan sätta till någon annans namn. Utelämnat på en värd utan
         * inloggning — då finns ingen att skriva (berättelse 126, tillägget).
         */
        ...(session?.subject
          ? { by: { subject: session.subject, name: String(session.name ?? "") } }
          : {}),
        savedAt,
        /*
         * Versionens eget id skrivs in i grafen den fryser. Ett ärende som
         * besvaras av den här versionen bär då `serviceVersion: "v-…"`, som
         * en mottagare kan slå upp hos värden — en tidsstämpel går bara att
         * jämföra (berättelse 123 och 124).
         */
        graph: {
          ...body.value.graph,
          meta: { ...(body.value.graph.meta ?? {}), versionId: versionOwnId },
        },
      };

      store.put({ kind: "version", id: version.id, value: version });

      /*
       * The first version anybody freezes is what a visitor gets; after that
       * the pointer only moves when somebody says so. The title follows here
       * too — a guide published without ever having a draft saved would
       * otherwise sit nameless in *Guider*.
       */
      const frozenTitle = titleOf(body.value.graph);
      /*
       * Publiceringen nollställer båda 130-fälten, och av samma skäl: de
       * handlade om **arbetskopian sedan förra versionen**, och den är nu
       * publicerad.
       *
       * *Inte klar — juristen ska läsa* är sant till den dagen någon
       * publicerar; efteråt är det en lapp på en färdig text, och en lapp som
       * står kvar efter att ha slutat gälla är värre än ingen lapp.
       *
       * Fälten tas BORT och sätts inte till tomma: en tom lista och ett tomt
       * fält är två sätt att säga samma sak, och det ena hade blivit kvar i en
       * post ingen tittar i.
       */
      const { draftEditors, draftNote, ...guideWithoutDraftNotes } = guide;

      void draftEditors;
      void draftNote;

      const guideAfter = {
        ...guideWithoutDraftNotes,
        /*
         * Vilken stämpel den frysta kopian hade (berättelse 131, 20/9).
         *
         * Editorn tar bort arbetskopian efter en publicering, och utan det här
         * minnet blev varje kollega som byggde på samma kopia avvisad med en
         * krockruta om en ändring som aldrig gjorts. Se `conflictWith`.
         *
         * Tom sträng lagras aldrig: en guide som publicerats utan arbetskopia
         * har ingen stämpel att minnas, och `""` hade matchat en klient som
         * skickar ett tomt villkor — alltså precis den som inte vill villkora
         * något.
         */
        ...(String(guide.draftSavedAt ?? "") === ""
          ? {}
          : { publishedDraftSavedAt: String(guide.draftSavedAt) }),
        ...(frozenTitle === "" ? {} : { name: frozenTitle }),
        ...(guide.current ? {} : { current: version.id }),
        // Att frysa en version är också att röra guiden, så listan säger det.
        ...(version.by ? { updatedBy: version.by } : {}),
      };

      store.put({ kind: "guide", id: guideId, value: guideAfter });

      send(200, {
        version: {
          id: version.id,
          number: version.number,
          ...(version.note ? { note: version.note } : {}),
          ...(version.by ? { by: version.by } : {}),
          savedAt: version.savedAt,
          current: !guide.current,
        },
      });
      return;
    }

    if (request.method === "GET" && section === "versions" && versionId) {
      const found = store.get(`version/${versionId}`);

      // A version of another guide is not this guide's version: without the
      // check, anybody holding one secret could read every guide on the host.
      if (!found || found.value?.guideId !== guideId) {
        send(404, { error: "no-version" });
        return;
      }

      send(200, { graph: found.value.graph });
      return;
    }

    if (request.method === "POST" && section === "current") {
      const body = await readGraph();
      const wantedId = body.ok ? body.value?.versionId : "";
      const found = typeof wantedId === "string" ? store.get(`version/${wantedId}`) : null;

      if (!found || found.value?.guideId !== guideId) {
        // Pointing at nothing is how a guide goes dark for its visitors.
        send(404, { error: "no-version" });
        return;
      }

      store.put({ kind: "guide", id: guideId, value: { ...guide, current: wantedId } });
      send(200, { current: wantedId });
      return;
    }

    send(405, { error: "no-method", message: `${request.method} is not allowed on ${url.pathname}` });
    return;
  }

  /*
   * Fortfarande 404, och fortfarande `no-route`. `/` ÄR ingen väg, och att
   * svara 200 där hade gjort den till en — då skulle den stå i `ROUTES`, i
   * kontraktet, och i varje övervakning som läser 200 som "tjänsten mår bra".
   * Den här servern kontrollerar ingenting när den svarar: den vet inte om
   * registret går att läsa. Ett hälsolöfte den inte kan hålla är värre än
   * inget.
   *
   * Versionen rider med i samma svar, för det är svaret en värd redan får när
   * den famlar efter en adress — och det är precis då frågan "vilken version
   * kör där ute?" ställs.
   */
  send(404, {
    error: "no-route",
    message: `no route for ${request.method} ${url.pathname}`,
    version: VERSION,
    finns: ROUTES,
  });
});

export { server, PORT };

server.listen(PORT, () => {
  // Quiet when something else started it, loud when a person did.
  if (process.env.FLOWWEAVER_TYST) {
    return;
  }

  console.log(`${submission ? "Inlämningsmottagare och lagring" : "Lagringsvärd"} (referens) på http://localhost:${PORT}`);
  for (const line of submission
    ? submission.startupLines()
    : ["  inlämning   av — submission-routes.mjs finns inte här (FlowWeaver PRO)"]) {
    console.log(line);
  }

  console.log(
    `  register    ${store ? store.file : "av (sätt FLOWWEAVER_DB för att skriva ned ärendena)"}`,
  );
  console.log(
    `  CORS        ${ORIGINS.length ? ORIGINS.join(", ") : "av (sätt FLOWWEAVER_ORIGIN för att öppna för en sida)"}`,
  );
  console.log(
    `  inloggning  ${
      AUTH.on
        ? `OIDC mot ${AUTH.issuer} — hemligheten per guide avvisas`
        : "av — hemligheten per guide gäller (sätt OIDC_* i .env för inloggning)"
    }`,
  );

  /*
   * Låsets livslängd, och bara när det finns någon att låsa åt (berättelse
   * 129). Utan inloggning finns inga personer, alltså inget lås att sätta tid
   * på — och en rad om en inställning som inte gäller är en rad någon tror på.
   */
  if (AUTH.on) {
    console.log(
      LOCKS_ON
        ? `  lås         ${LOCK_MINUTES} min utan aktivitet, sedan ledigt av sig självt (LOCK_MINUTES i .env)`
        : "  lås         av (LOCK_MINUTES=0) — låsvägarna svarar 404, som hos en värd utan lås",
    );
  }

  /*
   * Rollerna, räknade och inte uppräknade (berättelse 128).
   *
   * Antalet och inte namnen: raden ska gå att läsa i en skärmbild, och ett
   * subjekt är värdens egen identifierare för en person. Den som behöver veta
   * vem som är vad läser `.env`, som är `600` och ägs av tjänsten.
   *
   * Noll säger sig självt, och det är hela skälet att raden finns: en värd med
   * inloggning och utan mappning är en värd där **alla är läsare** och ingen
   * kan spara — vilket annars upptäcks som att editorn inte fungerar.
   */
  if (AUTH.on) {
    const namedSubjects = ROLES.bySubject.size;
    const namedGroups = ROLES.byGroup.size;

    console.log(
      `  roller      ${
        namedSubjects + namedGroups === 0
          ? "ingen mappning — ALLA inloggade är läsare och kan inte spara (sätt ROLES eller ROLE_* i .env)"
          : `${namedSubjects} person${namedSubjects === 1 ? "" : "er"} och ${namedGroups} grupp${
              namedGroups === 1 ? "" : "er"
            } namngivna; alla andra är läsare`
      }`,
    );
  }

  // Halvt konfigurerat säger sig självt, som Resend gör. Ett tyst fallback till
  // hemligheten vore precis det fel ingen hade letat efter.
  if (AUTH.fault) {
    console.log(`  OBS         ${AUTH.fault}`);
  }
});
