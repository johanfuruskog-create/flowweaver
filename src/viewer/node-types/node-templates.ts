import { getNodeType } from "./node-type-registry";

import type { FlowNodeData, NodeTemplate, NodeTemplateChild } from "../types/graph";
import type { NodeBehavior } from "../types/node-types";
import type { EditorCapability } from "../types/editor-capabilities";

/**
 * Node templates: a base type plus saved values.
 *
 * "Ja/Nej-fråga" is not a new kind of node. It is a question node where someone
 * typed in their options and gave it a name. The template owns the **values**;
 * the shape — the fields, the behaviour, the ports, the rendering — is owned by
 * the base type and inherited live.
 *
 * The template used to freeze a copy of the base type's entire contract at the
 * moment it was saved. Fix something in the question node and every saved
 * "Ja/Nej-fråga" kept the old copy, carrying a contract it did not own. Now it
 * only points at its base type, so improvements reach it without anyone touching
 * the template.
 *
 * There are therefore two things and no third: **node types**, which we own, and
 * **templates**, whose values the customer owns. See
 * `docs/STORIES/007-ett-falt-ett-stalle.md`.
 *
 * ## The template is provenance, not identity
 *
 * A template is never registered as a node type. It is needed only at the moment
 * the node is created: the node becomes a node of the base type and carries the
 * template's key in `template`.
 *
 * The template's key used to be the node's `type`, which made the link
 * load-bearing — if a colleague removed a shared template, every node using it
 * became unknown, in every guide. The link may now break, because nothing hangs
 * from it. The only thing that degrades is the name, and it degrades to the
 * truth: the node carries the base type's name.
 */

/** Grundtyper man får skapa en ny mall från i Nodmallar-dialogen. */
export const NODE_TEMPLATE_BASES = [
  "question",
  "multi-choice",
  "text-question",
  "number-question",
] as const;

/**
 * The base types an existing node may be saved as a template from.
 *
 * The line is **whose the values are**, not whether the node counts as logic.
 *
 * A rule and a calculation hold this guide's own reasoning: the cases and the
 * formula are written against the variables of the flow they sit in, so
 * carrying them into another guide carries something that was never true there.
 *
 * A service call is the opposite. The endpoint, the values it sends and the
 * fields it reads back describe the organisation's integration, and it is the
 * same call in every guide that needs it — which is exactly what a template is
 * for. Reconfiguring it by hand per guide is how one of them ends up pointing
 * at last year's address.
 *
 * Note it is not in `NODE_TEMPLATE_BASES`: a blank service call created from
 * the template dialog would be a template of nothing. You save one you have
 * configured and seen work.
 *
 * A page is the same case with more inside it (story 088): the template is
 * the page *with its fields*, and a blank page template would be a page of
 * nothing.
 */
const CAPTURABLE_BASES = new Set<string>([
  ...NODE_TEMPLATE_BASES,
  "result",
  "service-call",
  "page",
]);

/** En stabil, kort nyckel för en ny mall. */
export function createNodeTemplateKey(): string {
  return `mall-${crypto.randomUUID().slice(0, 8)}`;
}

/** Funktionsgrinden mallen ärver — grundtypens. */
export function templateCapability(
  template: NodeTemplate
): EditorCapability | undefined {
  return getNodeType(template.base)?.requiredCapability;
}

/** The base types with their feature gate, so they can be filtered per level. */
export function getNodeTemplateBases(): Array<{
  id: string;
  requiredCapability?: EditorCapability;
}> {
  return NODE_TEMPLATE_BASES.map((id) => ({
    id,
    requiredCapability: getNodeType(id)?.requiredCapability,
  }));
}

/**
 * A new node from the template: the base type's starting data with the
 * template's values on top.
 *
 * The template is never registered as a node type. The node becomes a node of
 * the **base type** and carries the template's key as provenance, so it works
 * unchanged the day the template is removed. The registry therefore contains
 * only what we own ourselves (K12b).
 *
 * Returns null if the base type does not exist — there is then no node to
 * create.
 */
export function nodeFromTemplate(
  template: NodeTemplate
): { type: string; data: Record<string, unknown>; template: string } | null {
  const base = getNodeType(template.base);
  if (!base) {
    return null;
  }

  return {
    type: template.base,
    data: { ...base.createData(), ...structuredClone(template.values) },
    template: template.type,
  };
}

/** Can a node of this type be saved as a template? */
export function canBeTemplateBase(type: string): boolean {
  return CAPTURABLE_BASES.has(type);
}

/** A new, empty template from a base type. Name and icon are filled in by the editor. */
export function newNodeTemplate(base: string): NodeTemplate | null {
  if (!getNodeType(base)) {
    return null;
  }

  // No values: a node from this template is so far exactly a new node of the
  // base type, with a different name in the palette.
  return { type: createNodeTemplateKey(), label: "", base, values: {} };
}

/**
 * Captures a configured node as a template. Returns null if the node type
 * cannot become a template. The name is filled in by the editor. A page is
 * captured with its fields, in the page's order.
 */
export function nodeToTemplate(
  node: FlowNodeData,
  children: FlowNodeData[] = []
): NodeTemplate | null {
  if (!canBeTemplateBase(node.type)) {
    return null;
  }

  return {
    type: createNodeTemplateKey(),
    label: "",
    base: node.type,
    values: structuredClone(node.data),
    ...capturedChildren(node, children),
  };
}

