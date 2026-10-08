import { describe, expect, test, vi } from "vitest";

import "../viewer/node-types/default-node-types";

import { NOT_ALLOWED, ServerGraphStore, SIGN_IN_AGAIN } from "./server-graph-store";

import type { GraphData } from "../viewer/types/graph";

/**
 * The storage contract's client half (story 124, `docs/LAGRING-KONTRAKT.md`).
 *
 * `smoke:storage` proves the server keeps the five routes; this proves the
 * adapter speaks them — the address it calls, the secret it carries, and the
 * two shapes `load` has to tell apart: a guide with a working copy, and a
 * guide that has only ever been published.
 *
 * `fetch` is a fake, which is the point: what is being measured is what the
 * adapter *asks for*, and a real server would answer the same either way.
 */

const graph = (title: string): GraphData => ({
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

type Call = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  keepalive?: boolean;
  credentials?: RequestCredentials;
};

function fakeFetch(answers: Record<string, unknown>): { fetch: typeof globalThis.fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetcher = (async (url: string, init: RequestInit = {}) => {
    calls.push({
      url: String(url),
      method: init.method ?? "GET",
      headers: (init.headers ?? {}) as Record<string, string>,
      body: typeof init.body === "string" ? JSON.parse(init.body) : init.body,
      keepalive: init.keepalive,
      credentials: init.credentials,
    });

    const key = `${init.method ?? "GET"} ${String(url)}`;
    const answer = answers[key] ?? answers[String(url)] ?? { status: 404, body: { error: "no" } };
    const { status = 200, body = {} } = answer as { status?: number; body?: unknown };

    return {
      ok: status < 400,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  }) as unknown as typeof globalThis.fetch;

  return { fetch: fetcher, calls };
}

const store = (answers: Record<string, unknown>) => {
  const { fetch, calls } = fakeFetch(answers);

  return {
    calls,
    it: new ServerGraphStore({
      base: "https://api.example.invalid",
      secret: "hemlig",
      fetch,
    }),
  };
};

describe("ServerGraphStore", () => {
  test("arbetskopian skrivs till sin egen väg, med hemligheten som Bearer", async () => {
    const { it, calls } = store({
      "PUT https://api.example.invalid/guides/g1/draft": { body: { savedAt: "2026-09-17T10:00:00.000Z" } },
    });

    const result = await it.saveDraft("g1", graph("Utkast"));

    expect(result).toEqual({ success: true, savedAt: "2026-09-17T10:00:00.000Z" });
    expect(calls[0]!.method).toBe("PUT");
    expect(calls[0]!.url).toBe("https://api.example.invalid/guides/g1/draft");
    expect(calls[0]!.headers.authorization, "hemligheten går i huvudet, aldrig i adressen").toBe("Bearer hemlig");
    expect(calls[0]!.url).not.toContain("hemlig");
  });

  test("en guide med arbetskopia öppnar den, och säger att det är den", async () => {
    const { it } = store({
      "GET https://api.example.invalid/guides/g1": {
        body: {
          current: "v-1",
          draft: graph("Arbetskopian"),
          draftSavedAt: "2026-09-17T10:00:00.000Z",
          versions: [{ id: "v-1", label: "…", savedAt: 1, current: true }],
        },
      },
    });

    const loaded = await it.load("g1");

    expect(loaded.status).toBe("success");
    expect(loaded.status === "success" && loaded.graph.nodes[0]!.data.title).toBe("Arbetskopian");
    expect(loaded.status === "success" && loaded.draft).toBe(true);
    expect(loaded.status === "success" && loaded.current).toBe("v-1");
  });

  /*
   * Utan arbetskopia är det den publicerade versionen som gäller, och den
   * ligger bakom en andra väg — listan bär rader, inte grafer. En guide med
   * versioner och inget utkast är inte en tom guide.
   */
  test("en guide utan arbetskopia hämtar den publicerade versionens graf", async () => {
    const { it, calls } = store({
      "GET https://api.example.invalid/guides/g1": {
        body: { current: "v-2", versions: [{ id: "v-2", label: "…", savedAt: 2, current: true }] },
      },
      "GET https://api.example.invalid/guides/g1/versions/v-2": { body: { graph: graph("Publicerad") } },
    });

    const loaded = await it.load("g1");

    expect(loaded.status === "success" && loaded.graph.nodes[0]!.data.title).toBe("Publicerad");
    expect(loaded.status === "success" && loaded.draft).toBe(false);
    expect(calls.map((one) => one.url)).toEqual([
      "https://api.example.invalid/guides/g1",
      "https://api.example.invalid/guides/g1/versions/v-2",
    ]);
  });

  test("en guide utan både utkast och version finns inte att öppna", async () => {
    const { it } = store({
      "GET https://api.example.invalid/guides/g1": { body: { current: "", versions: [] } },
    });

    expect(await it.load("g1")).toEqual({ status: "empty" });
  });

  test("en guide servern inte känner säger det med värdens ord, inte med en tom guide", async () => {
    const { it } = store({});
    const loaded = await it.load("g1");

    expect(loaded.status).toBe("error");
    expect(loaded.status === "error" && loaded.message).toContain("404");
  });

  test("att frysa en version skickar grafen och noteringen", async () => {
    const { it, calls } = store({
      "POST https://api.example.invalid/guides/g1/versions": {
        body: { version: { id: "v-3", label: "2026-09-17 10:00", note: "Före", savedAt: 3, current: false } },
      },
    });

    const frozen = await it.saveVersion("g1", graph("Ny"), "Före");

    expect(frozen.success && frozen.version.id).toBe("v-3");
    expect((calls[0]!.body as { note: string }).note).toBe("Före");
    expect((calls[0]!.body as { graph: GraphData }).graph.nodes[0]!.data.title).toBe("Ny");
  });

  /*
   * Stämpeln på vägen ut, och bara där.
   *
   * `meta.updatedAt` sätts när en version fryses och när en guide exporteras —
   * aldrig på arbetskopian, för en stämpel som ändrar sig själv gör varje
   * jämförelse mellan två versioner falskt positiv (`GuideMeta`). Mätt 18/9:
   * localStorage-lagringen stämplade vid frysning, den här gjorde det inte, och
   * samma handling i två lagringar lämnade två olika grafer efter sig.
   */
  test("en fryst version bär när den frystes; arbetskopian bär ingenting", async () => {
    const { it, calls } = store({
      "POST https://api.example.invalid/guides/g1/versions": {
        body: { version: { id: "v-4", savedAt: 4, current: false } },
      },
      "PUT https://api.example.invalid/guides/g1/draft": { body: { savedAt: "2026-09-18T10:00:00.000Z" } },
    });

    await it.saveVersion("g1", graph("Fryst"));
    await it.saveDraft("g1", graph("Arbetskopia"));

    const frozen = (calls[0]!.body as { graph: GraphData }).graph;
    const draft = calls[1]!.body as GraphData;

    expect(typeof frozen.meta?.updatedAt, "frysningen stämplas").toBe("string");
    expect(draft.meta?.updatedAt, "arbetskopian rörs inte").toBeUndefined();
  });

  test("publish skickar versionens id och skriver ingen graf", async () => {
    const { it, calls } = store({
      "POST https://api.example.invalid/guides/g1/current": { body: { current: "v-2" } },
    });

    expect(await it.publish("g1", "v-2")).toEqual({ success: true, current: "v-2" });
    expect(calls[0]!.body).toEqual({ versionId: "v-2" });
  });

  test("en version som inte finns är null, aldrig någon annans graf", async () => {
    const { it } = store({});

    expect(await it.openVersion("g1", "v-finns-inte")).toBeNull();
  });

  /*
   * Kriterium 3: sidan som stängs ska inte tappa det som skrevs sist.
   * `keepalive` är det enda sättet en webbläsare låter en begäran leva längre
   * än sidan, och det används BARA då — dess 64 kB-gräns skulle annars göra
   * stora guider osparbara på den vanliga vägen.
   */
  test("vid stängning skickas skrivningen med keepalive, annars inte", async () => {
    const { it, calls } = store({
      "PUT https://api.example.invalid/guides/g1/draft": { body: { savedAt: "x" } },
    });

    await it.saveDraft("g1", graph("Vanlig"));
    expect(calls[0]!.keepalive, "en vanlig skrivning behöver det inte").toBeFalsy();

    it.beforeUnload();
    await it.saveDraft("g1", graph("Sista"));

    expect(calls[1]!.keepalive, "den sista måste överleva sidan").toBe(true);
  });

  /*
   * Statusen är 502 och inte 401 sedan berättelse 126: påståendet här är att
   * ett fel blir ett ärligt nej med värdens siffra i, och 401 har sedan dess
   * ord i stället för en siffra (se *när värden inte känner igen en längre*
   * nedan). Med 401 kvar hade det här testet mätt den andra regeln och gått
   * rött av rätt skäl men för fel påstående.
   */
  test("ett fel från värden blir ett ärligt nej, aldrig ett tyst ja", async () => {
    const { it } = store({
      "PUT https://api.example.invalid/guides/g1/draft": { status: 502, body: { error: "mail" } },
    });

    const result = await it.saveDraft("g1", graph("Utkast"));

    expect(result.success).toBe(false);
    expect(!result.success && result.message).toContain("502");
  });

  test("ett avbrott i nätet är också ett nej", async () => {
    const it = new ServerGraphStore({
      base: "https://api.example.invalid",
      secret: "hemlig",
      fetch: vi.fn(async () => {
        throw new Error("nätet försvann");
      }) as unknown as typeof globalThis.fetch,
    });

    const result = await it.saveDraft("g1", graph("Utkast"));

    expect(result.success).toBe(false);
  });
});

/**
 * Tillägget 17/9: *Kasta ändringarna*.
 *
 * Vägen finns för att en värd ska kunna få veta att det inte FINNS någon
 * arbetskopia — inte att det ligger en som råkar vara lika med den
 * publicerade. Sidan frågar *finns opublicerade ändringar?* och en tom kopia
 * som ändå ligger kvar svarar fel på den frågan.
 */
describe("att kasta arbetskopian", () => {
  test("går på sin egen väg, med hemligheten, och skickar ingen graf", async () => {
    const { it, calls } = store({
      "DELETE https://api.example.invalid/guides/g1/draft": { body: { draft: null } },
    });

    expect((await it.discardDraft("g1")).success).toBe(true);
    expect(calls[0]!.method).toBe("DELETE");
    expect(calls[0]!.url).toBe("https://api.example.invalid/guides/g1/draft");
    expect(calls[0]!.headers.authorization).toBe("Bearer hemlig");
    expect(calls[0]!.body, "ingen kropp att missförstå").toBeUndefined();
  });

  test("ett nej från värden är ett nej, inte ett tyst ja", async () => {
    const { it } = store({
      "DELETE https://api.example.invalid/guides/g1/draft": { status: 401, body: {} },
    });

    expect((await it.discardDraft("g1")).success).toBe(false);
  });
});

/**
 * Berättelse 126: värden har en inloggning, och då är sessionen legitimationen.
 *
 * Det som mäts är vad adaptern *ber om* — vilket är hela poängen med en fejkad
 * `fetch` här: en riktig server hade svarat likadant på båda, och felet syns
 * först i en webbläsare hos någon annan när cookien inte följde med.
 */
describe("med värdens inloggning i stället för hemligheten", () => {
  const withSession = (answers: Record<string, unknown>) => {
    const { fetch, calls } = fakeFetch(answers);

    return {
      calls,
      it: new ServerGraphStore({ base: "https://api.example.invalid", session: true, fetch }),
    };
  };

  test("cookien följer med, och inget Authorization skickas", async () => {
    const { it, calls } = withSession({
      "PUT https://api.example.invalid/guides/g1/draft": { body: { savedAt: "2026-09-18T10:00:00.000Z" } },
    });

    expect((await it.saveDraft("g1", graph("Utkast"))).success).toBe(true);
    expect(calls[0]!.credentials, "utan den skickar webbläsaren ingen cookie alls").toBe("include");
    expect(
      calls[0]!.headers.authorization,
      "en klient som erbjuder två legitimationer har bara gjort det svårare att se vilken som inte höll",
    ).toBeUndefined();
  });

  test("hemlighetens läge skickar ingen cookie", async () => {
    const { it, calls } = store({
      "PUT https://api.example.invalid/guides/g1/draft": { body: { savedAt: "x" } },
    });

    await it.saveDraft("g1", graph("Utkast"));

    expect(calls[0]!.credentials).toBeUndefined();
    expect(calls[0]!.headers.authorization).toBe("Bearer hemlig");
  });
});

/**
 * Kriterium 5: på `401` säger raden *Logga in igen* i stället för att tyst
 * sluta spara.
 *
 * *Värden svarade 401* är sant och till ingen hjälp: det enda en redaktör kan
 * göra åt det är att logga in igen, och en rad som inte säger det läses som
 * "sparningen är trasig" — alltså fortsätter man skriva i en sida som slutat
 * spara.
 */
describe("när värden inte känner igen en längre", () => {
  test("401 blir Logga in igen, inte en siffra", async () => {
    const { it } = store({
      "PUT https://api.example.invalid/guides/g1/draft": { status: 401, body: {} },
    });

    const result = await it.saveDraft("g1", graph("Utkast"));

    expect(result.success).toBe(false);
    expect(result.success === false && result.message).toBe(SIGN_IN_AGAIN);
    expect(result.success === false && result.message).toContain("Logga in igen");
  });

  test("andra fel behåller siffran — dem kan redaktören inte göra något åt", async () => {
    const { it } = store({
      "PUT https://api.example.invalid/guides/g1/draft": { status: 503, body: {} },
    });

    const result = await it.saveDraft("g1", graph("Utkast"));

    expect(result.success === false && result.message).toBe("Värden svarade 503.");
  });

  /*
   * A8, 22/9. Servern skiljer sedan dess på *du är utloggad* och *du får
   * inte*, och klienten måste göra det också: en inloggningsknapp på ett
   * rättighetsfel skickar redaktören genom en inloggning som ger samma roll
   * tillbaka — ut och in till exakt samma nej.
   */
  test("403 förklarar behörigheten och föreslår aldrig ny inloggning", async () => {
    const { it } = store({
      "PUT https://api.example.invalid/guides/g1/draft": {
        status: 403,
        body: { error: "forbidden" },
      },
    });

    const result = await it.saveDraft("g1", graph("Utkast"));

    expect(result.success === false && result.message).toBe(NOT_ALLOWED);
    expect(result.success === false && result.message).not.toBe(SIGN_IN_AGAIN);
  });

  test("och en 403 utan kropp betyder samma sak", async () => {
    const { it } = store({
      "PUT https://api.example.invalid/guides/g1/draft": { status: 403, body: {} },
    });

    const result = await it.saveDraft("g1", graph("Utkast"));

    expect(result.success === false && result.message).toBe(NOT_ALLOWED);
  });

  test("och en publicering som avvisas säger samma sak", async () => {
    const { it } = store({
      "POST https://api.example.invalid/guides/g1/versions": { status: 401, body: {} },
    });

    const result = await it.saveVersion("g1", graph("Version"));

    expect(result.success === false && result.message).toBe(SIGN_IN_AGAIN);
  });

  /*
   * QA (uppdrag 22/9, mätning 4c; Fables A8): en giltig identitet med
   * OTILLRÄCKLIG roll ska svara `403 forbidden` och förklaras utan att
   * erbjuda återinloggning — sessionen är fin, det är rollen som saknas, och
   * *Logga in igen* vore fel råd (redaktören skulle bara logga in som sig
   * själv igen och möta samma vägg).
   *
   * VÄNTAR PÅ A8 (Ted): `hostErrorKey`s tabell mappar idag `forbidden` till
   * `host.signIn` (`src/viewer/core/host-errors.ts`), så den här är RÖD mot
   * dagens kod med flit — samma mönster som 3e/3f/3g i receiver-smoke.mjs.
   * Den ska gå grön den dag koden skiljer `forbidden` från `unauthorized`.
   */
  test("403 forbidden är INTE Logga in igen — rollen saknas, inte sessionen (väntar på A8)", async () => {
    const { it } = store({
      "PUT https://api.example.invalid/guides/g1/draft": { status: 403, body: { error: "forbidden" } },
    });

    const result = await it.saveDraft("g1", graph("Utkast"));

    expect(result.success === false && result.message).not.toContain("Logga in igen");
  });
});

/**
 * Den villkorade skrivningen (berättelse 127, kriterium 4).
 *
 * Adapterns halva av *ingen skriver över någon tyst*: den skickar tillbaka den
 * `draftSavedAt` den senast såg, och den håller reda på den själv. Serverns
 * halva mäts i `smoke:storage`, och att de två möts i en riktig webbläsare i
 * `smoke:login` — det här mäter vad klienten *ber om*, vilket är det enda
 * stället ett tappat villkor syns innan någons text försvunnit.
 */
describe("villkoret på arbetskopian", () => {
  const withDraft = (savedAt: string, extra: Record<string, unknown> = {}) => ({
    "GET https://api.example.invalid/guides/g1": {
      body: { current: "", draft: graph("Nisses"), draftSavedAt: savedAt, versions: [], ...extra },
    },
  });

  test("skrivningen bär den stämpel läsningen gav", async () => {
    const { it, calls } = store({
      ...withDraft("2026-09-18T20:50:00.000Z"),
      "PUT https://api.example.invalid/guides/g1/draft": { body: { savedAt: "2026-09-18T20:51:00.000Z" } },
    });

    await it.load("g1");
    await it.saveDraft("g1", graph("Mitt"));

    const put = calls.find((one) => one.method === "PUT")!;

    expect(
      (put.body as { draftSavedAt?: string }).draftSavedAt,
      "utan villkoret skriver sparningen över vad som helst som hunnit landa",
    ).toBe("2026-09-18T20:50:00.000Z");
    expect(
      (put.body as { graph?: GraphData }).graph,
      "grafen ligger i kuvertet, inte som kuvertet",
    ).toMatchObject({ startNodeId: "q" });
  });

  test("utan läst arbetskopia är villkoret tomt — och det är ett villkor", async () => {
    const { it, calls } = store({
      "PUT https://api.example.invalid/guides/g1/draft": { body: { savedAt: "T2" } },
    });

    await it.saveDraft("g1", graph("Första"));

    expect(
      (calls[0]!.body as { draftSavedAt?: string }).draftSavedAt,
      "tom sträng betyder *det fanns ingen arbetskopia när jag läste*, inte *skriv utan villkor*",
    ).toBe("");
  });

  test("kvittot blir nästa skrivnings villkor", async () => {
    const { it, calls } = store({
      "PUT https://api.example.invalid/guides/g1/draft": { body: { savedAt: "T2" } },
    });

    await it.saveDraft("g1", graph("Ett"));
    await it.saveDraft("g1", graph("Två"));

    expect(
      (calls[1]!.body as { draftSavedAt?: string }).draftSavedAt,
      "annars krockar klientens andra sparning med sin egen första",
    ).toBe("T2");
  });

  test("en kastad arbetskopia nollställer villkoret", async () => {
    const { it, calls } = store({
      ...withDraft("T1"),
      "DELETE https://api.example.invalid/guides/g1/draft": { body: { draft: null } },
      "PUT https://api.example.invalid/guides/g1/draft": { body: { savedAt: "T9" } },
    });

    await it.load("g1");
    await it.discardDraft("g1");
    await it.saveDraft("g1", graph("Efter"));

    expect(
      (calls[calls.length - 1]!.body as { draftSavedAt?: string }).draftSavedAt,
      "det finns ingen arbetskopia längre, och villkoret ska säga det",
    ).toBe("");
  });

  test("publiceringen väntar in sparningen som redan är i luften", async () => {
    const { it, calls } = store({
      "PUT https://api.example.invalid/guides/g1/draft": { body: { savedAt: "T2" } },
      "POST https://api.example.invalid/guides/g1/versions": { body: { version: { id: "v-1" } } },
    });

    /*
     * Precis vad `publish()` gör: `autosave.flush()` startar en sparning utan
     * att vänta in den, och sedan fryses en version. Bär publiceringen den
     * gamla stämpeln avvisar värden den — och den som hann före var man själv.
     */
    void it.saveDraft("g1", graph("Ett"));

    await it.saveVersion("g1", graph("Ett"), "Note");

    const post = calls.find((one) => one.method === "POST")!;

    expect((post.body as { draftSavedAt?: string }).draftSavedAt).toBe("T2");
  });

  test("409 säger vem och när, inte bara ett nummer", async () => {
    const { it } = store({
      "PUT https://api.example.invalid/guides/g1/draft": {
        status: 409,
        body: {
          error: "conflict",
          draftSavedAt: "2026-09-18T20:51:00.000Z",
          draftSavedBy: { name: "Nisse Hult" },
        },
      },
    });

    const result = await it.saveDraft("g1", graph("Mitt"));

    expect(result.success).toBe(false);
    expect(
      result.success === false && result.conflict,
      "en krock utan namn lämnar redaktören med en sida som slutat spara och ingen att fråga",
    ).toEqual({ by: "Nisse Hult", savedAt: "2026-09-18T20:51:00.000Z" });
  });

  test("och en publicering som krockar säger samma sak", async () => {
    const { it } = store({
      "POST https://api.example.invalid/guides/g1/versions": {
        status: 409,
        body: { error: "conflict", draftSavedAt: "T3", draftSavedBy: { name: "Monika Ågren" } },
      },
    });

    const result = await it.saveVersion("g1", graph("Version"));

    expect(result.success === false && result.conflict?.by).toBe("Monika Ågren");
  });

  test("en värd utan inloggning har ingen att namnge, och krocken finns ändå", async () => {
    const { it } = store({
      "PUT https://api.example.invalid/guides/g1/draft": {
        status: 409,
        body: { error: "conflict", draftSavedAt: "T3" },
      },
    });

    const result = await it.saveDraft("g1", graph("Mitt"));

    expect(result.success === false && result.conflict).toEqual({ by: "", savedAt: "T3" });
  });

  test("load lämnar vidare vem som skrev arbetskopian, och om det var man själv", async () => {
    const { it } = store(withDraft("T1", { draftSavedBy: { name: "Nisse Hult", me: false } }));

    const loaded = await it.load("g1");

    expect(loaded.status === "success" && loaded.savedBy).toEqual({ name: "Nisse Hult", me: false });
  });
});
