// Standalone distribution entry for the EDITOR.
//
// Registers `<guide-editor>`, which in turn pulls in the viewer (for the
// built-in preview) and every editor subcomponent, plus `<guide-versions>` for
// hosts that keep more than one version of a guide and `<prompt-dialog>` for
// answering it.
//
// The prompt is here because the version list asks questions a host has to
// answer with a word — what shall the copy be called, what is this version —
// and the only alternative we could offer was `window.prompt`. Shipping a list
// that raises `version-rename-intent` while leaving the host nothing better
// than a browser box to answer it with is half a contract. The confirmation
// dialog already travelled, quietly, because `<guide-editor>` imports it. Deliberately imports ONLY
// those components, so the example page's code never travels with the bundle
// (guarded by entries.test.ts). The theme variables ship with the bundle
// — they are scoped to our own tags and therefore cannot recolour the host's
// page.
//
// The node types are registered here for the same reason as in viewer.ts:
// without them the consumer has an empty registry and neither the palette nor
// the canvas works.
import { applyTokens } from "../viewer/styles/apply-tokens";

import "../viewer/node-types/default-node-types";
import "../editor/components/guide-editor/guide-editor";
import "../editor/components/guide-versions/guide-versions";
import "../editor/components/prompt-dialog/prompt-dialog";

applyTokens();

export { GuideEditor } from "../editor/components/guide-editor/guide-editor";
export type * from "../viewer/types/graph";
export type { ThemeChoice } from "../viewer/core/theme";

/*
 * `<guide-versions>` — the versions of a guide, for a host that keeps them.
 *
 * It waited here deliberately: public surface binds us the moment it exists,
 * and this shape changed three times in one evening. What ended the wait is a
 * second host. The control moved into `src/components/` because the storage is
 * Sitevision's and the list is ours — and a list only we can reach is a list
 * every host writes again, which is the shape of nearly every fault this
 * project has had.
 *
 * The element decides nothing. It renders rows and raises `version-*-intent`;
 * reading, writing, naming and removing stay with whoever owns the storage.
 */
export { GuideVersions } from "../editor/components/guide-versions/guide-versions";
export { PromptDialog } from "../editor/components/prompt-dialog/prompt-dialog";
export type { PromptOptions } from "../editor/components/prompt-dialog/prompt-dialog";
export type {
  GuideVersion,
  VersionOrder,
} from "../editor/components/guide-versions/guide-versions";

// Locale packs the host registers at startup — story 010. Without them the
// viewer's own texts ("Nästa", "Ange ett tal") are Swedish or English only, and
// a fully translated Arabic guide still shows Swedish buttons. `localeStrings`
// hands back the package's own texts as a template to translate from.
export {
  registerLocale,
  unregisterLocale,
  localeStrings,
  builtInLocales,
  availableLocales,
  coverageOf,
  declareLocales,
  clearDeclaredLocales,
  declaredLocales,
  declaredDefaultLocale,
} from "../viewer/localization/registry";
export type {
  AudienceCoverage,
  LocaleCoverage,
  LocaleDeclaration,
  LocaleStrings,
} from "../viewer/localization/registry";

// One call for the whole wiring — story 015. Every integration wrote the same
// page of attribute-setting by hand and got it subtly differently; this is that
// page, once, with the ordering that matters and nothing that does not.
// Code lists a host registers — countries, municipalities, whatever a field
// picks from. Nothing is bundled: the lists ship as JSON beside these files and
// a host registers the ones they use, because a bundle that grows with every
// list anybody might want is a bundle nobody can defend. `registerCodeList`
// refuses a malformed one by name rather than quietly offering no suggestions.
export {
  registerCodeList,
  unregisterCodeList,
  getCodeList,
  getCodeLists,
  codeListFault,
} from "../viewer/code-lists/code-list-registry";
export type {
  CodeList,
  CodeListItem,
  CodeStandard,
} from "../viewer/code-lists/code-list-registry";

// The map is the host's — Flowweaver draws no map, fetches no tiles, and
// knows nothing of projections. A host registers a provider and the map
// question asks it; see docs/KART-KONTRAKT.md, written to be handed to a
// municipality's own developer or supplier. (Story 046.)
export {
  registerMapProvider,
  unregisterMapProvider,
} from "../viewer/core/map-provider-registry";
export type { MapProvider, MapPickResult, MapKind } from "../viewer/core/map-provider-registry";


// The submission receiver and its types are FlowWeaver PRO's: see
// entries/pro-viewer.ts and pro-editor.ts (open-core step 4, 2026-10-06).

// The link picker — story 100. The editor's link button asks the host's
// picker when one is registered, so an editor chooses a page the way they do
// everywhere else in their system instead of copying its address. A picker
// with `resolve` also keeps the addresses fresh: asked about every link's
// reference when a guide is opened. Nothing registered: the button writes
// `[text](https://)` as before.
export {
  registerLinkPicker,
  unregisterLinkPicker,
} from "../editor/core/link-picker-registry";
export type { LinkPicker, LinkPickContext, LinkPickResult } from "../editor/core/link-picker-registry";

// A finished colour scale — story 140; the why is beside the same export in viewer.ts.
export { applyPalette, palettes } from "../viewer/styles/palettes";
export type { Palette } from "../viewer/styles/palettes";

export { init } from "./init";
export type { HostSetup, LanguagePack, LanguageSetup, Wiring } from "./init";

// The setup check — story 016. Every setup fault this project has had was
// silent, because a locked editor and a forgotten attribute look the same. This
// is the host's way to ask.
export { checkSetup } from "./setup-check";
export type {
  CheckableElement,
  SetupFinding,
  SetupReport,
  SetupSeverity,
} from "./setup-check";
