import { afterAll, beforeAll, describe, expect, test } from "vitest";

import "../../viewer/node-types/default-node-types";
import { migrateIncoming } from "../../viewer/core/accepted-graph";
import { CURRENT_GRAPH_VERSION } from "../../viewer/core/graph-migrations";
import { GuideTraversalEngine } from "../../viewer/core/guide-traversal-engine";
import { getNodeTypes } from "../../viewer/node-types/node-type-registry";
import { exportGraphJson, importGraphJson } from "./graph-io";

import type { GraphData } from "../../viewer/types/graph";

/**
 * Random and broken guides through both doors, the migrations and the engine.
 *
 * ## Why it exists
 *
 * A guide is a file, and a file can come from anybody (`safe-pattern.ts`).
 * Every door test in the repo is a hand-written case for a fault somebody
 * already found; this one generates thousands of graphs nobody would write —
 * wrong types in every field, connection cycles, megabyte strings, node types
 * that do not exist, versions that are not numbers, author patterns that
 * backtrack exponentially — and holds three promises over all of them:
 *
 * 1. **Nothing throws.** `importGraphJson` and `migrateIncoming` answer with a
 *    result; a host page in plain JS catches nothing (`incoming-graph-door`).
 *    A graph that got through a door is walked by the engine, and that may not
 *    throw either.
 * 2. **Nothing hangs.** Each case has a time cap. A real infinite loop cannot be
 *    interrupted from inside the same thread, so the nightly run (Johan 10/10,
 *    `tools/nightly/`) runs this file in a child with a timeout of its own.
 * 3. **An unsafe pattern is never run.** `RegExp.prototype.test` and `exec` are
 *    watched while the engine walks: a call whose source is one of the
 *    exponential patterns below is recorded and answered without running it.
 *    The list is written out here, independent of `checkPattern`, so removing
 *    the guard in `format-validators.ts` is caught — that is the mutation this
 *    file was seen to fail on (LOGG 10/10).
 *
 * ## Reproducible
 *
 * A fixed seed in the ordinary suite, so a red run is the same red run on the
 * next machine. `FW_FUZZ_SEED` and `FW_FUZZ_CASES` change both; the nightly job
 * draws a new seed every night and the failure message names it, so a find is
 * one command away from being replayed:
 *
 *     FW_FUZZ_SEED=<seed> FW_FUZZ_CASES=<n> npx vitest run --project unit \
 *       src/editor/core/graph-import-fuzz.test.ts
 *
 * ## What it can see (PRAXIS 4)
 *
 * Only graphs that pass a door reach the engine, so the file counts how many
 * did and how many author patterns were actually tested, and fails if either
 * is near zero — a generator that only makes garbage would otherwise stay green
 * while proving nothing about the engine.
 */

// `import.meta.env`, not `process.env`: the tsconfig has no Node types, and
// Vitest hands the process environment through here in a unit run.
const SEED = Number((import.meta.env.FW_FUZZ_SEED as string | undefined) ?? 20261010) >>> 0;
const CASES = Number((import.meta.env.FW_FUZZ_CASES as string | undefined) ?? 3000);
/** Per case: generous, since a megabyte string is cloned several times. */
const CASE_BUDGET_MS = 2000;
/** Steps the engine is walked per graph; cycles must not make it loop. */
const MAX_STEPS = 40;

/** mulberry32 — small, seedable, good enough to spread cases. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Patterns that backtrack exponentially. Kept apart from `checkPattern` on
 * purpose: this is the list the guard is judged against, not its own opinion.
 */
const EXPONENTIAL = [
  "^(a+)+$",
  "^([a-zA-Z]+\\s?)+$",
  "^(a|a)+$",
  "^(\\d+-?)*$",
  "^(a+){10}$",
  "^(?:[a-z]+ ?)+$",
  "(x+x+)+y",
  "^(\\w+\\s?)*$",
];

