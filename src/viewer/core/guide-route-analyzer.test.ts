import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import {
  analyzeGuideRoute,
  findGuidePathsToResult,
} from "./guide-route-analyzer";
import { exampleGraph } from "../../data/example-graph";

describe("analyzeGuideRoute", () => {
  test("finds the direct target node and every reachable result", () => {
    const analysis = analyzeGuideRoute(exampleGraph, "question-age", "continue");

    expect(analysis.directTarget?.id).toBe("rule-age");
    expect(analysis.results.map((node) => node.id).sort()).toEqual([
      "result-age",
      "result-permit",
      "result-ready",
      "result-vision",
    ]);
    expect(analysis.issue).toBeNull();
  });

  test("marks an unconnected option as a dead end", () => {
    const graph = structuredClone(exampleGraph);
    graph.connections = graph.connections.filter(
      (connection) => connection.from.portId !== "continue"
    );

    expect(analyzeGuideRoute(graph, "question-age", "continue")).toMatchObject({
      directTarget: null,
      results: [],
      issue: "missing-connection",
      hasDeadEnd: true,
    });
  });

  test("ends the analysis safely on a cycle", () => {
    const graph = structuredClone(exampleGraph);
    graph.connections = graph.connections.map((connection) =>
      connection.id === "vision-yes-to-permit"
        ? { ...connection, to: { nodeId: "question-age", portId: "input" } }
        : connection
    );

    const analysis = analyzeGuideRoute(graph, "question-age", "continue");

    expect(analysis.hasCycle).toBe(true);
    expect(analysis.results.map((node) => node.id)).toContain("result-vision");
  });

  test("describes the path from the start node to a result", () => {
    const analysis = findGuidePathsToResult(exampleGraph, "result-ready");

    expect(analysis.paths).toHaveLength(5);
    expect(analysis.paths).toContainEqual([
      expect.objectContaining({ questionId: "question-age", optionLabel: "Fortsätt" }),
      expect.objectContaining({ questionId: "rule-age", optionLabel: "Vuxen" }),
      expect.objectContaining({ questionId: "question-gender", optionLabel: "Man" }),
      expect.objectContaining({ questionId: "rule-gender", optionLabel: "Äldre man" }),
      expect.objectContaining({ questionId: "question-male-information", optionLabel: "Ja" }),
      expect.objectContaining({ questionId: "question-vision", optionLabel: "Ja" }),
      expect.objectContaining({ questionId: "question-permit", optionLabel: "Ja" }),
    ]);
    expect(analysis.paths).toContainEqual([
      expect.objectContaining({ questionId: "question-age", optionLabel: "Fortsätt" }),
      expect.objectContaining({ questionId: "rule-age", optionLabel: "Vuxen" }),
      expect.objectContaining({ questionId: "question-gender", optionLabel: "Kvinna" }),
      expect.objectContaining({ questionId: "rule-gender", optionLabel: "Övriga vuxna" }),
      expect.objectContaining({ questionId: "question-vision", optionLabel: "Ja" }),
      expect.objectContaining({ questionId: "question-permit", optionLabel: "Ja" }),
    ]);
    expect(analysis.hasCycle).toBe(false);
  });

  test("returns no paths for a disconnected result", () => {
    const graph = structuredClone(exampleGraph);
    graph.connections = graph.connections.filter(
      (connection) => connection.to.nodeId !== "result-age"
    );

    expect(findGuidePathsToResult(graph, "result-age").paths).toEqual([]);
  });
});
