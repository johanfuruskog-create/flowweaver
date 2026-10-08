/*
 * `LocalizedTextMap` and not `LocalizedText`, which also admits a bare string.
 * A code list's label always names a language: the whole point of the list is
 * that it is offered in the reader's, and a loose string would let a Swedish
 * name through as if it were every language at once.
 */
import type { LocalizedTextMap } from "../core/localized-text";

/**
 * Lists of codes a field can offer, and a rule can branch on.
 *
 * ## Why a list is data and not strings
 *
 * A country list is **data**, not chrome. K1 puts every piece of interface text
 * in `ui-strings`, and that is right for labels somebody wrote; it is wrong for
 * two hundred country names, which would swamp a registry that carries 544 keys
 * for the whole product. So code lists live here, keyed by their own identity.
 *
 * ## Why the standard is a field
 *
 * The first list is Swedish, and it would have been easy to build for Sweden
 * alone. But a code only means something to whoever receives it: a guide feeding
 * a Swedish case system wants Skatteverket's list, one feeding a European
 * service may want plain ISO alpha-2, and something older may want alpha-3 or
 * the numeric form. Those are different lists of the *same* countries, and the
 * only way a guide can say which it means is if the list says which standard its
 * codes follow.
 *
 * So `standard` is not decoration. It is the field that keeps the second list
 * from being a fork of the first.
 *
 * ## Why a bundled list at all
 *
 * The lookup contract exists so that FlowWeaver knows nothing about anybody's
 * source — see `docs/UPPSLAG-KONTRAKT.md` — and that remains the right answer
 * whenever the value is sent onward, because the code has to match the system
 * that receives it. A bundled list is for the other case: a guide that only
 * branches internally, "EU or not", and never sends the value anywhere. There
 * any consistent list will do, and requiring a service for it would be absurd.
 *
 * The version and date are carried on purpose. A copy of somebody else's list is
 * a copy that drifts, and the drift is invisible unless the copy says what it is
 * a copy *of*.
 */

/** One entry: the code that gets stored, and what a person sees. */
export interface CodeListItem {
  /** The stored value — `SE`, `DE`, `XS`. */
  value: string;
  label: LocalizedTextMap;
  /**
   * What somebody might type instead of the label.
   *
   * The official name and the everyday one differ often enough to matter:
   * Belarus and Vitryssland, Storbritannien and England, Nederländerna and
   * Holland. Without these the field looks broken to the person who typed what
   * they call the place — which is the failure GOV.UK found and fixed with
   * synonyms when they built the same field for passport applications.
   */
  synonyms?: LocalizedTextMap[];
  /**
   * The source's own spelling, where we publish something else.
   *
   * Present only where the two differ, so a deviation is auditable rather than
   * silent. Correcting a source without saying so is how a copy stops being one.
   */
  sourceLabel?: string;
  /**
   * An entry that cannot be held together with any other in the same answer.
   *
   * Skatteverket's list carries four of them — `XS` stateless, `XO` unknown
   * country, `ZZ` under investigation, `XU` ceased country. None of the four
   * is a country you can hold *as well*: stateless means no state counts you
   * as a citizen, so *stateless and German* is a contradiction rather than an
   * unusual answer. Story 062.
   *
   * It is ours to say and not the source's: Skatteverket publishes codes and
   * names, and what the codes MEAN together is our reading of them. That
   * reading is what the flag records, which is why it sits beside
   * `sourceLabel` — the other field on this entry that says something the
   * source did not.
   */
  exclusive?: boolean;
}

/** Which standard a list's codes follow. Two lists sharing one are comparable. */
export type CodeStandard =
  | "iso-3166-1-alpha-2"
  | "iso-3166-1-alpha-3"
  | "iso-3166-1-numeric"
  | "custom";

export interface CodeList {
  id: string;
  standard: CodeStandard;
  label: LocalizedTextMap;
  /** The source's version, verbatim. Empty for a list that has none. */
  version: string;
  /** When that version was published, `YYYY-MM-DD`. */
  published: string;
  source: string;
  sourceUrl?: string;
  /**
   * Where the names in each language come from, when that is not `source`.
   *
   * A list's codes and its labels need not share an authority. Skatteverket
   * publishes the codes and Swedish names and no English at all, so English
   * comes from CLDR — and somebody reading the file a year from now should not
   * have to guess which half they are looking at.
   */
  labelSources?: Record<string, string>;
  items: CodeListItem[];
}

const lists = new Map<string, CodeList>();

/**
 * Takes a list, from us or from a host, and complains loudly about a bad one.
 *
 * ## Why this throws
 *
 * A `CodeList` is plain data with no functions in it, which is deliberate: it
 * means a host can keep their own list as a JSON file and hand it straight over,
 * without us shipping every list anybody might want.
 *
 * The cost of that is that the thing arriving here was a file a moment ago and
 * may be anything at all. The quiet failure is the dangerous one — a list that
 * registers with no items gives a field that finds nothing, which looks like a
 * search that found nothing, and somebody debugs their spelling for an hour.
 * So a malformed list is refused at the door, by name.
 */
export function registerCodeList(list: CodeList): void {
  const fault = codeListFault(list);

  if (fault) {
    throw new TypeError(`Kodlistan går inte att registrera: ${fault}`);
  }

  lists.set(list.id, list);
}

/** What is wrong with this list, or `null` when nothing is. */
export function codeListFault(list: unknown): string | null {
  if (!list || typeof list !== "object") {
    return "den är inte ett objekt";
  }

  const candidate = list as Partial<CodeList>;

  if (typeof candidate.id !== "string" || candidate.id.trim() === "") {
    return "den saknar id";
  }

  if (!Array.isArray(candidate.items) || candidate.items.length === 0) {
    return `"${candidate.id}" har inga poster`;
  }

  const STANDARDS = [
    "iso-3166-1-alpha-2",
    "iso-3166-1-alpha-3",
    "iso-3166-1-numeric",
    "custom",
  ];

  if (typeof candidate.standard !== "string" || !STANDARDS.includes(candidate.standard)) {
    // Not decoration: it is what keeps two lists of the same countries from
    // being mistaken for each other. `SE`, `SWE` and `752` all name Sweden.
    return `"${candidate.id}" saknar en känd standard (${STANDARDS.join(", ")})`;
  }

  for (const [index, item] of candidate.items.entries()) {
    if (!item || typeof item !== "object") {
      return `"${candidate.id}" post ${index} är inte ett objekt`;
    }

    if (typeof item.value !== "string" || item.value.trim() === "") {
      return `"${candidate.id}" post ${index} saknar värde`;
    }

    if (!item.label || typeof item.label !== "object") {
      return `"${candidate.id}" post ${index} (${item.value}) saknar etikett`;
    }

    const named = Object.values(item.label).some(
      (text) => typeof text === "string" && text.trim() !== "",
    );

    if (!named) {
      return `"${candidate.id}" post ${index} (${item.value}) har ingen etikett på något språk`;
    }
  }

  return null;
}

/** Takes a list away again. Registering the same id twice replaces it. */
export function unregisterCodeList(id: string): void {
  lists.delete(id);
}

export function getCodeList(id: string): CodeList | null {
  return lists.get(id) ?? null;
}

/** Every registered list, for the editor to offer and for tests to sweep. */
export function getCodeLists(): CodeList[] {
  return [...lists.values()];
}
