import {
  normalizeInline,
  type Block,
  type BlockType,
  type Inline,
  type LinkMark,
  type Marks,
  type Position,
  type RichText,
} from "../../core/rich-text-model";

/**
 * Any DOM read back into the model — the one reader for two jobs.
 *
 * **The field's own DOM after the browser changed it** (137 point 2, path b):
 * dictation, autocorrect and IME composition do not always announce
 * themselves through a cancelable `beforeinput`, so the browser writes, and
 * the field reads what it wrote. Whatever the engine produced — a `<div>`
 * where we drew a `<p>`, a `<b>`, a `<span style>`, a stray `&nbsp;` — comes
 * back as the model's six constructions, and the next render draws them the
 * one way.
 *
 * **Pasted HTML** (136 criterion 9): Word's and a web page's markup goes
 * through the same reading. What the model has a word for survives — bold,
 * italic, links, lists, paragraphs, line breaks; everything else is text or
 * nothing.
 *
 * The positions asked for come back as model positions, so the caret survives
 * the reading. A point inside a chip is before it (`start`) or after it
 * (`end`): a chip has no inside.
 */

export interface DomPoint {
  node: Node;
  offset: number;
  bias?: "start" | "end";
}

export interface DomReading {
  doc: RichText;
  positions: Array<Position | null>;
}

const BLOCK_TAGS = new Set([
  "P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE", "SECTION",
  "ARTICLE", "HEADER", "FOOTER", "ASIDE", "MAIN", "NAV", "TR", "DT", "DD", "FIGURE",
  "FIGCAPTION", "ADDRESS", "TABLE", "TBODY", "THEAD", "TFOOT", "DL",
]);
const SKIPPED_TAGS = new Set(["STYLE", "SCRIPT", "HEAD", "TITLE", "META", "LINK", "TEMPLATE", "NOSCRIPT", "SVG", "IMG", "VIDEO", "AUDIO", "IFRAME", "OBJECT"]);

