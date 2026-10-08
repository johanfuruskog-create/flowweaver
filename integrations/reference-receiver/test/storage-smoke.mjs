/**
 * The storage contract, driven over real HTTP against the reference host.
 *
 *     npm run smoke:storage        # startar servern själv, ~5 s
 *
 * ## What this covers that nothing else does
 *
 * `docs/LAGRING-KONTRAKT.md` describes five routes a host answers so that a
 * guide lives with the host instead of in one browser. `LocalStorageGraphStore`
 * answers the same six questions without a socket, and its tests prove the
 * model — one working copy, versions that never change, a pointer that moves.
 * None of that says whether the *server* keeps the same promises: a status
 * line, JSON across a wire, a secret that is checked, a graph that is too big.
 *
 * ## The refusals are the point
 *
 * A guide that saves is the easy half. What matters is what happens when
 * something is wrong, because that is where a storage either protects somebody
 * else's work or quietly loses it:
 *
 *  - **a guide that does not exist** is 404 and not an empty guide invented on
 *    the spot — an id typed wrong must not become a second, silently separate
 *    guide;
 *  - **the wrong secret** is 401 and says nothing about what was wrong;
 *  - **a version that does not exist** is 404 rather than the current one,
 *    because "go back to last Tuesday" answered with today is worse than an
 *    error;
 *  - **a graph too large** is refused at 256 kB — ten times the biggest guide
 *    anybody has built here — rather than filling a disk a visitor's errands
 *    also live on.
 *
 * ## What it cannot see, and what does
 *
 * **A browser.** `fetch` in node ignores CORS, so this file was green while
 * the preflight refused `PUT` — the working copy's only route — and the
 * server's own log looked empty. The preflight is checked below since 17/9,
 * but the class of fault stays: a policy, a header, a page that will not start.
 * `npm run smoke:guide-storage` is the run that puts a real browser on the
 * real page, and it found two faults on its first outing: that one, and a
 * first version nobody could create because a list with no rows has no *Spara*
 * to press.
 *
 * ## What it deliberately does not do
 *
 * Touch the deployed server. It starts its own on a throwaway database, like
 * `smoke:receiver`, and never reads `.env`.
 */
import { spawn, spawnSync } from "node:child_process";

// Registret öppnas direkt i provet för att härma en värds egen gallring: den är
// värdens regel, inte en väg i kontraktet, och servern erbjuder ingen.
import { SESSION_COOKIE, sign } from "../auth.mjs";
import { LOCK_MINUTES_DEFAULT, lockMinutes } from "../locks.mjs";
import { entryKey, openStore } from "../store.mjs";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SERVER = join(here, "..", "server.mjs");
const GUIDES = join(here, "..", "guides.mjs");
const PORT = 4323;
const BASE = `http://localhost:${PORT}`;

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

/* ── The throwaway world ───────────────────────────────────────────────── */

const work = mkdtempSync(join(tmpdir(), "flowweaver-storage-"));
const dbFile = join(work, "flowweaver.sqlite");
const outbox = join(work, "outbox");

const env = {
  ...process.env,
  FLOWWEAVER_TYST: "1",
  FLOWWEAVER_IGNORE_ENV_FILE: "1",
  FLOWWEAVER_DB: dbFile,
  OUTBOX_DIR: outbox,
  /*
   * En värd som en sida ska kunna prata med måste ha ett ursprung, och utan
   * det svarar servern inga CORS-huvuden alls — då mäter förhandsförfrågan
   * ingenting och kontrollerna längre ned går röda av fel skäl. Adressen är
   * dev-serverns, för det är där sidan körs när någon provar för hand.
   */
  FLOWWEAVER_ORIGIN: "http://localhost:5173",
};

/** `guides.mjs`, exactly as the runbook has somebody run it. */
const guides = (...args) => {
  const run = spawnSync(process.execPath, [GUIDES, ...args], { encoding: "utf8", env });

  return { code: run.status, out: run.stdout ?? "", err: run.stderr ?? "" };
};

const server = spawn(process.execPath, [SERVER, String(PORT)], { env, stdio: "ignore" });
/**
 * Den andra servern, med inloggning på — startas först när låset ska mätas
 * (berättelse 129). Deklarerad här för att `finally` ska kunna ta den även om
 * något faller innan den startat.
 */
let lockServer = null;
let oläsberServer = null;

/*
 * Up means "answers HTTP at all", asked of a storage route. It used to ask
 * `/recipients`, which is FlowWeaver PRO's (submission-routes.mjs) and absent
 * from the open storage host — so this smoke could not run where it matters
 * most (open-core step 5, 2026-10-06). `/guides` answers 401 or 200; any
 * answer is a server that started.
 */
async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(`${BASE}/guides`)).status > 0) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return false;
}

/** A guide the editor's door accepts, small and real. */
const graph = (title) => ({
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "question",
      position: { x: 0, y: 0 },
      data: { title, options: [{ id: "ja", label: "Ja", value: "ja" }] },
    },
  ],
  connections: [],
});

const call = async (method, path, { body, secret } = {}) => {
  const answer = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(secret ? { authorization: `Bearer ${secret}` } : {}),
    },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
  const text = await answer.text();

  return {
    status: answer.status,
    text,
    json: (() => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })(),
  };
};

