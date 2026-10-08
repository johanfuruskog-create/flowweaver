import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";

import { VersionConflict, versionStore } from "../src/version-store.js";

/**
 * The same store, against a real mongod.
 *
 * ## Why this exists when a fake already passes
 *
 * Because the fake agrees with whatever I believed about the driver, and one of
 * those beliefs is load-bearing: **the driver's version decides what
 * `findOneAndUpdate` hands back.** Up to mongodb 5 it returned a result object
 * with the document under `value`; from 6 it returns the document itself. The
 * store reads it directly, so on an older driver every save would look like a
 * conflict — the check would say *somebody else wrote first* about nobody, and
 * it would say it in the one place where being wrong is expensive.
 *
 * A fake cannot catch that. A real mongod can, and this is what it is for.
 *
 * The binary is downloaded once by `mongodb-memory-server` and cached. That is
 * why this file is not in the main repository's suite: CI there stays free of
 * anything that has to be fetched before it can run.
 */

let mongo;
let client;
let collection;

before(async () => {
  mongo = await MongoMemoryServer.create();
  client = new MongoClient(mongo.getUri());
  await client.connect();
  collection = client.db("flowweaver-test").collection("versions");
  await collection.createIndex({ space: 1, savedAt: -1 });
});

after(async () => {
  await client?.close();
  await mongo?.stop();
});

/*
 * Built the way `server.js` builds it, `toId` and all.
 *
 * Leaving it out is what the first run of this file did, and every id came
 * back as a string that matched nothing. That is the whole reason the
 * conversion belongs to the store rather than to the routes: a caller that
 * forgets it gets silence, not an error.
 */
const storeOn = (collection) =>
  versionStore(collection, { toId: (id) => new ObjectId(String(id)) });

const guide = (title) => ({
  startNodeId: "q",
  nodes: [{ id: "q", type: "question", data: { title: { sv: title } } }],
  connections: [],
});

test("a guide survives the round trip whole", async () => {
  const store = storeOn(collection);
  const made = await store.add("space-1", "Bostadsbidrag", guide("Bor du här?"));

  assert.deepEqual(await store.read(made.id), guide("Bor du här?"));
});

/*
 * The assertion the fake could not make.
 *
 * If `findOneAndUpdate` returned something the store does not understand, this
 * throws a conflict where none exists — which is exactly the failure that would
 * otherwise be found by an editor, in production, being told their own save was
 * somebody else's.
 */
test("a save with the right timestamp goes through", async () => {
  const store = storeOn(collection);
  const made = await store.add("space-1", "Delad", guide("original"));
  const saved = await store.update(made.id, guide("changed"), made.lastModified);

  assert.equal(saved.id, made.id);
  assert.deepEqual(await store.read(made.id), guide("changed"));
});

test("and a save with a stale one does not", async () => {
  const store = storeOn(collection);
  const made = await store.add("space-1", "Delad", guide("original"));

  await store.update(made.id, guide("theirs"), made.lastModified);

  await assert.rejects(
    () => store.update(made.id, guide("mine"), made.lastModified),
    (error) => {
      assert.ok(error instanceof VersionConflict);
      assert.equal(typeof error.current.lastModified, "number");
      return true;
    }
  );

  assert.deepEqual(await store.read(made.id), guide("theirs"));
});

test("the index carries the sort the list asks for", async () => {
  const store = storeOn(collection);
  const space = `space-${Date.now()}`;

  await store.add(space, "Först", guide("a"));
  await new Promise((resolve) => setTimeout(resolve, 5));
  await store.add(space, "Sedan", guide("b"));

  const plan = await collection
    .find({ space })
    .sort({ savedAt: -1 })
    .explain("queryPlanner");

  const stage = JSON.stringify(plan.queryPlanner?.winningPlan ?? plan);

  // An index scan, not a collection scan and not an in-memory sort. Without it
  // the list reads every version on the site to draw ten rows.
  assert.ok(stage.includes("IXSCAN"), `expected an index scan, plan was ${stage}`);
  assert.ok(!stage.includes("SORT"), `expected no in-memory sort, plan was ${stage}`);
});

test("renaming does not age the version", async () => {
  const store = storeOn(collection);
  const made = await store.add("space-1", "Namn", guide("a"));
  const renamed = await store.rename(made.id, "Annat namn");

  assert.equal(renamed.lastModified, made.lastModified);

  // So the save that was already in flight still succeeds.
  const saved = await store.update(made.id, guide("b"), made.lastModified);

  assert.equal(saved.id, made.id);
});

test("removing takes the row and leaves the rest", async () => {
  const store = storeOn(collection);
  const space = `space-${Date.now()}-remove`;
  const first = await store.add(space, "Går", guide("a"));

  await store.add(space, "Stannar", guide("b"));
  assert.equal((await store.remove(first.id))?.name, "Går");
  assert.deepEqual(
    (await store.list(space)).map((version) => version.name),
    ["Stannar"]
  );
});
