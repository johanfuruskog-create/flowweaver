import type { LocalizedText } from "../core/localized-text";
import type { SubmissionSchema } from "./submission-schema";

export type PortDirection = "input" | "output";

export type ConnectionPolicy = "none" | "single" | "multiple";

export type PortValueType = "flow" | "string" | "number" | "boolean";

interface BasePort {
  id: string;
  label: string;
  connectionPolicy: ConnectionPolicy;
}

export interface OutputPort extends BasePort {
  direction: "output";
  valueType: PortValueType;
}

export interface InputPort extends BasePort {
  direction: "input";
  accepts: PortValueType[];
}

export type NodePort = InputPort | OutputPort;

export interface FlowNodeData {
  id: string;
  type: string;
  position: {
    x: number;
    y: number;
  };
  data: Record<string, unknown>;
  /**
   * Which node template the node was created from. Pure **provenance**, not
   * identity: the node is already a fully valid node of its `type`, and works
   * unchanged if the template is deleted. It then simply carries the base
   * type's name instead of the template's.
   *
   * The template's key used to be the node's `type`, so deleting a template
   * made every node using it unknown. The tag stays even when the template is
   * gone — it is authored (K6b), and the template may come back.
   */
  template?: string;
  /** Page membership. Child positions are local to the Page. */
  parentPageId?: string;
  order?: number;
  /** Optional 12-column layout metadata for the rendered Page. */
  layout?: {
    columnSpan?: number;
    breakBefore?: boolean;
  };
  visibility?: ConditionalVisibility;
}

/**
 * *Visas bara om …* — the same shape wherever something is conditional.
 *
 * A field on a page carries it (story 077) and so does a single option in a
 * question (story 134). It was written inline on the node until the option
 * needed it; naming it is what lets `PageVisibilityService.isVisible` judge
 * either one with a single evaluation instead of two that drift.
 */
export interface ConditionalVisibility {
  match: "all" | "any";
  conditions: RuleCondition[];
}

export interface PortEndpoint {
  nodeId: string;
  portId: string;
}

/**
 * Colour keys for connections. Keys, not hex values, so the colour can follow
 * the theme: every hue already has a light and a dark value among the node
 * tokens. A guide coloured in light mode is therefore readable in dark.
 *
 * The names are the node families, so a user recognises them: a connection
 * coloured `rule` carries the rule node's purple.
 */
export type ConnectionColor =
  | "content"
  | "rule"
  | "calc"
  | "service"
  | "end"
  | "danger";

export interface Connection {
  id: string;
  from: PortEndpoint;
  to: PortEndpoint;
  /**
   * Optional colour on the line, to keep paths apart in large guides. Omitted
   * means the default colour. Purely visual — traversal does not care, and
   * older builds unaware of the field ignore it.
   */
  color?: ConnectionColor;
}

/**
 * A node template: a base type plus the values the editor saved.
 *
 * The shape — the fields, the behaviour, the ports — is owned by the base type
 * and inherited every time the template is used. The template carries only a
 * name, an icon and values. See `src/node-types/node-templates.ts`.
 */
export interface NodeTemplate {
  /** Unique key (used as node.type), e.g. "mall-1a2b". */
  type: string;
  label: string;
  /** Optional palette icon (glyph). Omitted inherits the base type's. */
  icon?: string;
  /** The base type's key, e.g. "question". */
  base: string;
  /** Values that set the template apart from a fresh node of the base type. */
  values: Record<string, unknown>;
  /**
   * The page's fields, in order, when the base is a page (story 088). A recipe,
   * not nodes: no ids, no positions — those are minted when the page is dragged
   * in. The variable names are part of the recipe.
   */
  children?: NodeTemplateChild[];
}

/** One field of a page template: what a page's child would be made from. */
export interface NodeTemplateChild {
  type: string;
  data: Record<string, unknown>;
}

