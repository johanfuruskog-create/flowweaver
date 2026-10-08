import type {
  FlowNodeData,
  NodePort,
} from "../types/graph";
import type {
  NodeFieldDeclaration,
  NodePropertyForm,
  NodeTypeDefinition,
  NodeTypeRegistration,
} from "../types/node-types";

const nodeTypes = new Map<string, NodeTypeDefinition>();

/**
 * The data a new node starts with, derived from the fields' declared defaults.
 *
 * A field without a declared value contributes **no key**. That is deliberate:
 * `minSelected` without a value means "no limit", and it should read as the key
 * being absent — not as a zero somebody later has to interpret.
 */
export function dataFromProperties(
  properties: NodeFieldDeclaration[]
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  for (const property of properties) {
    if (property.createDefault) {
      data[property.id] = property.createDefault();
    } else if (Object.hasOwn(property, "defaultValue")) {
      data[property.id] = structuredClone(property.defaultValue);
    }
  }

  return data;
}

export function registerNodeType(
  type: string,
  registration: NodeTypeRegistration
): void {
  // Own copies of the entries: describeNodeProperties writes into them, and a
  // shared declaration (WHY_FIELD is used by every type) must stay untouched.
  const properties = registration.properties.map((property) => ({ ...property }));
  nodeTypes.set(type, {
    ...registration,
    properties,
    createData:
      registration.createData ?? (() => dataFromProperties(properties)),
  });
}

/**
 * Attach the editor's forms to a registered type's fields, matched by id.
 *
 * The built-in types declare their fields in the viewer and their forms in
 * `editor/node-types/default-node-properties.ts`, so a visitor page never loads
 * the labels (see `NodeFieldDeclaration`). The join is strict both ways: a form
 * for a field that is not declared is a typo that would otherwise show up as a
 * panel control writing a key nothing reads, and a declared field without a
 * form is a setting nobody can reach — the test beside the forms checks the
 * latter, this function the former.
 */
export function describeNodeProperties(
  type: string,
  forms: Array<{ id: string } & NodePropertyForm>
): void {
  const definition = nodeTypes.get(type);
  if (!definition) {
    throw new Error(`describeNodeProperties: node type "${type}" is not registered`);
  }
  for (const form of forms) {
    const field = definition.properties.find((p) => p.id === form.id);
    if (!field) {
      throw new Error(
        `describeNodeProperties: "${type}" declares no field "${form.id}"`
      );
    }
    Object.assign(field, form);
  }
}

export function unregisterNodeType(type: string): void {
  nodeTypes.delete(type);
}

export function getNodeType(
  type: string
): NodeTypeDefinition | undefined {
  return nodeTypes.get(type);
}

export function isQuestionNode(node: FlowNodeData): boolean {
  // A question is any node type declaring a variable type for its answer.
  return getNodeType(node.type)?.variableType !== undefined;
}

export function isGuideStepNode(node: FlowNodeData): boolean {
  // Questions are always steps; other steps (Page, pass-through nodes such as
  // calculation and service call) declare it with isGuideStep.
  return isQuestionNode(node) || getNodeType(node.type)?.isGuideStep === true;
}

/** Node types where the guide ends: an entrance, never a way onward. */
export function isEndingNodeType(type: string): boolean {
  return getNodeType(type)?.endsGuide === true;
}

/** Node types that may exist only as children of a Page, never standalone. */
export function isPageOnlyNodeType(type: string): boolean {
  return getNodeType(type)?.pageOnly === true;
}

/** Node types that may sit as fields inside a Page. */
export function canNodeTypeBeInPage(type: string): boolean {
  const definition = getNodeType(type);
  return definition?.canBeInPage === true || definition?.pageOnly === true;
}
export function getNodeTypes(): Array<{
  type: string;
  definition: NodeTypeDefinition;
}> {
  return Array.from(nodeTypes, ([type, definition]) => ({ type, definition }));
}

export function getNodePorts(
  node: FlowNodeData,
  options: { isStart?: boolean; locale?: string } = {}
): NodePort[] {
  const definition = getNodeType(node.type);

  if (!definition) {
    return [];
  }

  const inputs: NodePort[] =
    options.isStart && definition.hideInputsWhenStart
      ? []
      : definition.inputs.map((input) => ({
      ...input,
      direction: "input"
      }));

  const outputs: NodePort[] =
    definition.getOutputs(node, options.locale).map(
      (output) => ({
        ...output,
        direction: "output"
      })
    );

  return [...inputs, ...outputs];
}
