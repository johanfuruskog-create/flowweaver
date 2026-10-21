import { validateGraph } from "./graph-validator";
import {
  CURRENT_GRAPH_VERSION,
  migrateGraph,
  readGraphVersion,
  stampGraphVersion,
} from "../../viewer/core/graph-migrations";
import { toNodeTemplate } from "../../viewer/node-types/node-templates";
import { normalizeLocale } from "../../viewer/core/localized-text";
import { readGraphShape } from "../../viewer/core/graph-shape";

import type { NodeTemplate, GraphData } from "../../viewer/types/graph";

export type GraphImportResult =
  | { success: true; graph: GraphData }
  | { success: false; errors: string[] };

export type GraphExportResult =
  | { success: true; json: string }
  | { success: false; errors: string[] };

export interface GraphImportOptions {
  allowDraftWithoutStartNode?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}


/**
 * Reads the guide's `meta`. Unrecognised fields are left out — but unlike
 * before, the key *exists*, so it survives a round trip.
 *
 * `updatedAt` is read as it stands. It is set on export, not here, because an
 * import is not a change.
 */
function parseMeta(value: unknown): { meta?: GraphData["meta"] } {
  if (!isRecord(value)) {
    return {};
  }

  const meta: NonNullable<GraphData["meta"]> = {};
  const localized = (text: unknown): unknown =>
    typeof text === "string"
      ? text
      : isRecord(text) &&
          Object.values(text).every((entry) => typeof entry === "string")
        ? { ...text }
        : undefined;

  const name = localized(value.name);
  const description = localized(value.description);

  if (name !== undefined) {
    meta.name = name as NonNullable<GraphData["meta"]>["name"];
  }
  if (description !== undefined) {
    meta.description = description as NonNullable<GraphData["meta"]>["description"];
  }
  // The identity comes back as it stands. An import is not a new guide: the
  // file names itself, and re-minting here would hand the same guide two ids
  // depending on which way in it came.
  if (typeof value.id === "string" && value.id !== "") {
    meta.id = value.id;
  }
  // The version a graph came from rides along: it is what the errand will say,
  // and a guide exported out of a host should not forget which version it was.
  if (typeof value.versionId === "string" && value.versionId !== "") {
    meta.versionId = value.versionId;
  }
  if (typeof value.owner === "string") {
    meta.owner = value.owner;
  }
  if (typeof value.updatedAt === "string") {
    meta.updatedAt = value.updatedAt;
  }
  // Only the shape is checked; the contents are what the editor wrote (story 094).
  if (isRecord(value.submissionSchema) && isRecord(value.submissionSchema.properties)) {
    meta.submissionSchema = structuredClone(value.submissionSchema) as unknown as NonNullable<GraphData["meta"]>["submissionSchema"];
  }

  return Object.keys(meta).length > 0 ? { meta } : {};
}

/** Nycklar `parseSettings` tolkar. Allt annat bevaras i `settings.extra`. */
const KNOWN_SETTINGS_KEYS = ["strings", "sourceLocale", "locales", "progress", "nodeTemplates", "customNodeTypes", "extra"];

/** Keys belonging to the graph's shape. Everything else is kept in `graph.extra`. */
const KNOWN_ROOT_KEYS = [
  "version",
  "startNodeId",
  "nodes",
  "connections",
  "settings",
  "meta",
  "extra",
];

/**
 * Picks out the keys not in the list, untouched.
 *
 * Import used to read only what it recognised and drop the rest silently — a
 * host platform that put something in the guide had it erased the first time the
 * editor saved. See K6b in `docs/KRAV.md`.
 */
function collectExtra(
  record: Record<string, unknown>,
  known: string[]
): Record<string, unknown> | undefined {
  const extra: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (!known.includes(key)) {
      extra[key] = structuredClone(value);
    }
  }

  return Object.keys(extra).length > 0 ? extra : undefined;
}

