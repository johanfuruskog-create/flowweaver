import { describe, expect, test } from "vitest";

import "../../viewer/node-types/default-node-types";
// Port labels are the canvas's — an editor surface — so the editor's words
// must be loaded for "Fortsätt" to resolve.
import "../localization/editor-ui-strings";

import {
  canNodeTypeBeInPage,
  getNodePorts,
  getNodeType,
  isGuideStepNode,
  isPageOnlyNodeType,
  isQuestionNode,
} from "../../viewer/node-types/node-type-registry";

import type { FlowNodeData } from "../../viewer/types/graph";

const createNode = (
  type: string,
  data: Record<string, unknown> = {}
): FlowNodeData => ({
  id: `${type}-node`,
  type,
  position: { x: 0, y: 0 },
  data,
});

describe("node type registry", () => {
  test("contains the default node types", () => {
    expect(getNodeType("question")?.label).toBe("Fråga");
    expect(getNodeType("question")?.variableType).toBe("choice");
    expect(getNodeType("number-question")?.variableType).toBe("number");
    expect(getNodeType("text-question")?.variableType).toBe("text");
    expect(getNodeType("result")?.label).toBe("Resultat");
  });

  test("creates questions with separate names and labels for the variable", () => {
    expect(getNodeType("question")?.createData()).toMatchObject({
      variableName: "",
      variableLabel: "",
    });
  });

  test("returns undefined for an unknown node type", () => {
    expect(getNodeType("unknown")).toBeUndefined();
  });

  test("creates an output port for every valid question option", () => {
    const node = createNode("question", {
      options: [
        { id: "yes", label: "Ja", value: "yes" },
        { id: "no", label: "Nej", value: "no" },
      ],
    });

    expect(getNodePorts(node, { isStart: true })).toEqual([
      {
        id: "yes",
        label: "Ja",
        valueType: "flow",
        connectionPolicy: "single",
        direction: "output",
      },
      {
        id: "no",
        label: "Nej",
        valueType: "flow",
        connectionPolicy: "single",
        direction: "output",
      },
    ]);
  });

  test("updates the question's ports when the options change", () => {
    const node = createNode("question", {
      options: [{ id: "yes", label: "Ja", value: "yes" }],
    });

    expect(
      getNodePorts(node, { isStart: true }).map((port) => port.id)
    ).toEqual(["yes"]);

    node.data.options = [
      { id: "no", label: "Nej", value: "no" },
      { id: "maybe", label: "Kanske", value: "maybe" },
    ];

    expect(getNodePorts(node, { isStart: true }).map((port) => port.id)).toEqual([
      "no",
      "maybe",
    ]);
  });

  test("ignores invalid question options when creating ports", () => {
    const node = createNode("question", {
      options: [
        { id: "valid", label: "Giltigt", value: "valid" },
        { id: "invalid", label: "Saknar värde" },
      ],
    });

    expect(
      getNodePorts(node, { isStart: true }).map((port) => port.id)
    ).toEqual(["valid"]);
  });

  test("gives ordinary questions an input but hides it for the start question", () => {
    const node = createNode("question", { options: [] });

    expect(getNodePorts(node)).toEqual([
      {
        id: "input",
        label: "",
        accepts: ["flow"],
        connectionPolicy: "multiple",
        direction: "input",
      },
    ]);
    expect(getNodePorts(node, { isStart: true })).toEqual([]);
  });

  test("gives the result node an entrance accepting several flows", () => {
    expect(getNodePorts(createNode("result"))).toEqual([
      {
        id: "input",
        label: "",
        accepts: ["flow"],
        connectionPolicy: "multiple",
        direction: "input",
      },
    ]);
  });

  test("gives the number question a Continue exit", () => {
    expect(getNodePorts(createNode("number-question"), { isStart: true })).toEqual([
      {
        id: "continue",
        label: "Fortsätt",
        valueType: "flow",
        connectionPolicy: "single",
        direction: "output",
      },
    ]);
  });

  test("returns no ports for an unknown node type", () => {
    expect(getNodePorts(createNode("unknown"))).toEqual([]);
  });

  test("creates the text question with validation fields and a Continue exit", () => {
    expect(getNodeType("text-question")?.createData()).toMatchObject({
      variableName: "",
      placeholder: "",
      required: false,
      minLength: null,
      maxLength: null,
    });
    expect(getNodePorts(createNode("text-question"), { isStart: true })).toEqual([
      {
        id: "continue",
        label: "Fortsätt",
        valueType: "flow",
        connectionPolicy: "single",
        direction: "output",
      },
    ]);
  });

  test("resolves port labels in the chosen language with source fallback", () => {
    const node = createNode("question", {
      options: [
        { id: "yes", label: { sv: "Ja", en: "Yes" }, value: "yes" },
        { id: "no", label: "Nej", value: "no" }, // bara källa → fallback
      ],
    });

    const english = getNodePorts(node, { isStart: true, locale: "en" }).map(
      (port) => port.label
    );
    expect(english).toEqual(["Yes", "Nej"]);

    const swedish = getNodePorts(node, { isStart: true }).map(
      (port) => port.label
    );
    expect(swedish).toEqual(["Ja", "Nej"]);
  });

  test("derives questions, steps and Page placement from the registry", () => {
    // Questions are recognised by their variableType.
    expect(isQuestionNode(createNode("question"))).toBe(true);
    expect(isQuestionNode(createNode("number-question"))).toBe(true);
    expect(isQuestionNode(createNode("rule"))).toBe(false);
    expect(isQuestionNode(createNode("result"))).toBe(false);

    // Steps = questions plus the types declaring isGuideStep.
    expect(isGuideStepNode(createNode("question"))).toBe(true);
    expect(isGuideStepNode(createNode("page"))).toBe(true);
    expect(isGuideStepNode(createNode("calculation"))).toBe(true);
    expect(isGuideStepNode(createNode("service-call"))).toBe(true);
    expect(isGuideStepNode(createNode("rule"))).toBe(false);
    expect(isGuideStepNode(createNode("result"))).toBe(false);
    expect(isGuideStepNode(createNode("page-heading"))).toBe(false);

    // Page children: questions (canBeInPage) and pageOnly decorations.
    expect(canNodeTypeBeInPage("question")).toBe(true);
    expect(canNodeTypeBeInPage("text-question")).toBe(true);
    expect(canNodeTypeBeInPage("page-heading")).toBe(true);
    expect(canNodeTypeBeInPage("page-spacer")).toBe(true);
    expect(canNodeTypeBeInPage("page")).toBe(false);
    expect(canNodeTypeBeInPage("rule")).toBe(false);
    expect(canNodeTypeBeInPage("result")).toBe(false);

    // pageOnly implies the type may sit in a Page but never standalone.
    expect(isPageOnlyNodeType("page-heading")).toBe(true);
    expect(isPageOnlyNodeType("question")).toBe(false);
  });

  // A new page starts without fields. The editor decides what goes on it —
  // they used to get two text fields they never asked for, and those vanished
  // silently as soon as they dragged in one of their own. See
  // docs/STORIES/001-sidan-borjar-tom.md.
  test("gives the PageNode no fields and a Continue exit", () => {
    const data = getNodeType("page")?.createData() ?? {};

    expect("firstVariableName" in data).toBe(false);
    expect("secondVariableName" in data).toBe(false);
    expect(getNodePorts(createNode("page"), { isStart: true })).toEqual([
      { id: "continue", label: "Fortsätt", valueType: "flow", connectionPolicy: "single", direction: "output" },
    ]);
  });
});
