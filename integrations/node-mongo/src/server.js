import express from "express";
import { MongoClient, ObjectId } from "mongodb";

import { versionRoutes } from "./routes.js";
import { versionStore } from "./version-store.js";

/**
 * The wiring, and the three lines in it that are decisions.
 *
 * Everything else here is what any Express server looks like. These are not:
 *
 * 1. **The index.** `{ space: 1, savedAt: -1 }` is exactly the query the list
 *    makes, and without it the database reads every version on the site to draw
 *    ten rows. It is one line and it is the difference between an example and
 *    an example somebody could run.
 *
 * 2. **CORS.** Off by default. An example that shipped with it open would be
 *    copied with it open, and this is a server that answers *write this over
 *    the guide people are reading*. Set `FLOWWEAVER_ORIGIN` to allow the one
 *    page that should reach it.
 *
 * 3. **No authentication at all.** Deliberate, and stated rather than implied:
 *    who may write is the host system's question and every host answers it
 *    differently — a session in a CMS, a token at a gateway, a header from a
 *    reverse proxy. Wiring one of them in here would teach a way of doing it
 *    that suits nobody's installation. Put this behind whatever already knows
 *    who your editors are.
 */

const URL = process.env.MONGODB_URL ?? "mongodb://localhost:27017";
const DATABASE = process.env.MONGODB_DATABASE ?? "flowweaver";
const PORT = Number(process.env.PORT ?? 4500);
const ORIGIN = process.env.FLOWWEAVER_ORIGIN;

export async function createServer() {
  const client = new MongoClient(URL);

  await client.connect();

  const collection = client.db(DATABASE).collection("versions");

  await collection.createIndex({ space: 1, savedAt: -1 });

  const app = express();

  app.use(express.json({ limit: "4mb" }));

  if (ORIGIN) {
    app.use((request, response, next) => {
      response.setHeader("Access-Control-Allow-Origin", ORIGIN);
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");
      response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE");
      if (request.method === "OPTIONS") {
        response.sendStatus(204);
        return;
      }
      next();
    });
  }

  /*
   * An id that does not parse is a 404, not a crash.
   *
   * `new ObjectId("nonsense")` throws, and it throws in the router before any
   * handler runs. Turning it into an id nothing matches lets the ordinary
   * "no such version" path answer, which is what a client can act on.
   */
  const toId = (id) => {
    try {
      return new ObjectId(String(id));
    } catch {
      return new ObjectId("000000000000000000000000");
    }
  };

  app.use(versionRoutes(versionStore(collection, { toId })));

  app.get("/ping", (_request, response) => response.json({ ok: true }));

  return { app, client };
}

/*
 * Started only when run directly, so the tests can import the parts without a
 * process listening on a port.
 */
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const { app } = await createServer();

  app.listen(PORT, () => {
    console.log(`Flowweaver versions on http://localhost:${PORT}`);
  });
}