try {
  if (!(await waitForServer())) {
    check("servern svarar", false, "gav aldrig svar");
    throw new Error("servern startade inte");
  }

  /* ── A guide is created at the host, and the secret is said once ──────── */

  const created = guides("new", "--note", "Bostadsbidrag");
  const id = created.out.match(/^id:\s*(\S+)$/m)?.[1] ?? "";
  const secret = created.out.match(/^hemlighet:\s*(\S+)$/m)?.[1] ?? "";

  check(
    "guides.mjs new myntar en guide och säger hemligheten en gång",
    created.code === 0 && /^[0-9a-f-]{36}$/.test(id) && secret.length >= 32,
    `${created.out.trim().split("\n").slice(0, 3).join(" | ")}`,
  );
  check(
    "hemligheten ligger hashad, aldrig i klartext",
    !guides("show", id).out.includes(secret),
    guides("show", id).out.split("\n")[0] ?? "",
  );

  /* ── The five routes ─────────────────────────────────────────────────── */

  const empty = await call("GET", `/guides/${id}`, { secret });

  check(
    "en ny guide har inga versioner och ingen arbetskopia",
    empty.status === 200 && empty.json?.versions?.length === 0 && empty.json?.draft === undefined,
    `${empty.status} ${empty.text.slice(0, 120)}`,
  );

  const draft = await call("PUT", `/guides/${id}/draft`, { body: graph("Utkast ett"), secret });

  check(
    "arbetskopian skrivs och kvitteras med en tid",
    draft.status === 200 && typeof draft.json?.savedAt === "string",
    `${draft.status} ${draft.text.slice(0, 120)}`,
  );

  await call("PUT", `/guides/${id}/draft`, { body: graph("Utkast två"), secret });

  const afterTwo = await call("GET", `/guides/${id}`, { secret });

  check(
    "arbetskopian är EN och skrivs över",
    afterTwo.json?.draft?.nodes?.[0]?.data?.title === "Utkast två",
    JSON.stringify(afterTwo.json?.draft?.nodes?.[0]?.data?.title),
  );

  /*
   * QA (uppdrag 22/9, mätning 2a): autosparen skriver bara arbetskopian.
   * Tio sparningar i rad ska ge noll nya versioner — vägarna är helt
   * skilda i kontraktet, men ingenting hittills har provat det i antal.
   *
   * Mutationen som fäller det: låt `PUT …/draft` även skriva en post av
   * `kind: "version"` (t.ex. en rad som förväxlar `saveDraft` med
   * `saveVersion` i en framtida omskrivning) — då räknar kontrollen
   * nedan mer än noll.
   */
  const versionerFöreTioSparningar = (await call("GET", `/guides/${id}`, { secret })).json
    ?.versions?.length;

  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await call("PUT", `/guides/${id}/draft`, { body: graph(`Autospar ${i}`), secret });
  }

  const efterTioSparningar = await call("GET", `/guides/${id}`, { secret });

  check(
    "tio autosparningar ger noll nya versioner",
    efterTioSparningar.json?.versions?.length === versionerFöreTioSparningar &&
      efterTioSparningar.json?.draft?.nodes?.[0]?.data?.title === "Autospar 9",
    JSON.stringify({
      före: versionerFöreTioSparningar,
      efter: efterTioSparningar.json?.versions?.length,
      titel: efterTioSparningar.json?.draft?.nodes?.[0]?.data?.title,
    }),
  );

  const frozen = await call("POST", `/guides/${id}/versions`, {
    body: { graph: graph("Version ett"), note: "Före regeländringen" },
    secret,
  });
  const versionId = frozen.json?.version?.id ?? "";

  check(
    "en version fryses och får ett id",
    frozen.status === 200 && versionId !== "" && frozen.json?.version?.note === "Före regeländringen",
    `${frozen.status} ${frozen.text.slice(0, 140)}`,
  );

  const second = await call("POST", `/guides/${id}/versions`, { body: { graph: graph("Version två") }, secret });
  const secondId = second.json?.version?.id ?? "";
  const opened = await call("GET", `/guides/${id}/versions/${versionId}`, { secret });

  check(
    "en fryst version går att öppna som den var",
    opened.status === 200 && opened.json?.graph?.nodes?.[0]?.data?.title === "Version ett",
    `${opened.status} ${JSON.stringify(opened.json?.graph?.nodes?.[0]?.data?.title)}`,
  );

  check(
    "den frysta grafen bär versionens eget id, så ett ärende kan säga vilken version som svarade",
    opened.json?.graph?.meta?.versionId === versionId,
    JSON.stringify(opened.json?.graph?.meta ?? null),
  );

  const listed = await call("GET", `/guides/${id}`, { secret });

  check(
    "listan har båda, nyast först, och den första är publicerad",
    listed.json?.versions?.length === 2 &&
      listed.json.versions[0].id === secondId &&
      listed.json.current === versionId,
    JSON.stringify(listed.json?.versions?.map((one) => one.id)),
  );

  const published = await call("POST", `/guides/${id}/current`, { body: { versionId: secondId }, secret });
  const afterPublish = await call("GET", `/guides/${id}`, { secret });

  check(
    "publish flyttar pekaren och skriver ingen graf",
    published.status === 200 &&
      published.json?.current === secondId &&
      afterPublish.json?.current === secondId &&
      afterPublish.json?.versions?.length === 2,
    `${published.status} ${published.text.slice(0, 120)}`,
  );

  /*
   * QA (uppdrag 22/9, mätning 2b): den publicerade versionens bytesträng,
   * tagen HÄR — innan nästan allt annat i provet kör — och jämförd sist,
   * strax innan guiden tas bort. Allt som händer med `id` mellan de här två
   * raderna (krock-, since-, numrerings-, snapshot- och lås-kontrollerna)
   * ska lämna den orörd.
   */
  const publiceradVidStart = await call("GET", `/guides/${id}/versions/${secondId}`, { secret });

  /* ── Kasta arbetskopian (tillägg 17/9) ───────────────────────────────── */

  /*
   * En värd måste kunna få veta att det INTE finns någon arbetskopia, och
   * skillnaden mot "en som råkar vara lika med den publicerade" är hela
   * poängen: den senare får sidan att säga *opublicerade ändringar* om något
   * ingen ändrat.
   */
  const dropped = await call("DELETE", `/guides/${id}/draft`, { secret });
  const afterDrop = await call("GET", `/guides/${id}`, { secret });

  check(
    "DELETE tar arbetskopian, och guiden har ingen efteråt",
    dropped.status === 200 && afterDrop.json?.draft === undefined,
    `${dropped.status} ${JSON.stringify(afterDrop.json?.draft ?? null)}`,
  );
  check(
    "versionerna rörs inte när arbetskopian kastas",
    afterDrop.json?.versions?.length === 2 && afterDrop.json?.current === secondId,
    JSON.stringify(afterDrop.json?.versions?.map((one) => one.id)),
  );
  check(
    "att kasta en arbetskopia som inte finns är också ett ja",
    (await call("DELETE", `/guides/${id}/draft`, { secret })).status === 200,
    "två gånger ger samma svar",
  );
  check(
    "men inte utan rätt hemlighet, och inte på en guide som inte finns",
    (await call("DELETE", `/guides/${id}/draft`, { secret: "fel" })).status === 401 &&
      (await call("DELETE", "/guides/finns-inte/draft", { secret })).status === 404,
    "401 och 404",
  );

  // Arbetskopian tillbaka, så resten av provet har en att mäta på.
  await call("PUT", `/guides/${id}/draft`, { body: graph("Utkast två"), secret });

  /* ── Ingen skriver över någon tyst (berättelse 127) ──────────────────── */

  /*
   * Den villkorade skrivningen, hela vägen genom HTTP.
   *
   * Det här är berättelsens kärna och den enda avvisning kontraktet har som
   * säger VEM. Utan en leverantör finns ingen att namnge — och att svaret då
   * INTE bär ett tomt namn är halva kontrollen: en rad som säger *av* och
   * sedan ingenting är sämre än ingen rad.
   *
   * Egen guide, för provet ovan har en arbetskopia med en historia.
   */
  const villkorad = guides("new", "--note", "Villkoret");
  const vId = villkorad.out.match(/^id:\s*(\S+)$/m)?.[1] ?? "";
  const vSecret = villkorad.out.match(/^hemlighet:\s*(\S+)$/m)?.[1] ?? "";

  const första = await call("PUT", `/guides/${vId}/draft`, {
    body: { graph: graph("Nisses text"), draftSavedAt: "" },
    secret: vSecret,
  });

  check(
    "en arbetskopia som inte fanns skrivs med tomt villkor",
    första.status === 200 && typeof första.json?.savedAt === "string",
    `${första.status} ${första.text.slice(0, 100)}`,
  );

  const stämpel = första.json?.savedAt ?? "";

  const föråldrad = await call("PUT", `/guides/${vId}/draft`, {
    body: { graph: graph("Annas text"), draftSavedAt: "" },
    secret: vSecret,
  });

  check(
    "en skrivning med gammalt villkor är 409, aldrig ett tyst ja",
    föråldrad.status === 409,
    `${föråldrad.status} ${föråldrad.text.slice(0, 120)}`,
  );

  /*
   * Och statusen är halva svaret. Det som mäts här är texten: en server som
   * avvisar EFTER att ha skrivit har avvisat ingenting, och det är precis det
   * fel som inte syns någonstans förrän någons arbete är borta.
   */
  const efterKrock = await call("GET", `/guides/${vId}`, { secret: vSecret });

  check(
    "och den andres text står kvar, orörd",
    efterKrock.json?.draft?.nodes?.[0]?.data?.title === "Nisses text",
    JSON.stringify(efterKrock.json?.draft?.nodes?.[0]?.data?.title),
  );
  check(
    "409 säger när arbetskopian skrevs, och namnger ingen hos en värd utan inloggning",
    föråldrad.json?.draftSavedAt === stämpel && föråldrad.json?.draftSavedBy === undefined,
    JSON.stringify(föråldrad.json),
  );
  check(
    "en värd utan inloggning skriver varken draftSavedBy eller updatedBy — aldrig ett tomt av",
    efterKrock.json?.draftSavedBy === undefined &&
      guides("show", vId).out.includes("ändrad av  ingen"),
    guides("show", vId).out.split("\n").find((one) => one.startsWith("ändrad av")) ?? "ingen rad",
  );

  const medRättStämpel = await call("PUT", `/guides/${vId}/draft`, {
    body: { graph: graph("Annas text"), draftSavedAt: stämpel },
    secret: vSecret,
  });

  check(
    "med rätt villkor går skrivningen igenom",
    medRättStämpel.status === 200 &&
      (await call("GET", `/guides/${vId}`, { secret: vSecret })).json?.draft?.nodes?.[0]?.data
        ?.title === "Annas text",
    `${medRättStämpel.status}`,
  );

  /* ── Läsläget följer med: `?since` och 204 (berättelse 129) ──────────── */

  /*
   * Den som står i läsläge frågar var tionde sekund om något hänt, och det
   * svaret ska kosta nästan ingenting. Stämpeln är frågan; `204` utan kropp är
   * svaret *nej*.
   *
   * Mätt som **kroppens längd** och inte bara som status: en server som svarar
   * 204 och ändå skriver en kropp har inte sparat något, och det är hela
   * skälet att vägen finns. Jämförelsen är likhet och inte ålder — en stämpel
   * värden aldrig haft besvaras med guiden, som det säkra svaret.
   */
  const nuStämpel = (await call("GET", `/guides/${vId}`, { secret: vSecret })).json?.draftSavedAt ?? "";

  const oförändrad = await call("GET", `/guides/${vId}?since=${encodeURIComponent(nuStämpel)}`, {
    secret: vSecret,
  });

  check(
    "en fråga med samma stämpel är 204 utan kropp",
    oförändrad.status === 204 && oförändrad.text === "",
    `${oförändrad.status} · ${oförändrad.text.length} tecken`,
  );

  const okändStämpel = await call("GET", `/guides/${vId}?since=nagot-annat`, { secret: vSecret });

  check(
    "en stämpel värden inte har besvaras med guiden",
    okändStämpel.status === 200 &&
      okändStämpel.json?.draft?.nodes?.[0]?.data?.title === "Annas text",
    `${okändStämpel.status} ${okändStämpel.text.slice(0, 80)}`,
  );

  const utanFrågan = await call("GET", `/guides/${vId}`, { secret: vSecret });

  check(
    "och utan since svarar värden som den alltid gjort",
    utanFrågan.status === 200 && typeof utanFrågan.json?.draftSavedAt === "string",
    `${utanFrågan.status}`,
  );

  /*
   * Publiceringen går samma väg: att frysa en arbetskopia någon annan hunnit
   * ändra är att publicera en text man inte har sett.
   */
  const krockandeVersion = await call("POST", `/guides/${vId}/versions`, {
    body: { graph: graph("Fryst av misstag"), note: "Krock", draftSavedAt: stämpel },
    secret: vSecret,
  });

  check(
    "POST …/versions med gammalt villkor är 409, och fryser ingenting",
    krockandeVersion.status === 409 &&
      (await call("GET", `/guides/${vId}`, { secret: vSecret })).json?.versions?.length === 0,
    `${krockandeVersion.status} ${krockandeVersion.text.slice(0, 100)}`,
  );

  /*
   * Och den gamla kroppsformen — grafen som kroppen — skriver som förut.
   *
   * Det står i kontraktet: en klient som inte skickar villkoret får sista
   * skrivning vinner. Kontrollen finns för att tillägget annars vore en
   * flaggdag: varje värd och varje klient hade fått bytas samma dag.
   */
  const gammalKlient = await call("PUT", `/guides/${vId}/draft`, {
    body: graph("Gammal klient"),
    secret: vSecret,
  });

  check(
    "en kropp som ÄR grafen skriver fortfarande, utan villkor",
    gammalKlient.status === 200 &&
      (await call("GET", `/guides/${vId}`, { secret: vSecret })).json?.draft?.nodes?.[0]?.data
        ?.title === "Gammal klient",
    `${gammalKlient.status}`,
  );

  guides("remove", vId);

  /* ── The refusals ────────────────────────────────────────────────────── */

  const noSuchGuide = await call("GET", "/guides/finns-inte", { secret });

  check(
    "en guide som inte finns är 404, aldrig en tom guide",
    noSuchGuide.status === 404 && noSuchGuide.json?.draft === undefined,
    `${noSuchGuide.status} ${noSuchGuide.text.slice(0, 120)}`,
  );

  const wrongSecret = await call("GET", `/guides/${id}`, { secret: "fel-hemlighet-som-ar-lagom-lang-ändå" });
  const noSecret = await call("GET", `/guides/${id}`);

  check(
    "fel hemlighet är 401, och utan hemlighet likaså",
    wrongSecret.status === 401 && noSecret.status === 401,
    `${wrongSecret.status} / ${noSecret.status}`,
  );
  check(
    "och svaret säger ingenting om vad som var fel",
    !/hash|hemlighet|secret|bearer/i.test(wrongSecret.text),
    wrongSecret.text.slice(0, 120),
  );
  check(
    "en skrivning med fel hemlighet ändrar ingenting",
    (await call("PUT", `/guides/${id}/draft`, { body: graph("Inkräktaren"), secret: "fel" })).status === 401 &&
      (await call("GET", `/guides/${id}`, { secret })).json?.draft?.nodes?.[0]?.data?.title === "Utkast två",
    "arbetskopian står kvar",
  );

  /*
   * En annan guides hemlighet är inte den här guidens hemlighet.
   *
   * Samma regel som "fel hemlighet" ovan, men uttryckt som ägarskap — och det
   * är den formen berättelse 126 gör till modellen: en guide ägs av någon, inte
   * av den som råkar ha en sträng. Kontrollen finns för att en värd som
   * jämförde "är den här strängen EN giltig hemlighet" i stället för "är den
   * DEN HÄR guidens" hade gått grön på allt ovan.
   */
  const other = guides("new", "--note", "Någon annans");
  const otherSecret = other.out.match(/^hemlighet:\s*(\S+)$/m)?.[1] ?? "";
  const asOther = await call("PUT", `/guides/${id}/draft`, {
    body: graph("Inkräktaren"),
    secret: otherSecret,
  });

  check(
    "en annan guides hemlighet är 401 på den här guiden, aldrig 403",
    asOther.status === 401,
    String(asOther.status),
  );
  check(
    "och den skrivningen ändrade ingenting",
    (await call("GET", `/guides/${id}`, { secret })).json?.draft?.nodes?.[0]?.data?.title === "Utkast två",
    "arbetskopian står kvar",
  );

  guides("remove", other.out.match(/^id:\s*(\S+)$/m)?.[1] ?? "");

  /*
   * Samlingsvägarna (berättelse 126). Utan inloggning finns ingen lista att ge:
   * "dina guider" är en tom mängd som inte går att skilja från "du har inga",
   * och att skapa en är att bestämma vem som äger den. Den här servern kör
   * UTAN leverantör, så båda ska vara 401 — inte 404, och inte en tom lista.
   *
   * En tom lista vore det farliga svaret: en sida hade ritat "Du har inga
   * guider än" åt någon som har tjugo.
   */
  const listWithoutLogin = await call("GET", "/guides", { secret });
  const createWithoutLogin = await call("POST", "/guides", { body: { name: "Smyg" } });

  check(
    "GET /guides utan inloggning är 401, aldrig en tom lista",
    listWithoutLogin.status === 401 && listWithoutLogin.json?.guides === undefined,
    `${listWithoutLogin.status} ${listWithoutLogin.text.slice(0, 80)}`,
  );
  check(
    "POST /guides utan inloggning är 401, och skapar ingenting",
    createWithoutLogin.status === 401 && createWithoutLogin.json?.guide === undefined,
    `${createWithoutLogin.status} ${createWithoutLogin.text.slice(0, 80)}`,
  );

  const noSuchVersion = await call("GET", `/guides/${id}/versions/v-finns-inte`, { secret });

  check(
    "en version som inte finns är 404, aldrig den aktuella",
    noSuchVersion.status === 404 && noSuchVersion.json?.graph === undefined,
    `${noSuchVersion.status} ${noSuchVersion.text.slice(0, 120)}`,
  );

  const publishNothing = await call("POST", `/guides/${id}/current`, { body: { versionId: "v-finns-inte" }, secret });

  check(
    "att publicera en version som inte finns avvisas",
    publishNothing.status >= 400 &&
      (await call("GET", `/guides/${id}`, { secret })).json?.current === secondId,
    `${publishNothing.status}, pekaren står kvar`,
  );

  /*
   * 256 kB, mätt som tio gånger den största guide någon byggt här (~23 kB).
   * En gräns finns för att guiderna ligger på samma disk som besökarnas
   * ärenden, och den som fyller den tar båda med sig.
   */
  const huge = { ...graph("Stor"), fyllnad: "x".repeat(300_000) };
  const tooBig = await call("PUT", `/guides/${id}/draft`, { body: huge, secret });

  check(
    "en orimligt stor graf avvisas",
    tooBig.status === 413,
    `${tooBig.status} ${tooBig.text.slice(0, 120)}`,
  );

  /*
   * QA, mutationskontroll (124, kriterium 9): den enda mätningen ovan är
   * ~300 kB över gränsen, och skulle inte fälla ett fel i själva talet 256 kB
   * (t.ex. en gräns satt till 512 kB i stället). De här två träffar gränsen
   * på kilobyten: 255 kB ska gå igenom, 257 kB ska avvisas.
   */
  const sizedGraph = (title, targetBytes) => {
    const bare = JSON.stringify({ ...graph(title), fyllnad: "" });
    return { ...graph(title), fyllnad: "x".repeat(Math.max(0, targetBytes - bare.length)) };
  };

  const underLimit = await call("PUT", `/guides/${id}/draft`, {
    body: sizedGraph("255 kB", 255 * 1024),
    secret,
  });

  check(
    "en graf på 255 kB, under gränsen, sparas",
    underLimit.status === 200,
    `${underLimit.status} ${underLimit.text.slice(0, 120)}`,
  );

  const overLimit = await call("PUT", `/guides/${id}/draft`, {
    body: sizedGraph("257 kB", 257 * 1024),
    secret,
  });

  check(
    "en graf på 257 kB, över gränsen, avvisas",
    overLimit.status === 413,
    `${overLimit.status} ${overLimit.text.slice(0, 120)}`,
  );

  const brokenBody = await call("PUT", `/guides/${id}/draft`, { body: "{ inte json", secret });

  check("en trasig kropp avvisas", brokenBody.status === 400, String(brokenBody.status));

  const notAGraph = await call("POST", `/guides/${id}/versions`, { body: { note: "utan graf" }, secret });

  check("en version utan graf avvisas", notAGraph.status === 400, String(notAGraph.status));

  /*
   * Förhandsförfrågan, som en webbläsare ställer den.
   *
   * Den här kontrollen finns för att allt annat här är grönt utan den: node:s
   * `fetch` bryr sig inte om CORS, så servern kunde svara att bara GET och
   * POST är tillåtna medan `PUT /draft` — arbetskopians enda väg — avvisades
   * av webbläsaren innan den ens skickades. Felet syntes först när sidan
   * kördes på riktigt, och serverns logg såg tom ut hela tiden.
   */
  const preflight = await fetch(`${BASE}/guides/${id}/draft`, {
    method: "OPTIONS",
    headers: {
      origin: "http://localhost:5173",
      "access-control-request-method": "DELETE",
      "access-control-request-headers": "authorization,content-type",
    },
  });
  const allowMethods = preflight.headers.get("access-control-allow-methods") ?? "";
  const allowHeaders = preflight.headers.get("access-control-allow-headers") ?? "";

  check(
    "förhandsförfrågan tillåter varje metod kontraktet använder",
    ["GET", "PUT", "POST", "DELETE"].every((method) => allowMethods.includes(method)),
    allowMethods || "inget svar",
  );
  check(
    "och hemligheten får följa med som huvud",
    allowHeaders.toLowerCase().includes("authorization"),
    allowHeaders || "inget svar",
  );

  /* ── Numret är värdens, och det döps aldrig om ───────────────────────── */

  /*
   * En egen guide för det här, för provet gallrar: en borttagen version mitt i
   * flödet ovan hade ändrat vad kontrollerna efter den räknar. Numren är per
   * guide, så en egen guide mäter exakt samma regel.
   *
   * Kontraktets regel: `number` sätts som `max + 1` när versionen fryses och
   * ändras aldrig — inte heller när äldre versioner gallras. Räknas det i
   * stället ur listans position döps allt som är kvar om den dagen, och
   * *"gå tillbaka till version 3"* betyder något annat i morgon än i dag.
   *
   * Gallringen görs rakt i registret, som en värds egen städregel gör den:
   * servern erbjuder ingen väg att ta bort en version, och ska inte göra det.
   */
  const numbered = guides("new", "--note", "Numren");
  const numberedId = numbered.out.match(/^id:\s*(\S+)$/m)?.[1] ?? "";
  const numberedSecret = numbered.out.match(/^hemlighet:\s*(\S+)$/m)?.[1] ?? "";
  const freeze = (title) =>
    call("POST", `/guides/${numberedId}/versions`, {
      body: { graph: graph(title) },
      secret: numberedSecret,
    });
  const numbersNow = async () =>
    (await call("GET", `/guides/${numberedId}`, { secret: numberedSecret })).json?.versions?.map(
      (one) => one.number,
    );

  await freeze("Version ett");
  await freeze("Version två");

  /*
   * QA (uppdrag 22/9, mätning 2c): numret är värdens, aldrig klientens.
   * Editorn skickar aldrig `number`, men kontraktet ska hålla ändå om något
   * annat gör det — en klient som "hjälper till" med ett tal ska ignoreras
   * lika tyst som en `label` klienten skickar (kontrollen längre ned för
   * snapshots). Skickad rakt i den tredje frysningen, i stället för en egen
   * version, så resten av numreringen nedan (fjärde blir 4, inte 5) står orörd.
   *
   * Mutationen som fäller det: läs `body.value.number` i vägen för
   * `POST …/versions` och skicka det vidare i stället för `max + 1`.
   */
  const third = await call("POST", `/guides/${numberedId}/versions`, {
    body: { graph: graph("Version tre"), number: 999 },
    secret: numberedSecret,
  });
  const numbersAfterThree = await numbersNow();

  check(
    "tre frysningar ger numren 1, 2, 3",
    third.json?.version?.number === 3 && JSON.stringify(numbersAfterThree) === "[3,2,1]",
    JSON.stringify({ tredje: third.json?.version?.number, listan: numbersAfterThree }),
  );
  check(
    "och ett nummer klienten skickade med (999) ignorerades tyst",
    third.json?.version?.number !== 999,
    JSON.stringify(third.json?.version?.number),
  );

  const registry = openStore(dbFile);
  const pruned = registry
    .list({ kind: "version" })
    .find((entry) => entry.value?.guideId === numberedId && entry.value?.number === 2);

  registry.remove(entryKey("version", pruned.value.id));

  const fourth = await freeze("Version fyra");
  const numbersAfterPrune = await numbersNow();

  check(
    "en gallrad version tar sitt nummer med sig — nästa blir 4, inte 3",
    fourth.json?.version?.number === 4 && JSON.stringify(numbersAfterPrune) === "[4,3,1]",
    JSON.stringify({ fjärde: fourth.json?.version?.number, listan: numbersAfterPrune }),
  );

  /*
   * ── Frysning vid krock, `POST …/snapshots` (berättelse 131) ───────────
   *
   * *"Kan vi helt undvika bortfall?"* Sammanslagningen lämnar ett bortfall
   * kvar — på raderna där båda rört samma sak måste en text vinna — och det
   * tas bort genom att båda kopiorna fryses **innan** den sammanslagna
   * skrivs. Den som förlorade valet ligger då kvar i historiken.
   *
   * Tre saker mäts, och alla tre är skillnaden mot en publicering:
   *
   *  1. posten finns i historiken med `reason: "conflict"` och **utan
   *     nummer** — mutationen som fäller det: låt vägen numrera som
   *     `POST …/versions` gör, och nästa publicering hoppar ett nummer;
   *  2. `current` rörs inte — en krockfrysning visas aldrig för en besökare;
   *  3. nästa **publicering** får nästa nummer i ordningen, alltså har
   *     krockkopiorna inte förbrukat några.
   *
   * Samma guide som numreringen ovan, med flit: numren är per guide, och det
   * som ska visas är just att de två nya raderna inte rörde dem.
   */
  const publicerat = await call("POST", `/guides/${numberedId}/current`, {
    body: { versionId: fourth.json?.version?.id },
    secret: numberedSecret,
  });
  const currentFöre = (await call("GET", `/guides/${numberedId}`, { secret: numberedSecret })).json
    ?.current;

  const hennes = await call("POST", `/guides/${numberedId}/snapshots`, {
    body: { graph: graph("Annas kopia"), side: "theirs" },
    secret: numberedSecret,
  });
  const min = await call("POST", `/guides/${numberedId}/snapshots`, {
    body: { graph: graph("Min kopia"), side: "mine" },
    secret: numberedSecret,
  });
  const efterFrysning = (await call("GET", `/guides/${numberedId}`, { secret: numberedSecret })).json;

  check(
    "två kopior fryses vid en krock, som versioner i historiken",
    publicerat.status === 200 &&
      hennes.status === 200 &&
      min.status === 200 &&
      efterFrysning?.versions?.length === 5,
    JSON.stringify({ hennes: hennes.status, min: min.status, rader: efterFrysning?.versions?.length }),
  );
  check(
    "de bär reason conflict och INGET nummer — numren namnger publiceringar",
    efterFrysning?.versions
      ?.filter((one) => one.reason === "conflict")
      .every((one) => one.number === undefined) &&
      efterFrysning.versions.filter((one) => one.reason === "conflict").length === 2 &&
      efterFrysning.versions.every((one) => one.reason === "conflict" || one.reason === undefined),
    JSON.stringify(efterFrysning?.versions?.map((one) => [one.reason ?? "-", one.number ?? "-"])),
  );
  /*
   * **Ingen etikett lagras.** Raden ska kunna säga *din kopia*, och vem *du*
   * är beror på vem som läser — en lagrad etikett hade sagt *din* om någon
   * annans arbete första gången en kollega öppnade historiken. Namnet byggs
   * av `<guide-versions>` ur `reason` och `by`.
   */
  check(
    "och ingen etikett lagras — raden byggs där den läses",
    efterFrysning?.versions
      ?.filter((one) => one.reason === "conflict")
      .every((one) => one.label === undefined),
    JSON.stringify(efterFrysning?.versions?.filter((one) => one.reason === "conflict")),
  );
  check(
    "current rörs inte — en krockkopia visas aldrig för en besökare",
    efterFrysning?.current === currentFöre &&
      efterFrysning.versions.every((one) => one.reason !== "conflict" || one.current !== true),
    JSON.stringify({ före: currentFöre, efter: efterFrysning?.current }),
  );

  /*
   * Och den avgörande: numren är orörda. Mutationen som fäller den — ta bort
   * `reason !== "conflict"`-filtret i `versionsOf`, alltså låt migreringen
   * numrera krockkopiorna vid nästa läsning — ger 5 i stället för 5 här och
   * hoppar över de nummer historiken redan lovat.
   */
  const femte = await freeze("Version fem");

  check(
    "nästa publicering får nästa nummer: krockkopiorna förbrukade inga",
    femte.json?.version?.number === 5,
    JSON.stringify({ femte: femte.json?.version?.number, numren: await numbersNow() }),
  );

  /*
   * **En etikett från klienten ignoreras.** `label` byggs där raden läses, av
   * `reason` och `by` — aldrig lagrad, för vem *du* är beror på vem som läser
   * (kommentaren i `server.mjs`). Skickar klienten ändå en `label` i kroppen
   * ska den falla bort tyst, precis som ett fält ingen bad om.
   *
   * Mutationen som fäller det: läs `body.value.label` i vägen och lägg den på
   * posten — testet ovan ("ingen etikett lagras") missar det, för det testet
   * skickar aldrig en `label`. Det här skickar en, med en giltig graf.
   */
  const medEtikett = await call("POST", `/guides/${numberedId}/snapshots`, {
    body: { graph: graph("Med klientetikett"), side: "mine", label: "Klientens egen etikett" },
    secret: numberedSecret,
  });
  const efterEtikett = (await call("GET", `/guides/${numberedId}`, { secret: numberedSecret })).json;
  const lagradEtikett = efterEtikett?.versions?.find((one) => one.id === medEtikett.json?.version?.id);

  check(
    "en etikett klienten skickar med lagras aldrig — raden bygger sin egen",
    medEtikett.status === 200 &&
      medEtikett.json?.version?.label === undefined &&
      lagradEtikett?.label === undefined,
    JSON.stringify({ svar: medEtikett.json?.version, lagrad: lagradEtikett }),
  );

  /*
   * Och rollen: `snapshots` är redaktörens väg, inte publicerarens. Här finns
   * ingen inloggning (hemligheten är legitimationen), så rollkontrollen mäts i
   * `smoke:login`; det som mäts här är att vägen finns och svarar 400 på en
   * kropp utan graf, som varje annan skrivväg.
   */
  const utanGraf = await call("POST", `/guides/${numberedId}/snapshots`, {
    body: { label: "Utan graf" },
    secret: numberedSecret,
  });

  check(
    "en krockfrysning utan graf är 400, som varje annan skrivning",
    utanGraf.status === 400,
    `${utanGraf.status} ${utanGraf.text.slice(0, 60)}`,
  );

  guides("remove", numberedId);

  /* ── The command line sees the same guide ────────────────────────────── */

  const shown = guides("show", id);

  check(
    "guides.mjs show visar guiden, versionerna och vilken som är publicerad",
    shown.code === 0 && shown.out.includes(secondId) && shown.out.includes("2 versioner"),
    shown.out.trim().split("\n").slice(0, 3).join(" | "),
  );
  check(
    "guides.mjs list räknar upp den",
    // `id !== ""` först: utan det är påståendet `"".includes("")`, alltså sant
    // oavsett vad listan säger — sågs gå grönt medan ingenting fanns.
    id !== "" && guides("list").out.includes(id),
    guides("list").out.trim().split("\n").slice(0, 2).join(" | "),
  );

  /*
   * `guides.mjs owner` — ägaren till en guide som redan finns.
   *
   * Övergången den finns för: en guide myntad med `new` bär bara en hemlighet,
   * och slås en OIDC-leverantör på avvisas den — då har guiden ingen `owner`
   * och är onåbar. Att den DÅ syns i rätt persons lista mäts i `smoke:login`,
   * där det finns en inloggning; här mäts vad kommandot gör med posten.
   *
   * Och det som är lätt att göra fel: allt annat i posten ska överleva. Ett
   * kommando som skriver en ny post i stället för att fylla på den gamla tar
   * hemligheten, pekaren och anteckningen med sig — och det syns inte förrän
   * någon försöker öppna guiden.
   */
  const ägd = guides("new", "--note", "Får en ägare");
  const ägdId = ägd.out.match(/^id:\s*(\S+)$/m)?.[1] ?? "";
  const ägdSecret = ägd.out.match(/^hemlighet:\s*(\S+)$/m)?.[1] ?? "";

  await call("POST", `/guides/${ägdId}/versions`, { body: { graph: graph("Innan ägaren") }, secret: ägdSecret });

  const utanÄgare = guides("show", ägdId);
  const satte = guides("owner", ägdId, "google-oauth2|117");
  const medÄgare = guides("show", ägdId);

  check(
    "guides.mjs show säger att en guide myntad på kommandoraden inte vet vem som skapade den",
    utanÄgare.out.includes("skapad av  ingen"),
    utanÄgare.out.split("\n").find((one) => one.startsWith("skapad av")) ?? utanÄgare.out.slice(0, 80),
  );
  check(
    "guides.mjs owner sätter skapad av, och show visar den",
    satte.code === 0 &&
      satte.out.includes("ingen → google-oauth2|117") &&
      medÄgare.out.includes("skapad av  google-oauth2|117"),
    `${satte.out.trim().split("\n")[1] ?? satte.err.trim()} | ${medÄgare.out.split("\n").find((one) => one.startsWith("skapad av")) ?? ""}`,
  );

  const efterÄgare = await call("GET", `/guides/${ägdId}`, { secret: ägdSecret });

  check(
    "och resten av posten är orörd — hemligheten, pekaren och versionen finns kvar",
    efterÄgare.status === 200 &&
      efterÄgare.json?.versions?.length === 1 &&
      efterÄgare.json?.current === efterÄgare.json?.versions?.[0]?.id,
    `${efterÄgare.status} ${JSON.stringify({ versioner: efterÄgare.json?.versions?.length, current: Boolean(efterÄgare.json?.current) })}`,
  );

  const okändÄgare = guides("owner", "finns-inte", "någon");
  const utanSubjekt = guides("owner", ägdId);

  check(
    "en guide som inte finns går inte att ge en ägare, och kommandot säger var subjektet står",
    okändÄgare.code === 1 && utanSubjekt.code === 2 && /journalctl|inloggad/.test(utanSubjekt.err),
    `${okändÄgare.code} / ${utanSubjekt.code} — ${utanSubjekt.err.trim().split("\n").pop() ?? ""}`,
  );

  guides("remove", ägdId);

  /* ── Låset: vem arbetar i guiden just nu (berättelse 129) ───────────── */

  /*
   * Ett lås hör till en **person**, och den här servern har inga.
   *
   * Hemligheten per guide är en *guides* legitimation: två flikar med samma
   * hemlighet är samma "vem", och ett lås mellan dem hade varit ett lås mot
   * sig självt. Så vägen finns inte här, och det mäts — annars vore den tysta
   * halvan av kontraktet oskriven.
   */
  const utanInloggning = await call("POST", `/guides/${id}/lock`, { body: {}, secret });

  check(
    "utan inloggning finns inget lås att ta — vägen finns inte",
    utanInloggning.status === 404 && utanInloggning.json?.error === "no-lock",
    `${utanInloggning.status} ${utanInloggning.text.slice(0, 80)}`,
  );

  /*
   * Och resten mäts mot en **andra** server, med inloggning på.
   *
   * Den behöver vara en andra och inte den här: med en leverantör inkopplad
   * avvisas hemligheten hur riktig den än är (`docs/LAGRING-KONTRAKT.md`), så
   * allt ovan hade slutat gå. Leverantören kontaktas aldrig — bara
   * `/auth/login` gör det — och sessionerna byggs här med samma `sign()` som
   * servern själv använder och med den `SESSION_SECRET` provet satte.
   *
   * Det är inte en bakväg: kontrollen av cookien är serverns egen och orörd,
   * och provet har nyckeln därför att provet är driftaren. En rigg som i
   * stället bad servern lita på ett huvud hade mätt riggen.
   *
   * **Tiden är värdens, och provet väntar in den på riktigt.** `LOCK_MINUTES`
   * tillåter decimaler just för det här (`locks.mjs`): 0,05 minuter är tre
   * sekunder, och det är samma variabel som i drift — inte en egen provväg.
   */
  const lockDb = join(work, "lock.sqlite");
  const LOCK_PORT = 4324;
  const LOCK_BASE = `http://localhost:${LOCK_PORT}`;
  const LOCK_MS = 3000;
  const SESSION_SECRET = "prov-sessionsnyckel-som-ar-lagom-lang";
  const lockEnv = {
    ...env,
    FLOWWEAVER_DB: lockDb,
    // Adressen slås aldrig upp: ingen väg i provet startar en inloggning.
    OIDC_ISSUER: "http://localhost:4399",
    OIDC_CLIENT_ID: "prov",
    OIDC_CLIENT_SECRET: "prov-hemlighet",
    SESSION_SECRET,
    LOCK_MINUTES: String(LOCK_MS / 60_000),
    ROLES: "prov-johan:admin,prov-anna:publisher,prov-nisse:editor",
  };

  lockServer = spawn(process.execPath, [SERVER, String(LOCK_PORT)], { env: lockEnv, stdio: "ignore" });

  const somebody = (subject, name) =>
    `${SESSION_COOKIE}=${sign(
      { subject, name, email: "", exp: Math.floor(Date.now() / 1000) + 3600 },
      SESSION_SECRET,
    )}`;
  const johanCookie = somebody("prov-johan", "Johan Furuskog");
  const annaCookie = somebody("prov-anna", "Anna Andersson");
  const nisseCookie = somebody("prov-nisse", "Nisse Hult");
  const monikaCookie = somebody("prov-monika", "Monika Ek");

  const asPerson = async (cookie, method, path, body) => {
    const answer = await fetch(`${LOCK_BASE}${path}`, {
      method,
      headers: { "content-type": "application/json", cookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await answer.text();

    return {
      status: answer.status,
      json: (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })(),
      text,
    };
  };

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(`${LOCK_BASE}/guides`)).status > 0) break;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const nyGuide = await asPerson(johanCookie, "POST", "/guides", { name: "Bygglov i Överby" });
  const låstId = nyGuide.json?.guide?.id ?? "";

  check(
    "en värd med inloggning skapar guiden åt förvaltaren",
    nyGuide.status === 200 && låstId !== "",
    `${nyGuide.status} ${nyGuide.text.slice(0, 80)}`,
  );

  /*
   * Tiden är värdens, alltid. Provet skickar med en egen `until` långt fram —
   * en klient som ljuger eller bara går fel — och värden ska strunta i den.
   */
  const annasLås = await asPerson(annaCookie, "POST", `/guides/${låstId}/lock`, {
    until: "2099-01-01T00:00:00.000Z",
  });
  const annasUntil = Date.parse(annasLås.json?.lock?.until ?? "");

  check(
    "Anna tar låset, och värden namnger henne i svaret",
    annasLås.status === 200 && annasLås.json?.lock?.name === "Anna Andersson" && annasLås.json?.lock?.me === true,
    `${annasLås.status} ${annasLås.text.slice(0, 120)}`,
  );
  check(
    "tiden är värdens — en klient som skickar en egen until blir ignorerad",
    Number.isFinite(annasUntil) && annasUntil <= Date.now() + LOCK_MS + 2000,
    annasLås.json?.lock?.until ?? "ingen tid",
  );
  check(
    "och subjektet går aldrig ut på tråden, bara namnet",
    !JSON.stringify(annasLås.json ?? {}).includes("prov-anna"),
    JSON.stringify(annasLås.json ?? {}).slice(0, 120),
  );

  const nissesFörsök = await asPerson(nisseCookie, "POST", `/guides/${låstId}/lock`, {});

  check(
    "den som kommer sedan får 409 med låset — vem, och sedan när",
    nissesFörsök.status === 409 &&
      nissesFörsök.json?.lock?.name === "Anna Andersson" &&
      nissesFörsök.json?.lock?.me === false &&
      typeof nissesFörsök.json?.lock?.since === "string",
    `${nissesFörsök.status} ${nissesFörsök.text.slice(0, 120)}`,
  );

  /*
   * Samma person, en annan dator.
   *
   * Subjektet räcker inte som "vem håller låset": Anna som öppnar guiden på
   * en andra dator ska ta över sig själv — utan dialog, för det kostar ingen
   * annan något — och det första fönstret ska få veta det vid sin nästa
   * förnyelse. Utan `window` i jämförelsen hade båda fönstren trott att de
   * höll låset, och båda hade autosparat.
   */
  const annasAndraDator = await asPerson(annaCookie, "POST", `/guides/${låstId}/lock`, {
    window: "dator-två",
  });

  check(
    "samma person på en annan dator får 409 och ser att låset är ens eget",
    annasAndraDator.status === 409 && annasAndraDator.json?.lock?.me === true,
    `${annasAndraDator.status} ${annasAndraDator.text.slice(0, 100)}`,
  );

  const annasÖvertagandeAvSigSjälv = await asPerson(annaCookie, "POST", `/guides/${låstId}/lock`, {
    window: "dator-två",
    takeOver: true,
  });
  const annasFörstaFönster = await asPerson(annaCookie, "POST", `/guides/${låstId}/lock`, {});

  check(
    "och tar över sig själv utan att vara publicerare",
    annasÖvertagandeAvSigSjälv.status === 200,
    `${annasÖvertagandeAvSigSjälv.status} ${annasÖvertagandeAvSigSjälv.text.slice(0, 100)}`,
  );
  check(
    "medan det första fönstrets förnyelse avvisas i stället för att ta tillbaka låset",
    annasFörstaFönster.status === 409,
    `${annasFörstaFönster.status} ${annasFörstaFönster.text.slice(0, 100)}`,
  );

  // Tillbaka till ett lås i det första fönstret, som resten av provet mäter på.
  await asPerson(annaCookie, "POST", `/guides/${låstId}/lock`, { takeOver: true });

  const redaktörensÖvertagande = await asPerson(nisseCookie, "POST", `/guides/${låstId}/lock`, {
    takeOver: true,
  });

  check(
    "en redaktör får inte ta över någon annans lås — 403, rollen räcker inte",
    redaktörensÖvertagande.status === 403,
    `${redaktörensÖvertagande.status} ${redaktörensÖvertagande.text.slice(0, 80)}`,
  );

  const läsarensLås = await asPerson(monikaCookie, "POST", `/guides/${låstId}/lock`, {});

  check(
    "och en läsare tar inget lås alls",
    läsarensLås.status === 403,
    `${läsarensLås.status} ${läsarensLås.text.slice(0, 80)}`,
  );

  /*
   * **Skrivvägarna kräver inte låset**, och det är berättelsens kärna sedd
   * från värdens sida: 409 på stämpeln (berättelse 127) är skyddet, och ett
   * lås som tappats är precis det fall där två ändå skriver. En värd som
   * krävde låset hade gjort skyddsnätet beroende av det den finns till för.
   */
  const skrevUtanLås = await asPerson(nisseCookie, "PUT", `/guides/${låstId}/draft`, {
    graph: graph("Nisse skriver ändå"),
    draftSavedAt: "",
  });

  check(
    "skrivvägarna kräver inte låset — stämpeln är skyddet, låset är vyn",
    skrevUtanLås.status === 200,
    `${skrevUtanLås.status} ${skrevUtanLås.text.slice(0, 80)}`,
  );

  const johansÖvertagande = await asPerson(johanCookie, "POST", `/guides/${låstId}/lock`, {
    takeOver: true,
  });

  check(
    "men en förvaltare tar över, och låset byter namn",
    johansÖvertagande.status === 200 && johansÖvertagande.json?.lock?.name === "Johan Furuskog",
    `${johansÖvertagande.status} ${johansÖvertagande.text.slice(0, 120)}`,
  );

  const medLås = await asPerson(annaCookie, "GET", `/guides/${låstId}`);
  const listanMedLås = await asPerson(annaCookie, "GET", "/guides");

  check(
    "guiden bär låset, så en sida vet innan den ritar något",
    medLås.json?.lock?.name === "Johan Furuskog" && medLås.json?.lock?.me === false,
    JSON.stringify(medLås.json?.lock ?? null),
  );
  check(
    "och listan bär det, så raden kan säga Låst av … under titeln",
    listanMedLås.json?.guides?.find((one) => one.id === låstId)?.lock?.name === "Johan Furuskog",
    JSON.stringify(listanMedLås.json?.guides?.map((one) => one.lock?.name ?? null) ?? null),
  );

  /* Förnyelsen behåller *sedan när* — raden säger när arbetet började. */
  const förnyat = await asPerson(johanCookie, "POST", `/guides/${låstId}/lock`, {});

  check(
    "en förnyelse behåller sedan-tiden och flyttar bara aktiv och till",
    förnyat.json?.lock?.since === johansÖvertagande.json?.lock?.since &&
      Date.parse(förnyat.json?.lock?.until ?? "") >= Date.parse(johansÖvertagande.json?.lock?.until ?? ""),
    `${förnyat.json?.lock?.since} / ${johansÖvertagande.json?.lock?.since}`,
  );

  /* Någon annans lås släpps inte av den som inte håller det. */
  const annansSläpp = await asPerson(annaCookie, "DELETE", `/guides/${låstId}/lock`);

  check(
    "man släpper sitt eget lås, aldrig någon annans",
    annansSläpp.status === 200 && annansSläpp.json?.lock?.name === "Johan Furuskog",
    `${annansSläpp.status} ${annansSläpp.text.slice(0, 100)}`,
  );

  const visar = spawnSync(process.execPath, [GUIDES, "show", låstId], {
    encoding: "utf8",
    env: { ...lockEnv, FLOWWEAVER_DB: lockDb },
  });

  check(
    "guides.mjs show säger vem som håller låset",
    visar.status === 0 && /^lås\s+Johan Furuskog sedan .* till /m.test(visar.stdout ?? ""),
    (visar.stdout ?? "").split("\n").find((one) => one.startsWith("lås")) ?? (visar.stderr ?? "").slice(0, 80),
  );

  const egetSläpp = await asPerson(johanCookie, "DELETE", `/guides/${låstId}/lock`);
  const efterSläpp = await asPerson(annaCookie, "GET", `/guides/${låstId}`);

  check(
    "och sitt eget släpps direkt, så nästa kan börja utan att vänta",
    egetSläpp.status === 200 && egetSläpp.json?.lock === null && efterSläpp.json?.lock === undefined,
    `${egetSläpp.status} ${JSON.stringify(efterSläpp.json?.lock ?? null)}`,
  );

  /*
   * Och det som gör låset till ett löfte med bäst-före: **ingen städar det**.
   *
   * Anna tar låset och rör sedan ingenting. Provet väntar ut värdens klocka på
   * riktigt — ingen stubbe, ingen framflyttad tid — och Nisse, som är redaktör
   * och aldrig får ta över, ska kunna ta låset utan att be om något.
   *
   * Mutationen som fäller det: låt `liveLock` svara på fältet i stället för på
   * tiden. Då är låset kvar i evighet och Nisses försök blir ett 409.
   */
  await asPerson(annaCookie, "POST", `/guides/${låstId}/lock`, {});
  await new Promise((resolve) => setTimeout(resolve, LOCK_MS + 500));

  const efterUtgång = await asPerson(annaCookie, "GET", `/guides/${låstId}`);
  const nisseTarLedigt = await asPerson(nisseCookie, "POST", `/guides/${låstId}/lock`, {});

  check(
    "ett lås förbi sin tid finns inte — guiden bär det inte längre",
    efterUtgång.json?.lock === undefined,
    JSON.stringify(efterUtgång.json?.lock ?? null),
  );
  check(
    "och nästa tar det utan att ta över, utan att någon städat något",
    nisseTarLedigt.status === 200 && nisseTarLedigt.json?.lock?.name === "Nisse Hult",
    `${nisseTarLedigt.status} ${nisseTarLedigt.text.slice(0, 100)}`,
  );

  /* ── 130: vilkas ändringar, och anteckningen ─────────────────────────── */

  /*
   * Två frågor som båda handlar om **avsikt** och inte om innehåll.
   *
   * Johan: *"Om inte Anna hade tänkt klart och inte vill att det skulle
   * publiceras?"* Versionerna skyddar innehållet, krocken skyddar arbetet —
   * det som saknades var en väg att säga *vänta*.
   */
  const stämpelNu = async (cookie) =>
    (await asPerson(cookie, "GET", `/guides/${låstId}`)).json?.draftSavedAt ?? "";

  await asPerson(annaCookie, "PUT", `/guides/${låstId}/draft`, {
    graph: graph("Annas ändring"),
    draftSavedAt: await stämpelNu(annaCookie),
  });

  const medSkribenter = await asPerson(johanCookie, "GET", `/guides/${låstId}`);
  const skribenter = medSkribenter.json?.draftEditors ?? [];

  check(
    "arbetskopian minns vilka som skrivit i den sedan förra versionen",
    skribenter.length === 2 &&
      skribenter.some((one) => one.name === "Nisse Hult" && one.me === false) &&
      skribenter.some((one) => one.name === "Anna Andersson" && one.me === false),
    JSON.stringify(skribenter),
  );
  check(
    "en rad per person och inte per sparning, med hens senaste tid",
    skribenter.every((one) => Number.isFinite(Date.parse(one.at ?? ""))),
    JSON.stringify(skribenter.map((one) => one.at)),
  );
  check(
    "och me avgörs av värden — Anna ser sig själv, Johan ser henne som en annan",
    (await asPerson(annaCookie, "GET", `/guides/${låstId}`)).json?.draftEditors?.find(
      (one) => one.name === "Anna Andersson",
    )?.me === true,
    JSON.stringify(
      (await asPerson(annaCookie, "GET", `/guides/${låstId}`)).json?.draftEditors ?? [],
    ),
  );
  check(
    "subjektet går aldrig ut på tråden, bara namnet",
    !JSON.stringify(medSkribenter.json ?? {}).includes("prov-anna"),
    JSON.stringify(skribenter),
  );

  /*
   * En andra sparning av samma person ERSÄTTER hens rad — den skrivs inte
   * till en gång till. Autosparen kör var tredje sekund, och en lista som
   * växer en rad per sparning hade blivit en logg innan eftermiddagen var
   * slut.
   *
   * Mutationen som fäller det: `withEditor` som lägger till utan att först
   * filtrera bort personens gamla rad (`server.mjs`, sett falla 19/9 —
   * QA). Utan den här kontrollen är testet ovan blint för det: Anna och
   * Nisse sparar bara en gång var i det här provet, så en trasig
   * avdubblering syns aldrig förrän en tredje sparning läggs till.
   */
  await asPerson(annaCookie, "PUT", `/guides/${låstId}/draft`, {
    graph: graph("Annas andra ändring"),
    draftSavedAt: await stämpelNu(annaCookie),
  });

  const efterAndraSparning = await asPerson(johanCookie, "GET", `/guides/${låstId}`);
  const skribenterEfterAndra = efterAndraSparning.json?.draftEditors ?? [];
  const annasRader = skribenterEfterAndra.filter((one) => one.name === "Anna Andersson");

  check(
    "en andra sparning av samma person ersätter raden i stället för att lägga till en till",
    skribenterEfterAndra.length === 2 && annasRader.length === 1,
    JSON.stringify(skribenterEfterAndra),
  );
  check(
    "och raden bär den senaste tiden, inte den första",
    Date.parse(annasRader[0]?.at ?? "") > Date.parse(skribenter.find((one) => one.name === "Anna Andersson")?.at ?? ""),
    `${annasRader[0]?.at} > ${skribenter.find((one) => one.name === "Anna Andersson")?.at}`,
  );

  /*
   * ── En publicering är ingen krock (berättelse 131, Johans mätning 20/9) ─
   *
   * Han publicerade; Anna, som arbetade i samma kopia, fick `409` vid sin
   * nästa sparning och en ruta som sa att han sparat medan hon arbetade —
   * fast han inte ändrat någonting, bara publicerat det hon bygger på. Slog
   * hon ihop fanns inga skillnader att välja mellan.
   *
   * Orsaken var mätt och inte gissad: publiceringen rör inte stämpeln, men
   * editorn tar bort arbetskopian efteråt. Då är `draftSavedAt` tom, och varje
   * stämpel skiljer sig från tomhet.
   *
   * Tre kontroller, och den andra är den som gör den första ofarlig.
   */
  const publId = (await asPerson(johanCookie, "POST", "/guides", { name: "Publicering" })).json
    ?.guide?.id;

  await asPerson(annaCookie, "PUT", `/guides/${publId}/draft`, {
    graph: graph("Annas arbete"),
    draftSavedAt: "",
  });

  const annasStämpel = (await asPerson(annaCookie, "GET", `/guides/${publId}`)).json?.draftSavedAt;
  const publFryst = await asPerson(johanCookie, "POST", `/guides/${publId}/versions`, {
    graph: graph("Annas arbete"),
    note: "Första",
    draftSavedAt: annasStämpel,
  });

  await asPerson(johanCookie, "POST", `/guides/${publId}/current`, {
    versionId: publFryst.json?.version?.id,
  });
  /* Det editorn gör efter en publicering: det som publicerats är inte längre
     opublicerat, så arbetskopian tas bort. */
  await asPerson(johanCookie, "DELETE", `/guides/${publId}/draft`);

  const annasSparning = await asPerson(annaCookie, "PUT", `/guides/${publId}/draft`, {
    graph: graph("Annas nya ändring"),
    draftSavedAt: annasStämpel,
  });

  check(
    "en publicering av den kopia jag bygger på är ingen krock",
    annasSparning.status === 200,
    `${annasSparning.status} ${JSON.stringify(annasSparning.json).slice(0, 100)}`,
  );

  /*
   * Och minnet är förbrukat i samma stund någon skriver: Anna har just
   * skrivit en ny arbetskopia, så en tredje person med den gamla stämpeln
   * missar HENNES ändring — och det är en riktig krock.
   *
   * Utan den här kontrollen är den ovanför farlig: en matchning som aldrig
   * går ut hade släppt igenom varje gammal stämpel för evigt.
   */
  const nissesGamla = await asPerson(nisseCookie, "PUT", `/guides/${publId}/draft`, {
    graph: graph("Nisse med gammal stämpel"),
    draftSavedAt: annasStämpel,
  });

  check(
    "men bara till nästa skrivning — sedan är en gammal stämpel en krock igen",
    nissesGamla.status === 409 && nissesGamla.json?.draftSavedBy?.name === "Anna Andersson",
    `${nissesGamla.status} ${JSON.stringify(nissesGamla.json).slice(0, 120)}`,
  );

  /*
   * Och 130:s avsiktsfält: publiceringen tömde dem, för de handlade om
   * arbetskopian sedan förra versionen — och den är nu publicerad. Annas
   * sparning efteråt gör henne till enda skribenten, inte till en andra rad
   * under en lista som skulle varit tömd.
   */
  const publEfter = await asPerson(johanCookie, "GET", `/guides/${publId}`);

  check(
    "och avsiktsfälten är tömda av publiceringen — den som skriver efteråt står ensam",
    (publEfter.json?.draftEditors ?? []).length === 1 &&
      publEfter.json.draftEditors[0].name === "Anna Andersson" &&
      publEfter.json?.draftNote === undefined,
    JSON.stringify({
      skribenter: publEfter.json?.draftEditors,
      anteckning: publEfter.json?.draftNote ?? "ingen",
    }),
  );

  /*
   * Och minnet gäller inte **genom** en kastad arbetskopia.
   *
   * Anna skrev efter publiceringen, och någon kastar sedan ändringarna. Då är
   * arbetskopian borta igen — men den stämpel som är publicerad har passerats
   * av hennes arbete, och en tredje person med den gamla stämpeln har missat
   * något. `409` är det ärliga svaret.
   *
   * Kontrollen finns för att nollställningen annars är omätt: mutationen som
   * tar bort den fällde ingenting alls, eftersom varje annat fall har en
   * arbetskopia och aldrig når matchningen.
   */
  await asPerson(johanCookie, "DELETE", `/guides/${publId}/draft`);

  const efterKastad = await asPerson(nisseCookie, "PUT", `/guides/${publId}/draft`, {
    graph: graph("Nisse efter en kastad kopia"),
    draftSavedAt: annasStämpel,
  });

  check(
    "och minnet gäller inte genom en kastad arbetskopia",
    efterKastad.status === 409,
    `${efterKastad.status} ${JSON.stringify(efterKastad.json).slice(0, 100)}`,
  );

  /*
   * ── Vems kopia en krockfrysning är (berättelse 131, tillägget 20/9) ────
   *
   * Johan såg fem rader i historiken som alla sa *av Anna Andersson*, fast
   * hälften var hans arbete: den som slog ihop skrev båda raderna, och `by`
   * sattes ur sessionen.
   *
   * Regeln mäts **här** och inte bara genom editorn, för den är värdens: en
   * klient säger vilken SIDA kopian är, och värden slår upp namnet. `mine` är
   * sessionen, `theirs` är `draftSavedBy`. Ett fält en klient sätter är ett
   * fält en klient kan sätta till någon annans namn — ett val mellan två namn
   * värden redan har är något annat.
   *
   * Anna är den som senast skrev i arbetskopian (raderna ovan), och Johan är
   * den som fryser. De två kopiorna ska därför bära var sitt namn.
   */
  const hennesSida = await asPerson(johanCookie, "POST", `/guides/${låstId}/snapshots`, {
    graph: graph("Annas arbete"),
    side: "theirs",
  });
  const minSida = await asPerson(johanCookie, "POST", `/guides/${låstId}/snapshots`, {
    graph: graph("Johans arbete"),
    side: "mine",
  });

  check(
    "en krockfrysning bär ägaren av kopian, inte den som tryckte på knappen",
    hennesSida.status === 200 &&
      minSida.status === 200 &&
      hennesSida.json?.version?.by?.name === "Anna Andersson" &&
      minSida.json?.version?.by?.name === "Johan Furuskog",
    JSON.stringify({
      theirs: hennesSida.json?.version?.by?.name,
      mine: minSida.json?.version?.by?.name,
    }),
  );
  /*
   * Och `me` är värdens svar på *är det den som frågar?*, aldrig en
   * namnjämförelse: två Anna Andersson på en kommun hade gjort en sådan till
   * fel svar för en av dem. Raden behöver det för att kunna säga *din kopia*.
   */
  const somJohan = await asPerson(johanCookie, "GET", `/guides/${låstId}`);
  const somAnna = await asPerson(annaCookie, "GET", `/guides/${låstId}`);
  const krockRader = (svar) =>
    (svar.json?.versions ?? [])
      .filter((one) => one.reason === "conflict")
      .map((one) => [one.by?.name ?? "", one.by?.me === true]);

  check(
    "och me är värdens svar — Johan ser sin egen kopia som sin, Anna sin",
    JSON.stringify(krockRader(somJohan)) ===
      JSON.stringify([
        ["Johan Furuskog", true],
        ["Anna Andersson", false],
      ]) &&
      JSON.stringify(krockRader(somAnna)) ===
        JSON.stringify([
          ["Johan Furuskog", false],
          ["Anna Andersson", true],
        ]),
    JSON.stringify({ johan: krockRader(somJohan), anna: krockRader(somAnna) }),
  );
  /*
   * Och ingen etikett lagras: raden ska kunna säga *din kopia*, och vem *du*
   * är beror på vem som läser — vilket kontrollen ovan är beviset för.
   */
  check(
    "och ingen av dem bär en lagrad etikett",
    krockRader(somJohan).length === 2 &&
      (somJohan.json?.versions ?? [])
        .filter((one) => one.reason === "conflict")
        .every((one) => one.label === undefined),
    JSON.stringify(
      (somJohan.json?.versions ?? []).filter((one) => one.reason === "conflict"),
    ),
  );

  /* Anteckningen: en mening till den som kommer efter. */
  const skrevAnteckning = await asPerson(annaCookie, "PUT", `/guides/${låstId}/note`, {
    text: "  Inte klar — juristen ska läsa\n resultattexterna.  ",
  });

  check(
    "den som arbetar skriver en anteckning, och värden sätter namn och tid",
    skrevAnteckning.status === 200 &&
      skrevAnteckning.json?.draftNote?.by?.name === "Anna Andersson" &&
      Number.isFinite(Date.parse(skrevAnteckning.json?.draftNote?.at ?? "")),
    `${skrevAnteckning.status} ${skrevAnteckning.text.slice(0, 120)}`,
  );
  check(
    "och gör den till EN rad — fyra ytor ritar den, och ett stycke är ett stycke på alla fyra",
    skrevAnteckning.json?.draftNote?.text === "Inte klar — juristen ska läsa resultattexterna.",
    JSON.stringify(skrevAnteckning.json?.draftNote?.text),
  );

  const nisseSerAnteckningen = await asPerson(nisseCookie, "GET", `/guides/${låstId}`);
  const listanMedAnteckning = await asPerson(nisseCookie, "GET", "/guides");

  check(
    "guiden bär anteckningen till alla som öppnar den",
    nisseSerAnteckningen.json?.draftNote?.text?.startsWith("Inte klar") === true &&
      nisseSerAnteckningen.json?.draftNote?.by?.me === false,
    JSON.stringify(nisseSerAnteckningen.json?.draftNote ?? null),
  );
  check(
    "och listan bär den, så ingen öppnar guiden för att publicera den i onödan",
    listanMedAnteckning.json?.guides
      ?.find((one) => one.id === låstId)
      ?.draftNote?.text?.startsWith("Inte klar") === true,
    JSON.stringify(
      listanMedAnteckning.json?.guides?.find((one) => one.id === låstId)?.draftNote ?? null,
    ),
  );

  const nisseSkriverÖver = await asPerson(nisseCookie, "PUT", `/guides/${låstId}/note`, {
    text: "Kör på!",
  });

  check(
    "en redaktör skriver inte över någon annans anteckning — 401, aldrig 403",
    nisseSkriverÖver.status === 401,
    `${nisseSkriverÖver.status} ${nisseSkriverÖver.text.slice(0, 80)}`,
  );

  /*
   * Och en redaktör tar inte bort den heller genom en tom text. Borttagandet
   * ÄR ett sätt att ändra anteckningen — att tysta någon annans invändning —
   * och samma regel gäller: den som skrev den, eller en publicerare.
   *
   * Mutationen som fäller det: kontrollera `text === ""` FÖRE
   * behörighetsvakten i stället för efter (`server.mjs`, sett falla 19/9 —
   * QA). Då blir en tom text en genväg förbi vakten, och ordningen syns
   * ingenstans i svaret om inte någon annan än den som skrev anteckningen
   * försöker tömma den.
   */
  const nisseFörsökerTaBort = await asPerson(nisseCookie, "PUT", `/guides/${låstId}/note`, {
    text: "",
  });

  check(
    "och en redaktör tar inte bort den genom att tömma texten — 401",
    nisseFörsökerTaBort.status === 401,
    `${nisseFörsökerTaBort.status} ${nisseFörsökerTaBort.text.slice(0, 80)}`,
  );
  check(
    "den finns kvar efter försöket",
    (await asPerson(nisseCookie, "GET", `/guides/${låstId}`)).json?.draftNote?.text?.startsWith(
      "Inte klar",
    ) === true,
    JSON.stringify((await asPerson(nisseCookie, "GET", `/guides/${låstId}`)).json?.draftNote ?? null),
  );

  check(
    "och den står kvar oförändrad efteråt",
    (await asPerson(nisseCookie, "GET", `/guides/${låstId}`)).json?.draftNote?.text?.startsWith(
      "Inte klar",
    ) === true,
    JSON.stringify((await asPerson(nisseCookie, "GET", `/guides/${låstId}`)).json?.draftNote ?? null),
  );

  const johanTarBort = await asPerson(johanCookie, "PUT", `/guides/${låstId}/note`, { text: " " });

  check(
    "men en publicerare får ta bort den — en tom text ÄR borttagandet",
    johanTarBort.status === 200 &&
      johanTarBort.json?.draftNote === null &&
      (await asPerson(nisseCookie, "GET", `/guides/${låstId}`)).json?.draftNote === undefined,
    `${johanTarBort.status} ${johanTarBort.text.slice(0, 80)}`,
  );

  /* Och publiceringen nollställer båda fälten: de gällde arbetskopian. */
  await asPerson(annaCookie, "PUT", `/guides/${låstId}/note`, { text: "Inte klar än." });

  const fryst = await asPerson(annaCookie, "POST", `/guides/${låstId}/versions`, {
    graph: graph("Annas ändring"),
    draftSavedAt: await stämpelNu(annaCookie),
  });
  const efterPublicering = await asPerson(annaCookie, "GET", `/guides/${låstId}`);

  check(
    "publiceringen fryser versionen",
    fryst.status === 200 && typeof fryst.json?.version?.id === "string",
    `${fryst.status} ${fryst.text.slice(0, 80)}`,
  );
  /*
   * Två kontroller och inte en: fälten nollställs av samma rad, och en enda
   * kontroll hade gått grön för fel av dem. Mutationerna är var sin — behåll
   * `draftEditors`, behåll `draftNote` — och de ska fälla var sin kontroll.
   */
  check(
    "och nollställer skribenterna — Anna står inte kvar i nästa granskning",
    efterPublicering.json?.draftEditors === undefined,
    JSON.stringify(efterPublicering.json?.draftEditors ?? null),
  );
  check(
    "och tar bort anteckningen — den gällde arbetskopian, och den är publicerad nu",
    efterPublicering.json?.draftNote === undefined,
    JSON.stringify(efterPublicering.json?.draftNote ?? null),
  );

  /* En värd utan inloggning har ingen att skriva under anteckningen. */
  const anteckningUtanInloggning = await call("PUT", `/guides/${id}/note`, {
    body: { text: "Hej" },
    secret,
  });

  check(
    "en värd utan leverantör svarar 404 på anteckningen, som på låset",
    anteckningUtanInloggning.status === 404,
    `${anteckningUtanInloggning.status} ${anteckningUtanInloggning.text.slice(0, 80)}`,
  );

  /*
   * ── `lockMinutes`: negativt och skräp, ren funktion (locks.mjs) ────────
   *
   * `LOCK_MINUTES=0` är ett uttryckligt val (stänger av låset, prövat nedan).
   * Men `locks.mjs` säger också att negativt och skräp i `.env` **inte** ska
   * tolkas som noll — en felskrivning ska falla tillbaka på förvalet (tio
   * minuter), tyst, aldrig stänga av skyddet ingen bad om. Mät direkt mot
   * funktionen: ingen server behöver startas för att pröva en ren beräkning.
   *
   * Mutationen som fäller det: byt `LOCK_MINUTES_DEFAULT` mot `0` i det sista
   * villkoret i `lockMinutes` — negativt och skräp ger då noll, alltså av,
   * i stället för värdens tänkta tio minuter.
   */
  check(
    "lockMinutes: negativt och skräp ger förvalet, aldrig noll",
    lockMinutes({ LOCK_MINUTES: "-5" }) === LOCK_MINUTES_DEFAULT &&
      lockMinutes({ LOCK_MINUTES: "banan" }) === LOCK_MINUTES_DEFAULT &&
      lockMinutes({ LOCK_MINUTES: "" }) === LOCK_MINUTES_DEFAULT &&
      lockMinutes({}) === LOCK_MINUTES_DEFAULT &&
      lockMinutes({ LOCK_MINUTES: "0" }) === 0,
    JSON.stringify({
      negativt: lockMinutes({ LOCK_MINUTES: "-5" }),
      skräp: lockMinutes({ LOCK_MINUTES: "banan" }),
      tomt: lockMinutes({ LOCK_MINUTES: "" }),
      saknas: lockMinutes({}),
      noll: lockMinutes({ LOCK_MINUTES: "0" }),
      förval: LOCK_MINUTES_DEFAULT,
    }),
  );

  /*
   * ── Låset avstängt: `LOCK_MINUTES=0` (berättelse 129, tillägget 20/9) ──
   *
   * Johan kunde inte framkalla 131:s krock för hand: sidan förnyar låset före
   * varje sparning, så den som blivit av med det hamnar i läsläge i stället
   * för att skriva. Skyddet fungerar — och just därför måste det gå att
   * stänga av för att mäta det som ligger bakom.
   *
   * Med noll är värden **precis en värd som inte byggt låset**: vägarna svarar
   * `404` och guiden bär inget `lock`. Kontraktet säger att det är ett
   * fullgott svar, och sidan arbetar då som före 129.
   *
   * Egen server, för `LOCK_MINUTES` läses en gång vid start — och det är rätt:
   * en livslängd som kan byta mitt i en session hade gjort varje lås till en
   * fråga om när det togs.
   */
  const utanLåsDb = join(work, "utan-las.sqlite");
  const UTAN_LÅS_PORT = 4325;
  const UTAN_LÅS_BAS = `http://localhost:${UTAN_LÅS_PORT}`;

  oläsberServer = spawn(process.execPath, [SERVER, String(UTAN_LÅS_PORT)], {
    env: { ...lockEnv, FLOWWEAVER_DB: utanLåsDb, LOCK_MINUTES: "0" },
    stdio: "ignore",
  });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(`${UTAN_LÅS_BAS}/guides`)).status > 0) break;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const utanLås = async (method, path, body) => {
    const answer = await fetch(`${UTAN_LÅS_BAS}${path}`, {
      method,
      headers: { "content-type": "application/json", cookie: johanCookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await answer.text();

    return {
      status: answer.status,
      json: (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })(),
    };
  };

  const utanLåsGuide = await utanLås("POST", "/guides", { name: "Utan lås" });
  const utanLåsId = utanLåsGuide.json?.guide?.id ?? "";

  await utanLås("PUT", `/guides/${utanLåsId}/draft`, { graph: graph("Utan lås"), draftSavedAt: "" });

  const taLåset = await utanLås("POST", `/guides/${utanLåsId}/lock`, { window: "w1" });
  const släppLåset = await utanLås("DELETE", `/guides/${utanLåsId}/lock?window=w1`);
  const guidenUtanLås = await utanLås("GET", `/guides/${utanLåsId}`);

  check(
    "LOCK_MINUTES=0: låsvägarna svarar 404, som hos en värd utan lås",
    taLåset.status === 404 &&
      taLåset.json?.error === "no-lock" &&
      släppLåset.status === 404,
    JSON.stringify({ ta: taLåset.status, släpp: släppLåset.status, fel: taLåset.json?.error }),
  );
  /*
   * Och guiden bär inget `lock` — **inte ens när ett ligger kvar i registret**.
   *
   * Det är en annan kodväg än vägarna ovan, och den mäts därför med ett lås
   * skrivet rakt i registret: precis det som finns kvar dagen någon skruvar
   * ner `LOCK_MINUTES` till noll medan Anna har guiden öppen. Svarar
   * `GET /guides/<id>` då med låset ritar sidan en låsrad över en guide ingen
   * kan släppa, för vägen att släppa den svarar `404`.
   *
   * Mätt som mönster och inte som tro: utan låset i registret hade kontrollen
   * varit grön av fel skäl, eftersom vägarna ändå aldrig tar något.
   */
  const utanLåsRegister = openStore(utanLåsDb);
  const utanLåsPost = utanLåsRegister.get(`guide/${utanLåsId}`);

  utanLåsRegister.put({
    kind: "guide",
    id: utanLåsId,
    value: {
      ...utanLåsPost.value,
      lock: {
        subject: "prov-anna",
        name: "Anna Andersson",
        window: "w-gammalt",
        since: new Date().toISOString(),
        activeAt: new Date().toISOString(),
        until: new Date(Date.now() + 600_000).toISOString(),
      },
    },
  });

  const medGammaltLås = await utanLås("GET", `/guides/${utanLåsId}`);

  check(
    "och guiden bär inget lås ens med ett kvarglömt i registret",
    guidenUtanLås.json?.lock === undefined && medGammaltLås.json?.lock === undefined,
    JSON.stringify({
      utan: guidenUtanLås.json?.lock ?? "inget",
      medKvarglömt: medGammaltLås.json?.lock ?? "inget",
    }),
  );
  /* Och skrivvägarna är orörda: låset var aldrig skyddet (berättelse 129). */
  check(
    "men arbetskopian går att skriva precis som förut — låset var aldrig skyddet",
    (
      await utanLås("PUT", `/guides/${utanLåsId}/draft`, {
        graph: graph("Utan lås, andra skrivningen"),
        draftSavedAt: guidenUtanLås.json?.draftSavedAt ?? "",
      })
    ).status === 200,
    "PUT …/draft",
  );

  /*
   * QA (uppdrag 22/9, mätning 2b): ingen väg skriver om en EXISTERANDE
   * version. Kropparna nedan måste vara VÄLFORMADE ({ graph }, som
   * `POST …/versions` kräver) — ett första försök med en bar graf (utan
   * kuvertet) gick 400/405 på fel grund: fel form, inte fel väg. Mätt mot
   * en riktig server (curl) med en korrekt kropp visar det verkliga läget:
   *
   *  - `PUT` mot adressen matchar ingen rutt alls (bara GET och POST är
   *    definierade för `section === "versions"`) och faller till
   *    `no-method`, 405 — en riktig avvisning.
   *  - `POST` mot SAMMA adress matchade däremot samma rutt som
   *    `POST …/versions` (kontrollen var `section === "versions"`, inte
   *    `!versionId`) och **lyckades** — den frös en NY version och struntade
   *    i id:t i adressen. Den skrev alltså aldrig om `secondId`, men den
   *    avvisades inte heller: adressen `…/versions/<vid>` med `POST` var i
   *    praktiken en synonym för `…/versions`.
   *
   * **Rättat 22/9** (Pers mätning, som gav `number: 3` på en tyst tredje
   * version). Servern prövar nu adressen före allt annat: ett sista segment
   * hör till `GET …/versions/<vid>` och ingen annan väg. `POST` och `PUT` på
   * den är `405 no-method` — vägen finns, men inte med den metoden — och ett
   * segment på någon annan sektion är `404 no-route`. Att avvisningen sker
   * före behörighetsprövningen är med flit: det är ett påstående om adressen
   * och sant oavsett vem som frågar.
   *
   * Kropparna nedan är välformade av samma skäl som förut: en avvisning på
   * fel grund mäter inte vägen.
   *
   * Mutationen som fäller raderna: ta bort `versionId !== undefined`-vakten i
   * `server.mjs`, så fryser `POST` igen och antalet växer.
   */
  const försöktePutta = await call("PUT", `/guides/${id}/versions/${secondId}`, {
    body: { graph: graph("Försök ändra en publicerad version") },
    secret,
  });
  const antalFörePost = (await call("GET", `/guides/${id}`, { secret })).json?.versions?.length;
  const försöktePosta = await call("POST", `/guides/${id}/versions/${secondId}`, {
    body: { graph: graph("Försök ändra en publicerad version") },
    secret,
  });
  const antalEfterPost = (await call("GET", `/guides/${id}`, { secret })).json?.versions?.length;

  const draftMedSegment = await call("PUT", `/guides/${id}/draft/${secondId}`, {
    body: { graph: graph("Fel adress"), draftSavedAt: "" },
    secret,
  });

  check(
    "PUT mot en versions egna adress är 405 no-method — vägen finns, men bara med GET",
    försöktePutta.status === 405 && försöktePutta.json?.error === "no-method",
    `${försöktePutta.status} ${försöktePutta.text.slice(0, 120)}`,
  );
  check(
    "POST mot samma adress är också 405 no-method, inte en tyst frysning",
    försöktePosta.status === 405 && försöktePosta.json?.error === "no-method",
    `${försöktePosta.status} ${försöktePosta.text.slice(0, 120)}`,
  );
  check(
    "och ingen ny version skrevs",
    antalEfterPost === antalFörePost,
    JSON.stringify({ förut: antalFörePost, efter: antalEfterPost }),
  );
  check(
    "ett extra segment på en annan sektion är 404 no-route, och skriver ingenting",
    draftMedSegment.status === 404 && draftMedSegment.json?.error === "no-route",
    `${draftMedSegment.status} ${draftMedSegment.text.slice(0, 120)}`,
  );

  const publiceradVidSlutet = await call("GET", `/guides/${id}/versions/${secondId}`, { secret });

  check(
    "och den publicerade versionen ÄR bytevis lika nu som vid provets start — POST-försöket rörde den aldrig",
    publiceradVidSlutet.text === publiceradVidStart.text,
    publiceradVidSlutet.text === publiceradVidStart.text
      ? "identisk"
      : `skiljer sig — start: ${publiceradVidStart.text.slice(0, 100)} | slut: ${publiceradVidSlutet.text.slice(0, 100)}`,
  );

  const removed = guides("remove", id);
  const gone = await call("GET", `/guides/${id}`, { secret });

  check(
    "guides.mjs remove tar guiden och dess versioner",
    removed.code === 0 && gone.status === 404 && !guides("list").out.includes(id),
    `${removed.out.trim()} — ${gone.status}`,
  );
} finally {
  server.kill();
  lockServer?.kill();
  oläsberServer?.kill();
}

const failed = checks.filter((one) => !one.ok);

console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
console.log(`databas: ${dbFile}${existsSync(dbFile) ? "" : " (skapades aldrig)"}`);
process.exit(failed.length ? 1 : 0);
