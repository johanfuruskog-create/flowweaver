import { describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";

import { GuideTraversalEngine } from "../viewer/core/guide-traversal-engine";
import { troubleshootingExampleGraph } from "./troubleshooting-example-graph";

/**
 * The big guide has to work all the way down, on every branch.
 *
 * A twenty-four node flow is exactly where a hand-written fixture goes quietly
 * wrong: one option wired to nothing leaves a dead end that looks like a
 * finished answer, and nobody notices until a visitor picks that one. So every
 * path is walked here rather than spot-checked.
 */

const nodes = new Map(troubleshootingExampleGraph.nodes.map((node) => [node.id, node]));

const optionsOf = (id: string): string[] =>
  ((nodes.get(id)!.data.options ?? []) as Array<{ id: string }>).map((option) => option.id);

describe("the troubleshooting guide", () => {
  test("is the biggest one we ship", () => {
    expect(troubleshootingExampleGraph.nodes.length).toBeGreaterThan(20);
  });

  /*
   * Every answer leads somewhere. A question option with no connection is a
   * dead end that renders as a finished guide — the visitor answers, and
   * nothing happens.
   */
  test("every option on every question is wired", () => {
    const wired = new Set(
      troubleshootingExampleGraph.connections.map(
        (connection) => `${connection.from.nodeId}:${connection.from.portId}`,
      ),
    );

    const loose = troubleshootingExampleGraph.nodes
      .filter((node) => node.type === "question")
      .flatMap((node) =>
        optionsOf(node.id)
          .filter((option) => !wired.has(`${node.id}:${option}`))
          .map((option) => `${node.id}:${option}`),
      );

    expect(loose).toEqual([]);
  });

  test("and every connection points at a node that exists", () => {
    const dangling = troubleshootingExampleGraph.connections
      .filter((connection) => !nodes.has(connection.to.nodeId))
      .map((connection) => connection.to.nodeId);

    expect(dangling).toEqual([]);
  });

  // Nothing is unreachable: a node nobody can arrive at is work that will never
  // be read, and in a guide this size it is easy to leave one behind.
  test("every node can be reached from the start", () => {
    const seen = new Set([troubleshootingExampleGraph.startNodeId]);
    let grew = true;

    while (grew) {
      grew = false;
      for (const connection of troubleshootingExampleGraph.connections) {
        if (seen.has(connection.from.nodeId) && !seen.has(connection.to.nodeId)) {
          seen.add(connection.to.nodeId);
          grew = true;
        }
      }
    }

    const stranded = [...nodes.keys()].filter((id) => !seen.has(id));

    expect(stranded).toEqual([]);
  });

  /*
   * Walked, not inspected. Every first answer leads to a real step, and the
   * flow ends in an action rather than an amount — which is what makes this
   * guide a different shape from every other one here.
   */
  test.each(["nothing", "error", "wrong", "slow"])(
    "answering %s reaches a next step",
    (answer) => {
      const engine = new GuideTraversalEngine(troubleshootingExampleGraph);
      engine.answerValue(answer);

      expect(engine.getCurrentNode()?.id).not.toBe("start");
      expect(engine.getCurrentNode()).toBeTruthy();
    },
  );

  test("a whole path ends in something to do", () => {
    const engine = new GuideTraversalEngine(troubleshootingExampleGraph);
    engine.answerValue("error");
    engine.answerValue("toner");

    const node = engine.getCurrentNode()!;

    expect(node.type).toBe("result");
    expect((node.data.title as { sv: string }).sv).toBe("Byt tonerkassetten");
  });
});
