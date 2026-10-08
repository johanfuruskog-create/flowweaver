import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";

import { PageFieldsService } from "./page-fields-service";

import type { FlowNodeData, GraphData } from "../types/graph";

/**
 * A format survives being put on a page.
 *
 * ## The gap this was written from
 *
 * `text-question` has offered `format` — email, phone, personnummer — for a long
 * time, and the viewer enforces it by reading `data-format` off the input. But
 * `PageField` never carried the format, so the attribute was never written for a
 * field **inside a page**, and the rule was silently dropped.
 *
 * Standing on its own the field validates. Dragged onto a page it stops, and
 * nothing says so: the editor still shows the setting, the guide still runs, and
 * an invalid personal number is accepted.
 *
 * That matters more than it looks, because a page is what a *form* is. Every
 * field a form asks for several of — postcode, organisation number, identity
 * number — is on a page by definition.
 */

const page = (fieldData: Record<string, unknown>): GraphData =>
  ({
    startNodeId: "p",
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
      {
        id: "f",
        type: "text-question",
        parentPageId: "p",
        order: 0,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Fält" }, variableName: "v", ...fieldData },
      } as unknown as FlowNodeData,
    ],
    connections: [],
  }) as unknown as GraphData;

const fieldOf = (data: Record<string, unknown>) => {
  const graph = page(data);
  const sida = graph.nodes.find((node) => node.type === "page")!;

  return PageFieldsService.getFields(graph, sida)[0];
};

describe("a text field on a page", () => {
  test("carries its named format", () => {
    expect(fieldOf({ format: "postnummer" })?.format).toBe("postnummer");
  });

  test("carries a regex pattern with it", () => {
    const field = fieldOf({ format: "regex", pattern: "^A\\d+$" });

    expect(field?.format).toBe("regex");
    expect(field?.pattern).toBe("^A\\d+$");
  });

  test("has no format when none was set", () => {
    expect(fieldOf({})?.format).toBeUndefined();
  });

  test("keeps the length rules it already carried", () => {
    // Guarding the neighbours: minLength and maxLength were carried before and
    // must not be lost while format is added beside them.
    const field = fieldOf({ minLength: 2, maxLength: 8 });

    expect(field?.minLength).toBe(2);
    expect(field?.maxLength).toBe(8);
  });
});

describe("validation of a page field", () => {
  test("rejects a value that breaks the format", async () => {
    const { PageFieldValidationService } = await import("./page-field-validation-service");
    const field = fieldOf({ format: "postnummer" })!;

    expect(PageFieldValidationService.getMessage(field, "12a45")).toBeTruthy();
  });

  test("accepts one that keeps it", async () => {
    const { PageFieldValidationService } = await import("./page-field-validation-service");
    const field = fieldOf({ format: "postnummer" })!;

    expect(PageFieldValidationService.getMessage(field, "123 45")).toBeNull();
  });

  test("leaves an empty answer to the required rule", async () => {
    const { PageFieldValidationService } = await import("./page-field-validation-service");
    const field = fieldOf({ format: "postnummer" })!;

    // Format speaks about filled-in answers; "must be answered" is a separate
    // message with a separate cause.
    expect(PageFieldValidationService.getMessage(field, "")).toBeNull();
  });

  test("says the length before the shape", async () => {
    const { PageFieldValidationService } = await import("./page-field-validation-service");
    const field = fieldOf({ format: "postnummer", minLength: 4 })!;

    // "too short" is more useful than "wrong shape" when both are true.
    expect(PageFieldValidationService.getMessage(field, "12a")).toMatch(/minst|least|4/i);
  });
});
