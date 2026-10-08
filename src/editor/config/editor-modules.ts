import {
  getEditorCapabilities,
  type EditorCapabilities,
  type EditorCapability,
  type EditorFeatureLevel,
} from "./editor-capabilities";

import { getNodeType, getNodeTypes } from "../../viewer/node-types/node-type-registry";

import type { LocalizedTextMap } from "../../viewer/core/localized-text";

/**
 * The module catalogue: an alternative, additive way to assemble the editor's
 * `EditorCapabilities`. A **core baseline** is always on; every module adds more
 * capabilities on top of it. The levels (basic/advanced/service) are just named
 * bundles of modules:
 *   - basic     = core (no modules)
 *   - advanced  = core + every module
 *   - service   = core + every module
 * so `getCapabilitiesFromModules([])` yields exactly the same object as
 * `getEditorCapabilities("basic")`, and every module yields `"advanced"`.
 */

export interface EditorModule {
  id: string;
  label: LocalizedTextMap;
  description: LocalizedTextMap;
  /** The capabilities the module unlocks on top of the core baseline. */
  capabilities: EditorCapability[];
}

/** Always on, whatever the modules — this is the stripped-down basic mode. */
export const CORE_CAPABILITIES: EditorCapability[] = [
  "multiChoice",
  "rules",
  "variables",
  "importExport",
];

/*
 * Ids are the API — what a host writes in the `modules` attribute — so they are
 * English (PRAXIS 19); the labels are what the editor shows. The ids were
 * Swedish until story 097; `MODULE_ID_ALIASES` keeps those attributes working.
 */
export const EDITOR_MODULES: EditorModule[] = [
  {
    id: "logic",
    label: { sv: "Logik", en: "Logic" },
    description: {
      sv: "Flervillkorsregler (OCH/ELLER) och uträkningar med formler.",
      en: "Multi-condition rules (AND/OR) and formula calculations.",
    },
    capabilities: ["advancedRules", "calculations"],
  },
  {
    id: "content",
    label: { sv: "Innehåll", en: "Content" },
    description: {
      sv: "Rikare innehållsnoder: kod och annoterad bild.",
      en: "Richer content nodes: code and annotated image.",
    },
    capabilities: ["richContent"],
  },
  {
    id: "fields",
    label: { sv: "Fält", en: "Fields" },
    description: {
      sv: "Fält som besökaren fyller i själv: text, tal, datum, samtycke.",
      en: "Fields the visitor fills in alone: text, number, date, consent.",
    },
    capabilities: ["inputQuestions", "numericConstraints", "fieldValidation"],
  },
  {
    id: "host-services",
    label: { sv: "Värdens tjänster", en: "Host services" },
    description: {
      sv: "Fält som kräver något hos värden: uppslag, fil, karta.",
      en: "Fields that need something on the host's side: lookup, file, map.",
    },
    // Their required/accept/size settings sit behind fieldValidation, as every
    // field's do — so the module carries it too, or a lookup could never be required.
    capabilities: ["hostServices", "fieldValidation"],
  },
  /*
   * `service` was one module until 2026-10-06 (open-core step 2). It mixed
   * what helps a visitor reach an answer (pages, route analysis, service
   * calls — the open product) with what sends the answer in (submission,
   * e-mail results — the full version). The line between them is the product
   * boundary (docs/UPPDELNING-OPPET-OCH-PRIVAT.md), so it is a line between
   * modules too. `service` lives on as an alias for both, below.
   */
  {
    id: "pages",
    label: { sv: "Sidor", en: "Pages" },
    description: {
      sv: "Sidor med flera fält, ruttanalys och tjänsteanrop.",
      en: "Multi-field pages, route analysis and service calls.",
    },
    capabilities: ["pages", "routeAnalysis", "serviceCalls"],
  },
  {
    id: "submission",
    label: { sv: "Inlämning", en: "Submission" },
    description: {
      sv: "Skicka in svaren till en mottagare, och e-postresultat.",
      en: "Send the answers in to a receiver, and email results.",
    },
    capabilities: ["submission", "emailResults"],
  },
];

/**
 * Ids the attribute accepted before, and what they mean now. The Swedish ids
 * are from before 097: `inmatning` was one module for every field type; a host
 * that wrote it gets Fält, not an empty palette — that would be a support
 * ticket, and the host's own fields were fields. `service` (and its Swedish
 * `tjanst`) was one module until the split above; a host that wrote it keeps
 * everything it had, which is now two modules.
 */
const MODULE_ID_ALIASES: Record<string, string[]> = {
  logik: ["logic"],
  innehall: ["content"],
  inmatning: ["fields"],
  tjanst: ["pages", "submission"],
  service: ["pages", "submission"],
};

