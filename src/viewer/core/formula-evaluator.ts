/**
 * Safe formula parser for calculation nodes. Supports arithmetic
 * (`+ - * /`, parentheses, unary minus) and the functions round, floor, ceil,
 * abs, sqrt, pow, min and max. No code execution — a recursive descent parser of our
 * own over a variable map.
 *
 * Swedish convention: decimals are written with a comma or a dot (`0,15`), and
 * function arguments are separated by semicolons (`min(a ; b)`).
 *
 * Story 086 adds `age(x)` and `days(a; b)`, which read a *text* variable — a
 * date the visitor picked, a personnummer, or the stamped `idag` — and give a
 * number. Their arguments are variable names, not expressions: there is no
 * arithmetic on a date, only on what these two make of it.
 */

import { ageOn, birthDateOf, daysBetween, isRealDate, TODAY_VARIABLE, todayIso } from "./date-math";

export type FormulaResult =
  | { success: true; value: number }
  | { success: false; error: string };

type Token =
  | { kind: "number"; value: number }
  | { kind: "ident"; value: string }
  | { kind: "op"; value: "+" | "-" | "*" | "/" }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "semicolon" };

const SINGLE_ARG_FUNCTIONS: Record<string, (x: number) => number> = {
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  abs: Math.abs,
  sqrt: Math.sqrt,
};

/** `pow(base; exponent)` — story 095, for the annuity `lån * r / (1 - pow(1 + r; -n))`. */
const TWO_ARG_FUNCTIONS: Record<string, (a: number, b: number) => number> = {
  pow: Math.pow,
};

const VARIADIC_FUNCTIONS: Record<string, (values: number[]) => number> = {
  min: (values) => Math.min(...values),
  max: (values) => Math.max(...values),
};

/** Functions whose arguments are text variables, and how many they take. */
const DATE_FUNCTIONS: Record<string, number> = { age: 1, days: 2 };

/** The variable's text values, for the date functions. */
export interface FormulaContext {
  texts?: Record<string, string>;
}

class FormulaError extends Error {}

/**
 * What a variable name is made of — exported so the editor's formula field
 * (story 139) draws a chip for exactly what this parser reads as a name, and
 * never for a substring of one.
 */
export const IDENT_START = /[\p{L}_]/u;
export const IDENT_PART = /[\p{L}\p{N}_]/u;

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  const identStart = IDENT_START;
  const identPart = IDENT_PART;
  let i = 0;

  while (i < formula.length) {
    const char = formula[i]!;

    if (char === " " || char === "\t" || char === "\n" || char === "\r") {
      i += 1;
      continue;
    }

    if (char >= "0" && char <= "9") {
      let raw = "";
      while (i < formula.length && /[0-9]/.test(formula[i]!)) {
        raw += formula[i];
        i += 1;
      }
      // Decimaldel med komma eller punkt.
      if (
        (formula[i] === "," || formula[i] === ".") &&
        /[0-9]/.test(formula[i + 1] ?? "")
      ) {
        i += 1;
        raw += ".";
        while (i < formula.length && /[0-9]/.test(formula[i]!)) {
          raw += formula[i];
          i += 1;
        }
      }
      tokens.push({ kind: "number", value: Number.parseFloat(raw) });
      continue;
    }

    if (identStart.test(char)) {
      let name = "";
      while (i < formula.length && identPart.test(formula[i]!)) {
        name += formula[i];
        i += 1;
      }
      tokens.push({ kind: "ident", value: name });
      continue;
    }

    if (char === "+" || char === "-" || char === "*" || char === "/") {
      tokens.push({ kind: "op", value: char });
      i += 1;
      continue;
    }
    if (char === "(") {
      tokens.push({ kind: "lparen" });
      i += 1;
      continue;
    }
    if (char === ")") {
      tokens.push({ kind: "rparen" });
      i += 1;
      continue;
    }
    if (char === ";") {
      tokens.push({ kind: "semicolon" });
      i += 1;
      continue;
    }

    throw new FormulaError(`Oväntat tecken: "${char}"`);
  }

  return tokens;
}

class Parser {
  private position = 0;
  private readonly tokens: Token[];
  private readonly variables: Record<string, number>;
  private readonly texts: Record<string, string>;

  constructor(tokens: Token[], variables: Record<string, number>, texts: Record<string, string>) {
    this.tokens = tokens;
    this.variables = variables;
    this.texts = texts;
  }