function parseSettings(value: unknown): { settings?: GraphData["settings"] } {
  if (!isRecord(value)) {
    return {};
  }
  const settings: NonNullable<GraphData["settings"]> = {};

  const extra = collectExtra(value, KNOWN_SETTINGS_KEYS);

  if (extra) {
    settings.extra = extra;
  }

  if (isRecord(value.extra)) {
    settings.extra = { ...settings.extra, ...structuredClone(value.extra) };
  }

  if (isRecord(value.strings)) {
    /*
     * `settings.strings` carries the guide's own wording for texts a **resident**
     * reads. A key belonging to the tool has no meaning here — a guide does not
     * get to rename "Fråga" in the palette.
     *
     * It is nevertheless kept exactly where it arrived. `uiText` refuses to
     * honour a tool key, so it is already inert, and the simplest way not to
     * throw something away is to leave it alone: the file that goes in comes
     * out identical (**K6b**). Relocating it to `settings.extra` was tried and
     * is worse — export writes `extra` back at the settings level, so a nested
     * `strings` there overwrites this one on the way out.
     *
     * Story 017, criteria 3 and 4.
     */
    const strings: Record<string, unknown> = {};
    for (const [key, text] of Object.entries(value.strings)) {
      // Keep only valid texts (a string or a { locale: string } map).
      if (typeof text === "string") {
        strings[key] = text;
      } else if (
        isRecord(text) &&
        Object.values(text).every((entry) => typeof entry === "string")
      ) {
        strings[key] = { ...text };
      }
    }
    settings.strings = strings as Record<string, string>;
  }

  if (typeof value.sourceLocale === "string") {
    const normaliserad = normalizeLocale(value.sourceLocale);
    if (normaliserad) {
      settings.sourceLocale = normaliserad;
    }
  }

  if (Array.isArray(value.locales)) {
    const locales = value.locales.filter(
      (code): code is string => typeof code === "string"
    );
    if (locales.length > 0) {
      settings.locales = locales;
    }
  }

  // Only a written `true` turns the meter on. A missing field and a written
  // `false` are the same thing on the way in and the same thing on the way
  // out — nothing is added to a guide that never had it (K7).
  if (value.progress === true) {
    settings.progress = true;
  }

  // Both the current shape (base type + values) and the old frozen copy are
  // read; toNodeTemplate converts the latter. See node-templates.ts.
  if (Array.isArray(value.nodeTemplates) || Array.isArray(value.customNodeTypes)) {
    const raw = Array.isArray(value.nodeTemplates)
      ? value.nodeTemplates
      : (value.customNodeTypes as unknown[]);
    const nodeTemplates = raw
      .map(toNodeTemplate)
      .filter((template): template is NodeTemplate => template !== null);
    if (nodeTemplates.length > 0) {
      settings.nodeTemplates = nodeTemplates;
    }
  }

  return Object.keys(settings).length > 0 ? { settings } : {};
}

export function importGraphJson(
  json: string,
  options: GraphImportOptions = {}
): GraphImportResult {
  let value: unknown;

  try {
    value = JSON.parse(json) as unknown;
  } catch {
    return {
      success: false,
      errors: ["Filen innehåller inte giltig JSON."],
    };
  }

  if (!isRecord(value)) {
    return {
      success: false,
      errors: ["Filen måste innehålla ett grafobjekt."],
    };
  }

  const version = readGraphVersion(value);
  if (version > CURRENT_GRAPH_VERSION) {
    return {
      success: false,
      errors: [
        `Guiden skapades i en nyare version (${version}) än vad som stöds (${CURRENT_GRAPH_VERSION}).`,
      ],
    };
  }

  /*
   * Lyft gamla grafer till aktuell form innan de tolkas och valideras — och
   * stämpla resultatet.
   *
   * Utan stämpel kom grafen versionslös ut härifrån, och objektdörren antar då
   * v3 och kör kedjan 4→6 en gång till. Ofarligt i dag, eftersom de
   * migreringarna är formvaktade och idempotensen är testad, men "exakt en
   * gång" var helt enkelt inte sant. Med stämpeln är andra passagen en no-op
   * via versionen i stället för via tur.
   */
  const record = stampGraphVersion(migrateGraph(value, version).graph);

  // The shape check is shared with the object door (`graph-shape.ts`).
  const shape = readGraphShape(record);

  if (!shape.ok) {
    return { success: false, errors: shape.errors };
  }

  const { nodes, connections } = shape;

  const graph: GraphData = {
    startNodeId: shape.startNodeId,
    nodes: structuredClone(nodes),
    connections: structuredClone(connections),
    ...parseSettings(record.settings),
    ...parseMeta(record.meta),
  };

  const rootExtra = collectExtra(record, KNOWN_ROOT_KEYS);

  if (rootExtra || isRecord(record.extra)) {
    graph.extra = {
      ...rootExtra,
      ...(isRecord(record.extra) ? structuredClone(record.extra) : {}),
    };
  }
  const semanticIssues = validateGraph(graph).filter(
    (issue) =>
      !(
        options.allowDraftWithoutStartNode &&
        graph.startNodeId === null &&
        issue.code === "missing-start-node"
      )
  );

  if (semanticIssues.length > 0) {
    return {
      success: false,
      errors: semanticIssues.map((issue) => issue.message),
    };
  }

  return { success: true, graph };
}

export function exportGraphJson(graph: GraphData): GraphExportResult {
  const issues = validateGraph(graph);

  if (issues.length > 0) {
    return {
      success: false,
      errors: issues.map((issue) => issue.message),
    };
  }

  // Export counts as a save: the stamp is set here and not on every change. A
  // stamp that changes itself makes every comparison between two versions
  // falsely positive. See K6c in docs/KRAV.md.
  const stamped: GraphData = {
    ...graph,
    meta: { ...graph.meta, updatedAt: new Date().toISOString() },
  };

  return {
    success: true,
    json: `${JSON.stringify(spreadExtra(stampGraphVersion(stamped)), null, 2)}\n`,
  };
}

/**
 * Puts preserved keys back where they came from, so a file that went in comes
 * out the same. `extra` is the library's internal carrier and must not show up
 * in the JSON.
 */
function spreadExtra<T extends GraphData & { version?: number }>(
  graph: T
): Record<string, unknown> {
  const { extra, settings, ...resten } = graph;
  const ut: Record<string, unknown> = { ...resten, ...extra };

  if (settings) {
    const { extra: settingsExtra, ...övrigaSettings } = settings;
    ut.settings = { ...övrigaSettings, ...settingsExtra };
  }

  return ut;
}
