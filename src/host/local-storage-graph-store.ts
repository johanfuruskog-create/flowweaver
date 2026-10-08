/**
 * Where a guide is kept — the seam story 124 widened.
 *
 * ## One working copy, and versions that never change
 *
 * Two kinds of thing, and keeping them apart is the whole model:
 *
 *  - **the working copy** (`saveDraft`): one per guide, overwritten. It is
 *    what the editor is on. Nothing is stacked, nothing accumulates, and
 *    autosave writes here and nowhere else.
 *  - **versions** (`saveVersion`): frozen, and never touched again. Going back
 *    to last week's version means nothing if last week's version can have
 *    changed since.
 *
 * `current` is a pointer at one of the versions: what a visitor gets. Moving it
 * is `publish`, and it writes no graph.
 *
 * ## Why the methods answer with promises
 *
 * Because the other implementation of this interface talks to a server
 * (`docs/LAGRING-KONTRAKT.md`), and one interface that serves both is the
 * point of having one. `localStorage` answers immediately and says so by
 * resolving immediately.
 *
 * ## Why `guideId` and why the empty string is a guide
 *
 * A host keeps many guides and names them by `meta.id` (story 123). A page on
 * the example site keeps exactly one and has always kept it under the key it
 * was constructed with. The empty string is that guide: the key stays what it
 * was, so nobody who built something on an example page loses it. Any other id
 * hangs beneath the same key.
 */
import { importGraphJson } from "../editor/core/graph-io";
import { stampGraphVersion } from "../viewer/core/graph-migrations";

import type { GuideVersion } from "../editor/components/guide-versions/guide-versions";
import type { GraphData } from "../viewer/types/graph";

interface StoredGraphEnvelope {
  version: 1;
  savedAt: string;
  graph: GraphData & { version: number };
}

/** A frozen version as it is kept: the row the list shows, plus the graph. */
interface StoredVersion {
  id: string;
  /** What somebody called it. Absent when nobody did — see `saveVersion`. */
  label?: string;
  note?: string;
  savedAt: number;
  graph: GraphData;
}

interface StoredVersions {
  current: string;
  versions: StoredVersion[];
}

export type GraphLoadResult =
  | { status: "empty" }
  | {
      status: "success";
      graph: GraphData;
      savedAt: string;
      /**
       * Whether the graph is the working copy rather than a version's.
       *
       * Not "is there unsaved work": that is a comparison, and whoever draws
       * the mark makes it — the same way the versions workbench does. This
       * only says which of the two the graph came from.
       */
      draft: boolean;
      /** Which version a visitor gets, when there is one. */
      current?: string;
      /**
       * Who wrote the working copy, and whether that was the one asking
       * (story 127).
       *
       * Absent on a host without a login, and on a store with no notion of a
       * second person — `localStorage` is one browser, so the question does
       * not arise there. **The page decides what to draw**: the row says the
       * name only when `me` is false, because *sparad 22:50 av dig* is a
       * sentence about nothing.
       */
      savedBy?: { name: string; me: boolean };
      /**
       * Vilka som skrivit i arbetskopian sedan förra versionen, och
       * arbetsanteckningen någon lämnat på den (berättelse 130).
       *
       * Båda saknas hos en värd utan inloggning, och hos en lagring utan en
       * andra människa: `localStorage` är en webbläsare, och där finns ingen
       * att namnge eller lämna en lapp till.
       *
       * **Sidan bestämmer vad som ritas.** `me` är värdens svar — granskningen
       * skriver *Anna Andersson (08:29) och du* — och sidan jämför aldrig
       * namn, av samma skäl som `savedBy` ovan.
       */
      editors?: Array<{ name: string; me: boolean; at: string }>;
      note?: { text: string; name: string; me: boolean; at: string };
    }
  | { status: "error"; message: string };

/**
 * Somebody else wrote since this client read (story 127).
 *
 * Details rather than a sentence: the adapter knows *that* it happened and
 * *who*, and the page knows what to call it. A store that carried the words
 * would carry them into every host that embeds the library, for a page only
 * this site has.
 */
export interface GraphSaveConflict {
  /** What the host calls them. Empty on a host that has no login to ask. */
  by: string;
  /** When they saved, as the host stamps it. */
  savedAt: string;
}

export type GraphSaveResult =
  | { success: true; savedAt: string }
  | { success: false; message: string; conflict?: GraphSaveConflict };

export type GraphVersionResult =
  | { success: true; version: GuideVersion }
  | { success: false; message: string; conflict?: GraphSaveConflict };

export type GraphPublishResult =
  | { success: true; current: string }
  | { success: false; message: string };

