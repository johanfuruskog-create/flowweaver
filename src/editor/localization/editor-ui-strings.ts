import { addEditorStrings } from "../../viewer/localization/built-in-strings";
import { EDITOR_STRINGS } from "./editor-strings";

/**
 * The editor's lookup: the shared one in `core/ui-strings.ts`, with the
 * editor's own words in the table.
 *
 * Editor code imports `t` from **here**, not from `core/ui-strings`. The
 * import is what loads the words — a component tested on its own, or a host
 * that mounts `<guide-versions>` without `<guide-editor>`, gets "Stäng" and
 * not `editor.close`, without anyone remembering a side-effect import.
 *
 * The viewer never imports this module, which is what keeps the 500-odd
 * editor keys out of the viewer bundle (`entries.test.ts`). Viewer code that
 * asks for an editor key — the canvas view of `<guide-preview>` — runs inside
 * the editor, where this module has already loaded.
 */
addEditorStrings(EDITOR_STRINGS);

export { customizableUiStrings, interpolate, t, tOr } from "../../viewer/core/ui-strings";
