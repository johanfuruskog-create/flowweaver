import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
// The checkbox is the editor's half of the field (leak 2, LOGG 8/9 2026).
import "../../editor/node-types/default-node-properties";

import { PageFieldsService } from "./page-fields-service";
import { getNodeType } from "../node-types/node-type-registry";

import type { FlowNodeData } from "../types/graph";

/**
 * A number can be demanded, the way text and a choice already could.
 *
 * Text had `required`, multiple-choice had `required`, a number did not — so an
 * amount, an age or a number of children could not be made compulsory. That is
 * a hole in the validation rather than a decision: the field's own behaviour
 * declared `minField` and `maxField` and simply never named a required field.
 *
 * A minimum is not a substitute. `min: 1` refuses zero; it says nothing about an
 * answer that was never given, and a form that lets somebody past an unanswered
 * amount finds out much later.
 */

const field = (data: Record<string, unknown>): FlowNodeData =>
  ({
    id: "n",
    type: "number-question",
    position: { x: 0, y: 0 },
    parentPageId: "p",
    data: { title: { sv: "Belopp" }, variableName: "belopp", ...data },
  }) as unknown as FlowNodeData;

const page = (node: FlowNodeData) =>
  ({
    startNodeId: "p",
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
      node,
    ],
    connections: [],
  }) as never;

const asField = (data: Record<string, unknown>) => {
  const graph = page(field(data)) as unknown as { nodes: FlowNodeData[] };
  const sida = graph.nodes.find((node) => node.type === "page")!;

  return PageFieldsService.getFields(graph as never, sida)[0];
};

describe("the editor", () => {
  test("offers the checkbox at all", () => {
    /*
     * The half that was actually missing, and the half the runtime test cannot
     * see: `page-fields-service` reads `data.required` whether or not anything
     * ever sets it, so a test that writes the flag itself passes on a node type
     * that offers no way to write it. Checked by mutation — removing the
     * property left the other tests green.
     */
    const number = getNodeType("number-question");
    const required = number?.properties?.find((property) => property.id === "required");

    expect(required?.control).toBe("checkbox");
  });

  test("declares it, so the validation runs it", () => {
    // The property alone is inert: the declarative model has to name the field
    // for the viewer to enforce it.
    expect(getNodeType("number-question")?.behavior?.answer?.validation?.requiredField)
      .toBe("required");
  });
});

describe("a number field", () => {
  test("can be made required", () => {
    expect(asField({ required: true })?.required).toBe(true);
  });

  test("is optional unless somebody says otherwise", () => {
    expect(asField({})?.required).toBeFalsy();
  });

  test("keeps its min and max, which are a different question", () => {
    const one = asField({ required: true, min: 1, max: 10 });

    // A minimum refuses a value; required refuses the absence of one.
    expect(one?.min).toBe(1);
    expect(one?.max).toBe(10);
    expect(one?.required).toBe(true);
  });
});
