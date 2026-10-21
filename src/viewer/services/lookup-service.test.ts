import { afterEach, describe, expect, test } from "vitest";

import {
  LOOKUP_CONTRACT_VERSION,
  LookupService,
  registerLookupOrigins,
  unregisterLookupOrigins,
} from "./lookup-service";

import type { FlowNodeData } from "../types/graph";

function nod(data: Record<string, unknown>): FlowNodeData {
  return {
    id: "sök",
    type: "autocomplete-question",
    position: { x: 0, y: 0 },
    data: { variableName: "kommun", ...data },
  } as FlowNodeData;
}

const KOMMUNER = [
  { id: "a", value: "1880", label: "Örebro" },
  { id: "b", value: "1881", label: "Kumla" },
  { id: "c", value: "0180", label: "Stockholm" },
];

describe("lookup against the field's own list", () => {
  test("searches case-insensitively", async () => {
    const { items } = await LookupService.search(
      nod({ source: "mock", mockItems: KOMMUNER }),
      "öre",
    );

    expect(items.map((item) => item.value)).toEqual(["1880"]);
  });

  // "orebro" must find "Örebro". A Swede searching does not always type the
  // dots, especially on a keyboard that is not theirs.
  test("ignores diacritics", async () => {
    const { items } = await LookupService.search(
      nod({ source: "mock", mockItems: KOMMUNER }),
      "orebro",
    );

    expect(items.map((item) => item.label)).toEqual(["Örebro"]);
  });

  test("searches the code as well", async () => {
    const { items } = await LookupService.search(
      nod({ source: "mock", mockItems: KOMMUNER }),
      "0180",
    );

    expect(items.map((item) => item.label)).toEqual(["Stockholm"]);
  });

  // A lookup on one character would match almost everything and make the list
  // meaningless — and against a service it is one call per keystroke.
  test("does no lookup below the minimum character count", async () => {
    const { items } = await LookupService.search(
      nod({ source: "mock", mockItems: KOMMUNER, minChars: 3 }),
      "ör",
    );

    expect(items).toEqual([]);
  });
});

describe("lookup against a service", () => {
  afterEach(() => unregisterLookupOrigins());

  const svar = (kropp: unknown, ok = true, status = 200): typeof fetch =>
    (async () =>
      ({
        ok,
        status,
        json: async () => kropp,
      }) as Response) as unknown as typeof fetch;

  test("accepts a response that follows the contract", async () => {
    const { items, error } = await LookupService.search(
      nod({ source: "service", endpoint: "/api/kommuner" }),
      "öre",
      "sv",
      svar({
        version: LOOKUP_CONTRACT_VERSION,
        items: [{ value: "1880", label: "Örebro", hint: "Örebro län" }],
      }),
    );

    expect(error).toBeNull();
    expect(items).toEqual([{ value: "1880", label: "Örebro", hint: "Örebro län" }]);
  });

  test("sends the term, the limit and the language in the query string", async () => {
    let requested = "";
    registerLookupOrigins(["https://exempel.se"]);

    await LookupService.search(
      nod({ source: "service", endpoint: "https://exempel.se/api/kommuner" }),
      "öre",
      "sv",
      (async (url: string) => {
        requested = url;
        return { ok: true, status: 200, json: async () => ({ version: 1, items: [] }) } as Response;
      }) as unknown as typeof fetch,
    );

    expect(requested).toContain("q=%C3%B6re");
    expect(requested).toContain("limit=8");
    expect(requested).toContain("locale=sv");
  });

  // A half-read response is worse than none: the user picks a suggestion with
  // no code, the variable ends up empty, and the fault shows only later in the
  // flow.
  test("rejects a suggestion without a value", async () => {
    const { items, error } = await LookupService.search(
      nod({ source: "service", endpoint: "/api/kommuner" }),
      "öre",
      undefined,
      svar({ version: 1, items: [{ label: "Örebro" }] }),
    );

    expect(items).toEqual([]);
    expect(error).toMatch(/value eller label/);
  });

  test("avvisar en annan kontraktsversion", async () => {
    const { error } = await LookupService.search(
      nod({ source: "service", endpoint: "/api/kommuner" }),
      "öre",
      undefined,
      svar({ version: 2, items: [] }),
    );

    expect(error).toMatch(/version 2/);
  });

  test("rapporterar ett felsvar utan att kasta", async () => {
    const { items, error } = await LookupService.search(
      nod({ source: "service", endpoint: "/api/kommuner" }),
      "öre",
      undefined,
      svar(null, false, 503),
    );

    expect(items).toEqual([]);
    expect(error).toBe("Uppslaget svarade 503.");
  });

  test("a network error becomes a message, not an exception", async () => {
    const { error } = await LookupService.search(
      nod({ source: "service", endpoint: "/api/kommuner" }),
      "öre",
      undefined,
      (async () => {
        throw new Error("Failed to fetch");
      }) as unknown as typeof fetch,
    );

    expect(error).toBe("Failed to fetch");
  });

  test("a field without an endpoint says so plainly", async () => {
    const { error } = await LookupService.search(
      nod({ source: "service", endpoint: "" }),
      "öre",
    );

    expect(error).toBe("Fältet saknar endpoint.");
  });
});