export function readDom(root: Node, points: DomPoint[] = []): DomReading {
  const blocks: Block[] = [];
  let current: Block | null = null;
  const positions: Array<Position | null> = points.map(() => null);
  // Points waiting for the next piece of content to say where they are.
  const waiting: number[] = [];

  const length = (block: Block): number =>
    block.content.reduce((sum, item) => sum + (item.type === "text" ? item.text.length : 1), 0);

  const here = (): Position => (current ? { block: blocks.length - 1, offset: length(current) } : { block: blocks.length, offset: 0 });

  const settle = (): void => {
    const position = here();

    while (waiting.length > 0) positions[waiting.shift()!] = position;
  };

  const openBlock = (type: BlockType): void => {
    current = { type, content: [] };
    blocks.push(current);
    settle();
  };

  const closeBlock = (): void => {
    current = null;
  };

  const ensureBlock = (): Block => {
    if (!current) openBlock("paragraph");
    return current!;
  };

  const push = (item: Inline): void => {
    ensureBlock().content.push(item);
  };

  const markPointsAt = (node: Node, offset: number): void => {
    points.forEach((point, index) => {
      if (positions[index] === null && !waiting.includes(index) && point.node === node && point.offset === offset) {
        waiting.push(index);
      }
    });
  };

  const walk = (node: Node, marks: Marks, list: BlockType | null): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.nodeValue ?? "";
      /*
       * The word joiner the field draws before each chip (fynd f) is its own
       * and never text: removed by where it stands — in the chip's wrapper —
       * not by what it is, so a U+2060 anywhere else is read as it came. What
       * the engine typed into the wrapper beside it is kept.
       */
      const own = node.parentElement?.hasAttribute("data-chip-glue") ?? false;
      const kept = own ? value.replace(/\u2060/g, "") : value;
      const raw = kept.replace(/\u00A0/g, " ");
      // Markup's own indentation between tags is not text.
      const text = (/^\s*$/.test(raw) && raw.includes("\n") ? "" : raw).replace(/[\r\n]+/g, " ");
      // A point counts the characters before it that were kept.
      const offsetOf = (offset: number): number =>
        own ? value.slice(0, offset).replace(/\u2060/g, "").length : offset;

      settle();
      if (text) ensureBlock();

      const at = here();

      points.forEach((point, index) => {
        if (positions[index] === null && point.node === node) {
          positions[index] = { block: at.block, offset: at.offset + Math.min(offsetOf(point.offset), text.length) };
        }
      });

      if (text) push({ type: "text", text, marks: cleanMarks(marks) });
      return;
    }

    if (!(node instanceof Element)) return;

    const tag = node.tagName.toUpperCase();

    if (SKIPPED_TAGS.has(tag)) return;

    if (node.hasAttribute("data-chip")) {
      const name = node.getAttribute("data-variable") ?? "";
      const source = node.getAttribute("data-source") ?? undefined;

      settle();
      points.forEach((point, index) => {
        if (positions[index] === null && (point.node === node || node.contains(point.node)) && point.node !== node.parentNode) {
          const at = here();
          const inside = point.node !== node || point.offset > 0;

          positions[index] = { ...at, offset: at.offset + (point.bias === "end" && inside ? 1 : 0) };
        }
      });
      push(source ? { type: "chip", name, source, marks: cleanMarks(marks) } : { type: "chip", name, marks: cleanMarks(marks) });
      return;
    }

    if (tag === "BR") {
      if (!node.hasAttribute("data-filler") && current && list === null) push({ type: "break" });
      settle();
      return;
    }

    if (tag === "UL" || tag === "OL") {
      closeBlock();
      walkChildren(node, marks, tag === "UL" ? "bullet" : "numbered");
      closeBlock();
      return;
    }

    if (tag === "LI") {
      closeBlock();
      openBlock(list ?? "bullet");
      walkChildren(node, marks, list ?? "bullet");
      closeBlock();
      return;
    }

    if (BLOCK_TAGS.has(tag)) {
      closeBlock();
      markPointsAt(node, 0);
      walkChildren(node, marks, null);
      closeBlock();
      return;
    }

    walkChildren(node, { ...marks, ...inlineMarks(node, marks) }, list);
  };

  const walkChildren = (node: Node, marks: Marks, list: BlockType | null): void => {
    const children = [...node.childNodes];

    children.forEach((child, index) => {
      markPointsAt(node, index);
      settle();
      walk(child, marks, list);
      // A table cell is text in a row, with a space before the next cell.
      if (child instanceof Element && /^(TD|TH)$/i.test(child.tagName) && index < children.length - 1) {
        push({ type: "text", text: " ", marks: {} });
      }
    });
    markPointsAt(node, children.length);
    settle();
  };

  if (root instanceof Element || root instanceof DocumentFragment || root instanceof Document) {
    walkChildren(root, {}, null);
  } else {
    walk(root, {}, null);
  }

  settle();

  const doc: RichText = {
    blocks: blocks.length > 0
      ? blocks.map((block) => ({ ...block, content: normalizeInline(block.content) }))
      : [{ type: "paragraph", content: [] }],
  };

  return { doc, positions };
}

/** What an inline element says about bold, italic and links — tag or style. */
function inlineMarks(element: Element, outer: Marks): Marks {
  const tag = element.tagName.toUpperCase();
  const style = element instanceof HTMLElement ? element.style : null;
  const weight = style?.fontWeight ?? "";
  const marks: Marks = {};
  const heavy = weight === "bold" || weight === "bolder" || Number(weight) >= 600;
  const light = weight === "normal" || weight === "lighter" || (Number(weight) > 0 && Number(weight) < 600);

  // Google Docs wraps a whole paste in `<b style="font-weight:normal">`.
  if ((tag === "STRONG" || tag === "B" || heavy) && !light) marks.bold = true;
  if (light && outer.bold) marks.bold = undefined;
  if (tag === "EM" || tag === "I" || style?.fontStyle === "italic") marks.italic = true;
  if (style?.fontStyle === "normal" && outer.italic) marks.italic = undefined;

  if (tag === "A" && element.getAttribute("href")) {
    const link: LinkMark = { url: element.getAttribute("href")! };
    const ref = element.getAttribute("data-ref");

    if (ref) link.ref = ref;
    marks.link = link;
  }

  return marks;
}

/** Marks made plain again: `undefined` keys dropped, so two runs compare equal. */
export function cleanMarks(marks: Marks): Marks {
  const out: Marks = {};

  if (marks.bold) out.bold = true;
  if (marks.italic) out.italic = true;
  if (marks.link) out.link = marks.link;
  return out;
}
