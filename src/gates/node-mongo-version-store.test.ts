/**
 * The Node/Mongo example's store, against a collection that is not one.
 *
 * ## Why a fake and not a database
 *
 * Because the thing worth pinning is not that Mongo works. It is that the eight
 * verbs behave the same as the other host's — and above all that the one
 * behaviour no other storage in this repository can have is right: a save that
 * would overwrite somebody else's work fails instead of succeeding quietly.
 *
 * A real Mongo would prove the driver. A fake proves the decisions, runs in
 * milliseconds, and lets this sit in CI beside everything else rather than
 * behind a service somebody has to remember to start.
 *
 * The fake implements only what the store actually calls, deliberately. Every
 * method it grows is a claim about Mongo that nothing checks.
 */

import { describe, expect, it } from "vitest";

import {
  VersionConflict,
  versionStore,
} from "../../integrations/node-mongo/src/version-store.js";

interface Document_ {
  _id: string;
  space: string;
  label: string;
  note: string;
  savedAt: number;
  graph: unknown;
}

/** As much of a collection as this store asks for, and no more. */
function fakeCollection() {
  const documents: Document_[] = [];
  let next = 1;

  const matches = (document_: Document_, filter: Record<string, unknown>) =>
    Object.entries(filter).every(
      ([key, value]) => (document_ as unknown as Record<string, unknown>)[key] === value
    );

  return {
    documents,

    async insertOne(document_: Omit<Document_, "_id">) {
      const stored = { ...document_, _id: `id${next++}` } as Document_;

      documents.push(stored);
      return { insertedId: stored._id };
    },

    async findOne(filter: Record<string, unknown>) {
      return documents.find((d) => matches(d, filter)) ?? null;
    },

    find(filter: Record<string, unknown>) {
      const hits = documents.filter((d) => matches(d, filter));

      return {
        sort(order: Record<string, number>) {
          const [field, direction] = Object.entries(order)[0];
          const sorted = [...hits].sort(
            (one, other) =>
              (((other as unknown as Record<string, number>)[field] ?? 0) -
                ((one as unknown as Record<string, number>)[field] ?? 0)) *
              (direction < 0 ? 1 : -1)
          );

          return { async toArray() { return sorted; } };
        },
      };
    },

    async findOneAndUpdate(
      filter: Record<string, unknown>,
      update: { $set: Partial<Document_> }
    ) {
      const held = documents.find((d) => matches(d, filter));

      if (!held) {
        return null;
      }
      Object.assign(held, update.$set);
      return held;
    },

    async findOneAndDelete(filter: Record<string, unknown>) {
      const at = documents.findIndex((d) => matches(d, filter));

      return at === -1 ? null : documents.splice(at, 1)[0];
    },
  };
}

/** A clock that only moves when a test says so. */
function clock(start = 1000) {
  let value = start;

  return { now: () => value, tick: (by = 1) => (value += by) };
}

const guide = (title: string) => ({
  startNodeId: "q",
  nodes: [{ id: "q", type: "question", data: { title: { sv: title } } }],
  connections: [],
});

