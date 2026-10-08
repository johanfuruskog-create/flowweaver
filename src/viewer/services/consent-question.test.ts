import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";

import { getNodeType } from "../node-types/node-type-registry";
import { PageFieldsService } from "./page-fields-service";
import { PageFieldValidationService } from "./page-field-validation-service";

import type { FlowNodeData, GraphData } from "../types/graph";

/**
 * A consent tick, which is not a multiple-choice question with one option.
 *
 * ## Why it is its own thing
 *
 * You could build it today: a `multi-choice` with a single option and
 * `minSelected: 1`. That works and it is wrong in three ways an editor has to
 * work around every time.
 *
 * - It renders as a **group** — a fieldset with a legend and one checkbox inside
 *   it. A consent is one control with one label, and a screen reader should hear
 *   one thing, not a group of one.
 * - The requirement is expressed as *"choose at least one of one"*, which is a
 *   sentence nobody would write on purpose.
 * - The answer is stored as a list. Every rule that reads it has to know that,
 *   and every result that prints it prints a list.
 *
 * ## What it stores
 *
 * `"true"` when ticked and `""` when not, so a rule reads `equals true` — the
 * sentence somebody would say. Not `"yes"`, which would be a word in one
 * language, and not a boolean, because every other answer in a guide is text and
 * a lone exception is a trap for whoever writes the next rule.
 *
 * ## The label carries a link
 *
 * A consent almost always points at something — terms, a privacy notice. The
 * text is formatted rather than plain for exactly that reason, and it is why
 * this is not simply `required` on a heading.
 */

const page = (fieldData: Record<string, unknown>): GraphData =>
  ({
    startNodeId: "p",
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
      {
        id: "f",
        type: "consent-question",
        parentPageId: "p",
        order: 0,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Jag godkänner villkoren" }, variableName: "samtycke", ...fieldData },
      } as unknown as FlowNodeData,
    ],
    connections: [],
  }) as unknown as GraphData;

const fieldOf = (data: Record<string, unknown>) => {
  const graph = page(data);
  const sida = graph.nodes.find((node) => node.type === "page")!;

  return PageFieldsService.getFields(graph, sida)[0];
};

describe("the consent node type", () => {
  test("is registered and takes a single answer", () => {
    const type = getNodeType("consent-question");

    expect(type).toBeTruthy();
    expect(type?.behavior?.answer?.input).toBe("consent");
    expect(type?.behavior?.answer?.cardinality).toBe("single");
  });

  test("belongs on a page, which is where a form puts it", () => {
    expect(getNodeType("consent-question")?.canBeInPage).toBe(true);
  });

  test("stores text, like every other answer", () => {
    // A lone boolean among text answers is a trap for whoever writes the next
    // rule against it.
    expect(getNodeType("consent-question")?.variableType).toBe("text");
  });
});

describe("a consent field on a page", () => {
  test("is a consent and not a choice", () => {
    // The type is what decides the control: one checkbox with one label, rather
    // than a fieldset containing one checkbox.
    expect(fieldOf({})?.type).toBe("consent");
  });

  test("can be demanded", () => {
    expect(fieldOf({ required: true })?.required).toBe(true);
  });

  test("is not required unless somebody says so", () => {
    // Not every consent is compulsory — a newsletter opt-in is the ordinary
    // case of one that is not.
    expect(fieldOf({})?.required).toBe(false);
  });
});

describe("validating a consent", () => {
  const message = (data: Record<string, unknown>, value: string) =>
    PageFieldValidationService.getMessage(fieldOf(data)!, value);

  test("a required one must be ticked", () => {
    expect(message({ required: true }, "")).toBeTruthy();
  });

  test("a ticked one passes", () => {
    expect(message({ required: true }, "true")).toBeNull();
  });

  test("an optional one passes either way", () => {
    expect(message({}, "")).toBeNull();
    expect(message({}, "true")).toBeNull();
  });

  test("says it must be ticked, not that something must be chosen", () => {
    /*
     * The message is the whole reason this is not a multiple-choice with one
     * option: "välj minst ett alternativ" in front of a single checkbox reads
     * as a fault in the form rather than as an instruction.
     */
    const said = message({ required: true }, "") ?? "";

    expect(said).not.toMatch(/minst ett|at least one/i);
  });
});
