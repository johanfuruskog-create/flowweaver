/**
 * What the editor writes into `meta` at a save-like moment — an export, a
 * schema export — that it does not know how to compute itself. The pro
 * version's submission schema (story 094) is the one stamp today: it used to
 * be a method of guide-editor that imported the schema service, which is the
 * pro version's file. Now the editor applies whatever is registered here,
 * in registration order, one stamp per id (open-core step 4, 2026-10-06).
 */
import type { GraphData, GuideMeta } from "../../viewer/types/graph";

export type ExportStamp = (graph: GraphData) => Partial<GuideMeta> | null;

const stamps = new Map<string, ExportStamp>();

export function registerExportStamp(id: string, stamp: ExportStamp): void {
  stamps.set(id, stamp);
}

export function unregisterExportStamp(id: string): void {
  stamps.delete(id);
}

export function exportStamps(): ExportStamp[] {
  return [...stamps.values()];
}
