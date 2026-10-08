/**
 * The receiver's register: one row per thing this host has taken in.
 *
 * ## Why a key-value table and not a schema per thing
 *
 * An errand is the first thing worth keeping, but it will not be the last:
 * guides, versions and templates are all "a blob of JSON with an id", and they
 * are coming. Given a table per kind, each of them costs a migration, a
 * second set of read and write functions, and a second place where "tidy the
 * old ones" has to be remembered. Given one table, a new kind is a new value
 * in a column — `kind = 'guide'` beside `kind = 'case'` — and everything in
 * this file already works on it.
 *
 * So the schema is deliberately thin: `<kind>/<id>` as the key, JSON as the
 * value, two timestamps. The *shape* of the value is decided by whoever writes
 * that kind, and it is written down in `docs/UPPDRAG-2026-09-15-GLESYS.md`
 * under the form of step 6 rather than enforced here — the same stance the
 * receiver takes toward the submission payload, which it judges but does not
 * schema-check.
 *
 * ## What it is not
 *
 * Not a read API. Nothing over HTTP reads this, because reading somebody's
 * errand requires knowing who is asking, and identity is a later question with
 * a much larger answer. The only reader is `cases.mjs`, run in a terminal on
 * the machine that owns the file.
 *
 * Not a second copy of the outbox either. The outbox file is the **delivery**
 * — what was sent, in the form it was sent. The row is the **errand** — what
 * was received. They hold overlapping text and answer different questions, and
 * `cases.mjs remove` takes both so that tidying one never leaves the other.
 *
 * ## Node's SQLite, and the two things that are measured
 *
 * `node:sqlite` from Ubuntu's own Node 22.22 on the server (SQLite 3.46.1,
 * measured 16/9), so the whole layer costs zero npm dependencies. Two details
 * were measured there rather than assumed:
 *
 *  - **`VACUUM INTO` for the backup, not `backup()`.** `DatabaseSync` has no
 *    `backup` method on that Node; the module exports a `backup()` *function*,
 *    but it is asynchronous and takes a database plus a path, while
 *    `VACUUM INTO` is one statement that writes a compacted copy and works the
 *    same on every version either machine has.
 *  - **A fresh file is created 0644 by the receiver's umask**, which would
 *    leave `johan` able to read the register but not to prune it. So a file
 *    this module creates gets group write, matching the outbox directory: the
 *    person tidying up does it without `sudo`, as the runbook promises.
 */
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * One table. A second kind of thing is a new `kind`, never a second table —
 * that is the whole point of the shape.
 */
const SCHEMA = `
create table if not exists entries (
  key        text primary key,
  kind       text not null,
  value      text not null,
  created_at text not null,
  updated_at text not null
);
create index if not exists entries_by_kind on entries (kind, created_at);
`;

/** Stamped into the file so a future change can tell what it is opening. */
export const SCHEMA_VERSION = 1;

/** `case/FW-260915-1011` — the kind is half the key, so a prefix scan is free. */
export function entryKey(kind, id) {
  return `${kind}/${id}`;
}

const nowIso = () => new Date().toISOString();

/**
 * Open the register at `file`, or answer `null` when there is no path.
 *
 * An empty path is not a fault: the receiver runs without a register exactly
 * as it runs without a Resend key, and both are configured by a line in `.env`
 * that may simply not be there. A path that cannot be opened *is* a fault and
 * throws — the caller decides whether that stops the process or is logged and
 * survived.
 */
