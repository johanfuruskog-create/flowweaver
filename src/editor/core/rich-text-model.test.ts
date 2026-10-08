import { describe, expect, it, test } from "vitest";

import "../../viewer/node-types/default-node-types";
// FlowWeaver PRO's sending types are registered on top (open-core step 4).
import { migrateGraph, readGraphVersion } from "../../viewer/core/graph-migrations";
import { getNodeType } from "../../viewer/node-types/node-type-registry";
import type { GraphData } from "../../viewer/types/graph";
import type { FormattingFeature } from "../../viewer/types/node-types";
import {
  caret,
  deleteBackward,
  insertInline,
  insertText,
  isFaithful,
  parseRichText,
  replaceChip,
  splitBlock,
  toggleBlockType,
  toggleMark,
  writeRichText,
  type ParseOptions,
  type RichText,
} from "./rich-text-model";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../testing/optional-pro";
await withPro("viewer/node-types/submission-node-types.ts", "editor/node-types/submission-node-properties.ts");
// Every guide here: PRO's list (open and PRO) where it is, the open list where not.
import { BUNDLED_GRAPHS as OPEN_GRAPHS } from "../../data/bundled-graphs";
const BUNDLED_GRAPHS: Array<[string, GraphData]> =
  ((await proModule("data/bundled-graphs.ts"))?.ALL_BUNDLED_GRAPHS as Array<[string, GraphData]> | undefined) ?? OPEN_GRAPHS;
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

const ALL: FormattingFeature[] = ["variable", "bold", "italic", "link", "bullet-list", "numbered-list"];
const MULTI: ParseOptions = { features: ALL };

/*
 * Every formatted text in a guide we ship, with the options the field will
 * read it with: the node type's own `formatting`, and one line for a title —
 * the viewer draws every title inline (`guide-preview` `formatTitle`).
 */
function formattedTexts(graphs: Array<[string, GraphData]>): Array<[string, string, ParseOptions]> {
  const out: Array<[string, string, ParseOptions]> = [];
  const walk = (value: unknown, visit: (text: string) => void): void => {
    if (typeof value === "string") visit(value);
    else if (Array.isArray(value)) value.forEach((item) => walk(item, visit));
    else if (value && typeof value === "object") Object.values(value).forEach((item) => walk(item, visit));
  };

  for (const [name, graph] of graphs) {
    for (const node of graph.nodes) {
      for (const property of getNodeType(node.type)?.properties ?? []) {
        if (!property.formatting) continue;

        walk(node.data[property.id], (text) =>
          out.push([`${name} ${node.id}.${property.id}`, text, { features: property.formatting!, inline: property.id === "title" }]),
        );
      }
    }
  }

  return out;
}

describe("förlustfritt över exempelguiderna (136 kriterium 6, 137 kriterium 1)", () => {
  const texts = formattedTexts(BUNDLED_GRAPHS);

  test.runIf(PRO)("det finns texter att pröva, med varje konstruktion urvalet har", () => {
    // Measured 25/9: 1 190 strings. What they hold is what the test can see —
    // PRAXIS 4, the second question. Links do not occur in the bundled guides;
    // the real agency's guides below carry them.
    expect(texts.length).toBeGreaterThan(1000);
    const all = texts.map(([, text]) => text).join("\n");
    expect(all).toMatch(/\*\*[^*]+\*\*/);
    expect(all).toMatch(/(^|[^*])\*[^*]+\*([^*]|$)/);
    expect(all).toMatch(/{{[^}]+}}/);
    expect(all).toMatch(/\n- /);
    expect(all).toMatch(/\n\n/);
    expect(all).toMatch(/[^\n]\n[^\n-]/);
  });

  test.each(texts)("%s", (_where, text, options) => {
    const doc = parseRichText(text, options);

    expect(doc).not.toBeNull();
    expect(writeRichText(doc!, options)).toBe(text);
  });
});

