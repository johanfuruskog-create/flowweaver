import { describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";
import { GuideTraversalEngine } from "../viewer/core/guide-traversal-engine";
import { toStepViewModel } from "./step-view-model";

import type { GraphData } from "../viewer/types/graph";

const graph: GraphData = {
  startNodeId: "pris",
  nodes: [
    { id: "pris", type: "number-question", position: { x: 0, y: 0 }, data: { title: "Bostadspris", description: "Ange priset.", variableName: "pris", unit: "kr", min: 0, step: 10000 } },
    {
      id: "calc",
      type: "calculation",
      position: { x: 300, y: 0 },
      data: {
        title: "Bolånekalkyl",
        assignments: [
          { id: "a1", variableName: "maxLån", formula: "min(pris * 0,85 ; 3000000)" },
        ],
      },
    },
    { id: "result", type: "result", position: { x: 600, y: 0 }, data: { title: "Klart", description: "Du kan låna upp till {{maxLån}} kr." } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "pris", portId: "continue" }, to: { nodeId: "calc", portId: "input" } },
    { id: "c2", from: { nodeId: "calc", portId: "continue" }, to: { nodeId: "result", portId: "input" } },
  ],
};

const vmFor = (engine: GuideTraversalEngine) =>
  toStepViewModel(engine.getCurrentNode()!, engine.getAnswers(), graph, {
    stepNumber: engine.getStepNumber(),
    canGoBack: engine.canGoBack(),
  });

describe("toStepViewModel", () => {
  test("describes a number question without revealing anything about the logic", () => {
    const engine = new GuideTraversalEngine(graph);
    const vm = vmFor(engine);

    expect(vm).toMatchObject({
      kind: "number",
      title: "Bostadspris",
      unit: "kr",
      min: 0,
      step: 10000,
    });
  });

  test("the result's text has the computed value but never the formula", () => {
    const engine = new GuideTraversalEngine(graph);
    engine.answerValue("3000000");
    const vm = vmFor(engine);

    expect(vm.kind).toBe("result");
    if (vm.kind !== "result") throw new Error("Förväntade ett resultat.");

    // The final value shows …
    /*
     * Grouped, because that is what somebody reads. It said `2550000` until a
     * calculated amount started being grouped the way an answered one always
     * was — the marker was the raw digits, not the claim, and the claim here is
     * that the *value* comes out and the formula does not.
     */
    expect(vm.body).toContain("2\u00a0550\u00a0000");
    // … but neither the formula, the function nor the template comes along.
    expect(vm.body).not.toContain("min(");
    expect(vm.body).not.toContain("0,85");
    expect(vm.body).not.toContain("{{");

    // The whole serialised view model is free of formula characters.
    const serialized = JSON.stringify(vm);
    expect(serialized).not.toContain("min(");
    expect(serialized).not.toContain("* 0,85");
  });

  test("the step label is Resultat for results, otherwise Steg N, localised", () => {
    const engine = new GuideTraversalEngine(graph);

    const question = vmFor(engine);
    if (question.kind === "unsupported") throw new Error("Förväntade ett steg.");
    expect(question.stepLabel).toBe("Steg 1");

    engine.answerValue("3000000"); // sifferfråga → uträkning → resultat
    const result = vmFor(engine);
    if (result.kind === "unsupported") throw new Error("Förväntade ett resultat.");
    expect(result.stepLabel).toBe("Resultat");

    const resultEn = toStepViewModel(
      engine.getCurrentNode()!,
      engine.getAnswers(),
      graph,
      { stepNumber: engine.getStepNumber(), canGoBack: engine.canGoBack() },
      "en"
    );
    if (resultEn.kind === "unsupported") throw new Error("Förväntade ett resultat.");
    expect(resultEn.stepLabel).toBe("Result");
  });

  test("resolves the view model in the user's language, with source fallback and button texts", () => {
    const localeGraph: GraphData = {
      startNodeId: "q",
      nodes: [
        {
          id: "q",
          type: "question",
          position: { x: 0, y: 0 },
          data: {
            title: { sv: "Vill du fortsätta?", en: "Do you want to continue?" },
            continueLabel: { sv: "Vidare", en: "Onward" },
            options: [
              { id: "yes", label: { sv: "Ja", en: "Yes" }, value: "yes" },
              { id: "no", label: "Nej", value: "no" }, // bara källa → fallback
            ],
          },
        },
        { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: "Klart" } },
      ],
      connections: [
        { id: "c1", from: { nodeId: "q", portId: "yes" }, to: { nodeId: "r", portId: "input" } },
        { id: "c2", from: { nodeId: "q", portId: "no" }, to: { nodeId: "r", portId: "input" } },
      ],
      settings: { strings: { "nav.previous": { en: "Go back" } } },
    };

    const engine = new GuideTraversalEngine(localeGraph);
    const vm = toStepViewModel(
      engine.getCurrentNode()!,
      {},
      localeGraph,
      { stepNumber: 1, canGoBack: false },
      "en"
    );

    expect(vm.kind).toBe("choice");
    if (vm.kind !== "choice") throw new Error("choice förväntades");
    expect(vm.title).toBe("Do you want to continue?");
    expect(vm.options.map((option) => option.label)).toEqual(["Yes", "Nej"]);
    // Button texts: the node's continueLabel + the guide's override, localised.
    expect(vm.labels.next).toBe("Onward");
    expect(vm.labels.back).toBe("Go back");
    expect(vm.labels.restart).toBe("Restart"); // ingen override → inbyggd default
  });

  test("describes the choice question's options without variable names or rules", () => {
    const choiceGraph: GraphData = {
      startNodeId: "q",
      nodes: [
        { id: "q", type: "question", position: { x: 0, y: 0 }, data: { title: "Välj", variableName: "svar", options: [
          { id: "o1", label: "Ja", value: "yes" },
          { id: "o2", label: "Nej", value: "no" },
        ] } },
        { id: "r", type: "result", position: { x: 300, y: 0 }, data: { title: "Klart" } },
      ],
      connections: [
        { id: "c", from: { nodeId: "q", portId: "o1" }, to: { nodeId: "r", portId: "input" } },
      ],
    };
    const engine = new GuideTraversalEngine(choiceGraph);
    const vm = toStepViewModel(engine.getCurrentNode()!, engine.getAnswers(), choiceGraph, {
      stepNumber: 1,
      canGoBack: false,
    });

    expect(vm).toMatchObject({
      kind: "choice",
      options: [
        { id: "o1", label: "Ja" },
        { id: "o2", label: "Nej" },
      ],
    });
    // The client sees only label and id, not the underlying value.
    expect(JSON.stringify(vm)).not.toContain("yes");
  });
});
