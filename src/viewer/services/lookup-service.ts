/**
 * Lookup for search fields with suggestions ("autocomplete").
 *
 * ## Why a contract of our own
 *
 * FlowWeaver should know nothing about Lantmäteriet, the population register or
 * any other source. The guide only says "search this" and gets back a list of
 * `{ value, label }`. Translating a source's shape into that list is the BFF's
 * job, not the guide's — see `docs/UPPSLAG-KONTRAKT.md` for the full description
 * and an example adapter.
 *
 * The reason is the same as for `service-call`: keys, agreements and third
 * parties belong on the server. A guide running on a SiteVision page must never
 * carry an API key, and it should not have to be replaced because a source
 * changed its response format.
 *
 * ## Mock mode
 *
 * A source that does not exist yet cannot be built against. So every field can
 * carry its own list and search it locally, without a network. The same
 * interface, the same keyboard, the same validation — only a different source.
 * That lets the contract be tried out before any BFF exists.
 */

import { resolveText } from "../core/localized-text";
import { declaredDefault } from "../node-types/node-fields";
import { getCodeList } from "../code-lists/code-list-registry";

import type { FlowNodeData, QuestionOption } from "../types/graph";

/** One suggestion in the list. */
export interface LookupItem {
  /** Koden som lagras — kommunkod, landskod, adressplats-id. */
  value: string;
  /** What the user sees and picks. */
  label: string;
  /** Optional discriminator when two matches share a name, e.g. "Örebro län". */
  hint?: string;
  /**
   * A suggestion that cannot be held together with any other.
   *
   * Optional, and a source that never sends it changes nothing — which is why
   * the contract could gain it without a version. See `docs/UPPSLAG-KONTRAKT.md`
   * and `docs/STORIES/062-ett-val-som-utesluter-de-andra.md`.
   */
  exclusive?: boolean;
}

/** Svaret en BFF ska returnera. */
export interface LookupResponse {
  version: number;
  items: LookupItem[];
}

export interface LookupResult {
  items: LookupItem[];
  /** Set when the lookup failed. The field then falls back to free text. */
  error: string | null;
}

/**
 * The contract's version. Raised only on a breaking change, and a BFF answering
 * with a different major is rejected rather than misread.
 */
export const LOOKUP_CONTRACT_VERSION = 1;

/** At most this many suggestions are requested and shown. */
export const LOOKUP_LIMIT = 8;

const TOM: LookupResult = { items: [], error: null };

/*
 * Which origins a lookup may reach — the host's list, never the guide's.
 *
 * The endpoint is guide data, and a guide is imported, shared and edited by
 * people who are not the host. What a resident types goes to that address, so
 * an address nobody on the hosting side chose is a way to send a resident's
 * words somewhere the page's owner never agreed to (security finding 6, 9/10).
 *
 * Nothing registered means the page's own origin only — a relative endpoint,
 * which is what `docs/UPPSLAG-KONTRAKT.md` has always recommended. Chosen over
 * "anything goes until a list exists" because that would leave every host that
 * never heard of this list exactly as exposed as before, and over "nothing at
 * all" because the own origin is the host's own: a guide pointed there reaches
 * only what the host serves. What it costs is a host that already looks up on
 * another origin: its field says "Uppslaget kunde inte nås" until it registers
 * that origin. No bundled guide does (16/9, `e2e/lookup-service-smoke.mjs`),
 * and the built site's CSP (`connect-src 'self'`) would have refused it anyway.
 *
 * A module-level list, like the map provider and the code lists, and not an
 * attribute: the editor's own preview runs lookups too, and a policy that has
 * to be repeated on every element is one that will be missing on one of them.
 */
let allowedOrigins: ReadonlySet<string> = new Set();

/**
 * Allows lookups to these origins, besides the page's own. Replaces any list
 * registered before. Each entry is a bare origin — `https://api.example.se`,
 * scheme and host and any port, nothing after — and anything else is refused
 * by name: a path here would read as a restriction it could not enforce, and
 * a missing scheme as a host it could not match.
 */
export function registerLookupOrigins(origins: readonly string[]): void {
  const next = new Set<string>();

  for (const entry of origins) {
    let origin: string | null = null;
    try {
      const url = new URL(entry);
      if (url.protocol === "https:" || url.protocol === "http:") {
        origin = url.origin;
      }
    } catch {
      origin = null;
    }

    if (origin === null || origin !== String(entry).trim().replace(/\/$/, "").toLowerCase()) {
      throw new TypeError(
        `registerLookupOrigins: "${String(entry)}" is not an origin like https://api.example.se`,
      );
    }
    next.add(origin);
  }

  allowedOrigins = next;
}

