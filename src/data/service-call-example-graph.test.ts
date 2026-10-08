import { describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";

import { GuideTraversalEngine } from "../viewer/core/guide-traversal-engine";
import { ServiceCallService } from "../viewer/services/service-call-service";
import { serviceCallExampleGraph } from "./service-call-example-graph";

/**
 * The guide behind the service-call example has to actually run.
 *
 * The page it drives claims a chain: values go with the call, fields come back
 * as variables, the flow carries on, and a resident reads the amount. Every
 * link in that is a place a hand-written fixture goes quietly wrong — a port id
 * that does not exist, a mapping field that is not in the sample response, a
 * variable named in the result text that nothing produces. None of those would
 * throw. They would leave the demonstration showing a dash.
 */

const node = (id: string) => serviceCallExampleGraph.nodes.find((n) => n.id === id)!;

describe("the service-call example guide", () => {
  test("carries the answers into the call by name", () => {
    expect(
      ServiceCallService.buildRequestPayload(node("call"), {
        income: "42000",
        deposit: "350000",
        unrelated: "x",
      }),
    ).toEqual({ income: "42000", deposit: "350000" });
  });

  test("reads every mapped field out of its own sample response", () => {
    const outcome = ServiceCallService.runMock(node("call"), {});

    expect(outcome.results.filter((r) => !r.success)).toEqual([]);
    expect(outcome.answers).toMatchObject({ maxLoan: "2550000", decision: "approved" });
  });

  test("runs from the first question to the amount", () => {
    const engine = new GuideTraversalEngine(serviceCallExampleGraph);
    engine.answerValue("42000");
    engine.answerValue("350000");

    expect(engine.getCurrentNode()?.id).toBe("result-approved");
    expect(engine.getAnswers()).toMatchObject({ maxLoan: "2550000", decision: "approved" });
  });

  /*
   * The route is decided by a field the resident never sees. If `decision`
   * stopped arriving, the guide would still finish — down the other branch,
   * with no error anywhere. So it is checked from the other side too.
   */
  test("the branch follows the field that is never shown", () => {
    const engine = new GuideTraversalEngine({
      ...serviceCallExampleGraph,
      nodes: serviceCallExampleGraph.nodes.map((n) =>
        n.id === "call"
          ? { ...n, data: { ...n.data, mockResponse: '{"maxLoan": 0, "decision": "denied"}' } }
          : n,
      ),
    });
    engine.answerValue("12000");
    engine.answerValue("0");

    expect(engine.getCurrentNode()?.id).toBe("result-denied");
  });
});
