/**
 * What an editor may be allowed to do, as names.
 *
 * The *types* live with the viewer because a node type's declaration
 * (`requiredCapability` in `node-types.ts`) names the capability that unlocks
 * it, and the declarations are the viewer's model of a node. What each feature
 * level actually enables — the table and `getEditorCapabilities` — is the
 * editor's business and stays in `editor/config/editor-capabilities.ts`. The
 * viewer bundle therefore carries sixteen names and no policy.
 */
export type EditorFeatureLevel = "basic" | "advanced" | "service";

export interface EditorCapabilities {
  /** Rule nodes (rule sets). Allowed in basic too — naturally limited to the
   * field types the level has (basic: single/multi choice). */
  rules: boolean;
  /** Rules with several conditions combined with AND/OR. Basic has simple rules
   * with one condition per branch; the structure is locked (but values remain
   * editable) for rules built in advanced mode. */
  advancedRules: boolean;
  /** Calculation nodes (formulas). More advanced — not in basic. */
  calculations: boolean;
  variables: boolean;
  /** Multi-choice question (checkbox) — a simple choice field, allowed in basic. */
  multiChoice: boolean;
  /** Fields the visitor fills in alone — text, number, date, consent. */
  inputQuestions: boolean;
  /** Fields that only work once the host has built something behind them:
   * lookup (docs/UPPSLAG-KONTRAKT.md), file (docs/FIL-KONTRAKT.md), map.
   * Split from inputQuestions in story 097, so a guide with a number field
   * does not open with a map in the palette. */
  hostServices: boolean;
  pages: boolean;
  numericConstraints: boolean;
  fieldValidation: boolean;
  routeAnalysis: boolean;
  importExport: boolean;
  emailResults: boolean;
  /** Service calls (backend integration) — an e-service feature, not in basic. */
  serviceCalls: boolean;
  /** Richer content nodes (code, annotated image) — only in more advanced modes. */
  richContent: boolean;
  /** Sending something in — the submission node. This is the product boundary
   * (docs/UPPDELNING-OPPET-OCH-PRIVAT.md): the open product helps a visitor
   * reach an answer, the full version lets the visitor send it in. Split out
   * of the service module 2026-10-06 (open-core step 2). */
  submission: boolean;
}

export type EditorCapability = keyof EditorCapabilities;
