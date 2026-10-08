import { describe, expect, test } from "vitest";

import { asRole, hostLogin, roleAllows } from "./host-login";

/**
 * The four answers a page has to tell apart (story 126).
 *
 * The one that matters is *no login* against *logged out*, because they lead to
 * two different screens: a host with no provider is running the documented
 * other half of this story, where a guide's own address and secret is how you
 * get in — offering a *Logga in* button there is offering a door to a wall.
 *
 * `fetch` is a fake on purpose: what is measured is what the page *asks for* and
 * how it reads the answer, and a real host would answer the same either way.
 * The browser run (`smoke:login`) is where the cookie and the redirects are
 * measured, and those cannot be faked usefully.
 */

const answering = (
  byPath: Record<string, { status: number; body?: unknown }>,
): { fetch: typeof globalThis.fetch; calls: { url: string; method: string; credentials?: RequestCredentials }[] } => {
  const calls: { url: string; method: string; credentials?: RequestCredentials }[] = [];
  const fetcher = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), method: init.method ?? "GET", credentials: init.credentials });

    const path = new URL(String(url)).pathname;
    const answer = byPath[path];

    if (!answer) {
      throw new Error(`ingen attrapp för ${path}`);
    }

    return {
      ok: answer.status < 400,
      status: answer.status,
      json: async () => answer.body ?? {},
    } as Response;
  }) as unknown as typeof globalThis.fetch;

  return { fetch: fetcher, calls };
};

const base = "https://api.example.invalid";

describe("var sidan står med värden", () => {
  test("ingen adress alls är ingen värd — inget anrop görs", async () => {
    const { fetch, calls } = answering({});

    expect(await hostLogin("", fetch).state()).toEqual({ kind: "no-host" });
    expect(calls, "en tom adress ska inte bli ett anrop till ingenting").toEqual([]);
  });

  /*
   * 404 på `/auth/me` betyder att vägarna inte finns här, alltså en värd utan
   * leverantör. Det är inte ett fel och ska inte ritas som ett.
   */
  test("404 är en värd utan inloggning, inte en utloggad besökare", async () => {
    const { fetch } = answering({ "/auth/me": { status: 404 } });

    expect(await hostLogin(base, fetch).state()).toEqual({ kind: "no-login" });
  });

  test("401 är utloggad", async () => {
    const { fetch } = answering({ "/auth/me": { status: 401 } });

    expect(await hostLogin(base, fetch).state()).toEqual({ kind: "signed-out" });
  });

  test("200 ger namnet och adressen ur tokenet", async () => {
    const { fetch, calls } = answering({
      "/auth/me": {
        status: 200,
        body: { name: "Test Testsson", email: "test@exempel.invalid", role: "publisher" },
      },
    });

    expect(await hostLogin(base, fetch).state()).toEqual({
      kind: "signed-in",
      name: "Test Testsson",
      email: "test@exempel.invalid",
      role: "publisher",
    });
    expect(calls[0]!.credentials, "sessionen är en cookie och följer inte med av sig själv").toBe(
      "include",
    );
  });

  test("en värd som inte svarar alls är ingen värd, inte en krasch", async () => {
    const fetcher = (async () => {
      throw new Error("nätet försvann");
    }) as unknown as typeof globalThis.fetch;

    expect(await hostLogin(base, fetcher).state()).toEqual({ kind: "no-host" });
  });
});

describe("vägen in och ut", () => {
  /*
   * Adressen att komma tillbaka till reser som en parameter och prövas av
   * värden mot dess egen lista. Båda halvorna behövs: en värd som följer vad
   * som helst är en öppen omdirigering, och en sida som inte kan säga var den
   * började skickar alla till startsidan efter en inloggning de påbörjade
   * någon annanstans.
   */
  test("inloggningen bär tillbaka-adressen, kodad", async () => {
    const { fetch } = answering({});

    expect(hostLogin(base, fetch).loginAddress("https://flowweaver.se/guides/")).toBe(
      "https://api.example.invalid/auth/login?return=https%3A%2F%2Fflowweaver.se%2Fguides%2F",
    );
  });

  test("utloggningen är en POST — en länk hade räckt för någon annans sida", async () => {
    const { fetch, calls } = answering({ "/auth/logout": { status: 200, body: { ok: true } } });

    await hostLogin(base, fetch).logout();

    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.credentials).toBe("include");
  });
});