/** Back to the page's own origin only. */
export function unregisterLookupOrigins(): void {
  allowedOrigins = new Set();
}

export class LookupService {
  /** The fewest characters before a lookup is made. */
  static getMinChars(node: FlowNodeData): number {
    const value = node.data.minChars;
    if (typeof value === "number" && value > 0) {
      return value;
    }

    // Zero or negative is not an answer — what the field is declared to be
    // worth applies instead. The number itself lives only in the declaration.
    const declared = declaredDefault(node.type, "minChars");
    return typeof declared === "number" ? declared : 0;
  }

  static allowsFreeText(node: FlowNodeData): boolean {
    return node.data.allowFreeText === true;
  }

  /**
   * Looks up `term` for the node.
   *
   * @param fetchImpl An injected `fetch` — the tests never need a network, and host
   *   environments with their own fetching can pass theirs in.
   */
  static async search(
    node: FlowNodeData,
    term: string,
    locale?: string,
    fetchImpl: typeof fetch = fetch,
  ): Promise<LookupResult> {
    const trimmed = term.trim();

    if (trimmed.length < this.getMinChars(node)) {
      return TOM;
    }

    if (node.data.source === "service") {
      return this.frånTjänst(node, trimmed, locale, fetchImpl);
    }

    if (node.data.source === "codelist") {
      return { items: this.frånKodlista(node, trimmed, locale), error: null };
    }

    return { items: this.frånMock(node, trimmed, locale), error: null };
  }

  /**
   * The values this node's source says stand alone.
   *
   * A guide stores a lookup answer as label and code — never the flag, because
   * the flag describes the OPTION and the answer is what was chosen. So a
   * visitor who steps forward and back gets their chips rebuilt out of
   * something that has forgotten *stateless* cannot be held with a country,
   * and the next country lands beside it. Measured as exactly that: the
   * replacement worked in one sitting and stopped working after one step away.
   *
   * A bundled list and a field's own list can answer here with no network. A
   * service cannot, and says nothing rather than guessing — the flag is then
   * restored the moment a search brings the entry back, which is the same
   * moment the visitor could act on it.
   */
  static standsAlone(node: FlowNodeData): Set<string> {
    if (node.data.source === "service") {
      return new Set();
    }

    if (node.data.source === "codelist") {
      const id = typeof node.data.codeListId === "string" ? node.data.codeListId : "";

      return new Set(
        (getCodeList(id)?.items ?? [])
          .filter((item) => item.exclusive === true)
          .map((item) => item.value),
      );
    }

    // Everything else searches the field's own list, exactly as `search` does.
    const items = Array.isArray(node.data.mockItems)
      ? (node.data.mockItems as QuestionOption[])
      : [];

    return new Set(
      items
        .filter((item) => item.exclusive === true)
        .map((item) => (typeof item.value === "string" ? item.value : "")),
    );
  }

  /**
   * Searches a bundled code list — countries and their like.
   *
   * The same search as the field's own list, over data that ships with us. What
   * differs is that a code list carries `synonyms`: the official name and the
   * one people type are not the same word often enough to matter, and a field
   * where "Vitryssland" finds nothing reads as broken rather than as strict.
   *
   * An unknown id gives an empty list rather than an error. The field is then
   * visibly empty, which is a fault somebody sees while building the guide —
   * quieter than a thrown error in front of a resident, and louder than falling
   * back to some other list they did not ask for.
   */
  private static frånKodlista(
    node: FlowNodeData,
    term: string,
    locale?: string,
  ): LookupItem[] {
    const id = typeof node.data.codeListId === "string" ? node.data.codeListId : "";
    const list = getCodeList(id);

    if (!list) {
      return [];
    }

    const nyckel = this.söknyckel(term);

    return list.items
      .map((item) => ({
        value: item.value,
        label: resolveText(item.label, locale, ""),
        synonyms: (item.synonyms ?? []).map((one) => resolveText(one, locale, "")),
        // Frånvarande och inte falskt: frånvaro är vad varje läsare redan
        // tolkar rätt, och `exclusive: false` i ett svar ser ut som ett beslut.
        ...(item.exclusive ? { exclusive: true } : {}),
      }))
      .filter((item) => item.label !== "")
      .filter(
        (item) =>
          this.söknyckel(item.label).includes(nyckel) ||
          this.söknyckel(item.value).includes(nyckel) ||
          item.synonyms.some((one) => this.söknyckel(one).includes(nyckel)),
      )
      .map(({ value, label, ...rest }) =>
        "exclusive" in rest ? { value, label, exclusive: true } : { value, label },
      )
      .slice(0, LOOKUP_LIMIT);
  }

