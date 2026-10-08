/**
 * The guides a host keeps, from a terminal on the machine that keeps them.
 *
 *     FLOWWEAVER_DB=/srv/flowweaver/data/flowweaver.sqlite node guides.mjs new --note "Bostadsbidrag"
 *     … guides.mjs list
 *     … guides.mjs show <id>
 *     … guides.mjs remove <id>
 *
 * ## Why creating a guide is a command and not a route
 *
 * `docs/LAGRING-KONTRAKT.md` has five routes and none of them creates a guide.
 * That is on purpose: creating one mints the secret that owns it, and a route
 * that hands out ownership to whoever asks is a route that hands out ownership
 * to whoever asks. Here the act happens where somebody is already logged in to
 * the machine, and the secret is said once, on their screen.
 *
 * A host with real identity does this differently — a guide belongs to whoever
 * created it in their system, and the secret is not needed at all. The contract
 * says nothing about either, which is the point of it.
 *
 * ## The secret, and why only its hash is kept
 *
 * 32 random bytes as hex. It is carried as `Authorization: Bearer` and stored
 * as SHA-256, so a stolen database is not a stolen set of guides — the same
 * reason nobody keeps passwords. It cannot be shown again: `show` prints the
 * hash's first characters so two guides can be told apart, never the secret.
 *
 * Whoever has the link owns the guide, like a shared document link. That is
 * **not** the right shape for an authority, and the contract does not make it
 * one.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { loadEnvFile } from "./env.mjs";
import { liveLock } from "./locks.mjs";
import { entryKey, openStore } from "./store.mjs";

loadEnvFile();

/** `--note "Bostadsbidrag"`; everything else is a positional word. */
function readArguments(argv) {
  const flags = {};
  const words = [];

  for (let at = 0; at < argv.length; at += 1) {
    const one = argv[at];

    if (one.startsWith("--")) {
      const next = argv[at + 1];

      if (next !== undefined && !next.startsWith("--")) {
        flags[one.slice(2)] = next;
        at += 1;
      } else {
        flags[one.slice(2)] = true;
      }
    } else {
      words.push(one);
    }
  }

  return { flags, words };
}

const [command = "", ...rest] = process.argv.slice(2);
const { flags, words } = readArguments(rest);

const HELP = `Guiderna hos värden (docs/LAGRING-KONTRAKT.md, docs/DRIFT.md)

  guides.mjs new [--note "Namn"]     # myntar id och hemlighet, säger dem en gång
  guides.mjs list
  guides.mjs show <id>               # bl.a. vem som håller låset just nu
  guides.mjs owner <id> <subject>    # säger vem som skapade en befintlig guide
  guides.mjs remove <id>             # guiden OCH dess versioner

Databasen pekas ut av FLOWWEAVER_DB. Hemligheten lagras hashad och kan aldrig
visas igen — tappas den, mynta en ny guide och flytta över innehållet.`;

const stop = (message, code = 2) => {
  console.error(message);
  process.exit(code);
};

if (command === "" || command === "help" || command === "--help") {
  console.log(HELP);
  process.exit(command === "" ? 2 : 0);
}

const dbFile = (process.env.FLOWWEAVER_DB ?? "").trim();

if (dbFile === "") {
  stop(
    "FLOWWEAVER_DB är inte satt — säg vilken databas det gäller:\n" +
      `  FLOWWEAVER_DB=/srv/flowweaver/data/flowweaver.sqlite node guides.mjs ${command} …`,
  );
}

let store;

try {
  store = openStore(resolve(dbFile));
} catch (error) {
  stop(`Registret gick inte att öppna (${dbFile}): ${error.message}`);
}

/** The same hash the server compares against. One line, one place. */
export const hashSecret = (secret) => createHash("sha256").update(String(secret)).digest("hex");

/** Every version of one guide, newest first. Filtered in JS, like `cases.mjs`. */
const versionsOf = (guideId) =>
  store
    .list({ kind: "version" })
    .filter((entry) => entry.value?.guideId === guideId)
    .sort((a, b) => (b.value?.savedAt ?? 0) - (a.value?.savedAt ?? 0));

