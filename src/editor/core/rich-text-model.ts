import { FormattedTextService } from "../../viewer/services/formatted-text-service";
import { LINK_PATTERN, joinLinkTarget, splitLinkTarget } from "../../viewer/services/link-references";
import type { FormattingFeature } from "../../viewer/types/node-types";
import { IDENT_PART, IDENT_START } from "../../viewer/core/formula-evaluator";

/**
 * The text of a formatted field as a small tree, and the pair that moves it to
 * and from the Markdown the guide stores (stories 136 and 137).
 *
 * ## Why a model at all
 *
 * `contenteditable` is not an editor, it is a surface the browser changes by
 * itself — differently in Chromium, Firefox and WebKit (137's table). The
 * field therefore keeps its text here and draws the DOM from it after every
 * change; the browser is a keyboard. Storage does not change: the guide still
 * holds the Markdown it held before, so no guide is migrated and the viewer is
 * not touched.
 *
 * ## The shape
 *
 * Blocks are flat: a paragraph, or one item of a bulleted or numbered list.
 * Consecutive items of the same kind are one list; `newList` marks the rare
 * item that starts a second list directly after one of its own kind (the
 * viewer draws `- a\n\n- b` as two lists). A flat list of blocks makes every
 * position a pair `(block, offset)`, which is what the caret is.
 *
 * Inline content is flat too — runs with marks, the way the big editors do it
 * rather than nested tags — because toggling bold over half a link is then a
 * matter of setting a flag on some runs, not of restructuring a tree. The
 * writer builds the nesting when it writes. A text character counts one
 * offset, and so does a chip (an answer, `{{name}}`) and a line break inside a
 * paragraph.
 *
 * ## Reading the Markdown exactly as the viewer does
 *
 * The parser does not implement Markdown. It follows `FormattedTextService`
 * step for step — variables first, then lines, then links, bold, italic, each
 * with the viewer's own regular expression — so the model is what the visitor
 * sees, including the corners (`**a *b* c**` is not bold in the viewer, and is
 * not bold here). And it asks the viewer afterwards: a parse is accepted only
 * if the viewer renders the written-back string exactly as it renders the
 * original. Anything else returns `null`, and the field opens in text mode
 * (136 criterion 8) — the parser never guesses.
 *
 * ## Literal characters
 *
 * A backslash before `*`, `[` or `{` makes it a character in the viewer
 * (added 25/9 for 7b e). The writer uses it only on a line whose plain form
 * would be read as markup — `2*3*4`, `[a](b)`, `{{namn}}` typed as text — so
 * every text written before stays letter for letter. What the escape cannot
 * say — `- ` first on a line is a list — the field shows as the visitor gets
 * it (`isFaithful` and the field's re-read).
 */

export interface LinkMark {
  url: string;
  /** The host's reference for the page (story 100), kept but never shown. */
  ref?: string;
}

export interface Marks {
  bold?: true;
  italic?: true;
  link?: LinkMark;
}

export type Inline =
  | { type: "text"; text: string; marks: Marks }
  /**
   * An answer. `source` is the placeholder as it was written, `{{ namn }}`
   * with its spaces, so a text nobody touched is written back to the letter;
   * a chip made in the editor has none and is written `{{namn}}`.
   */
  | { type: "chip"; name: string; source?: string; marks: Marks }
  | { type: "break" };

export type BlockType = "paragraph" | "bullet" | "numbered";

export interface Block {
  type: BlockType;
  content: Inline[];
  newList?: true;
}

export interface RichText {
  blocks: Block[];
}

export interface Position {
  block: number;
  offset: number;
}

export interface Selection {
  anchor: Position;
  focus: Position;
}

export interface ParseOptions {
  features: readonly FormattingFeature[];
  /**
   * One line, as the viewer draws a heading: no blocks, and a line break in
   * the stored text is a space (`FormattedTextService.render`'s `inline`).
   */
  inline?: boolean;
  /**
   * A formula, not Markdown (story 139). The text is read with the formula
   * parser's own idea of a name: a known variable is a chip, every other
   * character — `*`, `(`, `;`, digits, a function's name, a name nobody has
   * defined — is text, escaped never. Written back it is the formula as
   * stored, letter for letter; a chip is written as its name. Always one
   * line, whatever `inline` says.
   */
  formula?: { known: ReadonlySet<string> };
}

/**
 * The caret's place through a re-read (`reread` in the field): a private-use
 * character outside the ten the Markdown reader owns. The formula reader
 * lets it stand inside a name, so the name the caret is in is never a chip
 * — a variable typed halfway (`barn` on the way to `barntillagg`) stays
 * text until a character that cannot be part of a name follows it (139
 * criterion 5).
 */
