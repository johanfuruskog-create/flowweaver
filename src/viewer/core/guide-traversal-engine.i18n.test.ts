import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { GuideTraversalEngine } from "./guide-traversal-engine";

import type { GraphData } from "../types/graph";

/** A simple graph with a question of any type plus a result. */
function graph(type: string, data: Record<string, unknown>): GraphData {
  return {
    startNodeId: "q",
    nodes: [
      { id: "q", type, position: { x: 0, y: 0 }, data: { variableName: "v", ...data } },
      { id: "done", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart" } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "done", portId: "input" } },
    ],
  } as GraphData;
}

function errorFor(
  type: string,
  data: Record<string, unknown>,
  value: string,
  locale?: string
): string {
  const engine = new GuideTraversalEngine(
    graph(type, data),
    locale ? { locale } : undefined
  );
  const result = engine.answerValue(value);
  if (result.success) throw new Error("förväntade ett valideringsfel");
  return result.error.message;
}

describe("the engine's validation messages are localised (every language)", () => {
  test("Swedish is the default", () => {
    expect(errorFor("text-question", { required: true }, "")).toBe(
      "Fältet är obligatoriskt."
    );
    expect(errorFor("text-question", { maxLength: 5 }, "abcdef")).toBe(
      "Texten får innehålla högst 5 tecken."
    );
    expect(errorFor("text-question", { minLength: 3 }, "ab")).toBe(
      "Texten måste innehålla minst 3 tecken."
    );
    expect(errorFor("text-question", { format: "email" }, "abc")).toBe(
      "Ange en giltig e-postadress."
    );
    expect(errorFor("number-question", {}, "inte-ett-tal")).toBe(
      "Ange ett giltigt tal."
    );
    expect(errorFor("number-question", { max: 10 }, "20")).toBe(
      "Värdet får vara högst 10."
    );
    expect(
      errorFor("multi-choice", {
        minSelected: 2,
        options: [
          { id: "a", label: "A", value: "a" },
          { id: "b", label: "B", value: "b" },
        ],
      }, "a")
    ).toBe("Välj minst 2 alternativ.");
  });

  test("engelska via locale-option", () => {
    expect(errorFor("text-question", { required: true }, "", "en")).toBe(
      "This field is required."
    );
    expect(errorFor("text-question", { maxLength: 5 }, "abcdef", "en")).toBe(
      "Enter at most 5 characters."
    );
    expect(errorFor("text-question", { format: "email" }, "abc", "en")).toBe(
      "Enter a valid email address."
    );
    expect(errorFor("number-question", { max: 10 }, "20", "en")).toBe(
      "The value must be at most 10."
    );
    expect(
      errorFor("multi-choice", {
        minSelected: 2,
        options: [
          { id: "a", label: "A", value: "a" },
          { id: "b", label: "B", value: "b" },
        ],
      }, "a", "en")
    ).toBe("Select at least 2 options.");
  });

  test("setLocale switches the language on an existing engine", () => {
    const engine = new GuideTraversalEngine(graph("text-question", { required: true }));
    engine.setLocale("en");
    const result = engine.answerValue("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe("This field is required.");
    }
  });

  /*
   * K1: the committed trail label for an unanswered, optional field was
   * hardcoded Swedish ("Inget svar") in the engine, not routed through
   * `this.text()` the way every validation message is — found while
   * K-measuring B4-B6 (Ted had already caught the file-field case in the
   * review). An English guide's review/receipt showed Swedish for every
   * skipped optional question, map, rating and consent.
   */
  test("den obesvarade etiketten följer locale, inte bara valideringsmeddelandena", () => {
    const engine = new GuideTraversalEngine(
      graph("text-question", { required: false }),
      { locale: "en" }
    );
    const result = engine.answerValue("");
    expect(result.success).toBe(true);
    expect(engine.getAnswerRecords().at(-1)?.optionLabel).toBe("No answer");
  });
});
