import type {
  GraphLoadResult,
  GraphPublishResult,
  GraphSaveConflict,
  GraphSaveResult,
  GraphStore,
  GraphVersionResult,
} from "./local-storage-graph-store";
import { readLock } from "./guide-lock";

import type { GuideLock } from "./guide-lock";
import type { GuideVersion } from "../editor/components/guide-versions/guide-versions";
import type { GraphData } from "../viewer/types/graph";

import { GENERAL, hostErrorCode, hostErrorKey } from "../viewer/core/host-errors";

/**
 * The storage contract, spoken over HTTP (story 124,
 * `docs/LAGRING-KONTRAKT.md`).
 *
 * ## Why this lives in `src/site/` and not in the library
 *
 * Because the library knows nothing about anybody's server, and that is the
 * property worth keeping. `src/viewer` and `src/editor` have never mentioned
 * an address, a token or a host, and everything a page does with one goes
 * through a contract the host implements — the submission receiver, the lookup
 * BFF, and now this. The site is *a* host that happens to use the reference
 * one; a second host writes its own thirty lines and changes nothing in the
 * package.
 *
 * ## The two shapes `load` has to tell apart
 *
 * A guide with a working copy opens that. A guide with only published versions
 * opens the published one — which lives behind a second request, because the
 * list carries rows and not graphs. A guide with neither is `empty`, and a
 * server that answers something else is an error rather than an invented empty
 * guide: an id typed wrong must not look like a blank canvas.
 *
 * ## The secret is a header, never an address
 *
 * `Authorization: Bearer` and not a query parameter, because addresses end up
 * in logs, in referrers and in shoulder-surfing distance. The page reads it
 * from `?key=` once and never puts it back on the wire that way.
 *
 * ## Two ways to say who is asking, and a host has exactly one
 *
 * Story 126 gives the reference host a login, and with one the guide's secret
 * is refused however good it is (`docs/LAGRING-KONTRAKT.md`, *Identitet*). So
 * this adapter carries **either** the session — `credentials: "include"`, which
 * sends the host's own cookie and nothing this page can read — **or** the
 * secret. Never both: a client that offers two credentials to a host that
 * accepts one has only made it harder to tell which one failed.
 *
 * Which it is comes from the page, because the page is the only one that knows:
 * it asked `GET /auth/me` before it opened anything.
 */
export interface ServerGraphStoreOptions {
  /** Where the host answers, e.g. `https://api.flowweaver.se`. No trailing slash needed. */
  base: string;
  /**
   * The guide's secret, carried as a Bearer token.
   *
   * Left out by a host with a login — see `session` below.
   */
  secret?: string;
  /**
   * The host has a login, so the session cookie is the identity.
   *
   * `credentials: "include"` and no `Authorization` header at all. The cookie
   * is `HttpOnly`, which is the point: nothing here can read it, so nothing
   * injected into this page can take it.
   */
  session?: boolean;
  /** For tests, and for a host that wraps `fetch` with its own session. */
  fetch?: typeof globalThis.fetch;
}

/**
 * What the editor's status line says when the host stops recognising you.
 *
 * A `401` used to become *Värden svarade 401*, which is the truth and no help:
 * the one thing an editor can do about it is log in again, and a line that does
 * not say so reads as "saving is broken" — so people keep typing into a page
 * that has quietly stopped saving (story 126, criterion 5).
 */
export const SIGN_IN_AGAIN = "Logga in igen — värden känner inte igen dig längre.";

/**
 * The fallback for a conflict, for a caller that does not look at `conflict`.
 *
 * The page that has words of its own says who and what to do; this one is the
 * plain truth for anything else, and it is never the sentence somebody reads
 * on `dev/guide-storage.html`.
 */
export const SOMEBODY_ELSE_SAVED = "Arbetskopian ändrades av någon annan.";

/**
 * Rollen räcker inte — och en ny inloggning ger samma roll tillbaka.
 *
 * Servern svarade `401` på det här fram till 22/9, och klienten kunde därför
 * inte skilja *du är utloggad* från *du får inte*: redaktören skickades genom
 * en inloggning som landade på exakt samma nej. Med A8 svarar servern `403`
 * med koden `forbidden`, och beskedet säger vad som gäller i stället för att
 * föreslå en väg som inte finns.
 */
