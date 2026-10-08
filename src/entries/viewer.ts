// Standalone distribution entry for the VIEWER.
//
// Registers `<guide-preview>` — the pure runtime component that runs a finished
// guide for the end user. Deliberately imports ONLY the component, so neither
// the editor's nor the example page's code travels with the bundle (guarded by
// entries.test.ts). The theme variables ship with the bundle — they are scoped
// to our own tags and therefore cannot recolour the host's page.
//
// The node types are registered here: without them the consumer has an empty
// registry and the guide renders nothing. The example pages import them via
// their own app shells, so the gap shows only in the standalone bundle (guarded
// below).
import { applyTokens } from "../viewer/styles/apply-tokens";

import "../viewer/node-types/default-node-types";
import "../viewer/components/guide-preview/guide-preview";

applyTokens();

export { GuidePreview } from "../viewer/components/guide-preview/guide-preview";

/*
 * Att läsa ett svar.
 *
 * Ett svar kan vara ett värde, flera, eller flera som har delar — se
 * `AnswerValue`. En värd som skriver ut svar ska fråga i stället för att anta:
 * `String(svaret)` på den sista formen ger "[object Object]", och det var
 * precis vad referensmottagarens brev skrev innan de här fanns.
 *
 * `answerText` när något ska visas, `answerList` när något ska jämföras,
 * `answerField` när en del ska plockas ut ur varje objekt (t.ex. koderna).
 */
export {
  answerText,
  answerList,
  answerField,
  isAnswerEmpty,
} from "../viewer/core/answer-values";
export type { AnswerValue, AnswerFields, Answers } from "../viewer/core/answer-values";

/*
 * Vad guiden lämnar — schemat (story 094). En mottagare bygger mot det innan
 * första ärendet kommit; editorn stämplar samma sak i `meta.submissionSchema`
 * vid export. Se docs/INLAMNING-KONTRAKT.md, avsnittet *Schemat*.
 */
export type { SubmissionSchema, SubmissionSchemaProperty } from "../viewer/types/submission-schema";
export type * from "../viewer/types/graph";

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

// A finished colour scale — story 140. The primary family is nine tokens per
// theme, and a host that sets only `--fw-primary` recolours part of it; the
// chips, tinted buttons, hover and focus ring stay indigo. One call sets all
// of it: `applyPalette(palettes.hav)`, and `applyPalette(null)` puts the
// default back. A host with its own colours sets the nine itself — the list is
// in the README, *Tokens och tema*.
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
