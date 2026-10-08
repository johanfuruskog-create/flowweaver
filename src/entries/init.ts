import { declareLocales, registerLocale } from "../viewer/localization/registry";

import type { GuideVersion } from "../viewer/types/versions";
import type { LocaleCoverage } from "../viewer/localization/registry";
import type { ThemeChoice } from "../viewer/core/theme";
import type { GraphData } from "../viewer/types/graph";

/**
 * One call that wires an editor into a host system — story 015, as an API.
 *
 * ## Why it exists
 *
 * The setup is short, but every line of it is a decision only the host can
 * make: who may edit, which languages exist, where a guide is saved. None of
 * those has a default we could pick, so leaving them out has to be visible
 * rather than silent — which is what `checkSetup` is for, and what this returns
 * a handle to.
 *
 * It replaces a page of attribute-setting that every integration wrote out by
 * hand, and got subtly differently each time.
 *
 * ## Order is not decoration
 *
 * Language packs are registered before anything renders, because lookup asks
 * the registry and an element that has already rendered has already chosen its
 * texts. Everything else here can happen in any order, and saying so is worth
 * as much as the ordering itself: an invented requirement costs the reader the
 * same as a missing one.
 */

/** Texts for one language. Split by audience, which is story 017's line. */
export interface LanguagePack {
  /** What a resident reads: buttons, field labels, validation messages. */
  viewer?: Record<string, string>;
  /** What an editor reads: the palette, the panel, the menus. */
  editor?: Record<string, string>;
}

export interface LanguageSetup {
  /**
   * The languages a guide may be offered in. The editor shows one checkbox per
   * entry; without this there is nothing to tick and an editor can only untick
   * what a guide already carries.
   */
  offer?: readonly string[];
  /** What a **new** guide is written in. A guide that says otherwise wins. */
  source?: string;
  /** Which language the editor opens showing. The content axis. */
  content?: string;
  /** The tool's own language: Swedish, English, or a pack you registered. */
  tool?: string;
}

export interface HostSetup {
  /** The guide as your system stored it. */
  graph?: GraphData;
  /** What this user may do, from your own permission system. */
  mode?: "readonly" | "translator" | "edit" | "administrator";
  languages?: LanguageSetup;
  /**
   * Texts for a language we do not ship. Only needed for a third language —
   * Swedish and English are complete in the package.
   */
  packs?: Record<string, LanguagePack>;
  /** The shared node templates your system stored. */
  templates?: unknown[];
  /**
   * The versions your system keeps of this guide, for a `<guide-versions>`.
   *
   * The list renders them and asks — `version-open-intent`,
   * `version-activate-intent` and the rest. Reading, writing, naming and
   * removing stay with whoever owns the storage, which is why there is no
   * `onVersion` here to match `onSave`: saving a guide has one meaning, and
   * "duplicate this version" has as many as there are places to keep guides.
   */
  versions?: GuideVersion[];
  /**
   * Light or dark, when the host has already decided. Left out, the elements
   * follow the operating system.
   *
   * The library never remembers this. A theme toggle is the host's chrome, and
   * which theme a person chose is the host's to store (K6d).
   */
  theme?: ThemeChoice | null;
  /** Save the guide. Called on every change — the library stores nothing. */
  onSave?: (graph: GraphData) => void;
  /** Save the shared templates. Same reason. */
  onTemplatesChange?: (templates: unknown[]) => void;
}

/** What `init` hands back, so a host can act on what it did. */
export interface Wiring {
  /** How much each registered pack covers, by language code. */
  coverage: Record<string, LocaleCoverage>;
  /** Stop listening. The element is left as it is. */
  disconnect: () => void;
}

type Editor = HTMLElement & {
  graph?: GraphData;
  nodeTemplates?: unknown[];
  getData?: () => GraphData;
  versions?: GuideVersion[];
  setTheme?: (theme: ThemeChoice | null) => void;
};

/**
 * Wires one `<guide-editor>` (or `<guide-preview>`) into a host.
 *
 * Returns the coverage of every pack it registered, so a host learns what a
 * partial translation actually covers at the moment it hands it over rather
 * than when a resident meets the gap.
 */
export function init(element: Editor, setup: HostSetup = {}): Wiring {
  const languages = setup.languages ?? {};
  const coverage: Record<string, LocaleCoverage> = {};

  // 1. Packs first: an element that has rendered has already chosen its texts.
  for (const [locale, pack] of Object.entries(setup.packs ?? {})) {
    coverage[locale] = registerLocale(locale, {
      ...(pack.viewer ?? {}),
      ...(pack.editor ?? {}),
    });
  }

  // 2. Which languages exist. Skipping it is a different thing from having
  //    none: the editor keeps whatever the guide carries and offers no more.
  if (languages.offer && languages.offer.length > 0) {
    declareLocales(languages.offer, { default: languages.source });
  }

  // 3. What this user may do. Without it the guide is read-only, which is the
  //    intended default and looks exactly like a forgotten attribute.
  if (setup.mode) {
    element.setAttribute("mode", setup.mode);
  }
  /*
   * The tool's language, on every element a host mounts.
   *
   * This is the one that goes wrong quietly: the list ships Swedish and English
   * and defaults to Swedish, so an English page that never set the attribute
   * gets an English editor above a Swedish table and nothing says a word.
   */
  if (languages.tool) {
    element.setAttribute("editor-locale", languages.tool);
  }
  if (languages.content) {
    element.setAttribute("active-locale", languages.content);
  }
  // Undefined means "not the host's business"; null is a decision — it hands
  // the choice back to the operating system.
  if (setup.theme !== undefined) {
    element.setTheme?.(setup.theme);
  }
  if (setup.versions) {
    element.versions = setup.versions;
  }

  const listeners: Array<[string, EventListener]> = [];
  const listen = (type: string, handler: EventListener): void => {
    element.addEventListener(type, handler);
    listeners.push([type, handler]);
  };

  // 4. The templates your system stored, and the promise to store them again.
  if (setup.templates) {
    element.nodeTemplates = setup.templates;
  }
  if (setup.onTemplatesChange) {
    listen("node-templates-changed", (event) => {
      setup.onTemplatesChange?.(
        (event as CustomEvent<{ templates: unknown[] }>).detail.templates,
      );
    });
  }

  // 5. The guide, and the promise to save it. This is the one that loses an
  //    afternoon rather than a template.
  if (setup.onSave) {
    listen("graph-changed", () => {
      const data = element.getData?.();
      if (data) {
        setup.onSave?.(data);
      }
    });
  }

  /*
   * The graph last, and only if given. An element can have its graph set before
   * the bundle loads — the upgrade guard takes the value back off itself — but
   * setting it after the language is decided means the first render is already
   * right rather than correcting itself.
   */
  if (setup.graph) {
    element.graph = setup.graph;
  }

  return {
    coverage,
    disconnect: () => {
      for (const [type, handler] of listeners) {
        element.removeEventListener(type, handler);
      }
      listeners.length = 0;
    },
  };
}
