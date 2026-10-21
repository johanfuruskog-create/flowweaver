/**
 * Whether an author's own pattern (`format: "regex"`) is safe to run against
 * what a visitor types.
 *
 * ## Why this exists
 *
 * A guide is a file, and a file can come from anybody — but the measured risk
 * is not a hostile file, it is an honest one. `^([a-zA-Z]+\s?)+$` is the name
 * pattern people copy from forums, and the browser's regex engine
 * backtracks: measured 9/10 through the engine (Node 24, the same V8 regex
 * engine Chrome runs), the answer *Anna Andersson Svensson Karlsson!* took
 * 286 ms to refuse and *Anna Maria Andersson Svensson Karlsson!* 4 555 ms.
 * Every extra word doubles it. The match is synchronous, so the tab is frozen
 * for that long — on blur, and again on *Nästa* — and the visitor has done
 * nothing but type their name with a stray character at the end.
 *
 * ## Why a safe subset and not a time limit or a length cap
 *
 * - **A time limit** needs the match off the main thread (a Worker) and an
 *   asynchronous answer, and validation is a synchronous question asked in
 *   three places (the engine, the field's blur, a page's fields). That is a
 *   rebuild of validation to guard one setting.
 * - **A length cap** does not help: 39 characters is already 4.5 seconds.
 * - **A dependency** (a linear-time engine such as RE2) is ruled out — the
 *   product has none (CLAUDE.md).
 *
 * What remains is to refuse the shapes that blow up **exponentially**, which
 * a static look at the pattern can see:
 *
 * 1. **A repeated group whose inside can match in more than one way** — the
 *    inside has a quantifier of variable length (`+`, `*`, `?`, `{2,}`,
 *    `{1,3}`) or an alternation (`a|b`). `([a-z]+\s?)+`, `(a+)+`, `(a|a)*`,
 *    `(-?\d+)*`. "Repeated" is anything allowed more than once, a fixed
 *    `{3}` included: `(a+){10}` is just as bad. A group of fixed length
 *    repeated is fine — `(\d{3}-){2}` has only one way to match.
 * 2. **A backreference** (`\1`, `\k<namn>`), which no regex engine can match
 *    without backtracking.
 *
 * It is a subset, so it refuses some safe patterns too — `(ab|cd)+` is
 * unambiguous and still refused. That is the price of not having to prove
 * two alternatives disjoint; a character class or writing the group out says
 * the same thing. The editor's health check names the refused pattern, so it
 * is never refused in silence (PRAXIS 35).
 *
 * ## What it does not catch
 *
 * **Polynomial** blow-up from stacked quantifiers side by side:
 * `^.*.*.*.*.*x$` took 5.2 s on 200 characters (measured 9/10). Nobody writes
 * that to validate a postcode, it needs a long answer, and catching it means
 * judging whether neighbouring quantifiers overlap — which is the analysis
 * this file declines to do. Written down so the next look at this starts from
 * the number, not from the belief that the problem is closed.
 */

export type PatternCheck = "ok" | "invalid" | "unsafe";

/** Whether `pattern` compiles, and whether it is safe to run (see above). */
export function checkPattern(pattern: string): PatternCheck {
  try {
    new RegExp(pattern);
  } catch {
    return "invalid";
  }

  return isSafe(pattern) ? "ok" : "unsafe";
}

interface Group {
  /** Something inside can match more than one way: a variable quantifier or `|`. */
  ambiguous: boolean;
}

function isSafe(pattern: string): boolean {
  // The group being read; the outermost is the pattern itself.
  const stack: Group[] = [{ ambiguous: false }];
  /** The group just closed, while what follows it may still quantify it. */
  let closed: Group | null = null;
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i]!;
    const current = stack[stack.length - 1]!;
    const quantifier = readQuantifier(pattern, i);

    if (quantifier) {
      if (closed && quantifier.max > 1 && closed.ambiguous) {
        return false;
      }

      if (quantifier.min !== quantifier.max) {
        current.ambiguous = true;
      }

      closed = null;
      i += quantifier.length;
      continue;
    }

    closed = null;

    if (char === "\\") {
      const next = pattern[i + 1] ?? "";

      // `\1`–`\9` and a named `\k<…>`: a backreference. `\0` is a NUL.
      if (/[1-9]/.test(next) || (next === "k" && pattern[i + 2] === "<")) {
        return false;
      }

      i += 2;
      continue;
    }

    if (char === "[") {
      i = endOfClass(pattern, i);
      continue;
    }

    if (char === "(") {
      stack.push({ ambiguous: false });
      // `(?:`, `(?=`, `(?!`, `(?<=`, `(?<!`, `(?<namn>`: the `?` says what
      // kind of group it is and is not a quantifier.
      i += pattern[i + 1] === "?" ? groupPrefix(pattern, i) : 1;
      continue;
    }

    if (char === ")") {
      const group = stack.pop()!;

      // What the group could do, its parent can too.
      if (group.ambiguous) {
        stack[stack.length - 1]!.ambiguous = true;
      }

      closed = group;
      i += 1;
      continue;
    }

    if (char === "|") {
      current.ambiguous = true;
    }

    i += 1;
  }

  return true;
}

/** `*`, `+`, `?`, `{n}`, `{n,}`, `{n,m}` at `at`, with a trailing lazy `?`. */
function readQuantifier(
  pattern: string,
  at: number,
): { min: number; max: number; length: number } | null {
  const char = pattern[at];
  const lazy = (length: number): number => (pattern[at + length] === "?" ? length + 1 : length);

  if (char === "*") return { min: 0, max: Infinity, length: lazy(1) };
  if (char === "+") return { min: 1, max: Infinity, length: lazy(1) };
  if (char === "?") return { min: 0, max: 1, length: lazy(1) };

  if (char === "{") {
    // Without the `u` flag a `{` that is not a count is a literal brace.
    const count = /^\{(\d+)(,(\d*))?\}/.exec(pattern.slice(at));

    if (!count) return null;

    const min = Number(count[1]);
    const max = count[2] === undefined ? min : count[3] === "" ? Infinity : Number(count[3]);

    return { min, max, length: lazy(count[0].length) };
  }

  return null;
}

/** How long the opening of the group at `at` is, `(` and its `?…` together. */
function groupPrefix(pattern: string, at: number): number {
  const kind = /^\(\?(?::|=|!|<=|<!|<[^>]*>)/.exec(pattern.slice(at));

  return kind ? kind[0].length : 1;
}

/** Past the `]` that ends the class opened at `at`. */
function endOfClass(pattern: string, at: number): number {
  // In JavaScript `[]` is an empty class and `]` right after `[` ends it.
  let i = at + 1;

  while (i < pattern.length && pattern[i] !== "]") {
    i += pattern[i] === "\\" ? 2 : 1;
  }

  return i + 1;
}
