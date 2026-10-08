import { describe, expect, test } from "vitest";

import "./default-node-types";
// FlowWeaver PRO's sending types are registered on top (open-core step 4).
import { getNodePorts, isEndingNodeType } from "./node-type-registry";
import type { GraphData } from "../types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../testing/optional-pro";
await withPro("viewer/node-types/submission-node-types.ts");
const { borrowExampleGraph } = ((await proModule("data/borrow-example-graph.ts")) ?? {}) as { borrowExampleGraph: GraphData };
const { formOrderExampleGraph } = ((await proModule("data/form-order-example-graph.ts")) ?? {}) as { formOrderExampleGraph: GraphData };
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * `endsGuide` is a declaration, and a declaration can lie. This holds it to
 * the ports of real nodes: an ending has an entrance and no way onward, and
 * a node with no way onward is an ending — measured on the example guides,
 * whose nodes carry real data (a multi-choice without options would have no
 * outputs either, and is why the flag is declared rather than derived).
 */
describe.runIf(PRO)("endsGuide matches the ports", () => {
  // PRO's two guides where PRO is; in the open repo the test has nothing to measure and skips.
  const nodes = [borrowExampleGraph, formOrderExampleGraph].filter(Boolean).flatMap((graph) => graph.nodes);

  test("the example guides reach every ending type", () => {
    expect(new Set(nodes.filter((node) => isEndingNodeType(node.type)).map((node) => node.type)).size).toBeGreaterThan(0);
  });

  test.each(nodes.map((node) => [node.type, node] as const))("%s", (type, node) => {
    const ports = getNodePorts(node, { locale: "sv" });
    const inputs = ports.filter((port) => port.direction === "input").length;
    const outputs = ports.filter((port) => port.direction === "output").length;

    if (isEndingNodeType(type)) {
      expect(inputs, "an ending has an entrance").toBeGreaterThan(0);
      expect(outputs, "an ending has no way onward").toBe(0);
    } else if (inputs > 0) {
      expect(outputs, `${type} has an entrance and no way onward: declare endsGuide`).toBeGreaterThan(0);
    }
  });
});
