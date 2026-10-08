/**
 * What one answer can be, and the one place that knows how to read it.
 *
 * ## Why an answer is no longer always a string
 *
 * It was `Record<string, string>` for as long as the product existed, and a
 * multi-value answer was smuggled through it newline-separated. That is a list
 * pretending to be a scalar, and it was paid for twice in one day:
 *
 * - A rule compared the whole string `"DK\nTR"` against its list and matched
 *   nothing — so every guide with a rule on a multi answer sent everybody to
 *   the default branch, silently, always to the worst outcome.
 * - Restoring the choices after a step back had to zip **two parallel lists by
 *   index**: `land` held the labels, `landskod` the codes, and they were kept
 *   in step by position alone. Lose one entry on either side and a rule quietly
 *   tests the wrong country's code.
 *
 * The second one is the reason objects are here and not only lists of strings.
 * A pair that must not drift should be one value, not two lists agreeing to
 * stay the same length.
 *
 * ## Why not simply "any JSON"
 *
 * Because every consumer would have to handle every shape. Three are enough for
 * what a person can answer: one value, several values, or several values that
 * each have parts. Numbers and dates stay strings — they already have a
 * canonical text form the whole product agrees on, and a number that is
 * sometimes `42000` and sometimes `"42000"` is a new class of bug for nothing.
 *
 * ## Why the readers live here and not at each call site
 *
 * There were ten hand-written `split("\n")` before this file, each with its own
 * idea of trimming and empties. A shape that every reader has to decode is a
 * shape every reader can decode slightly differently. Ask this module instead:
 * `answerList` when comparing, `answerText` when showing, `answerField` when
 * you want one part out of each object.
 */

/** The parts of one answer that has parts, e.g. a label and the code behind it. */
export type AnswerFields = Record<string, string>;

/**
 * One record of a page that repeats (story 084): the page's fields by name.
 *
 * A field is a string — or a pair, when the field is a lookup. That is the one
 * level of nesting this module allows, and it was not allowed at first: a
 * record was `AnswerFields`, so a lookup inside it kept its label and lost
 * its code, and the picker could not show the choice again after *Lägg till*
 * (story 090, measured on the try page). A pair that must not drift is one
 * value on a page; it is the same value inside a record.
 */
export type AnswerRecord = Record<string, string | AnswerFields>;

/**
 * One answer: a value, a value with parts, several values, or several with parts.
 *
 * The single object form is not symmetry for its own sake. A country picked
 * from a code list is *one* answer with two parts — the label a person read and
 * the code a rule tests — and that pair had been two separate variables kept in
 * step by convention. So had a map answer: `plats` beside `platsGeo`. One value
 * with parts is what those were all along.
 */
export type AnswerValue = string | AnswerFields | string[] | AnswerRecord[];

/** Every answer in a guide, by variable name. */
export type Answers = Record<string, AnswerValue>;

/**
 * Where a record's answers came from: the whole list and the record's place
 * in it (story 138, Johan 29/9).
 *
 * Inside a record the list's own variable holds only the records *before* it
 * — what a condition reads, decided in `PageRepeatService.recordAnswers`. The
 * setting *Varje upprepning ska välja olika* needs more than that: an option
 * chosen in a LATER record is hidden too. So the list travels beside the
 * answers under a symbol — no guide can name it, no condition reads it, and
 * an object spread (every reader's `{ ...scope, ...values }`) carries it
 * along without anybody passing a second argument through five call sites.
 */
export const RECORD_PLACE: unique symbol = Symbol("flowweaver.recordPlace");

export interface RecordPlace {
  records: readonly AnswerRecord[];
  index: number;
}

/** The record these answers were made for, or undefined outside a record. */
export function recordPlaceOf(answers: Answers): RecordPlace | undefined {
  return (answers as { [RECORD_PLACE]?: RecordPlace })[RECORD_PLACE];
}

/**
 * How a list of answers reads when it has to be one line.
 *
 * A comma, because that is how the trail and the answer record already showed
 * them (`chosen.join(", ")`) long before the values themselves became lists.
 * The newline they were *stored* with was never what anybody read.
 */
const SEPARATOR = ", ";

/**
 * The field an object-shaped answer is named by when nothing says otherwise.
 *
 * `label` and not `value`: what is written into a result text or a letter is
 * what a person recognises. The code beside it is for rules, and a rule asks
 * for it by name through `answerField`.
 */
const NAME_FIELD = "label";

/** A record's field as text: the string, or the label of a pair. */
const recordText = (one: string | AnswerFields | undefined): string =>
  typeof one === "string" ? one : one?.[NAME_FIELD] ?? "";

/** The derived part every list answers to: how many it holds. */
export const COUNT_PART = "count";

/** The derived part a field in a list answers to: what its values add up to. */
export const SUM_PART = "sum";

