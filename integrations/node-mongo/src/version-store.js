/**
 * The eight verbs, over an ordinary MongoDB collection.
 *
 * ## What this example is for
 *
 * Not to show that Mongo can hold JSON. It is to show that the *storage is the
 * only part that changes* — the version list, the intents, the two marks and
 * every decision about what publishing means are all somewhere else, and none
 * of them knows this file exists.
 *
 * The route scheme in `routes.js` is character for character the one the
 * Sitevision module already speaks. A host that has one can point at the other
 * without touching a line of its client.
 *
 * ## What it is allowed to be simpler about
 *
 * The Sitevision store slices a guide across numbered properties because a data
 * store record caps a value at 5000 characters and a record at 50 properties.
 * There is nothing like that here: the graph is a subdocument, whole. That is
 * worth noticing rather than being pleased about — it is the clearest way to
 * see which parts of that file were the platform's problem and which were ours.
 *
 * ## What it is allowed to be harder about
 *
 * Two editors. `updateVersion` takes the `savedAt` the caller believed it was
 * writing over, and refuses when the document has moved on. Neither of the
 * other two storages can be asked that question: one is a browser's own
 * `localStorage`, the other is a settings dialog only one person can have open,
 * so the check had nowhere to fail and nothing to prove.
 */

/** Thrown when somebody else wrote first. The route turns it into a 409. */
export class VersionConflict extends Error {
  constructor(current) {
    super("The version has been changed by someone else.");
    this.name = "VersionConflict";
    this.current = current;
  }
}

/** What a list needs, and no guide. */
function summary(document_) {
  return {
    id: String(document_._id),
    name: document_.label ?? "",
    note: document_.note ?? "",
    lastModified: document_.savedAt ?? 0,
  };
}

/**
 * A store over one collection.
 *
 * The collection is handed in rather than opened here, so the tests can pass
 * something that behaves like one and CI needs no database. It is the same
 * shape the Sitevision store is tested through, for the same reason.
 */
export function versionStore(collection, { now = () => Date.now(), toId = (id) => id } = {}) {
  /*
   * The id a caller gets back has to be an id a caller can hand in.
   *
   * Mongo's `_id` is an `ObjectId`, and `summary()` turns it into a string
   * because that is what travels through JSON and into a list's markup. Feed
   * that string back and `findOne` matches nothing — a store that gives out
   * keys its own door will not take.
   *
   * Found by running it against a real mongod. The fake had agreed with the
   * mistake, because a fake agrees with whatever its author believed, and the
   * routes hid it by converting on the way past.
   */
  const key = (id) => toId(id);

  /*
   * Renaming and annotating do not touch `savedAt`.
   *
   * It is the guide's timestamp, not the row's. Bumping it here would make
   * every rename look like an edit to the list, and — worse — would collide
   * with a concurrent save that had every right to succeed.
   */
  const set = async (id, fields) => {
    const saved = await collection.findOneAndUpdate(
      { _id: key(id) },
      { $set: fields },
      { returnDocument: "after" }
    );

    if (!saved) {
      throw new Error("The version no longer exists.");
    }

    return summary(saved);
  };

  return {
    /**
     * This space's versions, newest first.
     *
     * Sorted by the database, not in memory, and the index in `server.js` is
     * what makes that cheap. The Sitevision store sorts in code because its
     * store can only iterate; here that would be throwing away the one thing a
     * database is for.
     */
    async list(space) {
      const documents = await collection
        .find({ space: String(space) })
        .sort({ savedAt: -1 })
        .toArray();

      return documents.map(summary);
    },

    async read(id) {
      const held = await collection.findOne({ _id: key(id) });

      return held?.graph ?? null;
    },

    async add(space, name, graph) {
      const document_ = {
        space: String(space),
        label: name ?? "",
        note: "",
        savedAt: now(),
        graph,
      };
      const { insertedId } = await collection.insertOne(document_);

      return summary({ ...document_, _id: insertedId });
    },

    /**
     * Writes the guide into a version that already exists.
     *
     * `knownSavedAt` is the whole of the concurrency story. Passing it says *I
     * am replacing the version I read*; leaving it out says *I do not care what
     * is there*, which is a legitimate thing for a first import to say and the
     * wrong thing for an editor's save to say.
     *
     * The check and the write are one operation, deliberately. Reading first
     * and then writing leaves a gap wide enough for the other editor to fit
     * through, and a check with a gap in it reads as safety while being none.
     */
    async update(id, graph, knownSavedAt) {
      const filter =
        knownSavedAt === undefined
          ? { _id: key(id) }
          : { _id: key(id), savedAt: knownSavedAt };

      const saved = await collection.findOneAndUpdate(
        filter,
        { $set: { graph, savedAt: now() } },
        { returnDocument: "after" }
      );

      if (!saved) {
        const current = await collection.findOne({ _id: key(id) });

        if (!current) {
          throw new Error("The version no longer exists.");
        }
        throw new VersionConflict(summary(current));
      }

      return summary(saved);
    },

    /**
     * A copy of what is *stored*, not of what an editor is holding.
     *
     * Branching from last month's version and snapshotting today's work are
     * different acts, and a copy that quietly took the editor's unsaved changes
     * would be the second one wearing the first one's name.
     */
    async copy(id, name) {
      const held = await collection.findOne({ _id: key(id) });

      if (!held) {
        throw new Error("The version no longer exists.");
      }

      const { _id, ...rest } = held;
      const document_ = { ...rest, label: name ?? "", note: "", savedAt: now() };
      const { insertedId } = await collection.insertOne(document_);

      return summary({ ...document_, _id: insertedId });
    },

    async rename(id, name) {
      return set(id, { label: name ?? "" });
    },

    /** The note belongs to the version, so it is stored with it. */
    async note(id, note) {
      return set(id, { note: note ?? "" });
    },

    /**
     * Really removes it.
     *
     * The opposite of the file store in the Sitevision example, and for a
     * reason worth repeating: a file belongs to an archive somebody else
     * maintains, and a row here belongs to this module and to nothing else.
     * Leaving it would be litter in a place no editor can open.
     */
    async remove(id) {
      const gone = await collection.findOneAndDelete({ _id: key(id) });

      return gone ? summary(gone) : null;
    },
  };
}
