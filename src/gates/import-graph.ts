/*
 * The source import graph, read as text through Vite.
 *
 * Shared by the gates that follow imports between source files: the
 * distribution entries (`entries/entries.test.ts`, which must not reach the
 * example site) and the open-core boundary (`open-core.test.ts`, where the
 * open trees must not grow new imports into the private files). Both used to
 * need the same thirty lines — glob, path normalisation, resolution — and two
 * copies of a resolver is how one gate quietly starts counting differently
 * from the other.
 *
 * Files are read via `import.meta.glob` with `?raw` (the same mechanism as the
 * components' `?inline` styles) — no node builtins, so the gate cannot read
 * anything outside the repo, and no @types/node. The glob keys are relative to
 * THIS file (src/gates/): siblings get "./", the rest "../". They are
 * normalised to paths relative to src/ — "viewer/core/graph.ts" — so that keys
 * and resolved imports speak the same language.
 *
 * Reading source rather than a bundle means a type-only import counts as an
 * edge, which is deliberate: the direction rules of the repo hold for types
 * too (a shared type belongs in `viewer/types/`).
 */

const RAW = import.meta.glob("../**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** Normalises a `.`/`..` path (as parts) into a clean, src-relative string. */
export function normalize(parts: string[]): string {
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

/** Every `.ts` file under src/, keyed by its src-relative path. */
export const SOURCES = new Map<string, string>(
  Object.entries(RAW).map(([key, src]) => [normalize(["gates", ...key.split("/")]), src]),
);

/** Unit and browser tests — the gates never count what a test imports. */
export function isTestFile(path: string): boolean {
  return /\.(test|browser\.test)\.ts$/.test(path);
}

/** Joins a file path and a relative specifier into a src-relative path. */
export function joinRelative(fromFile: string, spec: string): string {
  return normalize([...fromFile.split("/").slice(0, -1), ...spec.split("/")]);
}

/** Resolves a specifier (without extension) to a known source file, else null. */
export function resolveSource(fromFile: string, spec: string): string | null {
  const base = joinRelative(fromFile, spec.replace(/\?.*$/, ""));
  const candidates = base.endsWith(".ts") ? [base] : [`${base}.ts`, `${base}/index.ts`];
  return candidates.find((c) => SOURCES.has(c)) ?? null;
}

/** One file importing another, and which names it takes. */
export interface ImportEdge {
  from: string;
  /** Src-relative path: the resolved file, or the joined specifier when nothing resolves. */
  to: string;
  /** True when `to` is a source file in the glob. */
  resolved: boolean;
  /**
   * The imported names. `default` for a default import, `*` for a namespace
   * or dynamic import, `(side effect)` for a bare `import "x"`.
   */
  symbols: string[];
}

// Every module specifier in any form: `from "x"`, side-effect `import "x"`,
// dynamic `import("x")`, `export … from "x"`. The specifier alone — the
// components' side-effect imports would otherwise be missed.
const SPECIFIER_RE = /(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g;

// The clause in front of `from`: `{ a, type B }`, `* as ns`, `*`, a default
// name, or `name, { a }`. `import type` and `export type` are read the same as
// their value twins — see the file comment.
const CLAUSE_RE =
  /\b(?:import|export)\s+(?:type\s+)?(\{[^}]*\}|\*\s*(?:as\s+\w+)?|\w+(?:\s*,\s*\{[^}]*\})?)\s*from\s*['"]([^'"]+)['"]/g;

/** The names an import clause takes: `{ a as b, type C }` → `["a", "C"]`. */
function namesOf(clause: string): string[] {
  const text = clause.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "").trim();
  if (text.startsWith("*")) return ["*"];
  const names: string[] = [];
  const open = text.indexOf("{");
  if (open !== 0) names.push("default");
  if (open >= 0) {
    for (const part of text.slice(open + 1, text.indexOf("}")).split(",")) {
      const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      if (name) names.push(name);
    }
  }
  return names;
}

/**
 * Comments are not imports. Found by mutation (2026-10-06): an import line
 * commented out still counted, so the open-core ratchet never noticed the edge
 * was gone. A `//` preceded by a colon or an open paren is left alone — those
 * are URL schemes inside strings (`http://…`, `url(//…)`), the same rule as
 * css-ratchet.test.ts.
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:(])\/\/.*$/gm, "$1");
}

/**
 * The direct imports of one file: every relative specifier (node_modules is
 * never bundled into the library and is not followed), with the names taken
 * from it. Two statements importing the same file — a value import and a type
 * import, typically — become one edge with the union of their names.
 */
export function importsOf(file: string): ImportEdge[] {
  const src = stripComments(SOURCES.get(file) ?? "");
  const edges = new Map<string, ImportEdge>();
  for (const match of src.matchAll(SPECIFIER_RE)) {
    const spec = match[1];
    if (!spec.startsWith(".")) continue;
    const resolved = resolveSource(file, spec);
    const to = resolved ?? joinRelative(file, spec.replace(/\?.*$/, ""));
    if (!edges.has(to)) edges.set(to, { from: file, to, resolved: resolved !== null, symbols: [] });
  }
  const named = new Map<string, Set<string>>();
  for (const match of src.matchAll(CLAUSE_RE)) {
    const spec = match[2];
    if (!spec.startsWith(".")) continue;
    const to = resolveSource(file, spec) ?? joinRelative(file, spec.replace(/\?.*$/, ""));
    const set = named.get(to) ?? new Set<string>();
    for (const name of namesOf(match[1])) set.add(name);
    named.set(to, set);
  }
  for (const edge of edges.values()) {
    const set = named.get(edge.to);
    edge.symbols = set ? [...set].sort() : [/\.(scss|css|svg|png|json)$/.test(edge.to) ? "*" : "(side effect)"];
  }
  return [...edges.values()];
}

/** Every src file reachable transitively from an entry (test files ignored). */
export function reachableFiles(entry: string): string[] {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const edge of importsOf(file)) {
      if (edge.resolved && !isTestFile(edge.to)) stack.push(edge.to);
    }
  }
  return [...seen];
}
