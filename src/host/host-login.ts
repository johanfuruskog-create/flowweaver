/**
 * The host's login, as a page sees it (story 126).
 *
 * ## Why this is not part of the storage adapter
 *
 * `ServerGraphStore` speaks the storage contract — six questions about one
 * guide — and that contract says nothing about identity on purpose: Sitevision
 * binds to its session, a municipality to its directory, and neither of them
 * would ever call any of the routes below. Putting *who am I* into the adapter
 * would have made every host implement a login to implement a storage.
 *
 * So this is the reference host's own half, kept beside the site that talks to
 * it rather than inside the library. Two pages use it and they use different
 * parts: *Mina guider* needs all of it, the editor needs only the name for its
 * top row.
 *
 * ## The cookie is the whole of it
 *
 * Every call is `credentials: "include"` and carries no token, because the
 * session lives in an `HttpOnly` cookie that nothing here can read. That is the
 * point rather than an inconvenience: a token a page can read is a token an
 * injected script can take, and the cookie the browser holds cannot be handed
 * to anybody by mistake.
 *
 * ## Four answers, and "broken" is not one of them
 *
 * `state()` tells the four apart, because a page that cannot distinguish *this
 * host has no login* from *you are logged out* offers a sign-in button that
 * leads nowhere. The host says which by status: `404` on `/auth/me` means the
 * routes do not exist here, `401` means they do and you are not, `200` means
 * you are.
 */

/**
 * The four roles, as a ladder (story 128).
 *
 * The **host's** words and not the page's: these are exactly what `.env` and
 * `GET /auth/me` say, and translating them here would mean two vocabularies for
 * one thing. What a reader sees — *läsare*, *redaktör* — is a word the page
 * looks up, and it is looked up from these.
 */
export type HostRole = "reader" | "editor" | "publisher" | "admin";

const LADDER: HostRole[] = ["reader", "editor", "publisher", "admin"];

/**
 * Is this role at least that one? The only permission question a page asks, and
 * the same one the host asks itself (`roles.mjs`).
 *
 * A page asking it is a **courtesy**, never a guard: the mode it sets is a view
 * and the host is the protection (`EditorMode` says so itself). The point is
 * that nobody is shown a palette they cannot use or a button that would only
 * produce a `401`.
 */
export const roleAllows = (role: HostRole, needed: HostRole): boolean =>
  LADDER.indexOf(role) >= LADDER.indexOf(needed);

/**
 * A role out of whatever the host answered, and **reader** for anything else.
 *
 * Unknown is the bottom rung, which is the same decision the host makes and for
 * the same reason: a host that is older than this story answers without a
 * `role` at all, and reading that as *administrator* would hand a palette to
 * somebody the host will refuse — a screen full of controls that do nothing.
 */
export const asRole = (value: unknown): HostRole =>
  LADDER.includes(value as HostRole) ? (value as HostRole) : "reader";

/** Where a page stands with the host. */
export type HostState =
  | { kind: "no-host" }
  | { kind: "no-login" }
  | { kind: "signed-out" }
  | { kind: "signed-in"; name: string; email: string; role: HostRole };