/** The fields of a page as a template carries them; nothing for other nodes. */
function capturedChildren(
  node: FlowNodeData,
  children: FlowNodeData[]
): Pick<NodeTemplate, "children"> {
  if (node.type !== "page") {
    return {};
  }

  return {
    children: [...children]
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
      .map((child) => ({ type: child.type, data: structuredClone(child.data) })),
  };
}

/**
 * The fields a page template puts inside a freshly created page: each one a
 * node of its own type with the template's data on top, in the template's
 * order. A field whose type does not exist here is left out — the page still
 * comes in, with what could be made.
 */
export function childrenFromTemplate(
  template: NodeTemplate,
  pageId: string,
  createId: () => string = () => crypto.randomUUID()
): FlowNodeData[] {
  return (template.children ?? []).flatMap((child, index) => {
    const base = getNodeType(child.type);
    if (!base) {
      return [];
    }

    return [
      {
        id: createId(),
        type: child.type,
        position: { x: 0, y: 0 },
        parentPageId: pageId,
        order: index,
        data: { ...base.createData(), ...structuredClone(child.data) },
      },
    ];
  });
}

/**
 * Reconstructs a vanished template's values from the nodes that came from it.
 *
 * What the nodes have **in common** is by definition what came from the template
 * — or what nobody bothered to change. What sets them apart is authored per
 * node: the title, the variable name. Taking a single node's data as it stands
 * would have made that one node's title the template's, and then served it to
 * every new node.
 *
 * With only one node the two cannot be told apart. Its values then become the
 * template's, and the editor is told so before saving.
 */
export function templateValuesFromNodes(
  nodes: FlowNodeData[]
): Record<string, unknown> {
  const [första, ...övriga] = nodes;

  if (!första) {
    return {};
  }

  const gemensamma: Record<string, unknown> = {};

  for (const [nyckel, värde] of Object.entries(första.data)) {
    const lika = övriga.every(
      (node) => JSON.stringify(node.data[nyckel]) === JSON.stringify(värde)
    );

    if (lika) {
      gemensamma[nyckel] = structuredClone(värde);
    }
  }

  return gemensamma;
}

/** Re-saves a template from a configured node. Key, name and icon remain. */
export function withNodeValues(
  template: NodeTemplate,
  node: FlowNodeData,
  children: FlowNodeData[] = []
): NodeTemplate {
  return {
    ...template,
    values: structuredClone(node.data),
    ...capturedChildren(node, children),
  };
}

/**
 * Reads a template from data that may come from outside — an imported guide or
 * a host that saved an older set.
 *
 * The older shape carried a copy of the base type's fields and behaviour. The
 * base type itself was never written out, so it is read from the behaviour: that
 * is an identity, not a guess — every base type has its own way of answering and
 * its own way onward. The fields' `defaultValue` becomes the template's values.
 *
 * If the base type cannot be read out the template is kept anyway, with an empty
 * base type. It is then unusable, but nothing is discarded (K6b).
 */
export function toNodeTemplate(value: unknown): NodeTemplate | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  if (typeof raw.type !== "string" || typeof raw.label !== "string") {
    return null;
  }

  const common = {
    type: raw.type,
    label: raw.label,
    ...(typeof raw.icon === "string" && raw.icon ? { icon: raw.icon } : {}),
  };

  if (typeof raw.base === "string") {
    return {
      ...common,
      base: raw.base,
      values:
        typeof raw.values === "object" && raw.values !== null
          ? structuredClone(raw.values as Record<string, unknown>)
          : {},
      ...(Array.isArray(raw.children)
        ? { children: raw.children.flatMap(toTemplateChild) }
        : {}),
    };
  }

  if (!Array.isArray(raw.fields)) {
    return null;
  }

  return {
    ...common,
    base: baseFromBehavior(raw.behavior),
    values: valuesFromFields(raw.fields),
  };
}

/** A page template's field as read from a host: a type and its data, or nothing. */
function toTemplateChild(value: unknown): NodeTemplateChild[] {
  if (typeof value !== "object" || value === null) {
    return [];
  }

  const raw = value as Record<string, unknown>;
  if (typeof raw.type !== "string") {
    return [];
  }

  return [
    {
      type: raw.type,
      data:
        typeof raw.data === "object" && raw.data !== null
          ? structuredClone(raw.data as Record<string, unknown>)
          : {},
    },
  ];
}

function valuesFromFields(fields: unknown[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const field of fields) {
    if (typeof field !== "object" || field === null) {
      continue;
    }

    const spec = field as { id?: unknown; defaultValue?: unknown };
    if (typeof spec.id === "string" && spec.defaultValue !== undefined) {
      values[spec.id] = structuredClone(spec.defaultValue);
    }
  }

  return values;
}

/** Grundtypen bakom ett gammalt, medkopierat beteende. Tom sträng = okänd. */
function baseFromBehavior(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    return "";
  }

  const behavior = value as Partial<NodeBehavior>;
  const answer = behavior.answer;

  if (behavior.flow?.kind === "end") {
    return "result";
  }

  if (answer?.cardinality === "multi") {
    return "multi-choice";
  }

  if (answer?.input === "number") {
    return "number-question";
  }

  if (answer?.input === "lookup") {
    return "autocomplete-question";
  }

  if (answer?.input === "text") {
    return "text-question";
  }

  if (answer?.optionsField) {
    return "question";
  }

  return "";
}
