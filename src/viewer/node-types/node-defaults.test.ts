import { describe, expect, test } from "vitest";

import "./default-node-types";
import { getNodeType, getNodeTypes } from "./node-type-registry";
import { declaredDefault, readNodeString, readNodeNumber } from "./node-fields";

import type { FlowNodeData } from "../types/graph";

/**
 * Story 007: a field's default is declared once, together with the field.
 * `createData()` is derived from the declaration.
 *
 * The strongest check is not here but in the contract snapshot: `dataKeys` is
 * the set of keys from `createData()`, and that file is unchanged. That the
 * derivation yields the same keys the hand-written functions did is therefore
 * already proven. This test protects the rules around it.
 */

describe("the default value lives with the field", () => {
  test("no built-in node type writes its own createData any more", () => {
    // The key is not in the source; the registry puts the derived one there.
    // A field without a declared value must never show up as a key either.
    for (const { type, definition } of getNodeTypes()) {
      const deklarerade = definition.properties
        .filter(
          (property) =>
            property.createDefault !== undefined ||
            Object.hasOwn(property, "defaultValue")
        )
        .map((property) => property.id)
        .sort();

      expect(Object.keys(definition.createData()).sort(), type).toEqual(
        deklarerade
      );
    }
  });

  test("every field without a declared value is a deliberate exception", () => {
    // "No limit" must stay an absence. The list is short and sits here so that
    // a new field forgetting its value shows up as a change, not as chance.
    const utan = getNodeTypes()
      .flatMap(({ type, definition }) =>
        definition.properties
          .filter(
            (property) =>
              property.createDefault === undefined &&
              !Object.hasOwn(property, "defaultValue")
          )
          .map((property) => `${type}.${property.id}`)
      )
      .sort();

    expect(utan).toEqual([
      "multi-choice.maxSelected",
      "multi-choice.minSelected",
      // A page that does not repeat has no repeat keys at all (story 084,
      // AC 8) — an older guide is unchanged, and min/max unset is 1/no limit.
      "page.addLabel",
      "page.repeatMax",
      "page.repeatMin",
      "page.repeatVariable",
      "page.repeatWord",
      "page.repeats",
      // *Varje upprepning ska välja olika* (story 138): absent is off, so no
      // guide written before the setting needs a migration to mean the same.
      "question.uniqueAcrossRepeats",
      "text-question.uniqueAcrossRepeats",
    ]);
  });

  test("computed starting values get their own ids every time", () => {
    const first = getNodeType("question")?.createData();
    const andra = getNodeType("question")?.createData();

    const id = (data?: Record<string, unknown>) =>
      (data?.options as Array<{ id: string }>)[0].id;

    expect(id(first)).not.toBe(id(andra));
  });

  test("two nodes never share the same object", () => {
    const en = getNodeType("service-call")?.createData();
    const two = getNodeType("service-call")?.createData();

    (en?.requestVariables as unknown[]).push("smitare");

    expect(two?.requestVariables).toEqual([]);
  });
});

describe("reading asks the declaration", () => {
  /** A node built before the field existed: the key is missing entirely. */
  const gammal: FlowNodeData = {
    id: "n1",
    type: "service-call",
    position: { x: 0, y: 0 },
    data: { title: "Hämta beslut" },
  };

  test("an old node gets the declared value", () => {
    expect(readNodeString(gammal, "method")).toBe("POST");
  });

  test("och skrivs inte om", () => {
    readNodeString(gammal, "method");
    readNodeString(gammal, "endpoint");

    expect(Object.keys(gammal.data)).toEqual(["title"]);
  });

  test("the node's own value always wins", () => {
    const node: FlowNodeData = { ...gammal, data: { method: "GET" } };

    expect(readNodeString(node, "method")).toBe("GET");
  });

  test("a field without a declared value gives undefined, not a zero", () => {
    const node: FlowNodeData = {
      id: "n2",
      type: "multi-choice",
      position: { x: 0, y: 0 },
      data: {},
    };

    expect(readNodeNumber(node, "maxSelected")).toBeUndefined();
  });

  // A newborn id would be an invention: it never looked like that when saved.
  test("computed starting values are not fallbacks", () => {
    expect(declaredDefault("question", "options")).toBeUndefined();
  });

  test("an unknown node type gives no value", () => {
    expect(declaredDefault("finns-inte", "method")).toBeUndefined();
  });
});
