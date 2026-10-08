import type {
  ConnectionPolicy,
  FlowNodeData,
  PortValueType,
  VariableType,
} from "./graph";
import type { EditorCapability } from "./editor-capabilities";

/**
 * Declarative description of a node type's behaviour. When a node type carries
 * a `behavior` it is interpreted by a generic engine and preview instead of a
 * coded branch per type. Validation's *values* (min/max and so on) live on the
 * node's data; behavior only points out which data fields hold them.
 */
export type AnswerCardinality = "none" | "single" | "multi";

export interface DeclarativeValidation {
  /** Name of a boolean data field that makes the answer required. */
  requiredField?: string;
  /** Name of a number data field: fewest choices (multi) / minimum value. */
  minField?: string;
  /** Name of a number data field: most choices (multi) / maximum value. */
  maxField?: string;
  /** Name of a number data field: minimum text length. */
  minLengthField?: string;
  /** Name of a number data field: maximum text length. */
  maxLengthField?: string;
  /** Name of a data field holding the format (email/phone/personnummer/regex). */
  formatField?: string;
  /** Name of a data field holding the regex pattern (when format = regex). */
  patternField?: string;
}

export interface DeclarativeAnswer {
  /** Data field holding the variable name the answer is stored in. */
  variableField: string;
  cardinality: AnswerCardinality;
  /** For choices: the data field holding the option list. */
  optionsField?: string;
  /**
   * For answers without options: which kind of input.
   *
   * `lookup` is a text answer picked from a searched list instead of typed
   * freely. The value is still text, so everything reading the answer need not
   * know the difference — only the rendering does.
   */
  input?: "text" | "number" | "lookup" | "date" | "consent" | "file" | "map" | "rating";
  validation?: DeclarativeValidation;
}

export type DeclarativeFlow =
  | { kind: "linear" }
  | { kind: "branch"; optionsField: string }
  | { kind: "end" };

export interface NodeBehavior {
  answer: DeclarativeAnswer;
  flow: DeclarativeFlow;
}

export interface NodeTypeDefinition {
  label: string;
  /** Optional palette icon (glyph). Mainly for custom node types. */
  icon?: string;
  /** Declarative behaviour — interpreted generically by engine and preview. */
  behavior?: NodeBehavior;
  requiredCapability?: EditorCapability;
  /** Usable only as a child of a Page, never standalone on the canvas. */
  pageOnly?: boolean;
  /**
   * A step of its own in the flow (has an entrance and a way onward) and may
   * therefore sit standalone on the canvas and be the start node. Questions
   * always count as steps via variableType and do not need the flag.
   */
  isGuideStep?: boolean;
  /**
   * The guide ends here: the node has an entrance and no way onward, for
   * every node of the type regardless of its data. Declared rather than
   * derived from `getOutputs`, because outputs can depend on data — a
   * multi-choice with no options yet has none either, and is not an ending.
   * The editor paints endings green (Johan 9/9: "grönt symboliserar att det
   * är ett avslut"); a review node has a way onward and stays a step.
   */
  endsGuide?: boolean;
  /**
   * May sit as a field inside a Page. pageOnly types imply this.
   */
  canBeInPage?: boolean;
  variableType?: VariableType;
  createData(): Record<string, unknown>;
  hideInputsWhenStart?: boolean;
  properties: StoredNodeProperty[];
  inputs: InputPortDefinition[];
  getOutputs(node: FlowNodeData, locale?: string): OutputPortDefinition[];
}

/**
 * How a node type is written. `createData` is optional here and derived from
 * the fields' declared defaults — see `NodePropertyDefinition.defaultValue`.
 * Anyone who still supplies their own may (a graph's data is not always a
 * mirror of the field list), but none of the built-in types need it.
 */
export type NodeTypeRegistration = Omit<NodeTypeDefinition, "createData"> & {
  createData?: () => Record<string, unknown>;
};

export interface InputPortDefinition {
  id: string;
  label: string;
  accepts: PortValueType[];
  connectionPolicy: ConnectionPolicy;
}

export interface OutputPortDefinition {
  id: string;
  label: string;
  valueType: PortValueType;
  connectionPolicy: ConnectionPolicy;
}

