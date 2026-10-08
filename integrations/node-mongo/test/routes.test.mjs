import assert from "node:assert/strict";
import test from "node:test";

import express from "express";

import { versionRoutes } from "../src/routes.js";
import { versionStore } from "../src/version-store.js";

/**
 * The HTTP half, run for real.
 *
 * The store's own decisions are pinned in the main repository, against a fake
 * collection. This is the other half: Express, the JSON body, the status codes,
 * and above all that a conflict arrives as **409 with the current version in
 * the body** rather than as a 500 with a sentence.
 *
 * `node --test` and nothing else. A copy of this folder should be runnable by
 * whoever copied it, without adopting a test framework they did not choose.
 *
 * There is no database here either. What a driver does is MongoDB's business;
 * what this example claims is the shape of the answers.
 */

/** As much of a collection as the store asks for. */
function fakeCollection() {
  const documents = [];
  let next = 1;
  const matches = (document_, filter) =>
    Object.entries(filter).every(([key, value]) => document_[key] === value);

  return {
    documents,
    async insertOne(document_) {
      const stored = { ...document_, _id: `id${next++}` };

      documents.push(stored);
      return { insertedId: stored._id };
    },
    async findOne(filter) {
      return documents.find((d) => matches(d, filter)) ?? null;
    },
    find(filter) {
      const hits = documents.filter((d) => matches(d, filter));

      return {
        sort(order) {
          const [field, direction] = Object.entries(order)[0];
          const sorted = [...hits].sort(
            (one, other) => (other[field] - one[field]) * (direction < 0 ? 1 : -1)
          );

          return { async toArray() { return sorted; } };
        },
      };
    },
    async findOneAndUpdate(filter, update) {
      const held = documents.find((d) => matches(d, filter));

      if (!held) return null;
      Object.assign(held, update.$set);
      return held;
    },
    async findOneAndDelete(filter) {
      const at = documents.findIndex((d) => matches(d, filter));

      return at === -1 ? null : documents.splice(at, 1)[0];
    },
  };
}

const guide = (title) => ({
  startNodeId: "q",
  nodes: [{ id: "q", type: "question", data: { title: { sv: title } } }],
  connections: [],
});

/** Starts the app on an ephemeral port and hands back a caller and a stop. */
async function serving() {
  let clock = 1000;
  const app = express();

  app.use(express.json({ limit: "4mb" }));
  app.use(versionRoutes(versionStore(fakeCollection(), { now: () => clock })));

  const server = app.listen(0);

  await new Promise((resolve) => server.once("listening", resolve));

  const base = `http://localhost:${server.address().port}`;

  return {
    tick: (by = 5) => (clock += by),
    async call(method, path, body) {
      const response = await fetch(base + path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      return { status: response.status, body: await response.json() };
    },
    stop: () => new Promise((resolve) => server.close(resolve)),
  };
}

test("a version is created, listed and read back", async () => {
  const { call, stop } = await serving();

  try {
    const made = await call("POST", "/versions", {
      space: "s1",
      name: "Bostadsbidrag",
      // Sent as a string, the way the Sitevision client sends it.
      graph: JSON.stringify(guide("Bor du här?")),
    });

    assert.equal(made.status, 200);
    assert.equal(made.body.version.name, "Bostadsbidrag");

    const listed = await call("GET", "/versions?space=s1");

    assert.deepEqual(
      listed.body.versions.map((version) => version.name),
      ["Bostadsbidrag"]
    );

    const read = await call("GET", `/versions/${made.body.version.id}`);

    assert.deepEqual(read.body.graph, guide("Bor du här?"));
  } finally {
    await stop();
  }
});

test("a save over someone else's work is a 409, with theirs in the body", async () => {
  const { call, tick, stop } = await serving();

  try {
    const made = await call("POST", "/versions", {
      space: "s1",
      name: "Delad",
      graph: guide("original"),
    });
    const mine = made.body.version.lastModified;

    tick();
    const theirs = await call("PUT", `/versions/${made.body.version.id}`, {
      graph: guide("theirs"),
      knownSavedAt: mine,
    });

    assert.equal(theirs.status, 200);

    tick();
    const clash = await call("PUT", `/versions/${made.body.version.id}`, {
      graph: guide("mine"),
      knownSavedAt: mine,
    });

    assert.equal(clash.status, 409);
    // The body carries what is there now, so a person can be offered a choice.
    assert.equal(clash.body.current.lastModified, theirs.body.version.lastModified);

    const read = await call("GET", `/versions/${made.body.version.id}`);

    assert.deepEqual(read.body.graph, guide("theirs"));
  } finally {
    await stop();
  }
});

test("the other four verbs answer, and removing means it", async () => {
  const { call, stop } = await serving();

  try {
    const made = await call("POST", "/versions", {
      space: "s1",
      name: "Original",
      graph: guide("a"),
    });
    const id = made.body.version.id;

    assert.equal((await call("POST", `/versions/${id}/name`, { name: "Nytt" })).body.version.name, "Nytt");
    assert.equal(
      (await call("POST", `/versions/${id}/note`, { note: "Före regeländringen" })).body.version.note,
      "Före regeländringen"
    );
    assert.equal((await call("POST", `/versions/${id}/copy`, { name: "Kopia" })).body.version.name, "Kopia");
    assert.equal((await call("DELETE", `/versions/${id}`)).status, 200);

    // The copy is still there; only the one that was asked for went.
    assert.deepEqual(
      (await call("GET", "/versions?space=s1")).body.versions.map((v) => v.name),
      ["Kopia"]
    );
  } finally {
    await stop();
  }
});

test("a guide that is not there is not an error", async () => {
  const { call, stop } = await serving();

  try {
    const read = await call("GET", "/versions/nothing-like-this");

    // A freshly created version and one that never existed both arrive here,
    // and both mean "start a new one".
    assert.equal(read.status, 200);
    assert.equal(read.body.graph, null);
  } finally {
    await stop();
  }
});