/** What an author can write besides: safe, invalid, odd. */
const OTHER_PATTERNS = [
  "^\\d{6}$",
  "^[A-Z]{3}$",
  "^\\d{3}-\\d{2}-\\d{4}$",
  "^a",
  "(",
  "[",
  "*",
  "\\",
  "",
  "^(?<namn>a)\\k<namn>$",
  "^(a)\\1$",
  "a{99999}",
];

/** Answers that make an exponential pattern take seconds to refuse. */
const HOSTILE_ANSWERS = [
  `${"a".repeat(32)}!`,
  "Anna Andersson Svensson Karlsson Ek!",
  `${"1-".repeat(20)}x`,
  `${"x".repeat(40)}`,
  "",
  " ",
  "\u0000",
  "😀".repeat(50),
];

const UNKNOWN_TYPES = ["okänd-typ", "__proto__", "constructor", "toString", "", "PAGE", "result "];
const FIELD_KEYS = [
  "title",
  "variableName",
  "description",
  "options",
  "format",
  "pattern",
  "required",
  "min",
  "max",
  "step",
  "fields",
  "minLength",
  "maxLength",
  "startValue",
  "presentation",
  "formula",
  "rules",
  "repeat",
  "__proto__",
];

type Rng = () => number;

const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;
const chance = (rng: Rng, p: number): boolean => rng() < p;
const int = (rng: Rng, max: number): number => Math.floor(rng() * max);

function string(rng: Rng): string {
  const roll = rng();
  if (roll < 0.02) return "x".repeat(200_000 + int(rng, 800_000));
  if (roll < 0.05) return pick(rng, [...EXPONENTIAL, ...OTHER_PATTERNS]);
  if (roll < 0.1) return pick(rng, ["__proto__", "constructor", "{{a}}", "{{", "<script>", "\uD800"]);
  const length = int(rng, 12);
  let text = "";
  for (let i = 0; i < length; i += 1) {
    text += String.fromCharCode(pick(rng, [32 + int(rng, 95), 0x00e5, 0x2028, 0x0000, 0x200b]));
  }
  return text;
}

/** Any JSON value, and some that JSON cannot carry (the object door can). */
function anything(rng: Rng, depth = 0): unknown {
  const roll = rng();
  if (roll < 0.1) return null;
  if (roll < 0.15) return undefined;
  if (roll < 0.25) return chance(rng, 0.5);
  if (roll < 0.4) return pick(rng, [0, -1, 1.5, 1e308, -0, NaN, Infinity, 2 ** 53 + 1, int(rng, 100)]);
  if (roll < 0.65 || depth > 4) return string(rng);
  if (roll < 0.8) return Array.from({ length: int(rng, 5) }, () => anything(rng, depth + 1));
  const object: Record<string, unknown> = {};
  for (let i = int(rng, 5); i > 0; i -= 1) object[string(rng)] = anything(rng, depth + 1);
  return object;
}

/** Usually the right type, sometimes anything at all. */
function maybe<T>(rng: Rng, right: () => T, wrongness: number): unknown {
  return chance(rng, wrongness) ? anything(rng) : right();
}

function localized(rng: Rng): unknown {
  return pick(rng, [() => string(rng), () => ({ sv: string(rng), en: string(rng) }), () => ({ sv: anything(rng) })])();
}