/**
 * What a host answers, in six questions. `docs/LAGRING-KONTRAKT.md` is the
 * same six over HTTP.
 */
export interface GraphStore {
  /** The working copy if there is one, otherwise the current version. */
  load(guideId: string): Promise<GraphLoadResult>;
  /** The working copy. One per guide, overwritten. */
  saveDraft(guideId: string, graph: GraphData): Promise<GraphSaveResult>;
  /**
   * Throw the working copy away: there is no longer one.
   *
   * Different from writing a copy that happens to equal the published version,
   * and the difference is the whole reason it exists — *are there unpublished
   * changes?* is answered by whether a working copy is there at all. Throwing
   * away one that is not there is also a yes.
   */
  discardDraft(guideId: string): Promise<GraphSaveResult>;
  /** Freeze what is there now as a version of its own. */
  saveVersion(guideId: string, graph: GraphData, note?: string): Promise<GraphVersionResult>;
  /** The rows a version list shows. */
  listVersions(guideId: string): Promise<GuideVersion[]>;
  /** A version's graph as it was. Writes nothing. */
  openVersion(guideId: string, versionId: string): Promise<GraphData | null>;
  /** Move the pointer a visitor follows. */
  publish(guideId: string, versionId: string): Promise<GraphPublishResult>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class LocalStorageGraphStore implements GraphStore {
  private readonly storage: Storage;
  private readonly key: string;

  constructor(
    storage: Storage,
    key = "flowweaver:guide"
  ) {
    this.storage = storage;
    this.key = key;
  }

  /** The key a guide's working copy lives under. See the header on the empty id. */
  private keyFor(guideId: string): string {
    return guideId === "" ? this.key : `${this.key}:${guideId}`;
  }

  /** And the one its versions live under, beside it. */
  private versionsKey(guideId: string): string {
    return `${this.keyFor(guideId)}:versions`;
  }

  private readVersions(guideId: string): StoredVersions {
    try {
      const held = JSON.parse(this.storage.getItem(this.versionsKey(guideId)) ?? "null") as unknown;

      if (isRecord(held) && Array.isArray(held.versions)) {
        return {
          current: typeof held.current === "string" ? held.current : "",
          versions: held.versions as StoredVersion[],
        };
      }
    } catch {
      // Unreadable versions are no versions: the working copy is what matters
      // to somebody who is editing, and it lives under its own key.
    }

    return { current: "", versions: [] };
  }

  private writeVersions(guideId: string, held: StoredVersions): boolean {
    try {
      this.storage.setItem(this.versionsKey(guideId), JSON.stringify(held));
      return true;
    } catch {
      return false;
    }
  }

  /** The row a version list draws, out of what is kept. */
  private static row(version: StoredVersion, current: string): GuideVersion {
    return {
      id: version.id,
      ...(version.label ? { label: version.label } : {}),
      ...(version.note ? { note: version.note } : {}),
      savedAt: version.savedAt,
      current: version.id === current,
    };
  }

  async load(guideId = ""): Promise<GraphLoadResult> {
    const working = this.loadWorkingCopy(guideId);

    if (working.status !== "empty") {
      return working;
    }

    /*
     * No working copy: what a visitor gets is the honest answer, because that
     * is what this guide *is* right now. A guide with versions and no draft is
     * not an empty guide.
     */
    const held = this.readVersions(guideId);
    const published = held.versions.find((one) => one.id === held.current) ?? held.versions[0];

    if (!published) {
      return { status: "empty" };
    }

    return {
      status: "success",
      graph: published.graph,
      savedAt: new Date(published.savedAt).toISOString(),
      draft: false,
      current: published.id,
    };
  }

  private loadWorkingCopy(guideId: string): GraphLoadResult {
    let storedValue: string | null;

    try {
      storedValue = this.storage.getItem(this.keyFor(guideId));
    } catch {
      return {
        status: "error",
        message: "Den lokalt sparade guiden kunde inte läsas.",
      };
    }

    if (storedValue === null) {
      return { status: "empty" };
    }

    let envelope: unknown;

    try {
      envelope = JSON.parse(storedValue) as unknown;
    } catch {
      return {
        status: "error",
        message: "Den lokalt sparade guiden innehåller trasig JSON.",
      };
    }

    if (
      !isRecord(envelope) ||
      envelope.version !== 1 ||
      typeof envelope.savedAt !== "string" ||
      !("graph" in envelope)
    ) {
      return {
        status: "error",
        message: "Den lokalt sparade guiden har ett format som inte stöds.",
      };
    }

    const imported = importGraphJson(JSON.stringify(envelope.graph), {
      allowDraftWithoutStartNode: true,
    });

    if (!imported.success) {
      return {
        status: "error",
        message: `Den lokalt sparade guiden är ogiltig: ${imported.errors[0]}`,
      };
    }

    const current = this.readVersions(guideId).current;

    return {
      status: "success",
      graph: imported.graph,
      savedAt: envelope.savedAt,
      draft: true,
      ...(current ? { current } : {}),
    };
  }

  /**
   * The working copy. Overwritten, never stamped.
   *
   * No `meta.updatedAt` here on purpose: a stamp that moves on every keystroke
   * makes every comparison between two versions falsely positive, which is the
   * reason `graph.ts` gives for stamping on save and export only. Freezing is
   * `saveVersion`, and that is where the stamp belongs.
   */
  async saveDraft(guideId: string, graph: GraphData): Promise<GraphSaveResult> {
    const savedAt = new Date().toISOString();
    const envelope: StoredGraphEnvelope = {
      version: 1,
      savedAt,
      graph: stampGraphVersion(structuredClone(graph)),
    };

    try {
      this.storage.setItem(this.keyFor(guideId), JSON.stringify(envelope));
      return { success: true, savedAt };
    } catch {
      return {
        success: false,
        message: "Guiden kunde inte sparas lokalt i webbläsaren.",
      };
    }
  }

  /**
   * Freeze what is there now, and stamp it.
   *
   * The label is the moment, because a version's name is the one thing the
   * caller has not got: `POST /guides/<id>/versions` takes a note and no name,
   * so the store decides — and the moment is what a list of versions is sorted
   * and recognised by. The note is the caller's own word for it.
   */
  async discardDraft(guideId: string): Promise<GraphSaveResult> {
    try {
      this.storage.removeItem(this.keyFor(guideId));
      return { success: true, savedAt: new Date().toISOString() };
    } catch {
      return { success: false, message: "Arbetskopian kunde inte kastas." };
    }
  }

  async saveVersion(guideId: string, graph: GraphData, note?: string): Promise<GraphVersionResult> {
    const now = new Date();
    const held = this.readVersions(guideId);
    const id = `v-${now.getTime().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    const version: StoredVersion = {
      id,
      /*
       * No name, and that is the fix rather than the omission (17/9).
       *
       * A wall-clock string minted here is minted in the *storage's* zone, and
       * the list renders `savedAt` in the *reader's* — so one frozen version
       * said 13:05 as its name and 15:05 in the column beside it. A version
       * nobody named is named by when it was saved, and `<guide-versions>`
       * says that once, in one place, out of `savedAt`.
       */
      ...(note ? { note } : {}),
      savedAt: now.getTime(),
      graph: stampGraphVersion({
        ...structuredClone(graph),
        /*
         * The version's own id goes into the graph it freezes, so an errand
         * answered by this version says which version answered it
         * (`serviceVersion`, stories 123 and 124). It is written here and
         * nowhere else: a working copy is not a version and must not carry
         * one.
         */
        meta: { ...graph.meta, versionId: id, updatedAt: now.toISOString() },
      }),
    };
    const next: StoredVersions = {
      // The first version anybody freezes is what a visitor gets; after that
      // the pointer only moves when somebody says so.
      current: held.current || version.id,
      versions: [version, ...held.versions],
    };

    if (!this.writeVersions(guideId, next)) {
      return { success: false, message: "Versionen kunde inte sparas lokalt i webbläsaren." };
    }

    return { success: true, version: LocalStorageGraphStore.row(version, next.current) };
  }

  async listVersions(guideId: string): Promise<GuideVersion[]> {
    const held = this.readVersions(guideId);

    return held.versions.map((one) => LocalStorageGraphStore.row(one, held.current));
  }

  async openVersion(guideId: string, versionId: string): Promise<GraphData | null> {
    const found = this.readVersions(guideId).versions.find((one) => one.id === versionId);

    // A copy: whoever opens a version may edit what they get, and a version
    // that changed because somebody looked at it is not a version.
    return found ? structuredClone(found.graph) : null;
  }

  async publish(guideId: string, versionId: string): Promise<GraphPublishResult> {
    const held = this.readVersions(guideId);

    if (!held.versions.some((one) => one.id === versionId)) {
      // Pointing at nothing is how a guide goes dark for its visitors, so it
      // is refused rather than stored and discovered later.
      return { success: false, message: `Versionen ${versionId} finns inte.` };
    }

    if (!this.writeVersions(guideId, { ...held, current: versionId })) {
      return { success: false, message: "Den publicerade versionen kunde inte sparas." };
    }

    return { success: true, current: versionId };
  }
}
