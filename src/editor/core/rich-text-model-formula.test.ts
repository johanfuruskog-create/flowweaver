import { describe, expect, test } from "vitest";
import "../../viewer/node-types/default-node-types";
import { BUNDLED_GRAPHS } from "../../data/bundled-graphs";
import { CalculationService } from "../../viewer/services/calculation-service";
import type { GraphData } from "../../viewer/types/graph";
import { caret, insertText, isFaithful, parseRichText, writeRichText, type ParseOptions, type RichText } from "./rich-text-model";

/**
 * Story 139 — the formula mode: a known variable is a chip, everything else
 * is formula text. The stored string is the formula as the parser reads it,
 * never Markdown: no escapes, no `{{…}}`, no marks.
 */

const options = (...known: string[]): ParseOptions => ({
  features: ["variable"],
  inline: true,
  formula: { known: new Set(known) },
});

/** The model as one line: `[name]` for a chip, text as is. */
function shape(doc: RichText): string {
  return doc.blocks
    .map((block) => block.content.map((item) => (item.type === "chip" ? `[${item.name}]` : item.type === "text" ? item.text : "\n")).join(""))
    .join("\n");
}

describe("formelläget (139)", () => {
  test("kända namn blir brickor, allt annat är formeltext, och strängen skrivs tillbaka som den var", () => {
    const opts = options("grund", "barntillagg");
    const source = "round(min(grund + barntillagg; 9000))";
    const doc = parseRichText(source, opts)!;

    expect(shape(doc)).toBe("round(min([grund] + [barntillagg]; 9000))");
    expect(writeRichText(doc, opts)).toBe(source);
    expect(isFaithful(doc, opts)).toBe(true);
  });

  test("en delsträng är ingen bricka, och ett funktionsanrop är text fastän namnet är känt", () => {
    const opts = options("grund", "min");

    expect(shape(parseRichText("grundbelopp * 2 + grund_2", opts)!)).toBe("grundbelopp * 2 + grund_2");
    expect(shape(parseRichText("min(grund; 1) + min (2; 3) + min", opts)!)).toBe("min([grund]; 1) + min (2; 3) + [min]");
  });

  test("markören inne i ett namn ger ingen bricka — namnet skrivs fortfarande", () => {
    const opts = options("barn", "inkomst");
    const marker = "";
    const doc = parseRichText(`barn${marker} + inkomst`, opts)!;

    expect(shape(doc)).toBe(`barn${marker} + [inkomst]`);
  });

  test("stjärnor, klamrar och hakparenteser är tecken — inga escapes, ingen kursiv", () => {
    const opts = options("a");
    const typed = insertText({ blocks: [{ type: "paragraph", content: [] }] }, caret({ block: 0, offset: 0 }), "a * 2 * [x] {{y}}").doc;

    expect(writeRichText(typed, opts)).toBe("a * 2 * [x] {{y}}");
    expect(shape(parseRichText("a * 2 * [x] {{y}}", opts)!)).toBe("[a] * 2 * [x] {{y}}");
  });

  test("varje buntad guides formel läses och skrivs tecken för tecken, och räknar samma", () => {
    let seen = 0;

    for (const [, graph] of BUNDLED_GRAPHS as Array<[string, GraphData]>) {
      const known = new Set<string>();

      for (const node of graph.nodes) {
        const name = (node.data as { variableName?: string }).variableName;

        if (typeof name === "string" && name) known.add(name);
        for (const row of CalculationService.parseAssignments((node.data as { assignments?: unknown }).assignments)) known.add(row.variableName);
      }
      const opts = { features: ["variable"], inline: true, formula: { known } } as ParseOptions;

      for (const node of graph.nodes) {
        for (const row of CalculationService.parseAssignments((node.data as { assignments?: unknown }).assignments)) {
          const doc = parseRichText(row.formula, opts);

          expect(doc, `${node.id}: ${row.formula}`).not.toBeNull();
          expect(writeRichText(doc!, opts), `${node.id}: ${row.formula}`).toBe(row.formula);
          seen += 1;
        }
      }
    }
    expect(seen).toBeGreaterThan(10);
  });
});