describe("the Node and Mongo example's store", () => {
  it("gives back the guide it was handed", async () => {
    const collection = fakeCollection();
    const store = versionStore(collection, { now: clock().now });

    const made = await store.add("space-1", "Bostadsbidrag", guide("Bor du här?"));

    expect(await store.read(made.id)).toEqual(guide("Bor du här?"));
    // Whole, not sliced: there is no property ceiling to work around here.
    expect(collection.documents[0].graph).toEqual(guide("Bor du här?"));
  });

  it("lists one space's versions, newest first", async () => {
    const collection = fakeCollection();
    const time = clock();
    const store = versionStore(collection, { now: time.now });

    await store.add("space-1", "Äldst", guide("a"));
    time.tick(10);
    await store.add("space-1", "Nyast", guide("b"));
    time.tick(10);
    await store.add("space-2", "Någon annans", guide("c"));

    expect((await store.list("space-1")).map((version) => version.name)).toEqual([
      "Nyast",
      "Äldst",
    ]);
  });

  /*
   * The reason this example exists.
   *
   * Two editors cannot be simulated in `localStorage` or in a settings dialog
   * only one person can have open, so this check had nowhere to fail until
   * there was a server. Here it can, and does.
   */
  it("refuses a save that would overwrite work it never saw", async () => {
    const collection = fakeCollection();
    const time = clock();
    const store = versionStore(collection, { now: time.now });
    const made = await store.add("space-1", "Delad", guide("original"));

    // Somebody else saves first.
    time.tick(5);
    await store.update(made.id, guide("theirs"), made.lastModified);

    // We are still holding the timestamp we read before they did.
    time.tick(5);
    await expect(store.update(made.id, guide("mine"), made.lastModified)).rejects
      .toBeInstanceOf(VersionConflict);

    // And what is stored is theirs, untouched by the attempt.
    expect(await store.read(made.id)).toEqual(guide("theirs"));
  });

  it("hands back what is there now, so a person can choose", async () => {
    const collection = fakeCollection();
    const time = clock();
    const store = versionStore(collection, { now: time.now });
    const made = await store.add("space-1", "Delad", guide("original"));

    time.tick(5);
    const theirs = await store.update(made.id, guide("theirs"), made.lastModified);

    await expect(
      store.update(made.id, guide("mine"), made.lastModified)
    ).rejects.toMatchObject({ current: { lastModified: theirs.lastModified } });
  });

  it("lets a caller say it does not care what is there", async () => {
    const collection = fakeCollection();
    const time = clock();
    const store = versionStore(collection, { now: time.now });
    const made = await store.add("space-1", "Delad", guide("original"));

    time.tick(5);
    await store.update(made.id, guide("theirs"), made.lastModified);

    // No `knownSavedAt`: last write wins, which is a choice and not a default.
    await store.update(made.id, guide("mine"));

    expect(await store.read(made.id)).toEqual(guide("mine"));
  });

  it("copies what is stored, under a new name and a new id", async () => {
    const store = versionStore(fakeCollection(), { now: clock().now });
    const made = await store.add("space-1", "Original", guide("stored"));
    const copy = await store.copy(made.id, "Kopia");

    expect(copy.id).not.toBe(made.id);
    expect(copy.name).toBe("Kopia");
    expect(await store.read(copy.id)).toEqual(guide("stored"));
    expect(await store.read(made.id)).toEqual(guide("stored"));
    // A copy starts without the note that explained why the original was kept.
    expect(copy.note).toBe("");
  });

  /*
   * `savedAt` is the guide's timestamp, not the row's.
   *
   * If renaming moved it, every rename would look like an edit in the list —
   * and worse, would collide with a concurrent save that had every right to
   * succeed.
   */
  it("does not age a version by renaming or annotating it", async () => {
    const time = clock();
    const store = versionStore(fakeCollection(), { now: time.now });
    const made = await store.add("space-1", "Namn", guide("a"));

    time.tick(100);
    const renamed = await store.rename(made.id, "Annat namn");
    const noted = await store.note(made.id, "Före regeländringen");

    expect(renamed.lastModified).toBe(made.lastModified);
    expect(noted.lastModified).toBe(made.lastModified);
    expect(noted.note).toBe("Före regeländringen");

    // And the save that was in flight all along still goes through.
    await expect(
      store.update(made.id, guide("b"), made.lastModified)
    ).resolves.toMatchObject({ id: made.id });
  });

  it("really removes, and says what it removed", async () => {
    const collection = fakeCollection();
    const store = versionStore(collection, { now: clock().now });
    const made = await store.add("space-1", "Tillfällig", guide("a"));

    expect((await store.remove(made.id))?.name).toBe("Tillfällig");
    expect(collection.documents).toHaveLength(0);
    expect(await store.remove(made.id)).toBeNull();
  });
});