function node(rng: Rng, ids: string[], types: string[], wrongness: number): unknown {
  const type = chance(rng, 0.08) ? pick(rng, UNKNOWN_TYPES) : pick(rng, types);
  const data: Record<string, unknown> = {
    title: maybe(rng, () => localized(rng), wrongness),
    variableName: maybe(rng, () => `v${int(rng, 6)}`, wrongness),
  };
  if (chance(rng, 0.5)) {
    data.format = maybe(rng, () => pick(rng, ["regex", "regex", "email", "personnummer", "postnummer"]), wrongness);
    data.pattern = maybe(rng, () => pick(rng, [...EXPONENTIAL, ...OTHER_PATTERNS]), wrongness);
  }
  if (chance(rng, 0.4)) {
    data.options = maybe(
      rng,
      () =>
        Array.from({ length: int(rng, 4) }, (_, i) => ({
          id: maybe(rng, () => `o${i}`, wrongness),
          label: maybe(rng, () => localized(rng), wrongness),
          value: maybe(rng, () => `val${i}`, wrongness),
        })),
      wrongness,
    );
  }
  if (chance(rng, 0.2)) {
    // The page-field shape before v4, for the migrations to lift.
    data.fields = maybe(
      rng,
      () =>
        Array.from({ length: int(rng, 3) }, () => ({
          id: string(rng),
          type: pick(rng, [...types, "text", "number"]),
          label: localized(rng),
          variableName: `f${int(rng, 4)}`,
          format: "regex",
          pattern: pick(rng, [...EXPONENTIAL, ...OTHER_PATTERNS]),
        })),
      wrongness,
    );
  }
  for (let i = int(rng, 3); i > 0; i -= 1) data[pick(rng, FIELD_KEYS)] = anything(rng);

  return {
    id: maybe(rng, () => pick(rng, ids), wrongness),
    type: maybe(rng, () => type, wrongness / 2),
    position: maybe(rng, () => ({ x: int(rng, 2000), y: int(rng, 2000) }), wrongness),
    data: maybe(rng, () => data, wrongness / 2),
    ...(chance(rng, 0.15) ? { parentPageId: maybe(rng, () => pick(rng, ids), wrongness) } : {}),
    ...(chance(rng, 0.1) ? { visibility: anything(rng) } : {}),
  };
}

/**
 * A graph. `wrongness` is how often a field gets the wrong kind of value; a
 * third of the cases are kept nearly right so they reach the engine.
 */
function graph(rng: Rng): unknown {
  if (chance(rng, 0.3)) return chain(rng);
  const wrongness = pick(rng, [0, 0, 0.02, 0.1, 0.4]);
  const types = getNodeTypes().map((entry) => entry.type);
  const count = int(rng, 10) + 1;
  const ids = Array.from({ length: count }, (_, i) => (chance(rng, 0.03) ? pick(rng, ["a b", "", "../x", "q"]) : `n${i}`));
  const nodes = ids.map(() => node(rng, ids, types, wrongness));

  // A text question with a pattern at the start, often enough to test the guard.
  if (chance(rng, 0.5)) {
    nodes[0] = {
      id: ids[0],
      type: "text-question",
      position: { x: 0, y: 0 },
      data: { variableName: "namn", format: "regex", pattern: pick(rng, [...EXPONENTIAL, ...OTHER_PATTERNS]) },
    };
  }

  const ports = ["continue", "input", "default", "o0", "o1", "true", "false", "", "__proto__"];
  const connections = Array.from({ length: int(rng, count * 2) }, (_, i) => ({
    id: maybe(rng, () => `c${i}`, wrongness),
    from: maybe(rng, () => ({ nodeId: pick(rng, ids), portId: pick(rng, ports) }), wrongness),
    to: maybe(rng, () => ({ nodeId: pick(rng, ids), portId: chance(rng, 0.8) ? "input" : pick(rng, ports) }), wrongness),
  }));
  // A cycle back to the start, so a walk that follows edges can go round.
  if (chance(rng, 0.3) && count > 1) {
    connections.push({ id: "loop", from: { nodeId: ids[count - 1], portId: "continue" }, to: { nodeId: ids[0], portId: "input" } });
  }

  const result: Record<string, unknown> = {
    startNodeId: maybe(rng, () => (chance(rng, 0.9) ? ids[0] : "saknas"), wrongness),
    nodes: maybe(rng, () => nodes, wrongness / 4),
    connections: maybe(rng, () => connections, wrongness / 4),
  };
  if (chance(rng, 0.7)) {
    result.version = pick(rng, [1, 2, 3, 4, 5, CURRENT_GRAPH_VERSION, CURRENT_GRAPH_VERSION + 1, 0, -1, 1.5, "3", NaN, 1e9]);
  }
  if (chance(rng, 0.3)) result.settings = maybe(rng, () => ({ locales: ["sv", "en"], strings: anything(rng) }), 0.5);
  if (chance(rng, 0.2)) result.meta = anything(rng);
  if (chance(rng, 0.1)) result[string(rng)] = anything(rng);
  return result;
}