/** Guide-global settings. Additive and optional (backwards compatible). */
export interface GuideSettings {
  /** Overrides fixed viewer texts (buttons etc.) per key; otherwise the t() default. */
  strings?: Record<string, LocalizedText>;
  /**
   * The language the guide is **written in** (BCP 47).
   *
   * Omitted means Swedish — the language all content that existed before the
   * field did is actually written in. No migration is needed as a result: an
   * old file reads exactly as before.
   *
   * Distinct from `locales`, which is what the guide additionally *exists* in.
   * The source is the only one that always has content.
   */
  sourceLocale?: string;
  /** Languages the guide is offered in (BCP 47). The source is implicitly first. */
  locales?: string[];
  /**
   * Node templates the guide uses, carried along so it is self-sufficient even
   * where the library lacks them. This was `customNodeTypes` and then held a
   * frozen copy of the base type's shape; migration v4→v5 turns them into a
   * base type plus values.
   */
  nodeTemplates?: NodeTemplate[];
  /**
   * Show how far the visitor has come, **instead of** the step mark (story 116).
   *
   * Not beside it: *STEG 2* and *40 %* are two answers to the same question,
   * and two answers in the same row is the second mechanism `docs/PRAXIS.md`
   * regel 15 warns about. Johan, on the first sketch that drew both: *"Kan de
   * inte vara samma?"*
   *
   * Chosen per guide by the editor, not by the host and not always on: a guide
   * of three steps gets a meter that is mostly talk, while twenty-five
   * questions without one look like a chasm. Additive and optional — absent
   * means the step mark, which is what every guide written before the field
   * existed has, so an older file reads exactly as before and there is no
   * migration (K7).
   *
   * A result page is the exception: *Resultat* stands in the same slot either
   * way. It says what the page **is**, not how far there is left, so it
   * competes with nothing.
   */
  progress?: boolean;
  /**
   * Setting keys the library does not recognise, preserved untouched. Same
   * reasoning as `GraphData.extra`.
   */
  extra?: Record<string, unknown>;
}

/**
 * Facts *about* the guide, as opposed to `GuideSettings` which governs how it
 * behaves. Keep apart what is **authored** and what is **observed** — see K6c in
 * `docs/KRAV.md`. Who created or changed the guide is never stored here; that is
 * owned by the system the guide lives in.
 */
export interface GuideMeta {
  /**
   * The guide's own identity — a UUID, minted once by the editor at the first
   * save or export and never changed afterwards (story 123).
   *
   * It is what an errand carries as `serviceId`, so a receiver can tell two
   * guides apart that both produce a *Felanmälan*. The name cannot do that: it
   * is translated, it is edited, and two units may well choose the same words.
   *
   * A fact about the guide and not about anybody who touched it (K6c). Absent
   * on a guide that has never been saved, and on a template — a template is not
   * a service, so a guide built from one mints its own.
   */
  id?: string;
  /** What the guide is called. Translatable. */
  name?: LocalizedText;
  /** What it answers and for whom. Translatable. */
  description?: LocalizedText;
  /**
   * Who is responsible for the guide's content — a person, a unit or a shared
   * mailbox. Authored by the editor and not translated.
   *
   * Distinct from who last changed it: the page's owner and whoever answers for
   * what the guide *says* are often different roles.
   */
  owner?: string;
  /**
   * Which frozen version this graph *is*, when a host keeps versions (story
   * 124).
   *
   * Written by the storage when a version is frozen, and never by the editor:
   * a working copy is not a version and has none. An errand carries it as
   * `serviceVersion` in preference to the stamp below — "version v-3f2a" is
   * something a host can look up, where a timestamp is only something to
   * compare.
   *
   * A fact about the guide and not about anybody who touched it (K6c).
   */
  versionId?: string;
  /**
   * When the guide was last changed, ISO 8601.
   *
   * Set where a guide leaves the editor to become something lasting: an
   * exported file, or a frozen version. **Never on the working copy** — a stamp
   * that changes itself makes every comparison between two versions falsely
   * positive, and the working copy is compared against the published one on
   * every keystroke.
   *
   * The comment said "on save and export" until 18/9, which read as *every
   * save*. Measured then: nothing stamps a draft, both version stores stamp a
   * freeze (the server adapter started that day), and `exportGraphJson` stamps
   * a file.
   *
   * Good enough for "roughly how old", not as evidence of what happened first:
   * the clock is the user's.
   */
  updatedAt?: string;
  /**
   * The shape of what the guide submits (story 094), stamped by the editor
   * on export so the receiver's copy is always the copy of *this* guide.
   * Built by `SubmissionSchemaService`; the health check compares it with a
   * fresh one and says when the guide has moved on.
   */
  submissionSchema?: SubmissionSchema;
}

