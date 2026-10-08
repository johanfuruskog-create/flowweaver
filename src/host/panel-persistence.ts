/**
 * The reference host's memory of the editor's panels: the side panel's width
 * (story 141), and whether the side panel and the full node palette are open
 * (stories 145 and 146). The example site's pages run it
 * through `site-chrome`, and the guides app's editor page runs it itself —
 * the page where editors spend their day.
 *
 * Kept like the theme (`theme-persistence.ts`) and the colour scale
 * (`palettes.ts`): in the browser, because that is where this host keeps its
 * preferences. The library draws what it is told and announces a finished
 * change — `panel-width-changed`, `panel-open-changed`,
 * `palette-open-changed` — and stores nothing
 * (K6e, story 145 criterion 11). A width reset announces `null`, and the memory
 * goes with it.
 *
 * One memory for every editor on the site, not one per page: the reason to
 * widen the panel, or to keep it out of the way, is the screen and the way one
 * works, and both are the same on every page. That is the site's answer to
 * story 145's question about instances; a host with editors that differ — a
 * translator's page beside an author's — keys its own.
 *
 * Restored before the first paint: the page runs this as its script starts, in
 * the same task the editor is drawn in, and a state set by the host is drawn
 * at once and without motion — so an open panel is open in the first frame.
 *
 * The file never reaches the package — it is the host's, imported by the
 * site's chrome and the guides app, never by `src/entries/*`.
 */

const WIDTH_KEY = "flowweaver:panel-width";
const OPEN_KEY = "flowweaver:panel-open";
const PALETTE_KEY = "flowweaver:palette-open";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode — the choice still holds for the page */
  }
}

/**
 * Gives every editor on the page the remembered width and open state, and
 * remembers the next change of either.
 *
 * An editor whose markup already names a width keeps it: saying it in the
 * markup is how a page opts out, as with `editor-locale`. Open is a yes or
 * nothing — folded is the editor's own default — so only a remembered *open*
 * is handed on, and a page that wants its panel open says `panel-open` itself.
 */
export function initPanelMemory(): void {
  const width = read(WIDTH_KEY);
  const open = read(OPEN_KEY) === "true";
  const paletteOpen = read(PALETTE_KEY) === "true";

  for (const editor of document.querySelectorAll("guide-editor")) {
    if (width !== null && !editor.hasAttribute("panel-width")) {
      editor.setAttribute("panel-width", width);
    }
    if (open) editor.setAttribute("panel-open", "");
    if (paletteOpen) editor.setAttribute("palette-open", "");
  }

  document.addEventListener("panel-width-changed", (event) => {
    const changed = (event as CustomEvent<{ width: number | null }>).detail.width;

    write(WIDTH_KEY, changed === null ? null : String(changed));
  });
  document.addEventListener("panel-open-changed", (event) => {
    write(OPEN_KEY, String((event as CustomEvent<{ open: boolean }>).detail.open));
  });
  document.addEventListener("palette-open-changed", (event) => {
    write(PALETTE_KEY, String((event as CustomEvent<{ open: boolean }>).detail.open));
  });
}
