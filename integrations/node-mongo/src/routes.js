import { Router } from "express";

import { VersionConflict } from "./version-store.js";

/**
 * The routes, and why they look like somebody else's.
 *
 * | Verb   | Route                      | What it is                          |
 * | ------ | -------------------------- | ----------------------------------- |
 * | GET    | `/versions?space=…`        | The list, without the guides         |
 * | GET    | `/versions/:id`            | One guide                            |
 * | POST   | `/versions`                | A new version holding the guide      |
 * | POST   | `/versions/:id`            | Write the guide into it              |
 * | POST   | `/versions/:id/copy`       | A new version from what is stored    |
 * | POST   | `/versions/:id/name`       | The name, not the guide              |
 * | POST   | `/versions/:id/note`       | The note                             |
 * | POST   | `/versions/:id/remove`     | Delete, and it means it              |
 *
 * ## Why POST for things that are not creations
 *
 * Because the Sitevision module cannot send anything else. Its settings dialog
 * reaches its own routes through `requester`, which offers `doGet` and
 * `doPost`, and a verb the client cannot send is a verb the route may as well
 * not have.
 *
 * Copying that constraint into a plain Node server would be cargo cult, so this
 * one **also** answers the verbs a host without that limit would reach for:
 * `PUT /versions/:id` and `DELETE /versions/:id` do exactly what their POST
 * spellings do. The point of the example is that one storage can serve both
 * clients unchanged — not that everyone should live inside Sitevision's
 * constraints.
 *
 * ## Optimistic concurrency
 *
 * A save may carry `knownSavedAt`, the timestamp of the version the editor read
 * before typing. If the document has moved on since, the route answers **409**
 * with what is there now, and the client gets to decide — overwrite, reload, or
 * save as a copy. That decision is the host's, which is why the route hands
 * back the current version instead of choosing.
 *
 * The Sitevision client does not send it yet. It costs nothing to ignore and
 * cannot be added later without a server that understands it, which is the
 * order these things have to happen in.
 */
export function versionRoutes(store) {
  const router = Router();

  /*
   * One place that turns a thrown thing into a status.
   *
   * The store speaks in exceptions because that is what a failed write is; the
   * routes speak in codes because that is what a client can act on. Keeping the
   * translation in one function is what stops a conflict from arriving as a 500
   * on the one route somebody forgot.
   */
  const answering = (handler) => async (request, response) => {
    try {
      response.json(await handler(request));
    } catch (error) {
      if (error instanceof VersionConflict) {
        response.status(409).json({ error: error.message, current: error.current });
        return;
      }
      response.status(500).json({ error: error.message });
    }
  };

  /**
   * The guide arrives as a string.
   *
   * Not because JSON cannot nest — it obviously can — but because the guide
   * then survives every transport the same way. The Sitevision module sends it
   * as a string for that reason and this accepts both, so a client written for
   * either works here.
   */
  const graphFrom = (body) => {
    const raw = body?.graph;

    if (!raw) {
      throw new Error("The request carried no guide.");
    }
    if (typeof raw !== "string") {
      return raw;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(`The guide in the request is not valid JSON: ${error.message}`);
    }
  };

  router.get(
    "/versions",
    answering(async (request) => {
      const { space } = request.query;

      if (!space) {
        throw new Error("The request carried no space.");
      }
      return { versions: await store.list(space) };
    })
  );

  router.post(
    "/versions",
    answering(async (request) => {
      const { space, name } = request.body ?? {};

      if (!space) {
        throw new Error("The request carried no space.");
      }
      return {
        created: true,
        version: await store.add(space, name, graphFrom(request.body)),
      };
    })
  );

  router.post(
    "/versions/:id/copy",
    answering(async (request) => ({
      created: true,
      version: await store.copy(request.params.id, request.body?.name),
    }))
  );

  router.post(
    "/versions/:id/name",
    answering(async (request) => {
      const { name } = request.body ?? {};

      if (!name) {
        throw new Error("No new name was given.");
      }
      return { renamed: true, version: await store.rename(request.params.id, name) };
    })
  );

  /** An empty note is a note being cleared, so it is not a missing value. */
  router.post(
    "/versions/:id/note",
    answering(async (request) => ({
      noted: true,
      version: await store.note(request.params.id, request.body?.note ?? ""),
    }))
  );

  const remove = answering(async (request) => ({
    removed: true,
    version: await store.remove(request.params.id),
  }));

  router.post("/versions/:id/remove", remove);
  router.delete("/versions/:id", remove);

  const save = answering(async (request) => ({
    saved: true,
    version: await store.update(
      request.params.id,
      graphFrom(request.body),
      request.body?.knownSavedAt
    ),
  }));

  router.post("/versions/:id", save);
  router.put("/versions/:id", save);

  router.get(
    "/versions/:id",
    answering(async (request) => ({
      graph: (await store.read(request.params.id)) ?? null,
    }))
  );

  return router;
}