export function openStore(file) {
  const path = String(file ?? "").trim();

  if (path === "") {
    return null;
  }

  const fresh = !existsSync(path);

  mkdirSync(dirname(path), { recursive: true });

  const db = new DatabaseSync(path);

  /*
   * Two processes share this file: the receiver writes a row when an errand
   * arrives, and `cases.mjs` reads or tidies whenever somebody is logged in.
   * SQLite's default is to fail a locked write instantly, so a tidy that
   * happened to coincide with an errand would simply error — rare, confusing,
   * and entirely avoidable. Five seconds is far longer than any write here
   * takes and far shorter than a person's patience.
   */
  db.exec("pragma busy_timeout = 5000");
  db.exec(SCHEMA);
  db.exec(`pragma user_version = ${SCHEMA_VERSION}`);

  if (fresh) {
    // See the header: without this the register is readable but not tidyable
    // by the person the runbook sends to tidy it.
    chmodSync(path, 0o660);
  }

  /** A stored row as the rest of the program wants it: id split out, value parsed. */
  const asEntry = (row) => ({
    key: row.key,
    kind: row.kind,
    id: String(row.key).slice(String(row.kind).length + 1),
    value: (() => {
      try {
        return JSON.parse(row.value);
      } catch {
        return null;
      }
    })(),
    // The stored text, for a search that reads the value as text and for a
    // `show` that prints what is actually in the file rather than a re-encoded
    // version of it.
    text: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const selectAll = (options = {}) => {
    const where = [];
    const args = [];

    if (options.kind) {
      where.push("kind = ?");
      args.push(options.kind);
    }

    if (options.since) {
      where.push("created_at >= ?");
      args.push(options.since);
    }

    if (options.before) {
      where.push("created_at < ?");
      args.push(options.before);
    }

    /*
     * The text search is done here and not with LIKE, and that is a measured
     * decision rather than a preference.
     *
     * SQLite folds case for ASCII only: against a stored *Ärende om Överby*,
     * `like '%ärende%'` answers nothing while `%trasig%` finds *Trasig*. On a
     * register written in Swedish that is not a limitation, it is a wrong
     * answer — the search says "no errands" about an errand that is there, and
     * nothing on the screen suggests why. JavaScript folds the whole alphabet.
     *
     * The cost is reading the rows that matched the indexed columns first.
     * This is a register that gets pruned at ninety days, read by one person
     * in a terminal, so the rows are few and the query is not in anyone's way.
     */
    const narrow = options.contains ? String(options.contains).toLocaleLowerCase("sv") : "";
    const sql =
      "select * from entries" +
      (where.length > 0 ? ` where ${where.join(" and ")}` : "") +
      " order by created_at desc" +
      // The limit stays in SQL only when SQL can see the whole question.
      // With a text search it has to be applied after the filtering, or a
      // `--limit 5` would cut five rows and then search inside them.
      (options.limit && narrow === "" ? " limit ?" : "");

    if (options.limit && narrow === "") {
      args.push(Number(options.limit));
    }

    const rows = db.prepare(sql).all(...args).map(asEntry);

    if (narrow === "") {
      return rows;
    }

    const hits = rows.filter((entry) => entry.text.toLocaleLowerCase("sv").includes(narrow));

    return options.limit ? hits.slice(0, Number(options.limit)) : hits;
  };

  return {
    file: path,

    /**
     * Write one thing. Writing the same key twice keeps the first
     * `created_at` and moves `updated_at` — the row is the thing, not an
     * event about it.
     *
     * `at` is an argument so a test can place a row in the past; waiting
     * ninety days for the pruning check is not a measurement anybody will
     * take.
     */
    put({ kind, id, value, at = nowIso() }) {
      const key = entryKey(kind, id);

      db.prepare(
        `insert into entries (key, kind, value, created_at, updated_at)
         values (?, ?, ?, ?, ?)
         on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at`,
      ).run(key, kind, JSON.stringify(value), at, at);

      return key;
    },

    /** One row by key, or `null`. */
    get(key) {
      const row = db.prepare("select * from entries where key = ?").get(key);

      return row ? asEntry(row) : null;
    },

    /**
     * Rows, newest first. `kind`, `since` and `contains` narrow it; `contains`
     * is a LIKE over the stored JSON, which is a blunt instrument and says so
     * — it is a person looking for an errand they half remember, not a query
     * language.
     */
    list(options = {}) {
      return selectAll(options);
    },

    /** Remove one row. `false` when there was nothing there. */
    remove(key) {
      return db.prepare("delete from entries where key = ?").run(key).changes > 0;
    },

    /**
     * Everything older than `olderThanDays`, removed, and returned so the
     * caller can tidy what it keeps beside the register.
     *
     * The rows are listed before they are deleted rather than counted after:
     * an errand also has files, and "how many disappeared" does not tell
     * anybody which files to take with them.
     */
    prune({ olderThanDays = 90, kind, now = new Date() } = {}) {
      const before = new Date(now.getTime() - Number(olderThanDays) * 86_400_000).toISOString();
      const doomed = selectAll({ kind, before });

      for (const entry of doomed) {
        db.prepare("delete from entries where key = ?").run(entry.key);
      }

      return doomed;
    },

    /**
     * A complete, compacted copy at `to`. SQLite refuses to write over an
     * existing file, and so does this — a backup that silently replaced
     * yesterday's would be one backup, not two.
     */
    backup(to) {
      const target = String(to);

      if (existsSync(target)) {
        throw new Error(`filen finns redan: ${target}`);
      }

      mkdirSync(dirname(target), { recursive: true });
      db.prepare("vacuum into ?").run(target);

      return target;
    },

    close() {
      db.close();
    },
  };
}
