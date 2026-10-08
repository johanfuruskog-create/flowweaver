import { VIEWER_STRINGS } from "./viewer-strings";

import type { LocalizedTextMap } from "../core/localized-text";

/**
 * The built-in strings, as the lookup in `ui-strings.ts` sees them: one table
 * with two audiences behind it.
 *
 * The **viewer's** words ship with every bundle — a visitor meets them. The
 * **editor's** arrive when the editor loads: `editor-ui-strings.ts` adds them
 * here, and nothing in the viewer's import graph reaches that module. That is
 * the difference between the two bundles' size (a fifth of the viewer, 8/9),
 * and `entries.test.ts` keeps it that way.
 *
 * Which audience a key belongs to decides two things a guide can observe:
 *
 * - whether `settings.strings` may override it (viewer only), and
 * - whether translating the guide's content into a language creates any demand
 *   for that language at all (viewer only).
 *
 * See `viewer-strings.ts` and `editor-strings.ts`, and story 017.
 */

/** The editor's table — empty until the editor has loaded. */
const editorTable: Record<string, LocalizedTextMap> = {};

/**
 * Adds the editor's words. Called once, by `editor-ui-strings.ts`, at load —
 * never by a host, and never with viewer keys: the viewer's table wins on a
 * clash, so a duplicate could not rename "Nästa" from here even by accident.
 */
export function addEditorStrings(table: Record<string, LocalizedTextMap>): void {
  Object.assign(editorTable, table);
}

/** The built-in entry for a key, from either audience. */
export function builtInString(key: string): LocalizedTextMap | undefined {
  return VIEWER_STRINGS[key] ?? editorTable[key];
}

/** Every built-in entry currently loaded — the viewer's, plus the editor's when it is. */
export function builtInStrings(): Readonly<Record<string, LocalizedTextMap>> {
  return { ...editorTable, ...VIEWER_STRINGS };
}

/**
 * The editor's table as loaded. Empty in a viewer-only page, which is the
 * truthful coverage report there: no editor, nothing an editor would read.
 */
export function editorStrings(): Readonly<Record<string, LocalizedTextMap>> {
  return editorTable;
}

/** True when a guide may override the key — that is, a resident can read it. */
export function isViewerString(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(VIEWER_STRINGS, key);
}

export { VIEWER_STRINGS };
