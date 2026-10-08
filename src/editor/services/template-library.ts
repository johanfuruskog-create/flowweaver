import { tOr } from "../localization/editor-ui-strings";
import { toNodeTemplate } from "../../viewer/node-types/node-templates";

import type { NodeTemplate } from "../../viewer/types/graph";

/**
 * A library of node templates. A template such as "Ja/Nej" is defined once and
 * becomes available in every guide.
 *
 * ## The library stores nothing
 *
 * The templates live in memory. Where they are saved — in the browser, on a
 * website, shared between colleagues — is the host's call; it sets the list and
 * listens for changes. The same contract as for the guide itself, see K6d and
 * K6e in `docs/KRAV.md`.
 *
 * This file used to write to `localStorage` directly. The consequence was that a
 * template was visible only to whoever created it, in that browser, and that a
 * colleague building the next guide started from nothing. The demo page's shell
 * does that writing instead — right where the guide's autosave already sits.
 *
 * On export, used templates are embedded in the guide's JSON so it stays
 * portable; on load, the guide's carried templates are merged into the
 * library.
 */

let library: NodeTemplate[] = [];

/**
 * Types that ship with the library itself. They survive a host setting its own
 * list — otherwise a host sending two templates would accidentally remove
 * E-postfråga, Telefonnummer and Personnummer.
 */
const builtinTypes = new Set<string>();

type Listener = (specs: NodeTemplate[]) => void;

const listeners = new Set<Listener>();



export function getLibrary(): NodeTemplate[] {
  return library.map((spec) => structuredClone(spec));
}

/**
 * The templates that do not come from the library itself — that is, what a host
 * should save. The built-ins ship with the code and need no storage.
 */
export function getEditableLibrary(): NodeTemplate[] {
  return getLibrary().filter((spec) => !builtinTypes.has(spec.type));
}

/**
 * Subscribes to changes. The listener gets the whole list, so it never has to
 * track what changed. Returns an unsubscribe.
 */
export function subscribeToLibrary(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function write(specs: NodeTemplate[]): void {
  library = specs;
  const snapshot = getEditableLibrary();
  listeners.forEach((listener) => listener(snapshot));
}

/**
 * Sets the templates from outside, from a host. The built-ins remain.
 *
 * Deliberately fires no change event: this is the host stating what it has, not
 * the editor having changed something. Without that distinction, every load
 * would bounce straight back as a write.
 */
export function setLibrary(specs: unknown): void {
  const giltiga = Array.isArray(specs)
    ? specs.map(toNodeTemplate).filter((spec): spec is NodeTemplate => spec !== null)
    : [];
  const inbyggda = library.filter((spec) => builtinTypes.has(spec.type));
  const known = new Set(inbyggda.map((spec) => spec.type));

  library = [...inbyggda, ...giltiga.filter((spec) => !known.has(spec.type))];
}

/** Adds or replaces a template (the same key updates). */
export function saveToLibrary(spec: NodeTemplate): void {
  write(
    library.some((item) => item.type === spec.type)
      ? library.map((item) => (item.type === spec.type ? spec : item))
      : [...library, spec]
  );
}

/**
 * Removes a template. Built-ins remain — they belong to the tool, and there is
 * nowhere to remember a removal: the host saves only the editor's own.
 */
export function removeFromLibrary(type: string): void {
  if (builtinTypes.has(type)) {
    return;
  }

  write(library.filter((item) => item.type !== type));
}

/**
 * A template's name, or `undefined` if it no longer exists.
 *
 * A node created from a template carries the template's key as provenance. If it
 * can be looked up the node takes the template's name; otherwise the base
 * type's. No cloning here — this question is asked once per node on every
 * redraw.
 */
export function templateLabel(
  type: string | undefined,
  uiLocale?: string
): string | undefined {
  const template = type ? library.find((item) => item.type === type) : undefined;
  return template ? displayTemplateLabel(template, uiLocale) : undefined;
}

/**
 * A template's name as a human should read it.
 *
 * `tOr` needs no branch here, and that is the point. Our own templates have a
 * key and are translated like every other word we ship; a template an
 * administrator wrote has none and falls back to the text they typed. One call
 * covers both kinds, so nothing has to ask which sort it is looking at.
 *
 * The palette will still be mixed in an English editor — but the mixture now
 * means something. Translated is ours; untranslated is theirs.
 */
export function displayTemplateLabel(
  template: { type: string; label: string },
  uiLocale?: string
): string {
  return tOr(`nodeTemplate.${template.type}.label`, template.label, uiLocale);
}

/**
 * What a node of this type is called, in the editor's language.
 *
 * The same `tOr` shape as `displayTemplateLabel`, and for the same reason: the
 * key is the translation, the registry's own `label` is the fallback, and one
 * call covers a built-in type and one someone registered.
 *
 * It exists because the expression was written out four times and got the
 * locale in only two of them — so the palette said "Question" while the node on
 * the canvas beside it said "Fråga", in an editor set to English. A helper is
 * harder to half-apply than a line you retype.
 */
export function displayNodeTypeLabel(
  type: string,
  fallback: string | undefined,
  uiLocale?: string
): string {
  return tOr(`nodeType.${type}.label`, fallback ?? type, uiLocale);
}

/**
 * The templates built on a given base type.
 *
 * A node can only carry a template whose base type is the node's own. Labelling
 * a question node "E-postfråga" would be an untruth — it cannot have come from
 * there.
 */
export function templatesForBase(base: string): NodeTemplate[] {
  return library
    .filter((item) => item.base === base)
    .map((item) => structuredClone(item));
}

/** Whether a template ships with the tool and therefore cannot be removed. */
export function isBuiltinTemplate(type: string): boolean {
  return builtinTypes.has(type);
}

/** Changes a template's name/icon in the library. */
export function updateInLibrary(
  type: string,
  changes: { label: string; icon?: string }
): void {
  write(
    library.map((item) =>
      item.type === type
        ? { ...item, label: changes.label, icon: changes.icon }
        : item
    )
  );
}

/**
 * Merges templates in (e.g. from an imported guide) without overwriting.
 *
 * @param builtin Marks the templates as the library's own, so they survive a
 *   host setting its list.
 */
export function mergeIntoLibrary(
  specs: NodeTemplate[],
  { builtin = false }: { builtin?: boolean } = {}
): void {
  if (specs.length === 0) return;

  if (builtin) {
    specs.forEach((spec) => builtinTypes.add(spec.type));
  }

  const known = new Set(library.map((item) => item.type));
  const added = specs.filter((spec) => spec.type && !known.has(spec.type));

  if (added.length > 0) {
    write([...library, ...added]);
  }
}