/**
 * What the editor lets a user change — a ladder where each rung down **removes**
 * capability, never adds any.
 *
 * The more capability, the fewer people. The default is therefore `readonly`:
 * capability is **opt in**, the host asks for it rather than happening to get
 * it. A host that says nothing gets a guide to look at, and the panel states
 * plainly why it is locked.
 *
 * A mode is a **view**, not data: it is never stored in the guide but set by the
 * host, like `feature-level`. And it is not protection — it runs in a browser
 * and can be bypassed. Whether a guide is impossible to change is decided by the
 * host's permission system. The modes exist to make it *easy to do the right
 * thing*. See `docs/STORIES/004-lamna-over-till-oversattare.md`.
 */
export type EditorMode =
  /** Everything, including the shared node template library. A select few. */
  | "administrator"
  /** The guide. Uses the templates, does not manage them. Most editors. */
  | "edit"
  /** Only the translations in the chosen language. The source text is locked. */
  | "translator"
  /** Ingenting. Den som ska titta och tycka — och standard. */
  | "readonly";

const EDITOR_MODES = ["administrator", "edit", "translator", "readonly"] as const;

export function isEditorMode(value: unknown): value is EditorMode {
  return EDITOR_MODES.includes(value as EditorMode);
}

/**
 * May the guide's content be changed? The administrator is an editor plus the
 * shared library, so both rungs build on this.
 */
export function canEditGuide(mode: EditorMode): boolean {
  return mode === "edit" || mode === "administrator";
}

/** May the shared template library be managed? Only the top of the ladder. */
export function canManageTemplates(mode: EditorMode): boolean {
  return mode === "administrator";
}

export type PropertyControlType =
  | "text"
  | "textarea"
  | "template-text"
  | "template-textarea"
  | "formatted-textarea"
  | "number"
  | "checkbox"
  | "select"
  | "options"
  | "rule-cases"
  | "calculation-assignments"
  | "request-variables"
  | "response-mappings"
  | "annotations"
  | "node-select"
  | "variable-select"
  | "recipient-list"
  | "submission-row"
  | "map-start"
  /** A word per step of a rating scale — see `rating-scale-service.ts`. */
  | "rating-labels";

export interface NodePropertyDisplay {
  tag: NodeDisplayTag;
  className?: string;
}

export type FormattingFeature = "bold" | "italic" | "link" | "bullet-list" | "numbered-list" | "variable";

/**
 * A property is declared in two halves, and the halves live in different
 * bundles.
 *
 * The viewer needs to know that the field **exists** and what it is worth when
 * a node lacks the key — `NodeFieldDeclaration`. The editor additionally needs
 * to know how to **ask for it**: label, description, control, options, section,
 * gate — `NodePropertyForm`. The built-in types declare the first half in
 * `viewer/node-types/default-node-types.ts` and the second in
 * `editor/node-types/default-node-properties.ts`, joined by id through
 * `describeNodeProperties`. Before the split the forms travelled with every
 * visitor page: 42 kB of Swedish labels and help texts nobody there could see
 * (LOGG 8/9 2026).
 *
 * A host writing a custom type may still hand `registerNodeType` the full
 * `NodePropertyDefinition` — the registry accepts either shape, and the editor
 * reads only the entries that carry a `control`.
 */
export interface NodeFieldDeclaration {
  id: string;
  formatting?: FormattingFeature[];
  /**
   * What the field is worth when nobody said otherwise: both the starting value
   * in a new node and the answer when an older node lacks the key. One field,
   * one place.
   *
   * Omitted, no key is created at all and the reader gets `undefined` — "no
   * limit" should stay an absence rather than an invented value. Keep that apart
   * from `defaultValue: null`, which is a stated empty value.
   */
  defaultValue?: unknown;
  /**
   * A starting value that must be computed, e.g. options with their own ids.
   * Takes precedence over `defaultValue` and applies to **new nodes only**: an
   * old node lacking the key gets no invented id on read.
   */
  createDefault?: () => unknown;
}

