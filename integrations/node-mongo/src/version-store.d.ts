/**
 * The store's shape, written down.
 *
 * The example itself is plain JavaScript — a host copying it into a Node
 * service should not have to adopt a build step to read it. This file exists so
 * the repository's own tests can typecheck against it, and it doubles as the
 * shortest statement of what a storage has to answer: eight verbs, and one of
 * them takes a timestamp.
 */

/** What a list needs. The guide is fetched separately, by id. */
export interface VersionSummary {
  id: string;
  name: string;
  note: string;
  /** When the *guide* was last written. Renaming and annotating do not move it. */
  lastModified: number;
}

/** Thrown when somebody else wrote first. `current` is what is there now. */
export declare class VersionConflict extends Error {
  constructor(current: VersionSummary);
  current: VersionSummary;
}

export interface VersionStore<Graph = unknown> {
  list(space: string): Promise<VersionSummary[]>;
  read(id: unknown): Promise<Graph | null>;
  add(space: string, name: string, graph: Graph): Promise<VersionSummary>;
  /**
   * `knownSavedAt` is the timestamp the caller believed it was writing over.
   * Omitting it means last write wins — a choice, not a default.
   */
  update(
    id: unknown,
    graph: Graph,
    knownSavedAt?: number
  ): Promise<VersionSummary>;
  copy(id: unknown, name: string): Promise<VersionSummary>;
  rename(id: unknown, name: string): Promise<VersionSummary>;
  note(id: unknown, note: string): Promise<VersionSummary>;
  remove(id: unknown): Promise<VersionSummary | null>;
}

/**
 * A store over one collection. The collection is handed in rather than opened,
 * so a test can pass something that behaves like one.
 */
export declare function versionStore<Graph = unknown>(
  collection: unknown,
  options?: {
    now?: () => number;
    /**
     * Turns the id a caller holds into the one the collection stores under.
     * Mongo's is an `ObjectId`; what travels through JSON is a string. Without
     * this the store hands out keys its own door will not take.
     */
    toId?: (id: unknown) => unknown;
  }
): VersionStore<Graph>;