  parse(): number {
    if (this.tokens.length === 0) {
      throw new FormulaError("Tom formel");
    }
    const value = this.parseExpression();
    if (this.position < this.tokens.length) {
      throw new FormulaError("Oväntat innehåll efter formeln");
    }
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private next(): Token | undefined {
    return this.tokens[this.position++];
  }

  private parseExpression(): number {
    let value = this.parseTerm();
    let token = this.peek();
    while (token?.kind === "op" && (token.value === "+" || token.value === "-")) {
      this.next();
      const right = this.parseTerm();
      value = token.value === "+" ? value + right : value - right;
      token = this.peek();
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parseFactor();
    let token = this.peek();
    while (token?.kind === "op" && (token.value === "*" || token.value === "/")) {
      this.next();
      const right = this.parseFactor();
      if (token.value === "/") {
        if (right === 0) {
          throw new FormulaError("Division med noll");
        }
        value /= right;
      } else {
        value *= right;
      }
      token = this.peek();
    }
    return value;
  }

  private parseFactor(): number {
    const token = this.peek();
    if (token?.kind === "op" && (token.value === "+" || token.value === "-")) {
      this.next();
      const operand = this.parseFactor();
      return token.value === "-" ? -operand : operand;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const token = this.next();

    if (token === undefined) {
      throw new FormulaError("Formeln slutar oväntat");
    }

    if (token.kind === "number") {
      return token.value;
    }

    if (token.kind === "lparen") {
      const value = this.parseExpression();
      this.expect("rparen", ")");
      return value;
    }

    if (token.kind === "ident") {
      if (this.peek()?.kind === "lparen") {
        return this.parseFunctionCall(token.value);
      }
      return this.resolveVariable(token.value);
    }

    throw new FormulaError("Väntade ett tal, en variabel eller (");
  }

  private parseFunctionCall(name: string): number {
    this.expect("lparen", "(");

    if (DATE_FUNCTIONS[name] !== undefined) {
      return this.parseDateFunction(name);
    }

    const args: number[] = [this.parseExpression()];
    while (this.peek()?.kind === "semicolon") {
      this.next();
      args.push(this.parseExpression());
    }
    this.expect("rparen", ")");

    const singleArg = SINGLE_ARG_FUNCTIONS[name];
    if (singleArg) {
      if (args.length !== 1) {
        throw new FormulaError(`${name} tar exakt ett argument`);
      }
      return singleArg(args[0]!);
    }

    const twoArg = TWO_ARG_FUNCTIONS[name];
    if (twoArg) {
      if (args.length !== 2) {
        throw new FormulaError(`${name} tar exakt två argument`);
      }
      return twoArg(args[0]!, args[1]!);
    }

    const variadic = VARIADIC_FUNCTIONS[name];
    if (variadic) {
      return variadic(args);
    }

    throw new FormulaError(`Okänd funktion: ${name}`);
  }

  /** `age(personnummer)` and `days(från; till)`: names in, a number out. */
  private parseDateFunction(name: string): number {
    const dates: string[] = [this.parseDateArgument(name)];
    while (this.peek()?.kind === "semicolon") {
      this.next();
      dates.push(this.parseDateArgument(name));
    }
    this.expect("rparen", ")");

    if (dates.length !== DATE_FUNCTIONS[name]) {
      throw new FormulaError(`${name} tar ${DATE_FUNCTIONS[name] === 1 ? "ett" : "två"} argument`);
    }

    const today = this.texts[TODAY_VARIABLE] ?? todayIso();

    return name === "age" ? ageOn(dates[0]!, today) : daysBetween(dates[0]!, dates[1]!);
  }

  /**
   * The date a named variable holds — as written, or as the birth date inside
   * a personnummer. Anything else is an error, not a number (story 086, AC 3):
   * an empty date field, a misspelt one, the 31st of February.
   */
  private parseDateArgument(fn: string): string {
    const token = this.next();

    if (token?.kind !== "ident") {
      throw new FormulaError(`${fn} tar en variabel med ett datum`);
    }

    const today = this.texts[TODAY_VARIABLE] ?? todayIso();
    const raw = token.value === TODAY_VARIABLE && this.texts[token.value] === undefined
      ? today
      : (this.texts[token.value] ?? "").trim();
    const date = isRealDate(raw) ? raw : birthDateOf(raw, today);

    if (date === null) {
      throw new FormulaError(`${token.value} är inte ett datum eller personnummer`);
    }

    return date;
  }

  private resolveVariable(name: string): number {
    const value = this.variables[name];
    if (value === undefined || !Number.isFinite(value)) {
      throw new FormulaError(`Okänd eller icke-numerisk variabel: ${name}`);
    }
    return value;
  }

  private expect(kind: Token["kind"], symbol: string): void {
    const token = this.next();
    if (token?.kind !== kind) {
      throw new FormulaError(`Väntade "${symbol}"`);
    }
  }
}

export function evaluateFormula(
  formula: string,
  variables: Record<string, number>,
  context: FormulaContext = {},
): FormulaResult {
  try {
    const value = new Parser(tokenize(formula), variables, context.texts ?? {}).parse();
    if (!Number.isFinite(value)) {
      return { success: false, error: "Resultatet är inte ett giltigt tal" };
    }
    return { success: true, value };
  } catch (error) {
    return {
      success: false,
      error: error instanceof FormulaError ? error.message : "Ogiltig formel",
    };
  }
}

/**
 * The variables a formula hands to `age` and `days`, for the health check —
 * it can say a name is not a date before any visitor finds out. Read from
 * the tokens, so `age( pnr )` and `age(pnr)` are the same formula; an
 * unparsable formula gives nothing, the evaluator reports that on its own.
 */
export function dateReferences(formula: string): { fn: string; name: string }[] {
  let tokens: Token[];

  try {
    tokens = tokenize(formula);
  } catch {
    return [];
  }

  const references: { fn: string; name: string }[] = [];

  tokens.forEach((token, index) => {
    if (token.kind !== "ident" || DATE_FUNCTIONS[token.value] === undefined) return;
    if (tokens[index + 1]?.kind !== "lparen") return;

    for (let i = index + 2; i < tokens.length; i += 1) {
      const inner = tokens[i]!;
      if (inner.kind === "rparen") break;
      if (inner.kind === "ident") references.push({ fn: token.value, name: inner.value });
    }
  });

  return references;
}

/**
 * The variables a formula reads — every identifier that is not a function
 * call — for the health check (story 095): a calculation in a page that reads
 * a variable asked *after* the page never counts while the visitor answers.
 * Same tokens as `dateReferences`, same silence on a formula that does not
 * parse.
 */
export function variableReferences(formula: string): string[] {
  let tokens: Token[];

  try {
    tokens = tokenize(formula);
  } catch {
    return [];
  }

  return [
    ...new Set(
      tokens.flatMap((token, index) =>
        token.kind === "ident" && tokens[index + 1]?.kind !== "lparen" ? [token.value] : [],
      ),
    ),
  ];
}
