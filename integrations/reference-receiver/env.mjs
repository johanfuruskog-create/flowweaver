/**
 * `.env` into `process.env`, for everything that runs beside the receiver.
 *
 * It lives in a file of its own because there are now two programs that need
 * the same answer to "where is the database, where is the outbox": the server
 * and `cases.mjs`. Two copies of this loading would be two places to change
 * and one day two different answers — and the failure would be silent, since
 * a tool pointed at a database nobody writes to looks exactly like a register
 * with nothing in it.
 *
 * ## The two rules, both of which were paid for
 *
 * Two faults were measured here, one after the other. First: only the
 * receiver's own directory was read, so a key placed at the repository root
 * left the mail going quietly to disk with a receipt that looked entirely
 * normal. Fixing that by loading the root file caused the second, which is
 * worse: the smoke deletes `RESEND_API_KEY` from the child's environment
 * precisely so a test run can never send real mail — and the file put it
 * straight back. Nine checks fell, and on a machine with a real key a smoke
 * run would have sent real mail.
 *
 * So: **a file fills gaps rather than overriding**, the way dotenv has always
 * worked — what the caller put in the environment wins, because the caller
 * knows what this run is for. And **a caller can refuse the file outright**
 * with `FLOWWEAVER_IGNORE_ENV_FILE=1`, because gap-filling alone was not
 * enough: a variable somebody *deleted* looks exactly like one that was never
 * set, so the file filled it back in. A test that must not send mail cannot
 * express that by unsetting a key — it has to be able to say "no file".
 *
 * ## A file that cannot be read is a file that is not there
 *
 * On the server `.env` is `600` and owned by `flowweaver`, while `cases.mjs`
 * is run by `johan`. The read therefore fails by design for the tool that
 * tidies the register, and it must be silent about it: the runbook passes
 * `FLOWWEAVER_DB` on the command line instead, and a stack trace about a
 * permission would only point away from that.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Read the first `.env` found — beside the receiver, then at the repository
 * root — and fill in only what the environment does not already say.
 *
 * Missing is the normal case: the file mode needs no configuration at all, so
 * absence is silence and never a warning.
 */
export function loadEnvFile() {
  if (process.env.FLOWWEAVER_IGNORE_ENV_FILE === "1") {
    return "";
  }

  for (const candidate of [join(here, ".env"), resolve(here, "..", "..", ".env")]) {
    if (!existsSync(candidate)) {
      continue;
    }

    let fromFile;

    try {
      fromFile = parseEnv(readFileSync(candidate, "utf8"));
    } catch {
      // Unreadable is the same as absent — see the header.
      return "";
    }

    for (const [key, value] of Object.entries(fromFile)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }

    return candidate;
  }

  return "";
}