/**
 * A guide that is right: text questions in a row, each with an author pattern,
 * ending in a result. These are the cases that reach the engine through the
 * file door, which validates; the broken ones mostly stop at the door.
 */
function chain(rng: Rng): unknown {
  const count = int(rng, 4) + 1;
  const nodes: unknown[] = Array.from({ length: count }, (_, i) => ({
    id: `q${i}`,
    type: "text-question",
    position: { x: 0, y: i * 200 },
    data: {
      title: { sv: string(rng) },
      variableName: `v${i}`,
      format: "regex",
      pattern: pick(rng, [...EXPONENTIAL, ...OTHER_PATTERNS]),
      ...(chance(rng, 0.3) ? { required: true } : {}),
    },
  }));
  nodes.push({ id: "end", type: "result", position: { x: 0, y: count * 200 }, data: { title: { sv: "Klart" } } });
  const connections = Array.from({ length: count }, (_, i) => ({
    id: `c${i}`,
    from: { nodeId: `q${i}`, portId: "continue" },
    to: { nodeId: i + 1 < count ? `q${i + 1}` : "end", portId: "input" },
  }));
  return {
    ...(chance(rng, 0.5) ? { version: CURRENT_GRAPH_VERSION } : {}),
    startNodeId: "q0",
    nodes,
    connections,
  };
}

/** A finding: enough to replay it. */
interface Finding {
  case: number;
  stage: string;
  error: string;
}

const findings: Finding[] = [];
const unsafeRuns: string[] = [];
let patternRuns = 0;
let walked = 0;
let slowest = { case: -1, ms: 0 };

const exponential = new Set(EXPONENTIAL.map((pattern) => new RegExp(pattern).source));
const authored = new Set([...EXPONENTIAL, ...OTHER_PATTERNS].flatMap((pattern) => {
  try {
    return [new RegExp(pattern).source];
  } catch {
    return [];
  }
}));

/*
 * The watch on the regex engine. A call on an exponential source is recorded
 * and answered "no match" without running — running it is the hang this file
 * exists to catch, and a hang cannot be reported from inside it.
 */
const originalTest = RegExp.prototype.test;
const originalExec = RegExp.prototype.exec;
let watching = false;

function watched<T>(this: RegExp, original: (this: RegExp, input: string) => T, input: string, refused: T): T {
  if (watching) {
    if (exponential.has(this.source)) {
      unsafeRuns.push(this.source);
      return refused;
    }
    if (authored.has(this.source)) patternRuns += 1;
  }
  return original.call(this, input);
}

beforeAll(() => {
  RegExp.prototype.test = function (input: string): boolean {
    return watched.call(this, originalTest, input, false) as boolean;
  };
  RegExp.prototype.exec = function (input: string): RegExpExecArray | null {
    return watched.call(this, originalExec, input, null) as RegExpExecArray | null;
  };
});

afterAll(() => {
  RegExp.prototype.test = originalTest;
  RegExp.prototype.exec = originalExec;
});

function attempt(index: number, stage: string, run: () => void): void {
  try {
    run();
  } catch (error) {
    findings.push({
      case: index,
      stage,
      error: error instanceof Error ? `${error.name}: ${error.message.slice(0, 160)}` : String(error).slice(0, 160),
    });
  }
}

/** Walk the engine: answer whatever is asked, with what an exponential pattern hates. */
function walk(rng: Rng, accepted: GraphData): void {
  const engine = new GuideTraversalEngine(accepted);
  watching = true;
  try {
    for (let step = 0; step < MAX_STEPS; step += 1) {
      const current = engine.getCurrentResult();
      if (!current.success) break;
      const options = current.node.data.options;
      const firstOption = Array.isArray(options) ? (options[0] as { id?: unknown } | undefined)?.id : undefined;
      const answer = pick(rng, HOSTILE_ANSWERS);
      const roll = rng();
      if (roll < 0.5) engine.answerValue(answer);
      else if (roll < 0.7 && typeof firstOption === "string") engine.answer(firstOption);
      else if (roll < 0.9) engine.answerPage({ namn: answer, f0: answer, f1: answer, v0: answer });
      else engine.previous();
    }
  } finally {
    watching = false;
  }
}