/** A guide as `GET /guides` lists it. */
export interface HostGuide {
  id: string;
  name: string;
  current: string;
  updatedAt: string;
  /**
   * Who touched it last — the name, never a subject (story 127).
   *
   * Absent on a guide nobody has written in since the host had a login, and
   * then the row says only *Ändrad <datum>*. A word *av* followed by nothing
   * is worse than no word at all.
   */
  updatedBy?: { name: string };
  /**
   * Vem som arbetar i den just nu (berättelse 129).
   *
   * Bara när låset lever — ett som passerat sin tid finns inte, och värden
   * räknar det aldrig. `me` är värdens svar på *är det jag själv?*, av samma
   * skäl som `mine` nedan: sidan lär sig aldrig sitt eget subjekt.
   *
   * Vid inläsningen och inte löpande: listan är ingen närvarovy, och en rad
   * som uppdaterar sig själv är en rad som behöver en uppkoppling för att inte
   * ljuga.
   */
  lock?: { name: string; me?: boolean };
  /**
   * Arbetsanteckningen någon lämnat på arbetskopian (berättelse 130).
   *
   * *Inte klar — juristen ska läsa resultattexterna.* Listan visar den dämpad
   * under titeln, så den som letar efter något att publicera ser invändningen
   * innan hen öppnar guiden.
   *
   * Saknas hos en värd utan inloggning: en anteckning utan avsändare är en
   * lapp utan namn, och då är den inte värd att lita på.
   */
  draftNote?: { text: string; at?: string; by?: { name?: string; me?: boolean } };
  /**
   * Did the asker create it, or make that last change?
   *
   * The **host** decides, because this page never learns its own subject: it
   * knows what it is called, and two people with the same name in one
   * municipality would make a name comparison the wrong answer for one of
   * them. *Bara mina* filters on this word alone.
   */
  mine?: boolean;
}

export interface HostLogin {
  state(): Promise<HostState>;
  /** Where the *Logga in* button points, coming back to `returnTo` afterwards. */
  loginAddress(returnTo: string): string;
  logout(): Promise<void>;
  listGuides(): Promise<{ ok: true; guides: HostGuide[] } | { ok: false }>;
  createGuide(name?: string): Promise<{ ok: true; id: string } | { ok: false }>;
}

export function hostLogin(base: string, fetcher: typeof globalThis.fetch = globalThis.fetch.bind(globalThis)): HostLogin {
  const root = base.replace(/\/$/, "");

  const ask = async (path: string, init: RequestInit = {}): Promise<Response | null> => {
    if (root === "") {
      return null;
    }

    try {
      return await fetcher(`${root}${path}`, { credentials: "include", ...init });
    } catch {
      /*
       * A host that cannot be reached and a host that refused are different
       * things, and only the second is an answer. `null` is *no answer*, and
       * every caller below turns it into the state it means rather than into a
       * status code nobody sent.
       */
      return null;
    }
  };

  return {
    async state(): Promise<HostState> {
      if (root === "") {
        return { kind: "no-host" };
      }

      const answer = await ask("/auth/me");

      if (!answer) {
        return { kind: "no-host" };
      }

      if (answer.status === 404) {
        return { kind: "no-login" };
      }

      if (!answer.ok) {
        return { kind: "signed-out" };
      }

      const body = (await answer.json()) as { name?: string; email?: string; role?: unknown };

      return {
        kind: "signed-in",
        name: String(body.name ?? ""),
        email: String(body.email ?? ""),
        role: asRole(body.role),
      };
    },

    loginAddress(returnTo: string): string {
      /*
       * The address to come back to travels as a parameter and is checked by
       * the host against its own list of origins. Both halves are needed: a
       * host that follows whatever it is told is an open redirect, and a page
       * that cannot say where it started sends everybody to the front page
       * after a login they began somewhere else.
       */
      return `${root}/auth/login?return=${encodeURIComponent(returnTo)}`;
    },

    async logout(): Promise<void> {
      // POST, because a logout a link can trigger is a logout somebody else's
      // page can trigger.
      await ask("/auth/logout", { method: "POST" });
    },

    async listGuides() {
      const answer = await ask("/guides");

      if (!answer?.ok) {
        return { ok: false as const };
      }

      const body = (await answer.json()) as { guides?: HostGuide[] };

      return { ok: true as const, guides: Array.isArray(body.guides) ? body.guides : [] };
    },

    async createGuide(name = "") {
      const answer = await ask("/guides", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!answer?.ok) {
        return { ok: false as const };
      }

      const body = (await answer.json()) as { guide?: { id?: string } };
      const id = String(body.guide?.id ?? "");

      return id === "" ? { ok: false as const } : { ok: true as const, id };
    },
  };
}