/** Which modules each named level corresponds to (a level is a bundle). */
export const FEATURE_LEVEL_MODULES: Record<EditorFeatureLevel, string[]> = {
  basic: [],
  advanced: EDITOR_MODULES.map((module) => module.id),
  service: EDITOR_MODULES.map((module) => module.id),
};

/** The core baseline as a "module" — to show and label always-on nodes. */
export const CORE_MODULE: { id: string; label: LocalizedTextMap } = {
  id: "core",
  label: { sv: "Grund", en: "Core" },
};

export function isEditorModuleId(value: string): boolean {
  return EDITOR_MODULES.some((module) => module.id === value);
}

/**
 * Which module a capability belongs to: the core baseline → Grund, otherwise
 * the module that unlocks it. Returns null when no module owns the capability.
 */
export function moduleForCapability(
  capability: EditorCapability
): { id: string; label: LocalizedTextMap } | null {
  if (CORE_CAPABILITIES.includes(capability)) {
    return CORE_MODULE;
  }
  const owner = EDITOR_MODULES.find((module) =>
    module.capabilities.includes(capability)
  );
  return owner ? { id: owner.id, label: owner.label } : null;
}

/**
 * Which module a node type belongs to, from its `requiredCapability`. Nodes
 * without a gate are always available and count as Grund.
 */
export function moduleForRequiredCapability(
  capability: EditorCapability | undefined
): { id: string; label: LocalizedTextMap } {
  if (!capability) {
    return CORE_MODULE;
  }
  return moduleForCapability(capability) ?? CORE_MODULE;
}

/** The effective module ids for a level (a level is a bundle of modules). */
export function modulesForFeatureLevel(level: EditorFeatureLevel): string[] {
  return [...FEATURE_LEVEL_MODULES[level]];
}

/**
 * Which modules a set of node types' `requiredCapability` demands — so that only
 * the modules an example actually uses are pre-ticked. Core capabilities (with
 * no owning module) do not count; they are always on. The result follows
 * catalogue order.
 */
export function modulesForRequiredCapabilities(
  capabilities: Array<EditorCapability | undefined>
): string[] {
  const used = new Set<string>();
  for (const capability of capabilities) {
    if (!capability) {
      continue;
    }
    const owner = EDITOR_MODULES.find((module) =>
      module.capabilities.includes(capability)
    );
    if (owner) {
      used.add(owner.id);
    }
  }
  return EDITOR_MODULES.map((module) => module.id).filter((id) => used.has(id));
}

/**
 * The modules a guide needs, read off its nodes' gates — what an example page
 * opens with, so the palette is the guide's and not the whole catalogue.
 * A node type the registry does not know counts as core: an unknown node is
 * a different problem than a missing module.
 */
export function modulesUsedByGraph(nodes: ReadonlyArray<{ type: string }>): string[] {
  return modulesForRequiredCapabilities(
    nodes.map((node) => getNodeType(node.type)?.requiredCapability)
  );
}

/**
 * The modules the menu offers: those with a registered node type behind at
 * least one of their capabilities. The catalogue is open code and lists
 * `submission`, but the open editor has no node that needs it until
 * FlowWeaver PRO registers *Inlämning* — so the entry would be a toggle with
 * nothing behind it (open-core step 5, 2026-10-06). Asked at render time, so
 * a PRO registered after the editor loaded is still found.
 */
export function visibleModules(): EditorModule[] {
  const required = new Set(
    getNodeTypes()
      .map(({ definition }) => definition.requiredCapability)
      .filter((capability): capability is EditorCapability => capability !== undefined),
  );
  return EDITOR_MODULES.filter((module) => module.capabilities.some((capability) => required.has(capability)));
}

/** Reads the `modules` attribute's value (space/comma separated ids). */
export function parseModuleIds(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  const seen = new Set<string>();
  return value
    .split(/[\s,]+/)
    .flatMap((id) => MODULE_ID_ALIASES[id.trim()] ?? [id.trim()])
    .filter((id) => id && isEditorModuleId(id) && !seen.has(id) && seen.add(id));
}

function emptyCapabilities(): EditorCapabilities {
  const template = getEditorCapabilities("advanced");
  const empty = {} as EditorCapabilities;
  (Object.keys(template) as EditorCapability[]).forEach((key) => {
    empty[key] = false;
  });
  return empty;
}

/**
 * Builds `EditorCapabilities` from a list of modules: the core baseline plus
 * every (valid) module's capabilities. Unknown module ids are ignored.
 */
export function getCapabilitiesFromModules(
  moduleIds: string[]
): EditorCapabilities {
  const capabilities = emptyCapabilities();

  for (const capability of CORE_CAPABILITIES) {
    capabilities[capability] = true;
  }

  for (const id of moduleIds) {
    const module = EDITOR_MODULES.find((item) => item.id === id);
    if (!module) {
      continue;
    }
    for (const capability of module.capabilities) {
      capabilities[capability] = true;
    }
  }

  return capabilities;
}