export interface GraphData {
  startNodeId: string | null;
  nodes: FlowNodeData[];
  connections: Connection[];
  settings?: GuideSettings;
  /** Facts about the guide. Optional — older guides lack it. */
  meta?: GuideMeta;
  /**
   * Root keys the library does not recognise, preserved untouched.
   *
   * Import used to read only what it knew and drop the rest silently. A host
   * platform that put something in the guide had it erased the first time the
   * editor opened and saved — without notice. See K6b in `docs/KRAV.md`.
   *
   * The field is written back as root keys on export, so a file that goes in
   * comes out the same. The library never reads the contents.
   */
  extra?: Record<string, unknown>;
}

export interface EmailResultOutput {
  type: "email";
  format: "markdown";
  nodeId: string;
  /**
   * Recipient id out of the host's catalog — the host resolves id→address in
   * its backend (docs/INLAMNING-KONTRAKT.md). When absent, `to` carries the
   * address form: the visitor's own address, or a pre-v7 legacy free text.
   */
  recipientId?: string;
  template: { to: string; subject: string; body: string };
  resolved: { to: string; subject: string; body: string };
  missingVariables: string[];
}

export interface QuestionOption {
  /**
   * Stable identity for the output port.
   * Must be unique within the question node.
   */
  id: string;

  /**
   * The text the user sees. A presentation field → translatable.
   */
  label: LocalizedText;

  /**
   * The value stored in the question's variable. Identity → never translated.
   */
  value: string;

  /**
   * Stands alone: it cannot be held together with any other choice.
   *
   * *Stateless* beside a country is a contradiction, not an unusual answer,
   * and *Inget av ovanstående* is the same shape. Optional, and absent means
   * what every option meant before it existed — which is why no guide had to
   * be migrated. Story 062.
   */
  exclusive?: boolean;

  /**
   * *Visas bara om …*, one level below the field's (story 134).
   *
   * The nut curry is not offered to somebody who answered *Nötter* on the
   * allergy question. The condition hides what is dangerous; it never steers
   * a preference — *Vegetariskt* carries none and is offered to everyone,
   * because wanting it is a choice the visitor makes rather than a fact about
   * them the guide already knows.
   *
   * Optional, and absent means what every option meant before it existed, so
   * no guide had to be migrated.
   */
  visibility?: ConditionalVisibility;
}

export type VariableType = "choice" | "number" | "text";

export interface RuleCondition {
  id: string;
  variableName: string;
  operator:
    | "equals"
    | "not-equals"
    | "greater-than"
    | "greater-than-or-equal"
    | "less-than"
    | "less-than-or-equal"
    /*
     * `one-of` and `not-one-of` read `value` as a comma-separated list.
     *
     * Nobody branches per country; they branch on membership — EU, the Nordics,
     * outside. That was expressible as twenty-seven `equals` conditions under
     * `match: "any"`, and nobody would author it by hand.
     *
     * A comma can never be part of a code in the lists we ship (`SE`, `1880`,
     * `XS`), so the separator needs no escaping and a person can write what they
     * would say.
     */
    | "one-of"
    | "not-one-of"
    /*
     * `all-of` and `not-all-of` ask the other two questions a set has.
     *
     * `one-of` is *does any of your answers appear in this list*, which is the
     * right question for *do you hold EU citizenship* and the wrong one for
     * *are you Nordic*: somebody with a Danish and a Turkish passport is not.
     * So `all-of` is every answer in the list, and `not-all-of` at least one
     * outside it.
     *
     * An empty answer is false for both. Nothing is not "all", and the wider
     * of the two branches must not be reached by somebody who has not
     * answered — the same reasoning the evaluator gives for empty entries.
     *
     * On a single answer they are `one-of` and `not-one-of` exactly (except
     * for that empty case), which is why the editor does not offer them on a
     * single-valued variable. The engine still evaluates them there: valid,
     * just pointless.
     */
    | "all-of"
    | "not-all-of";
  value: string;
}

export interface RuleCase {
  id: string;
  label: string;
  match: "all" | "any";
  conditions: RuleCondition[];
}

/** A row in a calculation node: set `variableName` to the result of `formula`. */
export interface CalculationAssignment {
  id: string;
  variableName: string;
  formula: string;
  /** What the row's variable is called in prose — the alias a question has (story 078), translatable like it (080). Optional; the name stands in when it is empty. */
  label?: LocalizedText;
}

/** A row in a service node: read `field` from the response into `variableName`. */
export interface ServiceResponseMapping {
  id: string;
  field: string;
  variableName: string;
  /** What the variable is called in prose — as a calculation row's label (story 079), translatable like it (080). Optional; the name stands in when it is empty. */
  label?: LocalizedText;
}