export const isAnswerFields = (one: unknown): one is AnswerFields =>
  typeof one === "object" && one !== null && !Array.isArray(one);

/** The same shape read as a record — what tells them apart is where it sits. */
export const isAnswerRecord = (one: unknown): one is AnswerRecord => isAnswerFields(one);

/**
 * The part of an answer a name asks for: `land` is the whole, `land.value` a part.
 *
 * A condition, a template or a visibility rule names a variable, and until now
 * it could only name a whole one. That is the single reason a code lived in a
 * second variable beside its label: there was no way to say *the code part of
 * land*, so the part was given a variable of its own and the two were kept in
 * step by hand.
 *
 * A dot and not a bracket, because it is read by people editing a guide and
 * written into a text field. Names of variables have never contained dots — the
 * editor's own validation refuses them — so the separator cannot collide with a
 * name somebody already chose.
 */
export function readPath(answers: Answers, path: string): AnswerValue | undefined {
  const dot = path.indexOf(".");

  if (dot === -1) return answers[path];

  const whole = answers[path.slice(0, dot)];
  const part = path.slice(dot + 1);

  if (whole === undefined || typeof whole === "string") return undefined;
  if (isAnswerFields(whole)) return whole[part];

  /*
   * `barn.count` är antalet poster i en lista — härlett här, aldrig lagrat.
   * En sida som upprepas (story 084) lagrar bara listan; skrevs antalet som
   * en nyckel bredvid skulle de två glida isär vid första borttagningen.
   * En sträng, som varje annat tal i ett svar: en regel jämför text, en
   * uträkning tolkar den.
   */
  if (part === COUNT_PART) return String(whole.length);

  /*
   * `blankett.antal.sum` är summan av fältet `antal` i varje post — härledd
   * som antalet, och skriven först när en guide behövde den (story 091:
   * mejlet sa "2 blanketter" om 2 + 1). Talen läses som uträkningen läser
   * dem: decimalkomma godtas, det som inte är ett tal räknas inte med, och
   * en tom lista summerar till noll.
   */
  if (part.endsWith(`.${SUM_PART}`)) {
    const total = answerField(whole, part.slice(0, -SUM_PART.length - 1))
      .map((one) => Number(one.replace(",", ".")))
      .filter(Number.isFinite)
      .reduce((sum, one) => sum + one, 0);

    return String(total);
  }

  /*
   * Flera värden som har delar ger flera delar — `land.value` på två valda
   * länder är `["DK", "DE"]`. Objekt som saknar delen hoppas över i stället
   * för att bli tomma strängar: ett tomt värde matchar ett tomt villkor och
   * ser besvarat ut.
   */
  return answerField(whole, part);
}

/**
 * The answer as a list of comparable strings.
 *
 * This is what a rule, a validation or a visibility condition wants: does the
 * answer contain X. An object-shaped answer is read by its name field, so a
 * condition written against the labels keeps working; a condition on the codes
 * asks `answerField(value, "value")`.
 *
 * Empty entries are dropped rather than compared. An empty string matches an
 * empty condition value, and that would make a case true for everybody who had
 * not answered — the widest branch there is, arrived at by a stray separator.
 */
export function answerList(value: AnswerValue | undefined): string[] {
  if (value === undefined || value === null) return [];

  if (isAnswerFields(value)) {
    const name = (value[NAME_FIELD] ?? "").trim();

    return name === "" ? [] : [name];
  }

  if (typeof value === "string") {
    /*
     * Radbrytningen läses fortfarande, men skrivs aldrig. Ett svar kan komma
     * från en värd som sparat undan det innan listorna fanns, eller från en
     * äldre integration — och ett sådant svar ska inte tyst bli ett enda långt
     * värde som ingen regel matchar.
     */
    return value
      .split("\n")
      .map((one) => one.trim())
      .filter((one) => one !== "");
  }

  return value
    .map((one) => (typeof one === "string" ? one : recordText(one[NAME_FIELD])))
    .map((one) => one.trim())
    .filter((one) => one !== "");
}

/** One field out of each object in an answer, e.g. every chosen country's code. */
export function answerField(value: AnswerValue | undefined, field: string): string[] {
  if (isAnswerFields(value)) {
    const part = (value[field] ?? "").trim();

    return part === "" ? [] : [part];
  }

  if (!Array.isArray(value)) return [];

  return value
    .filter(isAnswerRecord)
    .map((one) => recordText(one[field]).trim())
    .filter((one) => one !== "");
}

/** The answer as one line, for a result text, a letter or a trail. */
export function answerText(value: AnswerValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.includes("\n")
    ? answerList(value).join(SEPARATOR)
    : value;

  return answerList(value).join(SEPARATOR);
}

/** True when the answer holds nothing a person would call an answer. */
export function isAnswerEmpty(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (isAnswerFields(value)) return answerList(value).length === 0;

  return value.length === 0;
}