  /** Searches the field's own list. No network traffic. */
  private static frånMock(
    node: FlowNodeData,
    term: string,
    locale?: string,
  ): LookupItem[] {
    const items = Array.isArray(node.data.mockItems)
      ? (node.data.mockItems as QuestionOption[])
      : [];

    // Case-insensitive and diacritic-insensitive, so "orebro" finds "Örebro".
    // `localeCompare` will not do here — it compares, it does not search.
    const nyckel = this.söknyckel(term);

    return items
      .map((item) => ({
        value: typeof item.value === "string" ? item.value : "",
        label: resolveText(item.label, locale, ""),
        ...(item.exclusive ? { exclusive: true } : {}),
      }))
      .filter((item) => item.label !== "")
      .filter(
        (item) =>
          this.söknyckel(item.label).includes(nyckel) ||
          this.söknyckel(item.value).includes(nyckel),
      )
      .slice(0, LOOKUP_LIMIT);
  }

  private static async frånTjänst(
    node: FlowNodeData,
    term: string,
    locale: string | undefined,
    fetchImpl: typeof fetch,
  ): Promise<LookupResult> {
    const endpoint = typeof node.data.endpoint === "string" ? node.data.endpoint : "";

    if (endpoint === "") {
      return { items: [], error: "Fältet saknar endpoint." };
    }

    try {
      const page = new URL(globalThis.location?.href ?? "http://localhost");
      const url = new URL(endpoint, page);

      // Judged on the resolved URL, so `//elsewhere`, `data:` and the like
      // are what the browser would make of them, not what they look like.
      // Refused before anything leaves the page; the field then says what it
      // says for any lookup that failed — "Uppslaget kunde inte nås".
      if (url.origin !== page.origin && !allowedOrigins.has(url.origin)) {
        return { items: [], error: `Uppslag till ${url.origin} är inte tillåtet av sidan.` };
      }

      url.searchParams.set("q", term);
      url.searchParams.set("limit", String(LOOKUP_LIMIT));

      if (locale) {
        url.searchParams.set("locale", locale);
      }

      const svar = await fetchImpl(url.toString(), {
        headers: { Accept: "application/json" },
        // fetch's default is `same-origin`, and measured 9/10 in Chromium a
        // cookie the page set reached a relative endpoint. The contract has
        // always said "without credentials": a service behind a login is the
        // BFF's to reach, and a guide is not the host's session to spend.
        credentials: "omit",
      });

      if (!svar.ok) {
        return { items: [], error: `Uppslaget svarade ${svar.status}.` };
      }

      return this.tolka(await svar.json());
    } catch (fel) {
      return { items: [], error: String((fel as Error)?.message ?? fel) };
    }
  }

  /**
   * Reads and *rejects* a response that does not follow the contract.
   *
   * A half-read response is worse than none: the field would show suggestions
   * without a code, the user picks one, and the variable ends up empty without
   * anyone noticing until further along the flow.
   */
  static tolka(kropp: unknown): LookupResult {
    if (kropp === null || typeof kropp !== "object") {
      return { items: [], error: "Svaret är inte ett JSON-objekt." };
    }

    const { version, items } = kropp as Partial<LookupResponse>;

    if (version !== LOOKUP_CONTRACT_VERSION) {
      return {
        items: [],
        error: `Svaret har version ${String(version)}, förväntade ${LOOKUP_CONTRACT_VERSION}.`,
      };
    }

    if (!Array.isArray(items)) {
      return { items: [], error: "Svaret saknar en items-lista." };
    }

    const giltiga = items.filter(
      (item): item is LookupItem =>
        item !== null &&
        typeof item === "object" &&
        typeof (item as LookupItem).value === "string" &&
        typeof (item as LookupItem).label === "string" &&
        (item as LookupItem).label !== "",
    );

    if (giltiga.length !== items.length) {
      return {
        items: [],
        error: "Ett eller flera förslag saknar value eller label.",
      };
    }

    return { items: giltiga.slice(0, LOOKUP_LIMIT), error: null };
  }

  /** Lowercase without diacritics, for comparison. */
  private static söknyckel(text: string): string {
    return text
      .toLocaleLowerCase("sv")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  }
}
