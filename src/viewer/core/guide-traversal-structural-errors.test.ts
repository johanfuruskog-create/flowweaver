import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { GuideTraversalEngine } from "./guide-traversal-engine";

import type { GraphData } from "../types/graph";

/**
 * The engine's remaining structural failures, follow-up to the dead-end pair
 * in `guide-traversal-dead-end.test.ts`.
 *
 * Before this change all 35 `this.failure(code, "svensk text")` calls in
 * `guide-traversal-engine.ts` produced a fixed Swedish sentence regardless of
 * the guide's language — the engine has a `locale` and never used it for
 * these. These tests are the ones that were seen to fail against the old
 * code: Swedish stayed Swedish with `locale: "en"` set.
 */

const choice = (): GraphData => ({
  startNodeId: "fraga",
  nodes: [
    {
      id: "fraga",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: "Är du nöjd?",
        variableName: "nojd",
        options: [
          { id: "ja", label: "Ja", value: "ja" },
          { id: "nej", label: "Nej", value: "nej" },
        ],
      },
    },
  ],
  connections: [],
});

/** A question whose only connection points at a node that does not exist. */
const brokenTarget = (): GraphData => ({
  startNodeId: "namn",
  nodes: [
    {
      id: "namn",
      type: "text-question",
      position: { x: 0, y: 0 },
      data: { title: "Vad heter du?", variableName: "namn" },
    },
  ],
  connections: [
    { id: "c", from: { nodeId: "namn", portId: "continue" }, to: { nodeId: "spöke", portId: "input" } },
  ],
});

describe("a guide with no start node", () => {
  test("says so in Swedish by default", () => {
    const graph = choice();
    graph.startNodeId = null;
    const engine = new GuideTraversalEngine(graph);

    expect(engine.getCurrentResult()).toMatchObject({
      error: { code: "missing-start-node", message: "Guiden saknar startnod." },
    });
  });

  test("and in the guide's own language when it has one", () => {
    const graph = choice();
    graph.startNodeId = null;
    const engine = new GuideTraversalEngine(graph, { locale: "en" });

    expect(engine.getCurrentResult()).toMatchObject({
      error: { message: "This guide has no start step." },
    });
  });
});

describe("goToNode() at a step that does not exist", () => {
  test("names the step, in Swedish and in English, with the id interpolated", () => {
    const sv = new GuideTraversalEngine(choice());
    const en = new GuideTraversalEngine(choice(), { locale: "en" });

    expect(sv.goToNode("spöke")).toMatchObject({
      error: {
        code: "current-node-missing",
        message: 'Noden "spöke" finns inte i guiden.',
        params: { nodeId: "spöke" },
      },
    });
    expect(en.goToNode("spöke")).toMatchObject({
      error: { message: 'The step "spöke" does not exist in this guide.' },
    });
  });
});

describe("a connection to a step that does not exist", () => {
  test("names the missing target, localised", () => {
    const sv = new GuideTraversalEngine(brokenTarget());
    const en = new GuideTraversalEngine(brokenTarget(), { locale: "en" });

    expect(sv.answerValue("Johan")).toMatchObject({
      error: {
        code: "target-node-missing",
        message: 'Kopplingens målnod "spöke" finns inte.',
        params: { nodeId: "spöke" },
      },
    });
    expect(en.answerValue("Johan")).toMatchObject({
      error: { message: 'The target step "spöke" does not exist.' },
    });
  });
});

describe("choosing an option that no longer exists on the question", () => {
  /*
   * The interpolation case the mission asked for by name: the chosen id
   * reaches the sentence, in whichever language the guide is shown in.
   * Reuses `validation.optionMissing` — the branching-question path
   * (`answerDeclarative`) already said exactly this for the same fault, so
   * `answer()`'s own check was given the same key instead of a second one
   * with identical wording.
   */
  test("names the option, localised", () => {
    const sv = new GuideTraversalEngine(choice());
    const en = new GuideTraversalEngine(choice(), { locale: "en" });

    expect(sv.answer("kanske")).toMatchObject({
      error: {
        code: "unknown-option",
        message: 'Alternativet "kanske" finns inte på frågan.',
        params: { value: "kanske" },
      },
    });
    expect(en.answer("kanske")).toMatchObject({
      error: { message: 'The option "kanske" does not exist on the question.' },
    });
  });
});
