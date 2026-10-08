/**
 * One browser suite at a time on this machine — PRAXIS regel 32, as a lock
 * instead of a promise.
 *
 * ## Why a mechanism and not just the rule
 *
 * The rule was written 13/9 after two headless Chromiums fought over the
 * machine and five timing tests lost the race. It was broken three times on
 * 17/9 alone — by the lead running the full suite beside a UX preview, and by
 * two roles running suites at once — and every time the cost was the same:
 * red rows that were not results, re-run alone, green. Measured the same day
 * (LOGG 17/9): the six known flaky files stay green over 17 runs alone and
 * over 3 runs under twelve busy CPU cores, and fail only when another browser
 * suite runs alongside. CPU load is not the cause; a second Chromium is.
 *
 * So a second `vitest run` of the browser project now waits for the first to
 * finish instead of interleaving with it. It says so on stderr, with the pid
 * it is waiting for, so nobody mistakes the wait for a hang.
 *
 * ## How
 *
 * `mkdir` is atomic on every platform we run on, so the lock is a directory
 * under the OS temp dir with the holder's pid inside. A holder that died
 * without cleaning up (killed run, low-memory guard) is detected by signalling
 * pid 0 — `ESRCH` means gone — and its lock is taken over. CI shards run on
 * separate runners and never meet each other here.
 *
 * Only the browser project loads this file. The unit project runs in Node and
 * shares nothing that races.
 *
 * It lives in `tools/` as plain JavaScript, not under `src/`: the build's
 * `tsc` type-checks `src/` without Node's types (nothing under `src/` may
 * touch `node:fs` — CLAUDE.md), and the first version, placed under
 * `src/test-setup/`, broke the build on CI while every local run was green
 * because the lock was only ever exercised through vitest, never `npm run
 * build`. Build before push; the gate on CI is not the place to learn it.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LOCK = join(tmpdir(), "flowweaver-browser-suite.lock");
const PID_FILE = join(LOCK, "pid");
const POLL_MS = 1000;

function holderPid() {
  try {
    const pid = Number(readFileSync(PID_FILE, "utf8"));
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
  }
}

function tryAcquire() {
  try {
    mkdirSync(LOCK);
    writeFileSync(PID_FILE, String(process.pid));
    return true;
  } catch {
    return false;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function setup() {
  let told = false;

  while (!tryAcquire()) {
    const pid = holderPid();

    if (pid !== null && !alive(pid)) {
      rmSync(LOCK, { recursive: true, force: true });
      continue;
    }

    if (!told) {
      process.stderr.write(
        `\nEn annan webbläsarsvit kör redan (pid ${pid ?? "?"}) — väntar på att den blir klar (PRAXIS 32).\n`,
      );
      told = true;
    }

    await sleep(POLL_MS);
  }
}

export function teardown() {
  if (holderPid() === process.pid) {
    rmSync(LOCK, { recursive: true, force: true });
  }
}
