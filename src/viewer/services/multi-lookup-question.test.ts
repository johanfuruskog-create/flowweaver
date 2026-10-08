import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";

import { getNodeType } from "../node-types/node-type-registry";
import { PageFieldsService } from "./page-fields-service";
import { PageFieldValidationService } from "./page-field-validation-service";

import type { FlowNodeData, GraphData } from "../types/graph";

/**
 * Several values from a searched list, as a node an editor can pick.
 *
 * The component already holds a list — see `lookup-field-multiple` — and this is
 * the rest of the way: a node type, a field on a page, and a rule that can read
 * what came back.
 *
 * ## Why a node type of its own
 *
 * `multi-choice` and `question` are separate types for the same reason: how many
 * answers a question takes changes what an editor is configuring, not just how
 * it looks. A flag on the existing type would put `minSelected` and `maxSelected`
 * in front of somebody building a single-answer field, where they mean nothing.
 *
 * ## What it stores
 *
 * Newline-separated, in both variables. The labels in `variableName` and the
 * codes as a part of the same answer — the same pair a single lookup has always
 * stored, both simply become lists.
 *
 * ## Counting
 *
 * `minSelected` and `maxSelected`, named as `multi-choice` names them, because
 * an editor who has met one has met the other.
 */

const page = (fieldData: Record<string, unknown>): GraphData =>
  ({
    startNodeId: "p",
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
      {
        id: "f",
        type: "multi-autocomplete-question",
        parentPageId: "p",
        order: 0,
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Vilka språk talar du?" },
          variableName: "sprak",
          source: "codelist",
          codeListId: "navet-country-codes",
          ...fieldData,
        },
      } as unknown as FlowNodeData,
    ],
    connections: [],
  }) as unknown as GraphData;

const fieldOf = (data: Record<string, unknown>) => {
  const graph = page(data);
  const sida = graph.nodes.find((node) => node.type === "page")!;

  return PageFieldsService.getFields(graph, sida)[0];
};

describe("the node type", () => {
  test("is registered and takes several answers", () => {
    const type = getNodeType("multi-autocomplete-question");

    expect(type).toBeTruthy();
    expect(type?.behavior?.answer?.cardinality).toBe("multi");
    expect(type?.behavior?.answer?.input).toBe("lookup");
  });

  test("belongs on a page", () => {
    expect(getNodeType("multi-autocomplete-question")?.canBeInPage).toBe(true);
  });

  test("counts the way multiple-choice counts", () => {
    const ids = (getNodeType("multi-autocomplete-question")?.properties ?? []).map(
      (property) => property.id,
    );

    // The same names, because an editor who has met one has met the other.
    expect(ids).toContain("minSelected");
    expect(ids).toContain("maxSelected");
    /*
     * Ingen `codeVariableName` sedan version 9: koden är en DEL av svaret
     * (`sprak.value`), inte en variabel bredvid det. Egenskapen fanns för att
     * ett villkor bara kunde namnge en hel variabel.
     */
    expect(ids).not.toContain("codeVariableName");
  });

  test("keeps the settings a searched list needs", () => {
    const ids = (getNodeType("multi-autocomplete-question")?.properties ?? []).map(
      (property) => property.id,
    );

    expect(ids).toContain("source");
    expect(ids).toContain("codeListId");
    expect(ids).toContain("minChars");
  });
});

describe("as a field on a page", () => {
  test("is a lookup that takes several", () => {
    const field = fieldOf({});

    expect(field?.type).toBe("lookup");
    expect(field?.multiple).toBe(true);
  });

  test("a single lookup is not", () => {
    const graph = page({});
    const node = graph.nodes.find((one) => one.id === "f")!;

    (node as { type: string }).type = "autocomplete-question";

    const sida = graph.nodes.find((one) => one.type === "page")!;

    expect(PageFieldsService.getFields(graph, sida)[0]?.multiple).toBeFalsy();
  });

  test("carries how many are wanted", () => {
    const field = fieldOf({ minSelected: 1, maxSelected: 3 });

    expect(field?.minSelected).toBe(1);
    expect(field?.maxSelected).toBe(3);
  });
});

describe("validating how many were chosen", () => {
  const message = (data: Record<string, unknown>, value: string) =>
    PageFieldValidationService.getMessage(fieldOf(data)!, value);

  test("accepts a count inside the range", () => {
    expect(message({ minSelected: 1, maxSelected: 3 }, "sv\nen")).toBeNull();
  });

  test("refuses too few", () => {
    expect(message({ minSelected: 2 }, "sv")).toBeTruthy();
  });

  test("refuses too many", () => {
    expect(message({ maxSelected: 2 }, "sv\nen\nfi")).toBeTruthy();
  });

  test("counts entries and not characters", () => {
    // The mistake a newline-separated value invites: "sv\nen" is two answers,
    // not five characters.
    expect(message({ maxSelected: 2 }, "sv\nen")).toBeNull();
  });

  test("leaves an unanswered field to the required rule", () => {
    expect(message({ minSelected: 2 }, "")).toBeNull();
  });

  test("ignores blank entries, which a half-finished edit leaves behind", () => {
    expect(message({ maxSelected: 2 }, "sv\n\nen\n")).toBeNull();
  });
});