export const NOT_ALLOWED =
  "Du har inte behörighet att ändra den här guiden. Be den som förvaltar den om skrivrätt.";

/**
 * Redaktörens ord för en avvisning.
 *
 * Nyckeln kommer ur `hostErrorKey`, som är tabellen kod → nyckel och bor på
 * ett ställe för hela klienten. Den här funktionen är ordlistan för editorns
 * yta: samma kod ger andra ord för en besökare, och den ytan har sin egen rad.
 *
 * **Siffran är kvar som det generella beskedet**, och det är ett beslut med
 * skäl bakom sig och inte en lucka: ett fel redaktören inte kan göra något åt
 * ska inte få en mening som låtsas att hen kan. Siffran är däremot något hen
 * kan säga vidare till den som driftar servern. Jag bytte den mot en mening
 * först, och tre prov sa ifrån — de bar beslutet, och beslutet var det bättre.
 *
 * **Statusen är kvar som reserv**, och det är mätt: fram till 22/9 mappade den
 * här klienten bara status, och en värd som svarar `401` utan kropp — en
 * proxy, en äldre server — hade tappat *Logga in igen* den dag koden blev det
 * enda vi läste. Koden först, statusen när den saknas.
 */
function refusalWords(code: string | null, status: number): string {
  const key = code === null ? GENERAL : hostErrorKey(code);

  if (key === "host.signIn") return SIGN_IN_AGAIN;
  if (key === "host.forbidden") return NOT_ALLOWED;
  if (key === "host.conflict" || key === "host.locked") return SOMEBODY_ELSE_SAVED;

  /*
   * `403` utan kropp är fortfarande ett rättighetsfel, och att falla tillbaka
   * på siffran här hade gett tillbaka just den förväxling A8 tog bort.
   */
  if (status === 403) return NOT_ALLOWED;
  if (status === 401) return SIGN_IN_AGAIN;
  if (status === 409) return SOMEBODY_ELSE_SAVED;

  return `Värden svarade ${status}.`;
}

export class ServerGraphStore implements GraphStore {
  private readonly base: string;
  private readonly secret: string;
  private readonly session: boolean;
  private readonly fetcher: typeof globalThis.fetch;
  /** Set once the page is going away; see `beforeUnload`. */
  private unloading = false;
  /**
   * The `draftSavedAt` this client last saw, sent back untouched on every write
   * (story 127, `docs/LAGRING-KONTRAKT.md`).
   *
   * The empty string means *there was no working copy when I read*, which is a
   * condition of its own: a copy that has appeared since is as much somebody
   * else's work as a newer one is.
   *
   * It lives here and not in the page because the page never asked for it. The
   * store already answers *what is the state of this guide with the host* —
   * the token is part of that state, and threading it through
   * `saveDraft(guideId, graph)` would have meant a sixth question in a
   * six-question contract.
   */
  private knownDraftSavedAt = "";
  /**
   * Writes go one at a time, in order.
   *
   * Measured need, not tidiness: *Publicera* calls `autosave.flush()` — which
   * starts a `PUT …/draft` without awaiting it — and then freezes a version.
   * Both carry the condition, and whichever landed second would carry a token
   * the first had just replaced. The editor would have been told that somebody
   * else changed the guide, and that somebody would have been itself.
   */
  private queue: Promise<unknown> = Promise.resolve();