describe("myndighetens guider (examples/*.json) — länkarna finns här", () => {
  const files = import.meta.glob(["../../../examples/*.json"], {
    import: "default",
    eager: true,
  }) as Record<string, Record<string, unknown>>;
  const graphs = Object.entries(files).map(([path, raw]): [string, GraphData] => [
    path.replace(/^.*examples\//, ""),
    migrateGraph(raw, readGraphVersion(raw)).graph as unknown as GraphData,
  ]);
  const texts = formattedTexts(graphs);

  test.runIf(PRO)("det finns länkar att pröva", () => {
    expect(texts.some(([, text]) => /\]\(\//.test(text))).toBe(true);
  });

  /*
   * Read, not necessarily letter for letter: one of 183 ends in two blank
   * lines, which the viewer draws as nothing and the writer does not write
   * (measured 25/9). Opened, it is a model; untouched, it is never rewritten
   * — that is the field's promise, not the parser's.
   */
  test.each(texts)("%s går att läsa", (_where, text, options) => {
    expect(parseRichText(text, options)).not.toBeNull();
  });
});

describe("tolken gissar aldrig — null betyder textläge (136 kriterium 8)", () => {
  it.each([
    // Bold opens before a link and closes inside it: the viewer draws crossed tags.
    ["fetstil som korsar en länk", "**a [b** c](/x)"],
    // The viewer runs bold and italic over the address too.
    ["en stjärna i en adress", "[a](/x*y) och *b*"],
    // Our own stand-ins cannot occur in a text we read.
    ["ett tecken ur privata området", "a\uE001b"],
  ])("%s", (_name, text) => {
    expect(parseRichText(text, MULTI)).toBeNull();
  });

  it("läser det visaren läser, också hörnen: fetstil med kursiv inuti är inte fet i visaren", () => {
    const doc = parseRichText("**a *b* c**", MULTI)!;

    expect(doc.blocks[0]!.content.some((item) => item.type === "text" && item.marks.bold)).toBe(false);
  });

  it("en länk visaren vägrar är text", () => {
    const doc = parseRichText("[klicka](javascript:alert(1))", MULTI)!;

    expect(doc.blocks[0]!.content.every((item) => item.type !== "text" || !item.marks.link)).toBe(true);
  });

  it("formaten nodtypen inte ger är tecken: '1. ' i en rubrik är text", () => {
    const options = { features: ["variable"] as FormattingFeature[], inline: true };
    const doc = parseRichText("1. Börja **här**", options)!;

    expect(doc.blocks).toHaveLength(1);
    expect(doc.blocks[0]!.content).toEqual([{ type: "text", text: "1. Börja **här**", marks: {} }]);
  });
});

describe("bokstavliga tecken (136 kriterium 7b e)", () => {
  const literal = (text: string): RichText => ({ blocks: [{ type: "paragraph", content: [{ type: "text", text, marks: {} }] }] });

  it.each([
    ["en ensam stjärna", "5 * 3 är femton"],
    ["en ensam hakparentes", "[obs: se nedan"],
    ["en stängande hakparentes", "punkt a] och b]"],
    ["två klamrar utan slut", "skriv {{ här"],
    ["två stjärnor utan text emellan", "a ** b"],
  ])("%s skrivs så att visaren visar tecknen", (_name, text) => {
    const doc = literal(text);
    const written = writeRichText(doc, MULTI);

    expect(isFaithful(doc, MULTI)).toBe(true);
    expect(parseRichText(written, MULTI)).toEqual(doc);
  });

  /*
   * The pair the viewer would read as markup is written with a backslash
   * (the viewer's escape, 25/9), and read back as the same characters.
   */
  it.each([
    ["stjärnor kring text", "2*3*4", "2\\*3\\*4"],
    ["en länk skriven som text", "[a](/b)", "\\[a](/b)"],
    ["ett svar skrivet som text", "{{namn}}", "\\{{namn}}"],
  ])("%s lagras bokstavligt", (_name, text, stored) => {
    const doc = literal(text);

    expect(writeRichText(doc, MULTI)).toBe(stored);
    expect(isFaithful(doc, MULTI)).toBe(true);
    expect(parseRichText(stored, MULTI)).toEqual(doc);
  });

  it("bara raden som behöver det får backslash; en ensam stjärna på en annan rad lämnas", () => {
    const doc: RichText = {
      blocks: [
        { type: "paragraph", content: [{ type: "text", text: "5 * 3", marks: {} }] },
        { type: "paragraph", content: [{ type: "text", text: "a*b*c", marks: {} }] },
      ],
    };

    expect(writeRichText(doc, MULTI)).toBe("5 * 3\n\na\\*b\\*c");
  });

  it("en stjärna inuti fetstil går att skriva", () => {
    const doc: RichText = { blocks: [{ type: "paragraph", content: [{ type: "text", text: "a*b", marks: { bold: true } }] }] };

    expect(writeRichText(doc, MULTI)).toBe("**a\\*b**");
    expect(parseRichText("**a\\*b**", MULTI)).toEqual(doc);
  });
});

describe("en form per konstruktion (137 kriterium 4)", () => {
  it("fetstil över text, bricka, text blir ett spann: **a{{x}}b**", () => {
    const doc = parseRichText("a{{x}}b", MULTI)!;
    const edit = toggleMark(doc, { anchor: { block: 0, offset: 0 }, focus: { block: 0, offset: 3 } }, "bold");

    expect(writeRichText(edit.doc, MULTI)).toBe("**a{{x}}b**");
  });

  it("kursiv runt fetstil, aldrig tvärtom", () => {
    const doc = parseRichText("*a **b** c*", MULTI)!;

    expect(writeRichText(doc, MULTI)).toBe("*a **b** c*");
  });

  it("en numrerad lista numreras om", () => {
    const doc = parseRichText("1. a\n1. b\n7. c", MULTI)!;

    expect(writeRichText(doc, MULTI)).toBe("1. a\n2. b\n3. c");
  });
});

describe("redigering i modellen", () => {
  it("svar mitt i ett ord: ab{{x}}cd (137 handling 6)", () => {
    const doc = parseRichText("abcd", MULTI)!;
    const edit = insertInline(doc, caret({ block: 0, offset: 2 }), [{ type: "chip", name: "x", marks: {} }]);

    expect(writeRichText(edit.doc, MULTI)).toBe("ab{{x}}cd");
    expect(edit.selection.focus).toEqual({ block: 0, offset: 3 });
  });

  it("Backspace efter en bricka tar hela brickan, aldrig en bokstav ur namnet (handling 7)", () => {
    const doc = parseRichText("ab{{fornamn}}cd", MULTI)!;
    const edit = deleteBackward(doc, caret({ block: 0, offset: 3 }));

    expect(writeRichText(edit.doc, MULTI)).toBe("abcd");
  });

  it("byt en bricka: platsen och fetstilen står kvar", () => {
    const doc = parseRichText("Hej **{{namn}}**!", MULTI)!;
    const edit = replaceChip(doc, { block: 0, offset: 4 }, "fornamn");

    expect(writeRichText(edit.doc, MULTI)).toBe("Hej **{{fornamn}}**!");
  });

  it("Enter två gånger i en punktlista lämnar listan (handling 5)", () => {
    let doc = parseRichText("- a", MULTI)!;
    let selection = caret({ block: 0, offset: 1 });

    ({ doc, selection } = splitBlock(doc, selection));
    ({ doc, selection } = insertText(doc, selection, "b"));
    ({ doc, selection } = splitBlock(doc, selection));
    ({ doc, selection } = splitBlock(doc, selection));

    expect(doc.blocks.map((block) => block.type)).toEqual(["bullet", "bullet", "paragraph"]);
    expect(writeRichText(doc, MULTI)).toBe("- a\n- b");
  });

  it("ändra ett ord: fetstil, bricka, lista och radbrytning runt omkring står kvar (7b b)", () => {
    const text = "**{{namn}}** vill boka {{tjanst.label}}.\n\n- Helst: {{tid1}}\n- Annars: {{tid2}}\n\nSvara till {{epost}}\nmed en tid.";
    const doc = parseRichText(text, MULTI)!;
    // "vill" → "ska", in the first paragraph: after the chip (1) and " " (1).
    const edit = insertText(doc, { anchor: { block: 0, offset: 2 }, focus: { block: 0, offset: 6 } }, "ska");

    expect(writeRichText(edit.doc, MULTI)).toBe(text.replace("vill", "ska"));
  });

  it("punktlista på ett stycke med radbrytning blir en rad — visarens punkt är en rad", () => {
    const doc = parseRichText("a\nb", MULTI)!;
    const edit = toggleBlockType(doc, caret({ block: 0, offset: 0 }), "bullet");

    expect(writeRichText(edit.doc, MULTI)).toBe("- a b");
  });
});