/*
 * Security finding 6 (9/10): the address comes out of the guide, and the
 * visitor's text goes to it. A guide is data — imported, shared, edited by
 * somebody other than the host — so where it may send what a resident types is
 * the host's decision, not the guide's.
 */
describe("which addresses a lookup may reach", () => {
  afterEach(() => unregisterLookupOrigins());

  /** A fetch that records what it was asked, and answers an empty list. */
  const recording = () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const impl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ version: 1, items: [] }) } as Response;
    }) as unknown as typeof fetch;
    return { calls, impl };
  };

  const ask = (endpoint: string, impl: typeof fetch) =>
    LookupService.search(nod({ source: "service", endpoint }), "öre", undefined, impl);

  test("another origin is not asked when the host has allowed none", async () => {
    const { calls, impl } = recording();

    const { items, error } = await ask("https://annan.example/api/kommuner", impl);

    expect(calls).toEqual([]);
    expect(items).toEqual([]);
    expect(error).not.toBeNull();
  });

  test("another origin is asked once the host allows it", async () => {
    registerLookupOrigins(["https://annan.example"]);
    const { calls, impl } = recording();

    const { error } = await ask("https://annan.example/api/kommuner", impl);

    expect(error).toBeNull();
    expect(calls).toHaveLength(1);
  });

  test("an allowed origin does not open its neighbours", async () => {
    registerLookupOrigins(["https://annan.example"]);
    const { calls, impl } = recording();

    for (const endpoint of [
      "http://annan.example/api",
      "https://annan.example:8443/api",
      "https://ond.annan.example/api",
      "//ond.example/api",
      "data:application/json,{}",
    ]) {
      const { error } = await ask(endpoint, impl);
      expect(error, endpoint).not.toBeNull();
    }

    expect(calls).toEqual([]);
  });

  // The page's own origin is the host's own: a relative endpoint is the shape
  // the contract recommends, and it needs no list.
  test("the page's own origin needs no list", async () => {
    const { calls, impl } = recording();

    const { error } = await ask("/api/kommuner", impl);

    expect(error).toBeNull();
    expect(calls).toHaveLength(1);
  });

  // A setup fault said out loud, not a list that quietly allows something
  // other than what the host wrote.
  test("an entry that is not a bare origin is refused by name", () => {
    expect(() => registerLookupOrigins(["https://annan.example/api"])).toThrow(
      /annan\.example\/api/,
    );
    expect(() => registerLookupOrigins(["annan.example"])).toThrow(/annan\.example/);
  });

  // Measured in Chromium 9/10: with fetch's default (`same-origin`) a cookie
  // set by the page reached the endpoint; with `omit` it did not.
  test("the call carries no cookies, not even to the page's own origin", async () => {
    const { calls, impl } = recording();

    await ask("/api/kommuner", impl);

    expect(calls[0]?.init?.credentials).toBe("omit");
  });
});
