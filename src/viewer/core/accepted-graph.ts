import {
  CURRENT_GRAPH_VERSION,
  migrateGraph,
  readGraphVersion,
} from "./graph-migrations";

import type { GraphData } from "../types/graph";

/** Same question the file door asks, asked the same way. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}


/**
 * A graph that has passed the door.
 *
 * ## Why a type and not a check
 *
 * The migration chain used to run in `importGraphJson` but not in the `graph`
 * setter. A host that set the graph as an *object* — which the SiteVision
 * module does — went straight past it, and a page's two required fields
 * disappeared from a published guide without a word. See K7 in `docs/KRAV.md`.
 *
 * That was fixed by migrating in the setter too. But the fix left **two doors
 * that both happen to migrate**, and the third door someone adds can forget
 * again exactly as the second one did. A test cannot catch that: it would have
 * to know about a door nobody has written yet.
 *
 * A brand can. `loadGraph` accepts only an `AcceptedGraph`, and only
 * `migrateIncoming` produces one, so a new entrance that skips the migration is
 * a **compile error** rather than a bug that surfaces as missing fields in
 * production months later. See story 016.
 *
 * ## The escape hatch is named on purpose
 *
 * Undo and redo replay graphs that never left our hands; re-migrating them
 * would be wrong, not merely wasteful — the guessing migrations (v1→v3) cannot
 * tell old data from new and would normalise text the editor just typed.
 *
 * `alreadyAccepted` exists for exactly that, and it is deliberately ugly to
 * reach for. The brand does not make a bypass impossible; it makes it
 * impossible to do **by accident**. You can still decide to, and then it is
 * visible in the diff.
 */
declare const accepted: unique symbol;

/** A graph that has been through the migration chain, or never needed to be. */
export type AcceptedGraph = GraphData & { readonly [accepted]: true };

/**
 * Marks a graph as accepted without migrating it.
 *
 * Only for graphs that never left the editor — the undo history's snapshots.
 * Anything arriving from outside goes through the migration instead.
 */
export function alreadyAccepted(graph: GraphData): AcceptedGraph {
  return graph as AcceptedGraph;
}

/**
 * Lifts a graph arriving from **outside** to today's format.
 *
 * The migration chain ran only in `importGraphJson`. A host that sets the
 * graph as an *object* — which the SiteVision module does — went past it, and
 * an old guide would have been read with today's rules. It went unnoticed
 * until v3→v4 removed the old page-field format: until then old fields
 * rendered anyway, so the gap was silent. See K7 in `docs/KRAV.md`.
 *
 * Called only at a door, never inside. Internal graphs carry no version, so
 * undo and redo would otherwise have been read as v1 and re-migrated at every
 * step — which normalised text the editor had just written.
 *
 * ## Why it lives here and not in the editor
 *
 * It was the editor's private method, and the viewer therefore had none: a
 * guide in an older format rendered **an empty page for the resident, with no
 * error**. Measured on a v3 page — `fält=0` raw against `fält=2` migrated —
 * after two independent readings of the code said so and the first measurement
 * of mine was wrong.
 *
 * The comment above already named the SiteVision module as the host that sets
 * the graph as an object. That is the viewer's door as much as the editor's,
 * and the viewer is what a resident meets. So the function moved to where both
 * can reach it rather than being copied — a second copy of a migration rule is
 * the one thing worse than none.
 */
/**
 * What the door answers. `ok: false` carries a sentence for a person, in the
 * same shape and the same spirit as the file door's `errors`.
 */
export type IncomingGraph =
  | { ok: true; graph: AcceptedGraph }
  | { ok: false; message: string };

export function migrateIncoming(value: GraphData): IncomingGraph {
  /*
   * Two checks the file door has always made and this one never did.
   *
   * **Not an object.** `null`, a string, an array: reading `.version` off it
   * threw an uncaught `TypeError`, or slipped through to the misleading
   * "Guiden saknar startnod". A host page written in plain JS is exactly the
   * caller that hits this.
   *
   * **A newer version.** There is nothing to migrate a v99 graph *to*, and it
   * was branded accepted and drawn with today's rules anyway — so a field
   * written by a node type we do not have simply did not appear. Same failure
   * class as the missing migration, arriving from the other direction: a page
   * that looks badly built rather than broken.
   */
  if (!isRecord(value)) {
    return { ok: false, message: "Guiden måste vara ett objekt." };
  }

  const declared = readGraphVersion(value);

  if (declared > CURRENT_GRAPH_VERSION) {
    return {
      ok: false,
      message:
        `Guiden skapades i en nyare version (${declared}) än vad som stöds ` +
        `(${CURRENT_GRAPH_VERSION}).`,
    };
  }

  /*
   * A graph *without* a version field is assumed to be v3, not v1.
   *
   * `readGraphVersion` says v1 when the field is missing, which is right for a
   * JSON file: a file without a version is genuinely old. But an *object*
   * without a version comes from a modern editor — the in-memory graph carries
   * no version, so undo, a feature-level switch and everything else reusing it
   * would otherwise run the whole chain every time.
   *
   * The distinction matters because the migrations are of two kinds. The
   * structural ones (v3→v4: page fields become child nodes) are shape-guarded
   * — they touch only data that has the old shape and are therefore harmless
   * on fresh data. The *guessing* ones (v1→v3: bare strings become
   * translatable maps) cannot tell old from new, and normalised text the
   * editor had just written.
   *
   * Raise the constant when a migration is added that is not safe to run on a
   * modern graph.
   */
  const ASSUMED_VERSION_WITHOUT_FIELD = 3;
  const hasVersionField =
    typeof (value as { version?: unknown }).version === "number";
  const version = hasVersionField
    ? readGraphVersion(value)
    : ASSUMED_VERSION_WITHOUT_FIELD;
  const lifted =
    version < CURRENT_GRAPH_VERSION
      ? (migrateGraph(
          structuredClone(value) as unknown as Record<string, unknown>,
          version
        ).graph as unknown as GraphData)
      : value;

  // The version belongs to serialised JSON, not to the in-memory graph.
  // `exportGraphJson` stamps it on the way out; carry it internally and it
  // leaks into everything that compares graphs — the undo history included.
  const { version: _version, ...withoutVersion } = lifted as GraphData & {
    version?: number;
  };

  // The one place the brand is applied: everything reaching here has been
  // through the chain (or was already current). See `accepted-graph.ts`.
  return { ok: true, graph: alreadyAccepted(withoutVersion) };
}
