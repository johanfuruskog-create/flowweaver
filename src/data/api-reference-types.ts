import type { SiteText } from "./example-catalog";

/**
 * One name a host can reach: an attribute, a property, a method, an event or
 * an export. The NAMES are not ours to choose here — they are frozen in
 * `src/entries/public-surface.snapshot.json`, and the gate
 * `src/gates/api-reference-covers-surface.test.ts` fails on a name without an
 * entry and on an entry without a name. What an entry adds is what the name
 * does, in both languages.
 */
export interface ApiEntry {
  name: string;
  kind: "attribute" | "property" | "method" | "event" | "function" | "constant" | "type" | "class" | "note";
  /** Code, language-neutral: a signature, a detail type, an attribute form. */
  signature?: string;
  /** For attributes and enum-like properties: the values it takes. */
  values?: string;
  /** For events: the element that dispatches it. */
  element?: string;
  /** The contract in docs/ that governs it, e.g. "UPPSLAG-KONTRAKT.md". */
  contract?: string;
  text: SiteText;
}

export interface ApiSection {
  id: string;
  heading: SiteText;
  intro: SiteText;
  /** FlowWeaver PRO's: shown under a PRO badge, its contracts not linked to the open repo. */
  pro?: true;
  entries: ApiEntry[];
}
