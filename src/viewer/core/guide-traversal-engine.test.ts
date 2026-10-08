import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { GuideTraversalEngine } from "./guide-traversal-engine";

import type { GraphData } from "../types/graph";

const createGraph = (): GraphData => ({
  startNodeId: "question",
  nodes: [
    {
      id: "question",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: "Är du nöjd?",
        variableName: "satisfied",
        options: [
          { id: "yes", label: "Ja", value: "yes" },
          { id: "no", label: "Nej", value: "no" },
        ],
      },
    },
    {
      id: "result-yes",
      type: "result",
      position: { x: 400, y: -100 },
      data: { title: "Vad bra!" },
    },
    {
      id: "result-no",
      type: "result",
      position: { x: 400, y: 100 },
      data: { title: "Vad tråkigt." },
    },
  ],
  connections: [
    {
      id: "yes-result",
      from: { nodeId: "question", portId: "yes" },
      to: { nodeId: "result-yes", portId: "input" },
    },
    {
      id: "no-result",
      from: { nodeId: "question", portId: "no" },
      to: { nodeId: "result-no", portId: "input" },
    },
  ],
});

describe("GuideTraversalEngine", () => {
  test("starts at the graph's explicit start node", () => {
    const engine = new GuideTraversalEngine(createGraph());

    expect(engine.getCurrentNode()).toMatchObject({
      id: "question",
      type: "question",
      data: { title: "Är du nöjd?" },
    });
    expect(engine.getStepNumber()).toBe(1);
  });

  test("follows the chosen option's connection to the right result", () => {
    const engine = new GuideTraversalEngine(createGraph());

    const result = engine.answer("no");

    expect(result).toMatchObject({
      success: true,
      node: { id: "result-no", type: "result" },
    });
    expect(engine.getCurrentNode()?.id).toBe("result-no");
    expect(engine.getAnswers()).toEqual({ satisfied: "no" });
    expect(engine.getAnswerRecords()).toEqual([
      {
        questionId: "question",
        variableName: "satisfied",
        questionTitle: "Är du nöjd?",
        optionId: "no",
        optionLabel: "Nej",
        value: "no",
      },
    ]);
  });

  test("follows several questions and gathers answers along the way", () => {
    const graph = createGraph();
    graph.nodes.push({
      id: "follow-up",
      type: "question",
      position: { x: 400, y: 0 },
      data: {
        title: "Vill du fortsätta?",
        variableName: "continue",
        options: [{ id: "continue-yes", label: "Ja", value: "yes" }],
      },
    });
    graph.connections = [
      {
        id: "yes-follow-up",
        from: { nodeId: "question", portId: "yes" },
        to: { nodeId: "follow-up", portId: "input" },
      },
      {
        id: "follow-up-result",
        from: { nodeId: "follow-up", portId: "continue-yes" },
        to: { nodeId: "result-yes", portId: "input" },
      },
      graph.connections[1]!,
    ];
    const engine = new GuideTraversalEngine(graph);

    expect(engine.answer("yes")).toMatchObject({
      success: true,
      node: { id: "follow-up" },
    });
    expect(engine.answer("continue-yes")).toMatchObject({
      success: true,
      node: { id: "result-yes" },
    });
    expect(engine.getAnswers()).toEqual({
      satisfied: "yes",
      continue: "yes",
    });
  });

  test("passerar automatiskt en regel via Sant eller Falskt", () => {
    const graph = createGraph();
    graph.nodes.push({
      id: "satisfied-rule",
      type: "rule",
      position: { x: 200, y: 0 },
      data: {
        title: "Är nöjd",
        cases: [
          { id: "satisfied", label: "Om nöjd", match: "all", conditions: [{ id: "satisfied-condition", variableName: "satisfied", operator: "equals", value: "yes" }] },
        ],
        fallbackLabel: "Annars",
      },
    });
    graph.connections = [
      {
        id: "yes-rule",
        from: { nodeId: "question", portId: "yes" },
        to: { nodeId: "satisfied-rule", portId: "input" },
      },
      {
        id: "rule-true",
        from: { nodeId: "satisfied-rule", portId: "satisfied" },
        to: { nodeId: "result-yes", portId: "input" },
      },
      {
        id: "rule-false",
        from: { nodeId: "satisfied-rule", portId: "default" },
        to: { nodeId: "result-no", portId: "input" },
      },
      graph.connections[1]!,
    ];

    expect(new GuideTraversalEngine(graph).answer("yes")).toMatchObject({
      success: true,
      node: { id: "result-yes" },
    });
  });

  test("reports a rule that uses a missing answer", () => {
    const graph = createGraph();
    graph.nodes.push({
      id: "missing-rule",
      type: "rule",
      position: { x: 200, y: 0 },
      data: {
        title: "Saknat svar",
        cases: [
          { id: "yes", label: "Om ja", match: "all", conditions: [{ id: "unknown-condition", variableName: "unknown", operator: "equals", value: "yes" }] },
        ],
        fallbackLabel: "Annars",
      },
    });
    graph.connections[0] = {
      id: "yes-rule",
      from: { nodeId: "question", portId: "yes" },
      to: { nodeId: "missing-rule", portId: "input" },
    };

    expect(new GuideTraversalEngine(graph).answer("yes")).toMatchObject({
      success: false,
      error: { code: "invalid-rule" },
    });
  });

  test("kan startas om och rensar tidigare svar", () => {
    const engine = new GuideTraversalEngine(createGraph());
    engine.answer("yes");

    const result = engine.restart();

    expect(result).toMatchObject({
      success: true,
      node: { id: "question" },
    });
    expect(engine.getAnswers()).toEqual({});
  });

  /*
   * Bakåt tar tillbaka läget och körningen — men inte det ifyllda.
   *
   * Testet krävde först att `getAnswers()` var tomt efter ett steg bakåt, medan
   * raden under kräver att alternativet fortfarande är valt: radion såg ifylld
   * ut medan svaret var borta. I visaren blev det synligt i ett textfält: att
   * gå tillbaka från granskningen för att rätta en bokstav tömde fältet och
   * låste Nästa. Lagningen behöll svaren — och sedan 6/9 skiljs de två åt:
   * fältet fylls ur `getPrefill()`, körningen ur `getAnswers()`. Se
   * `guide-traversal-engine.back.test.ts` för varför.
   */
  test("can go back to the previous step with the answer still in the field", () => {
    const engine = new GuideTraversalEngine(createGraph());
    engine.answer("no");

    expect(engine.canGoBack()).toBe(true);
    expect(engine.getStepNumber()).toBe(2);
    expect(engine.previous()).toMatchObject({
      success: true,
      node: { id: "question" },
    });
    expect(engine.getPrefill()).toEqual({ satisfied: "no" });
    // Spåret och körningen rullas tillbaka: man står på frågan igen, alltså
    // har man inte svarat (6/9 — se back-testet för varför de två skiljs).
    expect(engine.getAnswers()).toEqual({});
    expect(engine.getAnswerRecords()).toEqual([]);
    expect(engine.getSelectedOptionId()).toBe("no");
    expect(engine.canGoBack()).toBe(false);
    expect(engine.getStepNumber()).toBe(1);
  });

  test("can inspect an arbitrary node without changing earlier answers", () => {
    const engine = new GuideTraversalEngine(createGraph());
    engine.answer("yes");

    const result = engine.goToNode("question");

    expect(result).toMatchObject({
      success: true,
      node: { id: "question" },
    });
    expect(engine.getAnswers()).toEqual({ satisfied: "yes" });
  });

  test("reports when the graph has no start node", () => {
    const graph = createGraph();
    graph.startNodeId = null;
    const engine = new GuideTraversalEngine(graph);

    expect(engine.getCurrentResult()).toEqual({
      success: false,
      error: {
        code: "missing-start-node",
        message: "Guiden saknar startnod.",
      },
    });
  });

  test("reports when the start node's id is not in the graph", () => {
    const graph = createGraph();
    graph.startNodeId = "missing-question";
    const engine = new GuideTraversalEngine(graph);

    expect(engine.getCurrentResult()).toMatchObject({
      success: false,
      error: { code: "current-node-missing" },
    });
  });

  test("rejects an unknown option without changing the current node", () => {
    const engine = new GuideTraversalEngine(createGraph());

    expect(engine.answer("unknown")).toMatchObject({
      success: false,
      error: { code: "unknown-option" },
    });
    expect(engine.getCurrentNode()?.id).toBe("question");
    expect(engine.getAnswers()).toEqual({});
  });

  test("rapporterar ett alternativ som saknar koppling", () => {
    const graph = createGraph();
    graph.connections = graph.connections.filter(
      (connection) => connection.from.portId !== "no"
    );
    const engine = new GuideTraversalEngine(graph);

    expect(engine.answer("no")).toMatchObject({
      success: false,
      error: { code: "missing-connection" },
    });
    expect(engine.getCurrentNode()?.id).toBe("question");
  });

  test("reports a connection to an unknown node", () => {
    const graph = createGraph();
    graph.connections[0]!.to.nodeId = "missing-result";
    const engine = new GuideTraversalEngine(graph);

    expect(engine.answer("yes")).toMatchObject({
      success: false,
      error: { code: "target-node-missing" },
    });
    expect(engine.getCurrentNode()?.id).toBe("question");
  });

  test("rejects an answer when the current node is not a question", () => {
    const engine = new GuideTraversalEngine(createGraph());
    engine.answer("yes");

    expect(engine.answer("yes")).toMatchObject({
      success: false,
      error: { code: "current-node-not-question" },
    });
  });

  test("muterar aldrig grafen eller data som returneras till konsumenten", () => {
    const graph = createGraph();
    const original = structuredClone(graph);
    const engine = new GuideTraversalEngine(graph);
    const currentNode = engine.getCurrentNode();

    if (currentNode) {
      currentNode.data.title = "Ändrad utanför motorn";
    }
    engine.answer("yes");

    expect(graph).toEqual(original);
    expect(engine.getGraph()).toEqual(original);
    expect(engine.getGraph()).not.toBe(graph);
  });

  test("accepts and validates a text question", () => {
    const graph: GraphData = {
      startNodeId: "name",
      nodes: [
        {
          id: "name",
          type: "text-question",
          position: { x: 0, y: 0 },
          data: {
            title: "Vad heter du?",
            variableName: "name",
            required: true,
            minLength: 2,
            maxLength: 10,
          },
        },
        {
          id: "result",
          type: "result",
          position: { x: 200, y: 0 },
          data: { title: "Klart" },
        },
      ],
      connections: [
        {
          id: "name-result",
          from: { nodeId: "name", portId: "continue" },
          to: { nodeId: "result", portId: "input" },
        },
      ],
    };
    const engine = new GuideTraversalEngine(graph);

    expect(engine.answerValue(" ")).toMatchObject({
      success: false,
      error: { message: "Fältet är obligatoriskt." },
    });
    expect(engine.answerValue("J")).toMatchObject({ success: false });
    expect(engine.answerValue("Ett alldeles för långt namn")).toMatchObject({
      success: false,
    });
    expect(engine.answerValue("Johan")).toMatchObject({
      success: true,
      node: { id: "result" },
    });
    expect(engine.getAnswers()).toEqual({ name: "Johan" });
    expect(engine.getAnswerRecords()).toEqual([
      {
        questionId: "name",
        variableName: "name",
        questionTitle: "Vad heter du?",
        optionId: "continue",
        optionLabel: "Johan",
        value: "Johan",
      },
    ]);
  });
  test("answers two fields on a PageNode in the same step", () => {
    const graph: GraphData = {
      startNodeId: "contact-page",
      nodes: [
        { id: "contact-page", type: "page", position: { x: 0, y: 0 }, data: { title: "Kontakt" } },
        // The fields are real child nodes since v3→v4. They used to live in
        // the page's own data and could neither be moved nor removed.
        { id: "f-name", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "contact-page", order: 0, data: { title: "Namn", variableName: "name", required: true } },
        { id: "f-email", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "contact-page", order: 1, data: { title: "E-post", variableName: "email", required: true } },
        { id: "done", type: "result", position: { x: 300, y: 0 }, data: { title: "Klart" } },
      ],
      connections: [{ id: "page-done", from: { nodeId: "contact-page", portId: "continue" }, to: { nodeId: "done", portId: "input" } }],
    };
    const engine = new GuideTraversalEngine(graph);

    expect(engine.answerPage({ name: "Kim", email: "" })).toMatchObject({ success: false });
    expect(engine.answerPage({ name: "Kim", email: "kim@example.se" })).toMatchObject({ success: true, node: { id: "done" } });
    expect(engine.getAnswers()).toEqual({ name: "Kim", email: "kim@example.se" });
    expect(engine.getAnswerRecords()).toHaveLength(2);
    expect(engine.getStepNumber()).toBe(2);
  });

  test("tracks traversed connections and rewinds them with the history", () => {
    const engine = new GuideTraversalEngine(createGraph());

    expect(engine.getTraversedConnectionIds()).toEqual([]);

    engine.answer("yes");
    expect(engine.getTraversedConnectionIds()).toEqual(["yes-result"]);

    engine.previous();
    expect(engine.getTraversedConnectionIds()).toEqual([]);

    engine.answer("no");
    expect(engine.getTraversedConnectionIds()).toEqual(["no-result"]);

    engine.restart();
    expect(engine.getTraversedConnectionIds()).toEqual([]);
  });
});