switch (command) {
  case "new": {
    const id = randomUUID();
    const secret = randomBytes(32).toString("hex");

    store.put({
      kind: "guide",
      id,
      value: {
        id,
        ...(typeof flags.note === "string" ? { note: flags.note } : {}),
        current: "",
        secretHash: hashSecret(secret),
        createdAt: new Date().toISOString(),
      },
    });

    /*
     * Said once, and on stdout so it can be piped into something that keeps
     * it. It is never stored in a readable form, so this is the only moment it
     * exists outside whoever is reading the screen.
     */
    console.log(`id: ${id}`);
    console.log(`hemlighet: ${secret}`);
    console.log(`adress: ?guide=${id}&key=${secret}`);
    console.log("Hemligheten visas aldrig igen. Den som har den äger guiden.");
    break;
  }

  case "list": {
    const guides = store.list({ kind: "guide" });

    for (const entry of guides) {
      const value = entry.value ?? {};
      const count = versionsOf(value.id).length;

      console.log(
        `${value.id}  ${value.createdAt ?? "?"}  ${count} ${count === 1 ? "version" : "versioner"}  ${value.note ?? ""}`.trimEnd(),
      );
    }

    console.log(`${guides.length} ${guides.length === 1 ? "guide" : "guider"}`);
    break;
  }

  case "show": {
    const id = words[0];

    if (!id) {
      stop("Säg vilken guide: guides.mjs show <id>");
    }

    const entry = store.get(entryKey("guide", id));

    if (!entry) {
      stop(`Ingen guide ${id} i registret.`, 1);
    }

    const value = entry.value ?? {};
    const versions = versionsOf(id);

    console.log(`${value.id}  ${value.note ?? ""}`.trimEnd());
    console.log(`skapad     ${value.createdAt ?? "?"}`);
    /*
     * *Skapad av*, och inget mer sedan berättelse 127: listan är
     * organisationens, så en guide utan ägare syns för varje inloggad ändå.
     * "ingen" är därför ett vanligt läge och inte en återvändsgränd — det är
     * vad varje guide myntad här före inloggningen fanns säger.
     */
    console.log(`skapad av  ${value.owner || "ingen"}`);
    // Vem som rörde guiden sist — det listan ritar som *av Nisse Hult*.
    console.log(`ändrad av  ${value.updatedBy?.name || "ingen"}`);
    // The hash, shortened: enough to tell two guides apart in a log, useless
    // to anybody who wants in.
    console.log(`hemlighet  sha256:${String(value.secretHash ?? "").slice(0, 12)}…`);
    console.log(`arbetskopia ${value.draft ? `skriven ${value.draftSavedAt ?? "?"}` : "ingen"}`);
    /*
     * Vem som arbetar i guiden just nu (berättelse 129).
     *
     * `liveLock` och inte `value.lock`: ett lås som passerat sin tid finns
     * inte, och raden ska säga samma sak som vägarna gör. Posten kan ligga
     * kvar i registret länge efter att den slutat betyda något — den städas
     * aldrig, och det är hela poängen med bäst-före.
     *
     * Den som undrar *varför får jag inte redigera?* läser den här raden, och
     * `till` är svaret på *hur länge till?*
     */
    const held = liveLock(value);

    console.log(
      `lås        ${
        held ? `${held.name || held.subject} sedan ${held.since}, till ${held.until}` : "inget"
      }`,
    );
    console.log(`publicerad ${value.current || "ingen"}`);
    console.log(`${versions.length} ${versions.length === 1 ? "version" : "versioner"}`);

    for (const version of versions) {
      const one = version.value ?? {};

      console.log(
        `  ${one.id}  ${new Date(one.savedAt ?? 0).toISOString()}  ${one.id === value.current ? "◀ publicerad  " : ""}${one.note ?? ""}`.trimEnd(),
      );
    }

    break;
  }

  /*
   * *Skapad av* på en guide som redan finns.
   *
   * **Det behövs inte längre för att guiden ska synas** (berättelse 127):
   * listan är organisationens, så en guide myntad med `new` — utan `owner` —
   * står i varje inloggad redaktörs lista utan att någon kör något. Det var
   * den återvändsgränd kommandot skrevs för, och den är borta.
   *
   * Kvar står det kommandot faktiskt gör: sätter vem som skapade guiden, så
   * att raden säger sant om den dagen någon frågar. Kör det när du vet svaret,
   * hoppa över det annars.
   *
   * `subject` är värdens egen identifierare för personen, densamma som
   * `sub` i id-tokenet. Den står i mottagarens logg vid varje inloggning
   * (`inloggad <subject> (<namn>)`), och det är enda stället den finns —
   * `/auth/me` ger namn och adress, aldrig id:t.
   *
   * **Hemligheten rörs inte.** Två skäl: att skriva om posten för att ta bort
   * ett fält är att riskera resten av den, och en hemlighet som ligger kvar
   * gör bytet återställbart — stänger man av leverantören igen fungerar den
   * gamla länken precis som förut. Med leverantören på är den ändå avvisad, så
   * den ligger inte och betyder något i tysthet.
   */
  case "owner": {
    const [id, subject] = words;

    if (!id || !subject) {
      stop('Säg vilken guide och vem: guides.mjs owner <id> <subject>\n' +
        "Subjektet står i mottagarens logg vid inloggning:\n" +
        "  journalctl -u flowweaver-receiver | grep inloggad");
    }

    const entry = store.get(entryKey("guide", id));

    if (!entry) {
      stop(`Ingen guide ${id} i registret.`, 1);
    }

    const value = entry.value ?? {};
    const before = value.owner ?? "";

    store.put({ kind: "guide", id, value: { ...value, owner: subject } });

    console.log(`${id}`);
    console.log(`skapad av ${before === "" ? "ingen" : before} → ${subject}`);
    console.log("Hemligheten är orörd. Med en leverantör inkopplad avvisas den ändå.");
    break;
  }

  case "remove": {
    const id = words[0];

    if (!id) {
      stop("Säg vilken guide: guides.mjs remove <id>");
    }

    const entry = store.get(entryKey("guide", id));

    if (!entry) {
      stop(`Ingen guide ${id} i registret.`, 1);
    }

    /*
     * The versions go with it. A version whose guide is gone is a row nothing
     * can reach and nothing will ever tidy — the same reason `cases.mjs remove`
     * takes the outbox files.
     */
    const versions = versionsOf(id);

    for (const version of versions) {
      store.remove(version.key);
    }

    store.remove(entry.key);

    console.log(
      `Borttaget: guide ${id} + ${versions.length} ${versions.length === 1 ? "version" : "versioner"}`,
    );
    break;
  }

  default:
    stop(`Okänt kommando "${command}".\n\n${HELP}`);
}

store.close();
