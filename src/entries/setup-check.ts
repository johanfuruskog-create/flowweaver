import { getGuideLocales, getSourceLocale } from "../viewer/core/localized-text";
import { VIEWER_STRINGS } from "../viewer/localization/built-in-strings";
import { declaredLocales, registeredText } from "../viewer/localization/registry";

import type { GraphData } from "../viewer/types/graph";

/**
 * What the host can ask about their own setup — story 016.
 *
 * ## Why it exists
 *
 * Every setup fault this project has had was **silent**: a graph set as an
 * object that skipped the migration, a page that rendered no fields, CSS that
 * leaked onto the host's page, an Arabic guide with Swedish buttons, node
 * templates saved in one browser. Six faults, no error messages, and all but one
 * found because a person happened to look.
 *
 * That is not bad luck. It follows from two deliberate choices, both right: the
 * library stores nothing, so it cannot know the host forgot to save; and
 * capability is opt in, so a silent locked editor is the *correct* answer to a
 * setup nobody did. Correct behaviour and silent failure look the same.
 *
 * ## What it will not do
 *
 * It reports only what is observable without guessing the host's intent. A check
 * that warns about what it cannot know becomes noise, and noise gets switched
 * off — then it is worse than nothing.
 *
 * Three things it therefore never mentions:
 *
 * - **Whether anyone is listening.** `getEventListeners` is a devtools API and
 *   does not exist to a page, so a missing `graph-changed` listener is
 *   genuinely invisible to us. Story 016's own table claimed otherwise; it was
 *   wrong, and this is where that shows.
 * - **Whether a listener does the right thing.** We can never know that a save
 *   handler saves.
 * - **What the host's permissions should be.** `mode` is theirs to decide; we
 *   only say what the current value leads to.
 *
 * ## Cost
 *
 * Nothing at runtime. This is a call the host makes, not a hook that runs on
 * every render.
 */

/** How much a finding matters, in terms of who it reaches. */
export type SetupSeverity = "error" | "warning";

/** One thing observed about the setup, and what it leads to. */
export interface SetupFinding {
  /** Stable across versions, so a host can filter or suppress by id. */
  id: string;
  severity: SetupSeverity;
  /** What is observed, in plain terms. */
  what: string;
  /** What it leads to — the reason the observation is worth reading. */
  consequence: string;
}

/** The answer. `ok` is true only when nothing was found. */
export interface SetupReport {
  ok: boolean;
  findings: SetupFinding[];
}

/** The element the check inspects. Either of the two the package offers. */
export interface CheckableElement extends HTMLElement {
  graph?: GraphData;
}

/**
 * Reads the setup of a mounted element and reports what is wrong with it.
 *
 * English rather than the guide's language, and deliberately not localised:
 * this is read by whoever wired the integration, not by an editor or a
 * resident. It is the one text in the package that is not the product's.
 */
export function checkSetup(element: CheckableElement): SetupReport {
  const findings: SetupFinding[] = [];
  const tag = element.tagName.toLowerCase();

  /*
   * The tokens resolve on the element itself, one step down from `:root`
   * (story 012). If they are missing the components render with no colours at
   * all, which looks like a broken build rather than a missing stylesheet.
   */
  const primary = getComputedStyle(element).getPropertyValue("--fw-primary").trim();
  if (primary === "") {
    findings.push({
      id: "tokens-missing",
      severity: "error",
      what: "No design tokens resolve on the element.",
      consequence:
        "The components render unstyled. The bundle normally applies them itself; " +
        "this usually means a build that stripped the injected stylesheet.",
    });
  }

  // Capability is opt in, so this is the correct default — and it is exactly
  // why it needs saying. A locked editor and a forgotten attribute look alike.
  if (tag === "guide-editor" && element.getAttribute("mode") === null) {
    findings.push({
      id: "mode-not-set",
      severity: "warning",
      what: "No `mode` attribute is set, so the editor is read-only.",
      consequence:
        "Nothing in the guide can be changed. That is the intended default — " +
        "set `mode` from your own permission system when a user may edit.",
    });
  }

  const graph = element.graph;
  if (graph) {
    findings.push(...checkLocales(graph));
  }

  return { ok: findings.length === 0, findings };
}

/**
 * The languages the guide offers, against what the host has set up.
 *
 * Two different gaps, and they are worth keeping apart. One is governance — a
 * guide offering a language outside the host's declared list — and one is text:
 * a language where a resident would still meet Swedish.
 */
function checkLocales(graph: GraphData): SetupFinding[] {
  const findings: SetupFinding[] = [];
  const source = getSourceLocale(graph);
  const offered = getGuideLocales(graph.settings?.locales, source).map(
    (locale) => locale.code,
  );

  const declared = declaredLocales();
  if (declared) {
    const outside = offered.filter((code) => !declared.includes(code));
    if (outside.length > 0) {
      findings.push({
        id: "locale-not-declared",
        severity: "warning",
        what: `The guide offers ${outside.join(", ")}, which ${
          outside.length === 1 ? "is" : "are"
        } not in the declared list.`,
        consequence:
          "The guide was probably written before the list was declared. " +
          "Either add the language to `declareLocales` or remove it from the guide.",
      });
    }
  }

  for (const code of offered) {
    if (code === source) {
      continue;
    }
    const missing = Object.keys(VIEWER_STRINGS).filter(
      (key) => !hasViewerText(graph, key, code),
    );
    if (missing.length > 0) {
      findings.push({
        id: `viewer-texts-missing:${code}`,
        severity: "warning",
        what: `${missing.length} of ${
          Object.keys(VIEWER_STRINGS).length
        } viewer texts have nothing in ${code}.`,
        /*
         * Name the language they actually meet, rather than assuming Swedish.
         * Resolution falls back to the guide's own source, so an
         * English-authored guide leaves an untranslated button in English. The
         * text said "Swedish" flatly, which was true of every guide we had
         * written and of nothing else — the same assumption that produced the
         * fallback bug this check exists beside.
         */
        consequence:
          `A resident reading the guide in that language meets buttons in ${source}, ` +
          "the language the guide is written in. Either register a pack for it, " +
          "or let the translator fill them in the guide.",
      });
    }
  }

  return findings;
}

/** Would a resident read this key in this language, from any source? */
function hasViewerText(graph: GraphData, key: string, locale: string): boolean {
  const own = graph.settings?.strings?.[key];
  if (
    own !== null &&
    typeof own === "object" &&
    typeof (own as Record<string, unknown>)[locale] === "string" &&
    ((own as Record<string, string>)[locale] ?? "").trim() !== ""
  ) {
    return true;
  }
  if (registeredText(key, locale) !== undefined) {
    return true;
  }
  const builtIn = VIEWER_STRINGS[key];
  const text = builtIn?.[locale] ?? builtIn?.[locale.split("-")[0]];
  return typeof text === "string" && text.trim() !== "";
}
