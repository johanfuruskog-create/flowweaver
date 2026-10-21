/**
 * What the guides app needs to know about the page it runs on, set by the
 * page before the app starts (open-core step 7, 2026-10-07).
 *
 * The app — *Mina guider* (`guides.ts`) and the editor beside it
 * (`guide-storage.ts`) — is the open FlowWeaver's reference host: it shows the
 * storage contract in use. It used to read four things straight out of the
 * example site: the API address from the site's interest form, the page's
 * language from the site's paths, and where the editor page and the list sit. A page now
 * says them here, in a module it imports *before* the app, so the app runs on
 * the site and on the open repo's demo alike.
 *
 * `?api=` in the address wins over `api` — but only when it names this
 * machine (`hostApi` below, 9/10).
 */
export interface HostConfig {
  /** The storage host's base address; empty means "no host is connected". */
  api: string;
  /** The page's language, which the app's own words follow. */
  locale: "sv" | "en";
  /** Where the editor page is, relative to the guides page. */
  editorHref: string;
  /** Where the guides list is, relative to the editor page: its way back. */
  guidesHref: string;
}

export const hostConfig: HostConfig = {
  api: "",
  locale: "sv",
  editorHref: "./guide-storage.html",
  guidesHref: "../guides/",
};

export function configureHost(config: Partial<HostConfig>): void {
  Object.assign(hostConfig, config);
}

/**
 * The storage host this page talks to: `?api=` when it names this machine,
 * otherwise the page's own `api`.
 *
 * ## Why only this machine
 *
 * `?api=` exists so the app can be tried against a receiver on your own
 * computer — `smoke:login` and `smoke:storage` run exactly that, on
 * `localhost`. Taken from any address, it let a link aim the page at a server
 * of the link-maker's choosing (security review 8/10): *Logga in* leads to
 * that server's `/auth/login`, and the editor sends the guide being written
 * there on every save.
 *
 * On our own site that was harmless, and measured so 9/10: the built page's
 * `connect-src` names one origin, and with `?api=https://ond.example` the
 * browser refused both pages' calls — zero requests reached it. But that
 * policy is written by our `vite.config.ts`, not by this code, and this code
 * is the open product's reference app: a host who serves it without the same
 * policy got none of that protection. So the rule lives where the parameter
 * is read.
 *
 * Loopback only — `localhost`, `127.0.0.1`, `[::1]`, any port — compared on
 * the parsed hostname, so `http://localhost@ond.example` (which is
 * `ond.example`) and `http://localhost.ond.example` are not this machine. An
 * address that is refused is said in the console rather than dropped in
 * silence (PRAXIS 35).
 */
export function hostApi(search: string): { api: string; given: string | null } {
  const asked = new URLSearchParams(search).get("api")?.trim() ?? "";

  if (asked !== "" && isLoopback(asked)) {
    return { api: asked, given: asked };
  }

  if (asked !== "") {
    console.warn(`?api=${asked} används inte: bara en adress på den här datorn (localhost) får ersätta värden.`);
  }

  return { api: (hostConfig.api ?? "").trim(), given: null };
}

function isLoopback(address: string): boolean {
  try {
    const { protocol, hostname } = new URL(address);

    return (
      (protocol === "http:" || protocol === "https:") &&
      (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]")
    );
  } catch {
    return false;
  }
}