/** The editor's half of a property: how the panel asks for the field. */
export interface NodePropertyForm {
  requiredCapability?: EditorCapability;
  /** A presentation field that can be translated (stored as LocalizedText). */
  localized?: boolean;
  label: string;
  description?: string;
  control: PropertyControlType;
  /**
   * Which group in the panel this belongs to. Ungrouped properties come first.
   *
   * `validation` gathers the rules about the answer — required, lengths,
   * bounds, format. They were spread down the panel in declaration order, each
   * a box to fill in with nothing saying they belonged together.
   *
   * `advanced` is the fold at the bottom: the fields an editor sets once or
   * never — the variable name, its label, the CSS classes. They stood between
   * the title and the description, so the three boxes a redaktör fills every
   * time were separated by three they rarely touch (uppdrag 23/9 2026, punkt 4).
   */
  section?: "validation" | "advanced";
  /**
   * Which of the node's own groups an ungrouped field stands in, by name.
   *
   * The panel draws a node's fields in groups, 24 px apart where the fields
   * inside each are 12 (Astra 1/10 2026, docs/GRAFISK-PROFIL.md *Panelens
   * grupper*). A new group starts where this name changes from one field to
   * the next, in declaration order; a field without it stands in `content`,
   * which is what a question's first group is — the title, the description,
   * the why. So a text question names its field's shape `field` (*Platshållare*,
   * *Visas som*, *Vad fältet är*), a choice question its answers `answers`, a
   * page its repetition `repeat`; a rule its cases, a service call its request
   * and its response — 24 where the task changes character (Astra 1/10,
   * bilaga 12), not one column at 12 for everything after the title.
   *
   * One name, not a list of groups somewhere else: the field says where it
   * belongs, as `section` does. The name is also the group's
   * `data-panel-group` in the panel.
   */
  group?: string;
  /**
   * Vilka variabler en `variable-select` får erbjuda.
   *
   * `{ format: "email" }` betyder frågor vars format är e-post. Filtret står i
   * NODTYPEN, inte i panelen, så en värds egen nodtyp kan använda det — och så
   * att panelen slipper en lista av specialfall som ingen hittar.
   *
   * Utan filter listade fältet varenda variabel i guiden: mejlkopian gick att
   * peka på "Beskriv felet", och felet syntes först när en besökare inte fick
   * sitt kvitto (story 054).
   */
  variableFilter?: { format: string };
  /**
   * The choices a `select` offers.
   *
   * A function when the choices are not known when the type is declared. Code
   * lists are the case: nothing is registered by default — a host adds the ones
   * they use — so a fixed list here would offer lists that are not there, and
   * the field would find nothing while looking correctly configured. That is the
   * fault the palette had in 0.7.3, offering templates it could not build.
   *
   * The node's own data is handed to the function, for the choices that depend
   * on another field: the submission node's *Ärendetyp* offers the entries of
   * the code list chosen beside it (story 123), and which list that is only
   * this node knows. The argument is optional to take, so every function
   * written before it keeps working unchanged — `showWhen` already reads the
   * node's data for the same kind of reason.
   */
  options?:
    | Array<{ label: string; value: string; disabled?: boolean }>
    | ((
        data: FlowNodeData["data"],
      ) => Array<{ label: string; value: string; disabled?: boolean }>);
  display?: NodePropertyDisplay;
  /**
   * Draw this field only while another field on the same node holds `equals`.
   *
   * A repeating page (story 084) has five settings that mean nothing until
   * *Kan upprepas* is on; shown all the time they are five boxes asking to be
   * filled in for a page that does not repeat. The panel reads the gate from
   * the node's data, so an old guide without the key shows the plain page.
   */
  /**
   * Draw this field only while the node sits on a page that repeats.
   *
   * *Varje upprepning ska välja olika* (story 138) means nothing anywhere
   * else. Unlike `showWhen` it reads the node's PARENT, which only the panel
   * holding the guide's nodes can see.
   */
  repeatingPageOnly?: boolean;
  showWhen?: {
    property: string;
    /** Shown while that field holds exactly this. */
    equals?: unknown;
    /**
     * …or while this says so, for a gate no single value can express.
     *
     * *Vad fältet är* (story 110) is hidden for every format that already
     * carries an `autocomplete` word — and which formats those are is the
     * registry's answer, not a list that can be written down here without
     * going stale the day a host adds one.
     */
    holds?: (value: unknown) => boolean;
  };
}

/** Both halves: what the editor works with, and what a host may register. */
export type NodePropertyDefinition = NodeFieldDeclaration & NodePropertyForm;

/**
 * What the registry stores per type: every field is declared, and a field has
 * a form when it was registered with one (a host's type) or described afterwards
 * (the built-in types).
 */
export type StoredNodeProperty = NodeFieldDeclaration & Partial<NodePropertyForm>;

export type NodeDisplayTag =
  | "h1"
  | "h2"
  | "h3"
  | "p"
  | "span"
  | "strong";