  /** Next in line: runs after whatever is in flight, whether that worked or not. */
  private inOrder<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work);

    this.queue = next.catch(() => undefined);

    return next;
  }

  constructor(options: ServerGraphStoreOptions) {
    this.base = options.base.replace(/\/$/, "");
    this.secret = options.secret ?? "";
    this.session = options.session === true;
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * The page is closing: the next write has to outlive it.
   *
   * `keepalive` is the only thing a browser offers for that, and it is used
   * **only** here — its 64 kB body limit would otherwise make a large guide
   * unsavable on the ordinary path. What is at risk is therefore at most what
   * was typed since the last interval, and a guide that big is rare enough to
   * be worth the honest trade rather than a second mechanism.
   */
  beforeUnload(): void {
    this.unloading = true;
  }

  private async ask(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<
    | { ok: true; status: number; json: Record<string, unknown> }
    | { ok: false; message: string; status: number; json: Record<string, unknown> | null }
  > {
    try {
      const answer = await this.fetcher(`${this.base}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          ...(this.session ? {} : { authorization: `Bearer ${this.secret}` }),
        },
        ...(this.session ? { credentials: "include" as const } : {}),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        ...(this.unloading ? { keepalive: true } : {}),
      });

      if (!answer.ok) {
        /*
         * `401` is the one status an editor can do something about, so it is
         * the one that gets words instead of a number: the session has run out
         * or somebody else's guide was opened, and either way the way forward
         * is to log in again. Saying *Värden svarade 401* is true and reads as
         * "saving is broken", which is how people keep typing into a page that
         * has stopped saving.
         *
         * Every other status keeps the number and nothing else. The host's own
         * words about *why* it refused are for the host's log — a page that
         * repeats them teaches an editor to read error codes, and the one thing
         * they can do about any of them is the same: tell whoever runs the
         * server.
         */
        /*
         * Kroppen läses FÖRE beskedet sedan 22/9, för det är kroppen som bär
         * koden. Den parsas ändå — en kropp som inte går att läsa får aldrig
         * göra en avvisning till en krasch — så det kostar ingenting att låta
         * den svara på frågan *vad var felet* i stället för statusen.
         */
        const json = await answer
          .json()
          .then((value: unknown) => value as Record<string, unknown>)
          .catch(() => null);

        return {
          ok: false,
          status: answer.status,
          message: refusalWords(hostErrorCode(json), answer.status),
          json,
        };
      }

      /*
       * `204` är ett svar utan kropp (`?since`, berättelse 129). `json()` på en
       * tom kropp kastar, och felet hade blivit *Värden gick inte att nå* i
       * fångsten nedan — ett nätverksfel om ett svar som kom fram.
       */
      if (answer.status === 204) {
        return { ok: true, status: 204, json: {} };
      }

      return {
        ok: true,
        status: answer.status,
        json: (await answer.json()) as Record<string, unknown>,
      };
    } catch {
      return { ok: false, status: 0, message: "Värden gick inte att nå.", json: null };
    }
  }

  /** The `409` body, as the page needs it. `null` for anything else. */
  private conflictFrom(answer: {
    status: number;
    json: Record<string, unknown> | null;
  }): GraphSaveConflict | null {
    if (answer.status !== 409) {
      return null;
    }

    const by = (answer.json?.draftSavedBy ?? null) as { name?: unknown } | null;

    return {
      by: typeof by?.name === "string" ? by.name : "",
      savedAt: typeof answer.json?.draftSavedAt === "string" ? answer.json.draftSavedAt : "",
    };
  }

  /**
   * `draftSavedBy` out of a guide's answer, as `load` hands it on.
   *
   * `me` comes from the host and is not worked out here: this page never
   * learns its own subject, and comparing the name it displays against the
   * name on the draft would give the wrong answer for one of two people called
   * the same thing.
   */
  private draftSavedByOf(
    json: Record<string, unknown>,
  ): { savedBy: { name: string; me: boolean } } | null {
    const who = (json.draftSavedBy ?? null) as { name?: unknown; me?: unknown } | null;

    return typeof who?.name === "string" && who.name !== ""
      ? { savedBy: { name: who.name, me: who.me === true } }
      : null;
  }

  /**
   * Har arbetskopian ändrats sedan `since`? (berättelse 129, tillägget 19/9)
   *
   * `"unchanged"` när värden svarar `204`, annars samma svar som `load`. Den
   * som står i läsläge medan någon annan arbetar frågar det här var tionde
   * sekund, och svaret är oftast tomt — det är hela poängen med vägen.
   *
   * En värd som inte känner till `since` svarar med guiden varje gång, och då
   * blir svaret en vanlig laddning. Ingenting går sönder; sidan ritar om samma
   * graf den redan hade.
   *
   * **Stämpeln för nästa skrivning rörs inte här.** `load` sätter den, för en
   * läsning man tänker skriva ovanpå. Den här läsningen görs i läsläge, och en
   * sida som inte får skriva ska inte heller flytta villkoret för en skrivning
   * som kommer efter ett övertagande.
   */
  async loadSince(
    guideId: string,
    since: string,
  ): Promise<"unchanged" | { result: GraphLoadResult; lock: GuideLock | null }> {
    const answer = await this.ask(
      "GET",
      `/guides/${encodeURIComponent(guideId)}?since=${encodeURIComponent(since)}`,
    );

    if (!answer.ok) {
      return { result: { status: "error", message: answer.message }, lock: null };
    }

    if (answer.status === 204) {
      return "unchanged";
    }

    /*
     * Låset följer med, och det är inte en extrauppgift: samma svar bär det
     * redan (`docs/LAGRING-KONTRAKT.md`), och det är så ett fönster som tror
     * att det håller guiden får veta att någon annan gör det. Läst med samma
     * tolk som låsvägarna — en andra avläsning hade varit en andra sanning.
     */
    return {
      result: await this.guideFrom(guideId, answer.json, false),
      lock: readLock(answer.json.lock),
    };
  }

  /**
   * Avsikten runt arbetskopian: vilka som skrivit, och lappen de lämnat
   * (berättelse 130).
   *
   * Formen är värdens (`docs/LAGRING-KONTRAKT.md`) och plattas till här:
   * `draftNote.by.name` blir `note.name`, för sidan ritar ett namn och inte
   * ett objekt. `me` följer med orört — det är värdens svar, aldrig en
   * namnjämförelse.
   *
   * Utelämnade fält ger utelämnade fält. En värd utan inloggning har ingen att
   * namnge, och då ska sidan säga ingenting alls om personer.
   */
  private intentOf(json: Record<string, unknown>): {
    editors?: Array<{ name: string; me: boolean; at: string }>;
    note?: { text: string; name: string; me: boolean; at: string };
  } | null {
    const rawEditors = Array.isArray(json.draftEditors) ? json.draftEditors : [];
    const editors = rawEditors
      .map((one) => one as { name?: unknown; me?: unknown; at?: unknown })
      .filter((one) => typeof one.name === "string" && one.name !== "")
      .map((one) => ({ name: String(one.name), me: one.me === true, at: String(one.at ?? "") }));

    const rawNote = (json.draftNote ?? null) as
      | { text?: unknown; at?: unknown; by?: { name?: unknown; me?: unknown } }
      | null;
    const note =
      rawNote && typeof rawNote.text === "string" && rawNote.text !== ""
        ? {
            text: rawNote.text,
            name: String(rawNote.by?.name ?? ""),
            me: rawNote.by?.me === true,
            at: String(rawNote.at ?? ""),
          }
        : null;

    return editors.length === 0 && note === null
      ? null
      : { ...(editors.length > 0 ? { editors } : {}), ...(note ? { note } : {}) };
  }

  async load(guideId: string): Promise<GraphLoadResult> {
    const answer = await this.ask("GET", `/guides/${encodeURIComponent(guideId)}`);

    if (!answer.ok) {
      return { status: "error", message: answer.message };
    }

    return this.guideFrom(guideId, answer.json, true);
  }

  /**
   * Guidens svar, som sidan behöver det — en form, två läsningar.
   *
   * `remember` är villkoret för nästa skrivning. En vanlig laddning sätter
   * det, alltid — även när det inte fanns någon arbetskopia, för att låta det
   * stå kvar från förra guiden hade varit ett villkor om något annat. En
   * läsning i läsläge (`loadSince`) sätter det inte: sidan får inte skriva
   * ändå, och villkoret hör till den läsning man tänker skriva ovanpå.
   */
  private async guideFrom(
    guideId: string,
    json: Record<string, unknown>,
    remember: boolean,
  ): Promise<GraphLoadResult> {
    const current = typeof json.current === "string" ? json.current : "";
    const draft = json.draft as GraphData | undefined;
    const draftSavedAt = typeof json.draftSavedAt === "string" ? json.draftSavedAt : "";

    if (remember) {
      this.knownDraftSavedAt = draft ? draftSavedAt : "";
    }

    if (draft) {
      return {
        status: "success",
        graph: draft,
        savedAt: draftSavedAt === "" ? new Date().toISOString() : draftSavedAt,
        draft: true,
        ...(current ? { current } : {}),
        ...(this.draftSavedByOf(json) ?? {}),
        ...(this.intentOf(json) ?? {}),
      };
    }

    if (!current) {
      return { status: "empty" };
    }

    const published = await this.ask("GET", `/guides/${encodeURIComponent(guideId)}/versions/${encodeURIComponent(current)}`);

    if (!published.ok) {
      return { status: "error", message: published.message };
    }

    return {
      status: "success",
      graph: published.json.graph as GraphData,
      savedAt: new Date().toISOString(),
      draft: false,
      current,
      /*
       * Anteckningen följer guiden och inte arbetskopian: den som just
       * publicerat och sedan skriver *väntar på juristen* ska se sin lapp även
       * innan nästa ändring finns. Skribenterna hör däremot till en
       * arbetskopia som ska publiceras, och det finns ingen här.
       */
      ...(() => {
        const intent = this.intentOf(json);

        return intent?.note ? { note: intent.note } : {};
      })(),
    };
  }

  async saveDraft(guideId: string, graph: GraphData): Promise<GraphSaveResult> {
    return this.inOrder(async () => {
      /*
       * Kuvertet, med villkoret i sig (berättelse 127).
       *
       * `draftSavedAt` är stämpeln den här klienten senast såg, orörd. Värden
       * jämför och svarar `409` om någon annan hunnit skriva — och det är
       * skillnaden mellan att skydda en kollegas arbete och att radera det
       * utan att någon märker det.
       */
      const answer = await this.ask("PUT", `/guides/${encodeURIComponent(guideId)}/draft`, {
        graph,
        draftSavedAt: this.knownDraftSavedAt,
      });

      if (!answer.ok) {
        const clash = this.conflictFrom(answer);

        return {
          success: false,
          message: answer.message,
          ...(clash ? { conflict: clash } : {}),
        };
      }

      const savedAt =
        typeof answer.json.savedAt === "string" ? answer.json.savedAt : new Date().toISOString();

      // Nästa skrivnings villkor är den här skrivningens kvitto. Utan raden
      // hade klientens andra sparning krockat med sin egen första.
      this.knownDraftSavedAt = savedAt;

      return { success: true, savedAt };
    });
  }

  async discardDraft(guideId: string): Promise<GraphSaveResult> {
    return this.inOrder(async () => {
      const answer = await this.ask("DELETE", `/guides/${encodeURIComponent(guideId)}/draft`);

      if (!answer.ok) {
        return { success: false, message: answer.message };
      }

      // Det finns ingen arbetskopia längre, och villkoret säger det.
      this.knownDraftSavedAt = "";

      return { success: true, savedAt: new Date().toISOString() };
    });
  }

  async saveVersion(guideId: string, graph: GraphData, note?: string): Promise<GraphVersionResult> {
    /*
     * Stämpeln på vägen ut.
     *
     * `meta.updatedAt` sätts när en guide lämnar editorn för att bli något
     * bestående — en fil, eller en fryst version — och aldrig på arbetskopian:
     * en stämpel som ändrar sig själv gör varje jämförelse mellan två versioner
     * falskt positiv (`GuideMeta`). localStorage-lagringen gjorde det redan;
     * mätt 18/9 gjorde den här det inte, så samma handling lämnade två olika
     * grafer efter sig beroende på var guiden låg.
     *
     * Värdens `versionId` skrivs av värden, inte här — det är dess id att ge.
     */
    return this.inOrder(async () => {
      const answer = await this.ask("POST", `/guides/${encodeURIComponent(guideId)}/versions`, {
        graph: { ...graph, meta: { ...graph.meta, updatedAt: new Date().toISOString() } },
        ...(note ? { note } : {}),
        /*
         * Samma villkor som arbetskopian, och av ett starkare skäl: att frysa
         * något någon annan hunnit ändra är att publicera en text man inte har
         * sett.
         */
        draftSavedAt: this.knownDraftSavedAt,
      });

      if (!answer.ok) {
        const clash = this.conflictFrom(answer);

        return { success: false, message: answer.message, ...(clash ? { conflict: clash } : {}) };
      }

      return { success: true, version: answer.json.version as GuideVersion };
    });
  }

  /**
   * Frys en kopia utan att publicera något (berättelse 131).
   *
   * Vid en krock ligger två grafer och en text måste vinna på varje rad där
   * båda rört samma sak. Innan den sammanslagna skrivs läggs **båda** undan
   * här — Annas och min — så att den som förlorade valet finns kvar i
   * historiken och går att återställa.
   *
   * Egen väg och inte `saveVersion` med en flagga: `POST …/versions` kräver
   * publicerare hos värden, och den som krockade kan vara redaktör. Skälen i
   * sin helhet står i `integrations/reference-receiver/server.mjs` vid vägen.
   *
   * **Ingen `draftSavedAt`.** Villkoret finns för att ingen ska frysa något
   * någon annan hunnit ändra — och här är det precis vad som ska ske: min
   * kopia är per definition byggd på en stämpel som gått ut. Det är hela
   * skälet den behöver sparas.
   *
   * Ett fel är inget att avbryta på: rutan har inte skrivit något än, och
   * anroparen får veta genom `success`.
   */
  async saveSnapshot(
    guideId: string,
    graph: GraphData,
    side: "theirs" | "mine",
  ): Promise<GraphVersionResult> {
    /*
     * **Vilken sida, aldrig vems.**
     *
     * Sammanslagningen fryser två grafer, och den som trycker på knappen
     * skriver båda. Sätter värden `by` ur sessionen på båda får den andres
     * arbete mitt namn — mätt av Johan 20/9, som såg sitt eget arbete stå som
     * Annas i historiken.
     *
     * Sidan säger därför bara vilken av de två kopian är. Namnet slår värden
     * upp: `mine` är sessionen, `theirs` är `draftSavedBy`. Ett fält en klient
     * sätter är ett fält en klient kan sätta till någon annans namn; ett val
     * mellan två namn värden redan har är något annat.
     *
     * **Ingen etikett heller.** Raden ska kunna säga *din kopia*, och vem
     * *du* är beror på vem som läser — den byggs av `<guide-versions>` ur
     * `reason` och `by`.
     */
    return this.inOrder(async () => {
      const answer = await this.ask("POST", `/guides/${encodeURIComponent(guideId)}/snapshots`, {
        graph: { ...graph, meta: { ...graph.meta, updatedAt: new Date().toISOString() } },
        side,
      });

      return answer.ok
        ? { success: true, version: answer.json.version as GuideVersion }
        : { success: false, message: answer.message };
    });
  }

  async listVersions(guideId: string): Promise<GuideVersion[]> {
    const answer = await this.ask("GET", `/guides/${encodeURIComponent(guideId)}`);

    return answer.ok && Array.isArray(answer.json.versions) ? (answer.json.versions as GuideVersion[]) : [];
  }

  async openVersion(guideId: string, versionId: string): Promise<GraphData | null> {
    const answer = await this.ask(
      "GET",
      `/guides/${encodeURIComponent(guideId)}/versions/${encodeURIComponent(versionId)}`,
    );

    return answer.ok ? ((answer.json.graph as GraphData) ?? null) : null;
  }

  async publish(guideId: string, versionId: string): Promise<GraphPublishResult> {
    const answer = await this.ask("POST", `/guides/${encodeURIComponent(guideId)}/current`, { versionId });

    if (!answer.ok) {
      return { success: false, message: answer.message };
    }

    return {
      success: true,
      current: typeof answer.json.current === "string" ? answer.json.current : versionId,
    };
  }
}