export const CARET_MARKER = "\uE00F";

/*
 * Private-use characters stand in for what the viewer has already replaced
 * when its next expression runs: a variable, the two ends of a link, bold and
 * italic. None of them is a `*`, `[`, `]` or `)`, which is exactly the
 * property the viewer's own placeholders and tags have.
 */
const CHIP = "\uE000";
const LINK_OPEN = "\uE001";
const LINK_CLOSE = "\uE002";
const BOLD_OPEN = "\uE003";
const BOLD_CLOSE = "\uE004";
const ITALIC_OPEN = "\uE005";
const ITALIC_CLOSE = "\uE006";
/* A backslashed `*`, `[` and `{`: characters, whatever follows them. */
const ESCAPED: Record<string, string> = { "\uE007": "*", "\uE008": "[", "\uE009": "{" };
const ESCAPE_TOKEN: Record<string, string> = { "*": "\uE007", "[": "\uE008", "{": "\uE009" };
const PRIVATE = /[\uE000-\uE009]/;

const VARIABLE = /{{\s*([^{}]+?)\s*}}/g;
const BULLET = /^\s*-\s+(.+)$/;
const NUMBERED = /^\s*\d+\.\s+(.+)$/;

// ---------------------------------------------------------------------------
// Reading

/**
 * The model of a stored text, or `null` when the viewer would show something
 * the model cannot hold. `null` means text mode, never a guess.
 */
export function parseRichText(source: string, options: ParseOptions): RichText | null {
  // A formula always reads: there is no markup to misread, only names.
  if (options.formula) return readLenient(source, options);

  const doc = readLenient(source, options);

  if (!doc) return null;

  const written = writeRichText(doc, options);

  if (written === source) return doc;

  // Not letter for letter: accepted only when the visitor would see exactly
  // the same, and every link keeps its address and reference.
  return render(written, options) === render(source, options) && sameLinkTargets(written, source)
    ? doc
    : null;
}

function render(text: string, options: ParseOptions): string {
  return FormattedTextService.render(text, [...options.features], {}, undefined, undefined, options.inline === true).html;
}

function sameLinkTargets(a: string, b: string): boolean {
  const targets = (text: string): string[] => [...text.matchAll(LINK_PATTERN)].map((match) => match[2]!.trim());

  return JSON.stringify(targets(a)) === JSON.stringify(targets(b));
}

function readLenient(source: string, options: ParseOptions): RichText | null {
  if (PRIVATE.test(source)) return null;
  if (options.formula) return { blocks: [{ type: "paragraph", content: readFormula(source, options.formula.known) }] };

  const features = new Set(options.features);

  if (options.inline) {
    const content = readLine(source.split(/\r?\n/).join(" "), features);

    return content ? { blocks: [{ type: "paragraph", content }] } : null;
  }

  const blocks: Block[] = [];
  let paragraph: Inline[] | null = null;
  // The kind of list the last line belonged to, or null after anything else.
  let listType: BlockType | null = null;

  for (const line of source.split(/\r?\n/)) {
    const bullet = features.has("bullet-list") ? BULLET.exec(line) : null;
    const numbered = !bullet && features.has("numbered-list") ? NUMBERED.exec(line) : null;
    const itemType: BlockType | null = bullet ? "bullet" : numbered ? "numbered" : null;

    if (itemType) {
      paragraph = null;
      const content = readLine((bullet ?? numbered)![1]!, features);

      if (!content) return null;

      const previous = blocks[blocks.length - 1];
      const block: Block = { type: itemType, content };

      // Same kind directly after a list of that kind that has ended (a blank
      // line or a paragraph closed it): the viewer starts a second list.
      if (listType !== itemType && previous?.type === itemType) block.newList = true;

      blocks.push(block);
      listType = itemType;
      continue;
    }

    listType = null;

    if (line.trim() === "") {
      paragraph = null;
      continue;
    }

    const content = readLine(line, features);

    if (!content) return null;

    if (paragraph) {
      paragraph.push({ type: "break" }, ...content);
    } else {
      paragraph = [...content];
      blocks.push({ type: "paragraph", content: paragraph });
    }
  }

  // An empty text is one empty paragraph — somewhere for the caret to stand.
  if (blocks.length === 0) return emptyRichText();

  return { blocks: blocks.map((block) => ({ ...block, content: normalizeInline(block.content) })) };
}

/**
 * A formula as the parser tokenizes it (`formula-evaluator.ts`): a name is
 * `IDENT_START` then `IDENT_PART`s, so `grund` inside `grundbelopp` is not
 * a name of its own; a name followed by `(` — spaces allowed between, as the
 * tokenizer allows them — is a function call and stays text even when a
 * variable happens to share the word. Only a name in `known` becomes a chip;
 * an unknown one is text, never a missing chip (139 criterion 4). The caret
 * marker counts as part of a name, which is what keeps a half-typed name
 * from turning into a chip under the caret.
 */