describe("guiderna", () => {
  test("listan är värdens svar, och en trasig lista är ingen lista", async () => {
    const { fetch } = answering({
      "/guides": {
        status: 200,
        body: {
          guides: [{ id: "g1", name: "Bygglov", current: "v-1", updatedAt: "2026-09-18T08:00:00.000Z" }],
        },
      },
    });

    expect(await hostLogin(base, fetch).listGuides()).toEqual({
      ok: true,
      guides: [{ id: "g1", name: "Bygglov", current: "v-1", updatedAt: "2026-09-18T08:00:00.000Z" }],
    });
  });

  /*
   * 401 blir `ok: false` och aldrig en tom lista. En tom lista är det farliga
   * svaret: sidan hade skrivit *Du har inga guider än* åt någon som har tjugo.
   */
  test("401 är inte noll guider", async () => {
    const { fetch } = answering({ "/guides": { status: 401 } });

    expect(await hostLogin(base, fetch).listGuides()).toEqual({ ok: false });
  });

  test("en ny guide ger sitt id, och ett svar utan id är ett nej", async () => {
    const { fetch } = answering({ "/guides": { status: 200, body: { guide: { id: "ny-1" } } } });

    expect(await hostLogin(base, fetch).createGuide("Bygglov")).toEqual({ ok: true, id: "ny-1" });

    const { fetch: empty } = answering({ "/guides": { status: 200, body: {} } });

    expect(await hostLogin(base, empty).createGuide()).toEqual({ ok: false });
  });
});

/**
 * Rollen, som sidan läser den (berättelse 128).
 *
 * Stegen är värdens och prövas där; det här är den andra halvan av samma
 * mening — att sidan inte ritar en palett eller en knapp för någon värden
 * kommer att avvisa. En vy, aldrig ett skydd.
 */
describe("rollen ur värdens svar", () => {
  /*
   * Det farliga felet, och det enda i den här filen som kan kosta något: en
   * värd som svarar utan `role` — alltså en värd från före den här
   * berättelsen, eller en som gick sönder — måste läsas som **läsare**.
   *
   * Åt andra hållet hade sidan gett hela paletten till någon värden svarar
   * `401` på, alltså en skärm full av kontroller som inte gör något.
   */
  test("en värd som inte säger någon roll läses som läsare", async () => {
    const { fetch } = answering({
      "/auth/me": { status: 200, body: { name: "Monika Ågren", email: "m@exempel.invalid" } },
    });

    expect(await hostLogin(base, fetch).state()).toEqual({
      kind: "signed-in",
      name: "Monika Ågren",
      email: "m@exempel.invalid",
      role: "reader",
    });
  });

  test("och ett ord som inte är en roll är läsare, inte ett fel", () => {
    expect(asRole("superuser")).toBe("reader");
    expect(asRole("")).toBe("reader");
    expect(asRole(undefined)).toBe("reader");
    expect(asRole(null)).toBe("reader");
    // Skiftläge räknas: `.env` säger `admin`, och något annat är något annat.
    expect(asRole("Admin")).toBe("reader");
  });

  test("de fyra orden går igenom som de är", () => {
    expect(asRole("reader")).toBe("reader");
    expect(asRole("editor")).toBe("editor");
    expect(asRole("publisher")).toBe("publisher");
    expect(asRole("admin")).toBe("admin");
  });

  /*
   * Stegen: varje steg får allt under sig. Skrivet som en tabell och inte som
   * fyra påståenden, för det som ska hålla är hela relationen — en jämförelse
   * som råkar vara rätt för två rungor och fel för en tredje är precis den
   * sortens fel ett stickprov missar.
   */
  test("stegen: varje roll får allt under sig och inget över", () => {
    const ladder = ["reader", "editor", "publisher", "admin"] as const;
    const matrix = ladder.map((role) => ladder.map((needed) => roleAllows(role, needed)));

    expect(matrix).toEqual([
      [true, false, false, false],
      [true, true, false, false],
      [true, true, true, false],
      [true, true, true, true],
    ]);
  });
});
