/**
 * The browser half: the eight verbs, over `fetch`.
 *
 * This is the whole of what a page needs in order to put `<guide-versions>`
 * over the server next door. Forty lines, and the list above it never learns
 * which of them it got — the same claim the Sitevision module makes with three
 * implementations, made again here with a fourth in a different runtime.
 *
 * Paste it into your own page, point `base` at your server, and hand the
 * element what `list()` returns. Answering its intents is the part that is
 * yours: what publishing means, whether removing asks first, where the draft
 * lives. None of that is storage, which is why none of it is in this file.
 */

/** A version's own shape, as the list wants it: `{ id, name, note, lastModified }`. */
export function versionStore({ base = "", space }) {
  /*
   * One place that turns a failed request into a sentence.
   *
   * A store that threw the raw `Response` would push status codes into every
   * handler above it, and a store that swallowed them would leave *nothing
   * happened* as the only symptom. The server sends its own sentence in
   * `error`; keeping it is the whole value of the round trip.
   */
  const call = async (method, path, body) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const answer = await response.json().catch(() => ({}));

    if (!response.ok) {
      /*
       * A conflict is not an error to report and forget. It carries the version
       * that is there now, so whoever catches it can offer the only three
       * answers that exist: take mine, take theirs, keep both.
       */
      const error = new Error(answer.error ?? `${response.status} from ${path}`);

      error.status = response.status;
      error.current = answer.current;
      throw error;
    }

    return answer;
  };

  const at = (id, tail = "") => `/versions/${encodeURIComponent(id)}${tail}`;

  return {
    async list() {
      return (await call("GET", `/versions?space=${encodeURIComponent(space)}`)).versions;
    },

    async read(id) {
      return (await call("GET", at(id))).graph;
    },

    async add(name, graph) {
      return (await call("POST", "/versions", { space, name, graph })).version;
    },

    /**
     * `knownSavedAt` is what makes a second editor visible.
     *
     * Pass the `lastModified` the row carried when it was opened and a save
     * that would overwrite somebody else's work fails with a 409 instead of
     * succeeding quietly. Leave it out and the last write wins, which is a
     * choice rather than a default — make it deliberately.
     */
    async update(id, graph, knownSavedAt) {
      return (await call("PUT", at(id), { graph, knownSavedAt })).version;
    },

    async copy(id, name) {
      return (await call("POST", at(id, "/copy"), { name })).version;
    },

    async rename(id, name) {
      return (await call("POST", at(id, "/name"), { name })).version;
    },

    async note(id, note) {
      return (await call("POST", at(id, "/note"), { note })).version;
    },

    async remove(id) {
      await call("DELETE", at(id));
    },
  };
}
