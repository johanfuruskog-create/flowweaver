import { describe, expect, test } from "vitest";

import "../../viewer/node-types/default-node-types";
import { importGraphJson } from "./graph-io";
import { getNodeType } from "../../viewer/node-types/node-type-registry";

/**
 * End to end: a guide saved before story 007 loads, its node template migrates
 * to base type plus values, and the node using the template works.
 */

const gammalGuide = JSON.stringify({
  version: 4,
  startNodeId: "n1",
  nodes: [
    {
      id: "n1",
      type: "custom-1a2b",
      position: { x: 0, y: 0 },
      data: { title: { sv: "Din e-post" }, variableName: "epost" },
    },
  ],
  connections: [],
  settings: {
    customNodeTypes: [
      {
        type: "custom-1a2b",
        label: "E-postfråga",
        icon: "@",
        fields: [
          { id: "title", label: "Rubrik", control: "text", localized: true, defaultValue: "" },
          { id: "format", label: "Format", control: "select", defaultValue: "email" },
        ],
        behavior: {
          answer: {
            variableField: "variableName",
            cardinality: "single",
            input: "text",
            validation: { formatField: "format" },
          },
          flow: { kind: "linear" },
        },
      },
    ],
  },
});

describe("a guide saved before 007", () => {
  test("loads without being rejected as an unknown node type", () => {
    const result = importGraphJson(gammalGuide);

    expect(result.success).toBe(true);
  });

  test("the template becomes base type plus values", () => {
    const result = importGraphJson(gammalGuide);
    if (!result.success) return;

    expect(result.graph.settings?.nodeTemplates).toEqual([
      {
        type: "custom-1a2b",
        label: "E-postfråga",
        icon: "@",
        base: "text-question",
        values: { title: "", format: "email" },
      },
    ]);
  });

  test("the node becomes a text question with the template as provenance", () => {
    const result = importGraphJson(gammalGuide);
    if (!result.success) return;

    const nod = result.graph.nodes[0];

    expect(nod.type).toBe("text-question");
    expect(nod.template).toBe("custom-1a2b");
    // The data is untouched; what is missing is answered by the field's default.
    expect(nod.data).toEqual({ title: { sv: "Din e-post" }, variableName: "epost" });
  });

  // The template need not exist for the guide to work. That was the whole point.
  test("and the node type is our own, not the template's", () => {
    const result = importGraphJson(gammalGuide);
    if (!result.success) return;

    expect(getNodeType(result.graph.nodes[0].type)?.label).toBe("Textfråga");
    expect(getNodeType("custom-1a2b")).toBeUndefined();
  });
});
