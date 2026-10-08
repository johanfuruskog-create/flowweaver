import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";

import { GuideTraversalEngine } from "../core/guide-traversal-engine";
import { getNodeType } from "../node-types/node-type-registry";
import { PageFieldsService } from "./page-fields-service";
import { PageFieldValidationService } from "./page-field-validation-service";
import { RatingScaleService } from "./rating-scale-service";
import { TemplateVariableService } from "./template-variable-service";

import type { FlowNodeData, GraphData } from "../types/graph";

/**
 * The rating (story 115): a scale that answers with a number.
 *
 * ## What the answer is
 *
 * The step's PLACE, as text (Johan 13/9). That is what lets a rule ask
 * `betyg < 7` and a calculation take an average — a choice's answer is a code
 * somebody typed, and no arithmetic can be done on it. The words are the
 * *display*: the review, the answer record and `{{betyg}}` in a letter all map
 * the number back to *Ganska bra* through the same list the choice types use.
 *
 * ## Why *Inte aktuellt* is a pair and not an empty string
 *
 * Because an empty string cannot say which of two things happened. Somebody who
 * pressed *Inte aktuellt* and somebody who answered nothing would arrive as the
 * same answer, and the review has to be able to tell them apart. The pair
 * carries the words with an empty value: the words are what a person reads
 * back, the empty value is what keeps the answer out of an average — a nought
 * would drag the mean down for everybody with no opinion.
 */

const ratingNode = (data: Record<string, unknown>): FlowNodeData =>
  ({
    id: "f",
    type: "rating-question",
    position: { x: 0, y: 0 },
    data: { title: { sv: "Hur trivs du?" }, variableName: "trivsel", ...data },
  }) as unknown as FlowNodeData;

const pageWith = (data: Record<string, unknown>): GraphData =>
  ({
    startNodeId: "p",
    settings: { sourceLocale: "sv" },
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
      { ...ratingNode(data), parentPageId: "p", order: 0 },
    ],
    connections: [],
  }) as unknown as GraphData;

const fieldOf = (data: Record<string, unknown>) => {
  const graph = pageWith(data);

  return PageFieldsService.getFields(graph, graph.nodes[0]!)[0]!;
};