function readFormula(source: string, known: ReadonlySet<string>): Inline[] {
  const text = source.replace(/\r?\n/g, " ");
  const content: Inline[] = [];
  let plain = "";
  const flush = (): void => {
    if (plain) content.push({ type: "text", text: plain, marks: {} });
    plain = "";
  };
  let i = 0;

  while (i < text.length) {
    const char = text[i]!;

    if (IDENT_START.test(char)) {
      let end = i + 1;

      while (end < text.length && (IDENT_PART.test(text[end]!) || text[end] === CARET_MARKER)) end += 1;
      const name = text.slice(i, end);
      let after = end;

      while (after < text.length && /\s/.test(text[after]!)) after += 1;
      const call = text[after] === "(";

      if (known.has(name) && !call) {
        flush();
        content.push({ type: "chip", name, marks: {} });
      } else {
        plain += name;
      }
      i = end;
      continue;
    }
    plain += char;
    i += 1;
  }
  flush();

  return normalizeInline(content);
}

/** One line, the viewer's three inline passes in the viewer's order. */
function readLine(line: string, features: Set<FormattingFeature>): Inline[] | null {
  const chips: Array<{ name: string; source: string }> = [];
  // The viewer takes the escapes out first, before it looks for anything else.
  let text = line.replace(/\\([*[{])/g, (_whole, char: string) => ESCAPE_TOKEN[char]!);

  text = text.replace(VARIABLE, (whole, name: string) => {
    chips.push({ name, source: whole });
    return CHIP;
  });
  const links: LinkMark[] = [];

  if (features.has("link")) {
    let unreadable = false;
    let taken = 0;
    const countChips = (value: string): number => value.split(CHIP).length - 1;
    const original = text;

    text = text.replace(LINK_PATTERN, (whole, label: string, target: string, offset: number) => {
      // A variable in the address is part of the address, not an answer
      // drawn in the text: put back as it was written, and out of the chips.
      const first = countChips(original.slice(0, offset)) + countChips(label) - taken;
      let inTarget = 0;
      const restored = target
        .replace(new RegExp(CHIP, "g"), () => chips[first + inTarget++]!.source)
        .replace(/[\uE007-\uE009]/g, (token) => "\\" + ESCAPED[token]!);

      // The viewer runs bold and italic over the finished anchor, address
      // included; a star in an address is a case the model does not follow.
      if (restored.includes("*")) unreadable = true;

      // A link the viewer refuses (`javascript:`, `//host`) stays text there,
      // so it stays text here. Asked of the viewer, not re-decided.
      if (!render(`[x](${restored})`, { features: ["link"] }).includes("<a ")) return whole;

      chips.splice(first, inTarget);
      taken += inTarget;

      const { url, ref } = splitLinkTarget(restored);

      links.push(ref === undefined ? { url } : { url, ref });
      return LINK_OPEN + label + LINK_CLOSE;
    });

    if (unreadable) return null;
  }

  if (features.has("bold")) {
    text = text.replace(/\*\*([^*]+)\*\*/g, (_whole, inner: string) => BOLD_OPEN + inner + BOLD_CLOSE);
  }

  if (features.has("italic")) {
    text = text.replace(/\*([^*]+)\*/g, (_whole, inner: string) => ITALIC_OPEN + inner + ITALIC_CLOSE);
  }

  const content: Inline[] = [];
  let bold = false;
  let italic = false;
  let link: LinkMark | undefined;
  let linkIndex = 0;
  let chipIndex = 0;
  const marks = (): Marks => ({
    ...(bold ? { bold: true as const } : {}),
    ...(italic ? { italic: true as const } : {}),
    ...(link ? { link } : {}),
  });

  for (const char of text) {
    switch (char) {
      case BOLD_OPEN: bold = true; break;
      case BOLD_CLOSE: bold = false; break;
      case ITALIC_OPEN: italic = true; break;
      case ITALIC_CLOSE: italic = false; break;
      case LINK_OPEN: link = links[linkIndex++]; break;
      case LINK_CLOSE: link = undefined; break;
      case CHIP: {
        const chip = chips[chipIndex++];

        if (!chip) return null;
        content.push({ type: "chip", name: chip.name, source: chip.source, marks: marks() });
        break;
      }
      default:
        content.push({ type: "text", text: ESCAPED[char] ?? char, marks: marks() });
    }
  }

  return normalizeInline(content);
}

// ---------------------------------------------------------------------------
// Writing

/**
 * The Markdown for a model — one form per construction (137 criterion 4).
 *
 * Nesting, outermost first: link, italic, bold. That order is not taste. The
 * viewer replaces bold before italic, so italic can hold bold (`*a **b** c*`)
 * and bold can never hold italic; a link is replaced before both, so either
 * can sit inside it or around it. A chip carries marks like text, so bold
 * across *text, answer, text* is one span: `**a{{x}}b**`.
 *
 * Empty blocks and lines that hold only spaces are not written: the viewer
 * would draw nothing for them, or read a blank line as the end of the
 * paragraph.
 */
export function writeRichText(doc: RichText, options: ParseOptions): string {
  const features = new Set(options.features);

  // A formula: the characters as they stand, a chip as its name, a break as
  // a space. Nothing is escaped — there is no markup for a `*` to be.
  if (options.formula) {
    return doc.blocks
      .map((block) => block.content.map((item) => (item.type === "chip" ? item.name : item.type === "text" ? item.text : " ")).join(""))
      .join(" ");
  }

  if (options.inline) {
    return doc.blocks.map((block) => writeLines(block.content, features).join(" ")).filter((line) => line.trim() !== "").join(" ");
  }

  let out = "";
  let previous: Block | null = null;
  let number = 0;

  for (const block of doc.blocks) {
    const lines = writeLines(block.content, features).filter((line) => line.trim() !== "");

    if (lines.length === 0) continue;

    const continuesList: boolean = previous !== null && block.type !== "paragraph" && previous.type === block.type && !block.newList;

    if (block.type === "paragraph") {
      number = 0;
    } else {
      number = continuesList ? number + 1 : 1;
    }

    const text = block.type === "bullet"
      ? "- " + lines.join(" ")
      : block.type === "numbered"
        ? `${number}. ` + lines.join(" ")
        : lines.join("\n");

    out += previous === null ? text : (continuesList ? "\n" : "\n\n") + text;
    previous = block;
  }

  return out;
}

/** A block's inline content as lines — a break inside a paragraph ends one. */
function writeLines(content: Inline[], features: Set<FormattingFeature>): string[] {
  const lines: Inline[][] = [[]];

  for (const item of content) {
    if (item.type === "break") {
      lines.push([]);
    } else {
      lines[lines.length - 1]!.push(item);
    }
  }

  return lines.map((line) => writeLine(line, features));
}

/**
 * One line, plain when it reads back as itself, and with its `*`, `[` and `{`
 * escaped when it would not — so a text nobody typed a literal pair into is
 * written exactly as before.
 */
function writeLine(items: Inline[], features: Set<FormattingFeature>): string {
  const plain = writeInline(items, false);
  const reread = readLine(plain, features);

  // A chip made in the editor has no `source`; read back it has one. Same chip.
  const shape = (content: Inline[]): string =>
    JSON.stringify(normalizeInline(content).map((item) => (item.type === "chip" ? { ...item, source: undefined } : item)));

  return reread && shape(reread) === shape(items) ? plain : writeInline(items, true);
}

function writeInline(items: Inline[], escape = false): string {
  let out = "";
  let index = 0;

  while (index < items.length) {
    const link = marksOf(items[index]!).link;
    let end = index + 1;

    while (end < items.length && sameLink(marksOf(items[end]!).link, link)) end += 1;

    const inner = writeEmphasis(items.slice(index, end), escape);

    out += link ? `[${inner}](${joinLinkTarget(link.url, link.ref)})` : inner;
    index = end;
  }

  return out;
}

function writeEmphasis(items: Inline[], escape: boolean): string {
  return groupBy(items, (item) => marksOf(item).italic === true)
    .map(([italic, group]) => {
      const inner = groupBy(group, (item) => marksOf(item).bold === true)
        .map(([bold, run]) => {
          const text = run.map((item) => atomText(item, escape)).join("");

          return bold ? `**${text}**` : text;
        })
        .join("");

      return italic ? `*${inner}*` : inner;
    })
    .join("");
}

function atomText(item: Inline, escape = false): string {
  // `{` only where it opens `{{`: one backslash is enough to keep an answer text.
  if (item.type === "text") return escape ? item.text.replace(/[*[]|{(?={)/g, "\\$&") : item.text;
  if (item.type === "chip") return item.source ?? `{{${item.name}}}`;
  return "\n";
}

function groupBy<T>(items: T[], key: (item: T) => boolean): Array<[boolean, T[]]> {
  const groups: Array<[boolean, T[]]> = [];

  for (const item of items) {
    const value = key(item);
    const last = groups[groups.length - 1];

    if (last && last[0] === value) {
      last[1].push(item);
    } else {
      groups.push([value, [item]]);
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Faithfulness

/**
 * Whether the visitor will see what the model says — that the stored string
 * reads back as this very model. Since the viewer's escape (25/9) stars,
 * brackets and braces always can; what still cannot is `- ` or `1. ` first on
 * a line, which is a list. The field then shows what it will be, not a
 * surprise.
 *
 * Empty blocks are allowed: they are where the caret stands while writing, and
 * the writer leaves them out.
 */
export function isFaithful(doc: RichText, options: ParseOptions): boolean {
  const reread = readLenient(writeRichText(doc, options), options);

  return reread !== null && JSON.stringify(withoutEmpty(doc, options)) === JSON.stringify(withoutEmpty(reread, options));
}

function withoutEmpty(doc: RichText, options: ParseOptions): RichText {
  const blocks = doc.blocks
    .map((block) => ({ ...block, content: normalizeInline(trimBreaks(block.content)) }))
    .filter((block) => block.content.some((item) => item.type !== "break" && (item.type !== "text" || item.text.trim() !== "")));

  if (options.inline) {
    return { blocks: blocks.length === 0 ? [] : [{ type: "paragraph", content: normalizeInline(blocks.flatMap((block) => block.content)) }] };
  }

  // A list's `newList` only matters directly after a list of its own kind.
  return {
    blocks: blocks.map((block, index) => {
      const { newList, ...rest } = block;
      const previous = blocks[index - 1];

      return newList && previous?.type === block.type ? block : rest;
    }),
  };
}

function trimBreaks(content: Inline[]): Inline[] {
  // Lines of nothing but spaces are not written; neither are breaks around them.
  const lines: Inline[][] = [[]];

  for (const item of content) {
    if (item.type === "break") lines.push([]);
    else lines[lines.length - 1]!.push(item);
  }

  const kept = lines.filter((line) => writeInline(line).trim() !== "");

  return kept.flatMap((line, index) => (index === 0 ? line : [{ type: "break" } as Inline, ...line]));
}

// ---------------------------------------------------------------------------
// Positions and editing — pure functions, one change each

export function emptyRichText(): RichText {
  return { blocks: [{ type: "paragraph", content: [] }] };
}

function marksOf(item: Inline): Marks {
  return item.type === "break" ? {} : item.marks;
}

function sameLink(a: LinkMark | undefined, b: LinkMark | undefined): boolean {
  return a === b || (a !== undefined && b !== undefined && a.url === b.url && a.ref === b.ref);
}

export function sameMarks(a: Marks, b: Marks): boolean {
  return a.bold === b.bold && a.italic === b.italic && sameLink(a.link, b.link);
}

function itemLength(item: Inline): number {
  return item.type === "text" ? item.text.length : 1;
}

export function blockLength(block: Block): number {
  return block.content.reduce((sum, item) => sum + itemLength(item), 0);
}

/** Adjacent text with the same marks becomes one run; empty text goes. */
export function normalizeInline(content: Inline[]): Inline[] {
  const out: Inline[] = [];

  for (const item of content) {
    if (item.type === "text" && item.text === "") continue;

    const last = out[out.length - 1];

    if (item.type === "text" && last?.type === "text" && sameMarks(last.marks, item.marks)) {
      out[out.length - 1] = { ...last, text: last.text + item.text };
    } else {
      out.push(item);
    }
  }

  return out;
}

/** The content between two offsets of one block, split through text runs. */
export function sliceInline(content: Inline[], from: number, to: number): Inline[] {
  const out: Inline[] = [];
  let at = 0;

  for (const item of content) {
    const length = itemLength(item);
    const start = at;
    const end = at + length;

    at = end;

    if (end <= from || start >= to) {
      if (!(length === 0 && start >= from && start < to)) continue;
    }

    if (item.type === "text") {
      const text = item.text.slice(Math.max(0, from - start), Math.min(length, to - start));

      if (text) out.push({ ...item, text });
    } else if (start >= from && end <= to) {
      out.push(item);
    }
  }

  return out;
}

export function comparePositions(a: Position, b: Position): number {
  return a.block !== b.block ? a.block - b.block : a.offset - b.offset;
}

export function orderedRange(selection: Selection): [Position, Position] {
  return comparePositions(selection.anchor, selection.focus) <= 0
    ? [selection.anchor, selection.focus]
    : [selection.focus, selection.anchor];
}

export function isCollapsed(selection: Selection): boolean {
  return comparePositions(selection.anchor, selection.focus) === 0;
}

export function caret(position: Position): Selection {
  return { anchor: position, focus: position };
}

export function clampPosition(doc: RichText, position: Position): Position {
  const block = Math.max(0, Math.min(doc.blocks.length - 1, position.block));

  return { block, offset: Math.max(0, Math.min(blockLength(doc.blocks[block]!), position.offset)) };
}

function cloneDoc(doc: RichText): RichText {
  return { blocks: doc.blocks.map((block) => ({ ...block, content: [...block.content] })) };
}

export interface Edit {
  doc: RichText;
  selection: Selection;
}

/** Removes everything between two positions; blocks in between go with it. */
export function deleteRange(doc: RichText, from: Position, to: Position): Edit {
  const [start, end] = comparePositions(from, to) <= 0 ? [from, to] : [to, from];
  const next = cloneDoc(doc);
  const first = next.blocks[start.block]!;
  const last = next.blocks[end.block]!;
  const head = sliceInline(first.content, 0, start.offset);
  const tail = sliceInline(last.content, end.offset, Infinity);

  next.blocks.splice(start.block, end.block - start.block + 1, {
    ...first,
    content: normalizeInline([...head, ...tail]),
  });

  return { doc: next, selection: caret(start) };
}

/** Puts inline content where the selection is, replacing what it covers. */
export function insertInline(doc: RichText, selection: Selection, items: Inline[]): Edit {
  const [start, end] = orderedRange(selection);
  const cleared = deleteRange(doc, start, end).doc;
  const block = cleared.blocks[start.block]!;
  const content = normalizeInline([
    ...sliceInline(block.content, 0, start.offset),
    ...items,
    ...sliceInline(block.content, start.offset, Infinity),
  ]);
  const inserted = items.reduce((sum, item) => sum + itemLength(item), 0);

  cleared.blocks[start.block] = { ...block, content };

  return { doc: cleared, selection: caret({ block: start.block, offset: start.offset + inserted }) };
}

/**
 * The marks the next typed character takes: those of the character before
 * the caret. A link is only continued from inside it — typing at a link's end
 * writes after the link, as in every editor people know.
 */
export function marksAt(doc: RichText, position: Position): Marks {
  const content = doc.blocks[position.block]?.content ?? [];
  const before = sliceInline(content, Math.max(0, position.offset - 1), position.offset)[0];
  const after = sliceInline(content, position.offset, position.offset + 1)[0];
  const marks: Marks = before && before.type !== "break" ? { ...before.marks } : {};

  if (marks.link && !(after && after.type !== "break" && sameLink(after.marks.link, marks.link))) {
    delete marks.link;
  }

  return marks;
}

export function insertText(doc: RichText, selection: Selection, text: string, marks?: Marks): Edit {
  const [start] = orderedRange(selection);

  return insertInline(doc, selection, text ? [{ type: "text", text, marks: marks ?? marksAt(doc, start) }] : []);
}

/** Enter: the block splits. An empty list item leaves the list instead (137, action 5). */
export function splitBlock(doc: RichText, selection: Selection): Edit {
  const [start, end] = orderedRange(selection);
  const cleared = deleteRange(doc, start, end).doc;
  const block = cleared.blocks[start.block]!;

  if (block.type !== "paragraph" && blockLength(block) === 0) {
    cleared.blocks[start.block] = { type: "paragraph", content: [] };
    return { doc: cleared, selection: caret(start) };
  }

  const { newList: _newList, ...rest } = block;

  void _newList;

  cleared.blocks.splice(
    start.block,
    1,
    { ...block, content: sliceInline(block.content, 0, start.offset) },
    { ...rest, content: sliceInline(block.content, start.offset, Infinity) },
  );

  return { doc: cleared, selection: caret({ block: start.block + 1, offset: 0 }) };
}

/**
 * Backspace with nothing selected. At the start of a list item it turns the
 * item into a paragraph; at the start of a paragraph it joins the one before;
 * otherwise it takes the one thing before the caret — a whole chip, never a
 * letter of its name (137 point 6).
 */
export function deleteBackward(doc: RichText, selection: Selection): Edit {
  if (!isCollapsed(selection)) {
    const [start, end] = orderedRange(selection);
    return deleteRange(doc, start, end);
  }

  const { block, offset } = selection.focus;
  const current = doc.blocks[block]!;

  if (offset === 0) {
    if (current.type !== "paragraph") {
      const next = cloneDoc(doc);
      next.blocks[block] = { type: "paragraph", content: current.content };
      return { doc: next, selection };
    }

    if (block === 0) return { doc, selection };

    return deleteRange(doc, { block: block - 1, offset: blockLength(doc.blocks[block - 1]!) }, selection.focus);
  }

  return deleteRange(doc, { block, offset: offset - unitBefore(current, offset) }, selection.focus);
}

export function deleteForward(doc: RichText, selection: Selection): Edit {
  if (!isCollapsed(selection)) {
    const [start, end] = orderedRange(selection);
    return deleteRange(doc, start, end);
  }

  const { block, offset } = selection.focus;
  const current = doc.blocks[block]!;

  if (offset >= blockLength(current)) {
    if (block >= doc.blocks.length - 1) return { doc, selection };
    return deleteRange(doc, selection.focus, { block: block + 1, offset: 0 });
  }

  return deleteRange(doc, selection.focus, { block, offset: offset + unitAfter(current, offset) });
}

/** How many offsets the character before `offset` takes: 2 for a surrogate pair. */
function unitBefore(block: Block, offset: number): number {
  const [item] = sliceInline(block.content, offset - 1, offset);

  if (item?.type === "text") {
    const pair = sliceInline(block.content, Math.max(0, offset - 2), offset)[0];
    if (pair?.type === "text" && pair.text.length === 2 && /^[\uD800-\uDBFF][\uDC00-\uDFFF]$/.test(pair.text)) return 2;
  }

  return 1;
}

function unitAfter(block: Block, offset: number): number {
  const pair = sliceInline(block.content, offset, offset + 2)[0];

  return pair?.type === "text" && /^[\uD800-\uDBFF][\uDC00-\uDFFF]$/.test(pair.text) ? 2 : 1;
}

/** Every inline item the selection covers, across blocks. */
function selectedItems(doc: RichText, selection: Selection): Inline[] {
  const [start, end] = orderedRange(selection);
  const items: Inline[] = [];

  for (let index = start.block; index <= end.block; index += 1) {
    const block = doc.blocks[index]!;
    const from = index === start.block ? start.offset : 0;
    const to = index === end.block ? end.offset : Infinity;

    items.push(...sliceInline(block.content, from, to));
  }

  return items.filter((item) => item.type !== "break");
}

/** True when every selected character carries the mark — the button's `aria-pressed`. */
export function hasMark(doc: RichText, selection: Selection, mark: "bold" | "italic" | "link"): boolean {
  if (isCollapsed(selection)) {
    return Boolean(marksAt(doc, selection.focus)[mark]);
  }

  const items = selectedItems(doc, selection);

  return items.length > 0 && items.every((item) => item.type !== "break" && Boolean(item.marks[mark]));
}

/** Applies `change` to the marks of everything selected. */
function mapMarks(doc: RichText, selection: Selection, change: (marks: Marks) => Marks): Edit {
  const [start, end] = orderedRange(selection);
  const next = cloneDoc(doc);

  for (let index = start.block; index <= end.block; index += 1) {
    const block = next.blocks[index]!;
    const from = index === start.block ? start.offset : 0;
    const to = index === end.block ? end.offset : blockLength(block);
    const middle = sliceInline(block.content, from, to).map((item): Inline =>
      item.type === "break" ? item : { ...item, marks: change(item.marks) },
    );

    next.blocks[index] = {
      ...block,
      content: normalizeInline([
        ...sliceInline(block.content, 0, from),
        ...middle,
        ...sliceInline(block.content, to, Infinity),
      ]),
    };
  }

  return { doc: next, selection };
}

export function toggleMark(doc: RichText, selection: Selection, mark: "bold" | "italic"): Edit {
  const on = !hasMark(doc, selection, mark);

  return mapMarks(doc, selection, (marks) => {
    const next = { ...marks };

    if (on) next[mark] = true;
    else delete next[mark];

    return next;
  });
}

export function setLink(doc: RichText, selection: Selection, link: LinkMark | null): Edit {
  return mapMarks(doc, selection, (marks) => {
    const next = { ...marks };

    if (link) next.link = link;
    else delete next.link;

    return next;
  });
}

/** The link the caret or the selection stands in, whole. */
export function linkRangeAt(doc: RichText, position: Position): { from: number; to: number; link: LinkMark } | null {
  const content = doc.blocks[position.block]?.content ?? [];
  let at = 0;
  const spans: Array<{ from: number; to: number; link?: LinkMark }> = [];

  for (const item of content) {
    const length = itemLength(item);
    const link = item.type === "break" ? undefined : item.marks.link;
    const last = spans[spans.length - 1];

    if (last && sameLink(last.link, link)) last.to = at + length;
    else spans.push({ from: at, to: at + length, link });

    at += length;
  }

  const hit = spans.find((span) => span.link && span.from <= position.offset && position.offset <= span.to && span.to > span.from);

  return hit?.link ? { from: hit.from, to: hit.to, link: hit.link } : null;
}

/**
 * List buttons: every selected block becomes an item of that kind, or — when
 * all already are — goes back to being a paragraph.
 */
export function toggleBlockType(doc: RichText, selection: Selection, type: "bullet" | "numbered"): Edit {
  const [start, end] = orderedRange(selection);
  const next = cloneDoc(doc);
  const all = next.blocks.slice(start.block, end.block + 1).every((block) => block.type === type);

  for (let index = start.block; index <= end.block; index += 1) {
    const block = next.blocks[index]!;
    // A break cannot live in a list item — the viewer's item is one line.
    const content = all
      ? block.content
      : normalizeInline(block.content.map((item): Inline => (item.type === "break" ? { type: "text", text: " ", marks: {} } : item)));

    next.blocks[index] = { type: all ? "paragraph" : type, content };
  }

  return { doc: next, selection };
}

export function blockTypeAt(doc: RichText, selection: Selection): BlockType {
  const [start, end] = orderedRange(selection);
  const types = new Set(doc.blocks.slice(start.block, end.block + 1).map((block) => block.type));

  return types.size === 1 ? [...types][0]! : "paragraph";
}

/** The chip exactly covered by the selection, if the selection is one chip. */
export function selectedChip(doc: RichText, selection: Selection): { name: string; position: Position } | null {
  const [start, end] = orderedRange(selection);

  if (start.block !== end.block || end.offset - start.offset !== 1) return null;

  const [item] = sliceInline(doc.blocks[start.block]!.content, start.offset, end.offset);

  return item?.type === "chip" ? { name: item.name, position: start } : null;
}

/** A chip swapped for another answer, keeping its place and its marks. */
export function replaceChip(doc: RichText, position: Position, name: string): Edit {
  const block = doc.blocks[position.block]!;
  const [item] = sliceInline(block.content, position.offset, position.offset + 1);

  if (item?.type !== "chip") return { doc, selection: caret(position) };

  const next = cloneDoc(doc);

  next.blocks[position.block] = {
    ...block,
    content: [
      ...sliceInline(block.content, 0, position.offset),
      { type: "chip", name, marks: item.marks },
      ...sliceInline(block.content, position.offset + 1, Infinity),
    ],
  };

  const chipEnd = { block: position.block, offset: position.offset + 1 };

  return { doc: next, selection: { anchor: position, focus: chipEnd } };
}

/**
 * Several blocks put where the selection is — a paste. The first and the last
 * join the block the caret is in; the ones between keep their own kind.
 */
export function insertBlocks(doc: RichText, selection: Selection, blocks: Block[]): Edit {
  if (blocks.length === 0) return deleteRange(doc, ...orderedRange(selection));
  if (blocks.length === 1) return insertInline(doc, selection, blocks[0]!.content);

  const [start, end] = orderedRange(selection);
  const cleared = deleteRange(doc, start, end).doc;
  const block = cleared.blocks[start.block]!;
  const head = sliceInline(block.content, 0, start.offset);
  const tail = sliceInline(block.content, start.offset, Infinity);
  const first = blocks[0]!;
  const last = blocks[blocks.length - 1]!;
  const lastLength = last.content.reduce((sum, item) => sum + itemLength(item), 0);
  const replacement: Block[] = [
    { ...block, content: normalizeInline([...head, ...first.content]) },
    ...blocks.slice(1, -1),
    { ...last, content: normalizeInline([...last.content, ...tail]) },
  ];

  cleared.blocks.splice(start.block, 1, ...replacement);

  return {
    doc: cleared,
    selection: caret({ block: start.block + blocks.length - 1, offset: lastLength }),
  };
}

/**
 * Plain text as blocks: every line a paragraph (136 criterion 9: *ren text
 * behåller radbrytningar*). In a one-line field the lines are one line with a
 * space between — nothing dropped (criterion 5).
 */
export function blocksFromPlainText(text: string, inline: boolean): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  if (inline) {
    return [{ type: "paragraph", content: textContent(lines.map((line) => line.trim()).filter(Boolean).join(" ")) }];
  }

  return lines.map((line) => ({ type: "paragraph", content: textContent(line) }));
}

function textContent(text: string): Inline[] {
  return text ? [{ type: "text", text, marks: {} }] : [];
}

/** Every chip name in the text, in order — for the missing-reference marks. */
export function chipNames(doc: RichText): string[] {
  return doc.blocks.flatMap((block) => block.content.flatMap((item) => (item.type === "chip" ? [item.name] : [])));
}

/** The selected part of the text as a text of its own — what a copy carries. */
export function extractRange(doc: RichText, selection: Selection): RichText {
  const [start, end] = orderedRange(selection);
  const blocks: Block[] = [];

  for (let index = start.block; index <= end.block; index += 1) {
    const block = doc.blocks[index]!;
    const from = index === start.block ? start.offset : 0;
    const to = index === end.block ? end.offset : Infinity;

    blocks.push({ type: block.type, content: sliceInline(block.content, from, to) });
  }

  return { blocks };
}