const replay = `FW_FUZZ_SEED=${SEED} FW_FUZZ_CASES=${CASES}`;
/** Graphs the object door accepted and the engine walked. */
let objectWalked = 0;

function run(): void {
  const rng = random(SEED);

  for (let index = 0; index < CASES; index += 1) {
    const started = performance.now();
    const candidate = graph(rng);

    // The file door: the JSON text, sometimes cut short or replaced.
    let json = "";
    attempt(index, "stringify", () => {
      json = JSON.stringify(candidate) ?? "null";
    });
    if (chance(rng, 0.05)) json = json.slice(0, int(rng, json.length));
    if (chance(rng, 0.02)) json = pick(rng, ["", "null", "[]", "1", '"x"', "{", '{"nodes":{}}']);

    attempt(index, "importGraphJson", () => {
      const imported = importGraphJson(json, { allowDraftWithoutStartNode: chance(rng, 0.3) });
      if (imported.success) {
        walked += 1;
        attempt(index, "walk (file door)", () => walk(rng, imported.graph));
        attempt(index, "export", () => exportGraphJson(imported.graph));
      }
    });

    /*
     * The object door: what a host assigns, NaN and undefined included. The
     * viewer walks what it accepts without the editor's validation, so a throw
     * here is one a resident meets. Found here 10/10 — 1 685 of 50 000 cases
     * threw (`nodes.find is not a function`, `reading 'nodeId'` of null) until
     * the door got the file door's shape check (`graph-shape.ts`, Johan's yes).
     */
    attempt(index, "migrateIncoming", () => {
      const incoming = migrateIncoming(candidate as GraphData);
      if (incoming.ok) {
        objectWalked += 1;
        attempt(index, "walk (object door)", () => walk(rng, incoming.graph));
      }
    });

    const took = performance.now() - started;
    if (took > slowest.ms) slowest = { case: index, ms: took };
    if (took > CASE_BUDGET_MS) {
      findings.push({ case: index, stage: "time", error: `${Math.round(took)} ms > ${CASE_BUDGET_MS} ms` });
    }
  }

  // One line per kind of finding, then a summary the nightly log reads off.
  const kinds = new Map<string, number>();
  for (const finding of findings) {
    const kind = `${finding.stage}: ${finding.error.replace(/\d+/g, "#")}`;
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  }
  for (const [kind, count] of [...kinds].sort((a, b) => b[1] - a[1])) {
    console.log(`@@fuzz-kind ${count} × ${kind}`);
  }
  console.log(
    `@@fuzz ${replay}: ${findings.length} findings, ${unsafeRuns.length} unsafe pattern runs, ` +
      `${walked} + ${objectWalked} walked (file + object door), ${patternRuns} author patterns tested, ` +
      `slowest case ${slowest.case} ${Math.round(slowest.ms)} ms`,
  );
}

describe(`random and broken guides (seed ${SEED}, ${CASES} cases)`, () => {
  beforeAll(run, 30 * 60_000);

  test("nothing throws through either door, nothing hangs, no unsafe pattern is run", () => {
    expect(unsafeRuns, `${replay}: an exponential pattern was run`).toEqual([]);
    expect(findings.slice(0, 20), `${replay}: ${findings.length} findings`).toEqual([]);
    // Blind-generator guard (see the top of the file).
    expect(walked, `${replay}: too few graphs passed the file door`).toBeGreaterThan(CASES / 10);
    expect(objectWalked, `${replay}: too few graphs passed the object door`).toBeGreaterThan(CASES / 10);
    expect(patternRuns, `${replay}: too few author patterns were tested`).toBeGreaterThan(CASES / 10);
  });
});