/** A guide of one rating step, so the engine can be asked for its answer. */
const stepGuide = (data: Record<string, unknown>): GraphData =>
  ({
    startNodeId: "f",
    settings: { sourceLocale: "sv" },
    nodes: [
      ratingNode(data),
      { id: "r", type: "result", position: { x: 300, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "f", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  }) as unknown as GraphData;

describe("the rating node type", () => {
  test("is registered, answers with a number and may sit on a page", () => {
    const type = getNodeType("rating-question");

    expect(type?.behavior?.answer?.input).toBe("rating");
    expect(type?.behavior?.flow?.kind).toBe("linear");
    expect(type?.variableType).toBe("number");
    expect(type?.canBeInPage).toBe(true);
  });

  test("starts as four steps, and holds the count between two and eleven", () => {
    expect(RatingScaleService.stepCount(ratingNode({}))).toBe(4);
    expect(RatingScaleService.stepCount(ratingNode({ steps: 10 }))).toBe(10);
    expect(RatingScaleService.stepCount(ratingNode({ steps: 1 }))).toBe(2);
    expect(RatingScaleService.stepCount(ratingNode({ steps: 40 }))).toBe(11);
  });

  test("a step's value is its place, and a step without a word shows its number", () => {
    const steps = RatingScaleService.steps(
      ratingNode({ steps: 4, labels: [{ sv: "Dåligt" }, "", { sv: "Bra" }] }),
      "sv",
    );

    expect(steps.map((step) => step.value)).toEqual(["1", "2", "3", "4"]);
    expect(steps.map((step) => step.label)).toEqual(["Dåligt", "2", "Bra", "4"]);
  });

  test("both ways out are off until the editor turns them on", () => {
    expect(RatingScaleService.waysOut(ratingNode({}), "sv")).toEqual([]);
    expect(RatingScaleService.waysOut(ratingNode({ dontKnow: true }), "sv")).toEqual(["Vet ej"]);
  });

  test("and they come in the order the visitor meets them: the question, then themselves", () => {
    expect(
      RatingScaleService.waysOut(ratingNode({ notApplicable: true, dontKnow: true }), "sv"),
    ).toEqual(["Inte aktuellt", "Vet ej"]);
  });

  test("the built-in words are in the reader's language; the editor's beat them", () => {
    // A default stored in the graph could only ever be the language its editor
    // happened to write in.
    expect(
      RatingScaleService.waysOut(ratingNode({ notApplicable: true, dontKnow: true }), "en"),
    ).toEqual(["Not applicable", "Don't know"]);
    expect(
      RatingScaleService.waysOut(
        ratingNode({ notApplicable: true, notApplicableLabel: { sv: "Bor inte här" } }),
        "sv",
      ),
    ).toEqual(["Bor inte här"]);
  });
});

describe("a rating on a page", () => {
  test("is a field of its own with the steps as its options", () => {
    const field = fieldOf({ steps: 3, labels: [{ sv: "Dåligt" }, { sv: "Bra" }, { sv: "Bäst" }] });

    expect(field.type).toBe("rating");
    expect(field.options.map((option) => option.value)).toEqual(["1", "2", "3"]);
  });

  test("carries the ways out it was given, and nothing when it was given none", () => {
    expect(fieldOf({}).waysOut).toEqual([]);
    expect(fieldOf({ notApplicable: true, dontKnow: true }).waysOut).toEqual([
      "Inte aktuellt",
      "Vet ej",
    ]);
  });

  test("reads an answer back as the word, not the number", () => {
    const field = fieldOf({ steps: 4, labels: [{ sv: "Dåligt" }, { sv: "Sådär" }, { sv: "Bra" }, { sv: "Bäst" }] });

    expect(PageFieldsService.answerLabel(field, "3", "sv")).toBe("Bra");
  });

  test("says choose an option when a required scale is untouched", () => {
    const field = fieldOf({ required: true });

    // Not "Fältet är obligatoriskt": a scale is chosen, like a choice.
    expect(PageFieldValidationService.getMessage(field, "", "sv")).toBe("Välj ett alternativ.");
    expect(PageFieldValidationService.getMessage(field, "2", "sv")).toBeNull();
  });
});

describe("the answer a rating leaves", () => {
  test("is the step's place as a number", () => {
    const engine = new GuideTraversalEngine(stepGuide({ steps: 4 }), { locale: "sv" });

    expect(engine.answerValue("3").success).toBe(true);
    expect(engine.getAnswers().trivsel).toBe("3");
  });

  test("is refused when the scale has no such step", () => {
    const engine = new GuideTraversalEngine(stepGuide({ steps: 4 }), { locale: "sv" });

    expect(engine.answerValue("9").success).toBe(false);
  });

  test("records the word beside the number, so a review can read it", () => {
    const engine = new GuideTraversalEngine(
      stepGuide({ steps: 4, labels: [{ sv: "Dåligt" }, { sv: "Sådär" }, { sv: "Bra" }, { sv: "Bäst" }] }),
      { locale: "sv" },
    );

    engine.answerValue("2");

    expect(engine.getAnswerRecords()[0]?.optionLabel).toBe("Sådär");
  });

  test("refuses an empty scale when the editor made it required", () => {
    const engine = new GuideTraversalEngine(stepGuide({ required: true }), { locale: "sv" });
    const result = engine.answerValue("");

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.message).toBe("Välj ett alternativ.");
  });

  test("lets an optional scale be left alone, and says so in the record", () => {
    const engine = new GuideTraversalEngine(stepGuide({}), { locale: "sv" });

    expect(engine.answerValue("").success).toBe(true);
    expect(engine.getAnswerRecords()[0]?.optionLabel).toBe("Inget svar");
  });

  test("keeps a way out apart from an unanswered scale", () => {
    const engine = new GuideTraversalEngine(stepGuide({ notApplicable: true }), { locale: "sv" });

    engine.answerValue({ label: "Inte aktuellt", value: "" });

    // The words for the review; the empty value for everything that counts.
    expect(engine.getAnswerRecords()[0]?.optionLabel).toBe("Inte aktuellt");
    expect(engine.getAnswers()["trivsel.value"] ?? (engine.getAnswers().trivsel as Record<string, string>).value).toBe("");
  });
});

describe("what reads the answer afterwards", () => {
  test("a letter writes the word", () => {
    const graph = stepGuide({ steps: 4, labels: [{ sv: "Dåligt" }, { sv: "Sådär" }, { sv: "Bra" }, { sv: "Bäst" }] });
    const filled = TemplateVariableService.resolve("Du svarade {{trivsel}}.", { trivsel: "3" }, graph, "sv");

    expect(filled.resolved).toBe("Du svarade Bra.");
  });

  test("and writes the way out's words when that was the answer", () => {
    const graph = stepGuide({ notApplicable: true });
    const filled = TemplateVariableService.resolve(
      "Du svarade {{trivsel}}.",
      { trivsel: { label: "Inte aktuellt", value: "" } },
      graph,
      "sv",
    );

    expect(filled.resolved).toBe("Du svarade Inte aktuellt.");
  });
});
