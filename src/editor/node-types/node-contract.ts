import {
  canNodeTypeBeInPage,
  getNodeTypes,
  isGuideStepNode,
  isPageOnlyNodeType,
} from "../../viewer/node-types/node-type-registry";
import { editableProperties } from "./node-properties";

import type { FlowNodeData } from "../../viewer/types/graph";
import type { NodeTypeDefinition } from "../../viewer/types/node-types";

/**
 * A stable, backwards-compatible contract per node type. Captures the
 * identities old graphs depend on — type, data keys, fields, ports and placement
 * — but not cosmetics (labels, descriptions) or data-driven ports (question
 * options, rule cases) that live in the individual graph's data.
 *
 * The placement values are *effective* (they go through the same predicates the
 * runtime does), not raw flags, so the contract mirrors observable behaviour.
 */
export interface NodeTypeContract {
  type: string;
  variableType: string | null;
  requiredCapability: string | null;
  isGuideStep: boolean;
  canBeInPage: boolean;
  pageOnly: boolean;
  /** Keys in a freshly created node's data (names, not values). */
  dataKeys: string[];
  /** Editable fields as "id:control". */
  fields: string[];
  /** Fields that are translatable (localized: true). May never be identities. */
  localizedFields: string[];
  inputPorts: string[];
  /** Ports that do not depend on the node's data (the static skeleton). */
  staticOutputPorts: string[];
}

/** En sond med tom data ger det statiska portskelettet (dynamiska portar faller bort). */
function probe(type: string): FlowNodeData {
  return { id: "probe", type, position: { x: 0, y: 0 }, data: {} };
}

function contractFor(
  type: string,
  definition: NodeTypeDefinition
): NodeTypeContract {
  const sonde = probe(type);
  return {
    type,
    variableType: definition.variableType ?? null,
    requiredCapability: definition.requiredCapability ?? null,
    isGuideStep: isGuideStepNode(sonde),
    canBeInPage: canNodeTypeBeInPage(type),
    pageOnly: isPageOnlyNodeType(type),
    dataKeys: Object.keys(definition.createData()).sort(),
    fields: editableProperties(definition)
      .map((property) => `${property.id}:${property.control}`)
      .sort(),
    localizedFields: editableProperties(definition)
      .filter((property) => property.localized === true)
      .map((property) => property.id)
      .sort(),
    inputPorts: definition.inputs.map((input) => input.id).sort(),
    staticOutputPorts: definition
      .getOutputs(sonde)
      .map((output) => output.id)
      .sort(),
  };
}

/** Derives the contract for every registered node type, sorted by type. */
export function deriveNodeContracts(): NodeTypeContract[] {
  return getNodeTypes()
    .map(({ type, definition }) => contractFor(type, definition))
    .sort((left, right) => left.type.localeCompare(right.type));
}

export interface ContractDiff {
  /** Changes that break old graphs — they demand a migration plus a version bump. */
  breaking: string[];
  /** Safe changes (additive or loosening). */
  additive: string[];
}

function diffSets(
  type: string,
  label: string,
  before: string[],
  after: string[],
  diff: ContractDiff
): void {
  const afterSet = new Set(after);
  const beforeSet = new Set(before);
  for (const value of before) {
    if (!afterSet.has(value)) {
      diff.breaking.push(`${type}: ${label} "${value}" togs bort`);
    }
  }
  for (const value of after) {
    if (!beforeSet.has(value)) {
      diff.additive.push(`${type}: ${label} "${value}" lades till`);
    }
  }
}

function diffContract(
  before: NodeTypeContract,
  after: NodeTypeContract,
  diff: ContractDiff
): void {
  const type = after.type;

  diffSets(type, "datanyckel", before.dataKeys, after.dataKeys, diff);
  diffSets(type, "fält", before.fields, after.fields, diff);
  // Toggling `localized` is safe in itself: the readers handle both a string
  // and a map via resolveText, so rendering and data intake are unaffected.
  // (The identity test is the guard against translating the wrong field.) Both
  // directions are therefore classed as additive — but show up in the snapshot
  // as a tracked change.
  const beforeLocalized = new Set(before.localizedFields ?? []);
  const afterLocalized = new Set(after.localizedFields ?? []);
  for (const field of before.localizedFields ?? []) {
    if (!afterLocalized.has(field)) {
      diff.additive.push(`${type}: fältet "${field}" är inte längre översättbart`);
    }
  }
  for (const field of after.localizedFields ?? []) {
    if (!beforeLocalized.has(field)) {
      diff.additive.push(`${type}: fältet "${field}" blev översättbart`);
    }
  }
  diffSets(type, "ingångsport", before.inputPorts, after.inputPorts, diff);
  diffSets(type, "utgångsport", before.staticOutputPorts, after.staticOutputPorts, diff);

  // Loosening is safe, tightening breaks.
  if (before.isGuideStep && !after.isGuideStep) {
    diff.breaking.push(`${type}: kan inte längre vara ett eget steg`);
  } else if (!before.isGuideStep && after.isGuideStep) {
    diff.additive.push(`${type}: får nu vara ett eget steg`);
  }

  if (before.canBeInPage && !after.canBeInPage) {
    diff.breaking.push(`${type}: får inte längre ligga i en Page`);
  } else if (!before.canBeInPage && after.canBeInPage) {
    diff.additive.push(`${type}: får nu ligga i en Page`);
  }

  if (!before.pageOnly && after.pageOnly) {
    diff.breaking.push(`${type}: får inte längre stå fristående (pageOnly)`);
  } else if (before.pageOnly && !after.pageOnly) {
    diff.additive.push(`${type}: får nu stå fristående`);
  }

  if (before.variableType !== after.variableType) {
    diff.breaking.push(
      `${type}: variableType ändrad (${before.variableType} → ${after.variableType})`
    );
  }

  if (before.requiredCapability !== after.requiredCapability) {
    if (before.requiredCapability === null) {
      diff.breaking.push(
        `${type}: kräver nu capability "${after.requiredCapability}"`
      );
    } else if (after.requiredCapability === null) {
      diff.additive.push(`${type}: capability-krav borttaget`);
    } else {
      diff.breaking.push(
        `${type}: requiredCapability ändrad (${before.requiredCapability} → ${after.requiredCapability})`
      );
    }
  }
}

/**
 * Compares two contract sets and classifies the differences. Additive (new
 * types/fields/ports, loosened placement) is safe; anything touching an
 * *existing* identity or tightening placement is breaking.
 */
export function classifyContractDiff(
  before: NodeTypeContract[],
  after: NodeTypeContract[]
): ContractDiff {
  const diff: ContractDiff = { breaking: [], additive: [] };
  const beforeByType = new Map(before.map((contract) => [contract.type, contract]));
  const afterByType = new Map(after.map((contract) => [contract.type, contract]));

  for (const contract of before) {
    if (!afterByType.has(contract.type)) {
      diff.breaking.push(`nodtypen "${contract.type}" togs bort`);
    }
  }
  for (const contract of after) {
    const previous = beforeByType.get(contract.type);
    if (!previous) {
      diff.additive.push(`ny nodtyp "${contract.type}"`);
      continue;
    }
    diffContract(previous, contract, diff);
  }

  return diff;
}
