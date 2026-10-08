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
 * `?api=` in the address still wins over `api`, as it always did.
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
