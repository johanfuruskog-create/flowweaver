import { describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";
import { GuideTraversalEngine } from "../viewer/core/guide-traversal-engine";
import { validateGraph } from "../editor/core/graph-validator";
import { exampleGraph } from "./example-graph";
import { pageBuilderExampleGraph } from "./page-builder-example-graph";
import { basicExampleGraph } from "./profile-example-graphs";

describe("exampleGraph", () => {
  test("has valid examples for every feature level", () => {
    expect(validateGraph(basicExampleGraph)).toEqual([]);
    expect(validateGraph(exampleGraph)).toEqual([]);
  });

  test("keeps Basic to choice questions and results", () => {
    expect(new Set(basicExampleGraph.nodes.map((node) => node.type))).toEqual(
      new Set(["question", "result"])
    );
  });

  test("leads the Basic driving-licence guide through ordinary questions to a result", () => {
    const basicGuide = new GuideTraversalEngine(basicExampleGraph);

    expect(basicGuide.answer("basic-age-yes")).toMatchObject({
      success: true,
      node: { id: "basic-vision" },
    });
    expect(basicGuide.answer("basic-vision-yes")).toMatchObject({
      success: true,
      node: { id: "basic-permit" },
    });
    expect(basicGuide.answer("basic-permit-yes")).toMatchObject({
      success: true,
      node: { id: "basic-ready" },
    });
  });

  test("har ett separat giltigt Page Builder-exempel", () => {
    expect(validateGraph(pageBuilderExampleGraph)).toEqual([]);
    const guide = new GuideTraversalEngine(pageBuilderExampleGraph);

    expect(guide.answerPage({
      applicantName: "Kim Andersson",
      municipality: "Örebro",
      applicantAge: "30",
    })).toMatchObject({ success: true, node: { id: "service-contact-page" } });
    expect(guide.answerPage({
      contactMethod: "email",
      emailAddress: "kim@example.se",
    })).toMatchObject({ success: true, node: { id: "service-email-complete" } });
  });
  test("is a valid, connected example guide", () => {
    expect(validateGraph(exampleGraph)).toEqual([]);
  });

  test("has a multi-step path to the result", () => {
    const engine = new GuideTraversalEngine(exampleGraph);

    expect(engine.answerValue("70")).toMatchObject({
      success: true,
      node: { id: "question-gender" },
    });
    expect(engine.answer("gender-male")).toMatchObject({
      success: true,
      node: { id: "question-male-information" },
    });
    expect(engine.answer("male-information-yes")).toMatchObject({
      success: true,
      node: { id: "question-vision" },
    });
    expect(engine.answer("vision-yes")).toMatchObject({
      success: true,
      node: { id: "question-permit" },
    });
    expect(engine.answer("permit-yes")).toMatchObject({
      success: true,
      node: { id: "result-ready" },
    });
    expect(engine.getStepNumber()).toBe(6);
  });

  test("lets other adults skip the male-only extra question", () => {
    const engine = new GuideTraversalEngine(exampleGraph);

    engine.answerValue("40");
    expect(engine.answer("gender-female")).toMatchObject({
      success: true,
      node: { id: "question-vision" },
    });
  });

  test("sends children down the age rule's Barn path without asking about sex", () => {
    const engine = new GuideTraversalEngine(exampleGraph);

    expect(engine.answerValue("12")).toMatchObject({
      success: true,
      node: { id: "result-age" },
    });
  });
});
