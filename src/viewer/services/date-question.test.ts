import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";

import { getNodeType } from "../node-types/node-type-registry";
import { PageFieldsService } from "./page-fields-service";
import { PageFieldValidationService } from "./page-field-validation-service";

import type { FlowNodeData, GraphData } from "../types/graph";

/**
 * A date field, because almost every form asks for one.
 *
 * ## Why it is its own type and not a text field with a pattern
 *
 * A regex over `\d{4}-\d{2}-\d{2}` accepts 2026-02-31 and offers a letter
 * keyboard on a phone. `<input type="date">` gives the platform's own picker,
 * the platform's own keyboard, and the platform's own screen reader
 * announcements — none of which we could write better, and all of which we
 * would have to.
 *
 * ## Why the value is an ISO string
 *
 * A guide is JSON, so the answer has to survive serialisation, and `YYYY-MM-DD`
 * is what the input element already produces. It also sorts correctly as text,
 * which is what makes `min` and `max` a plain string comparison rather than
 * date arithmetic — no timezone, no parsing, no drift.
 *
 * ## What this does not yet do
 *
 * Compare dates in a **rule**. `greater-than` reads both sides as numbers and an
 * ISO date is not one, so "efter den första mars" is not expressible yet. Worth
 * knowing rather than discovering: the field stores its answer perfectly well
 * and a rule can test it with `equals` or `är någon av`, and nothing more.
 */

const page = (fieldData: Record<string, unknown>): GraphData =>
  ({
    startNodeId: "p",
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
      {
        id: "f",
        type: "date-question",
        parentPageId: "p",
        order: 0,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Datum" }, variableName: "datum", ...fieldData },
      } as unknown as FlowNodeData,
    ],
    connections: [],
  }) as unknown as GraphData;

const fieldOf = (data: Record<string, unknown>) => {
  const graph = page(data);
  const sida = graph.nodes.find((node) => node.type === "page")!;

  return PageFieldsService.getFields(graph, sida)[0];
};

describe("the date node type", () => {
  test("is registered and says what kind of answer it takes", () => {
    const type = getNodeType("date-question");

    expect(type).toBeTruthy();
    expect(type?.behavior?.answer?.input).toBe("date");
    expect(type?.variableType).toBe("text");
  });

  test("can be put on a page, which is where a form needs it", () => {
    expect(getNodeType("date-question")?.canBeInPage).toBe(true);
  });

  test("offers the settings a date actually needs", () => {
    const properties = getNodeType("date-question")?.properties ?? [];
    const ids = properties.map((property) => property.id);

    expect(ids).toContain("required");
    expect(ids).toContain("min");
    expect(ids).toContain("max");
  });
});

describe("a date field on a page", () => {
  test("is a date and not a text field", () => {
    // The type is what decides which control the viewer renders, so this is the
    // difference between the platform's picker and a naked text box.
    expect(fieldOf({})?.type).toBe("date");
  });

  test("carries the earliest and latest allowed", () => {
    const field = fieldOf({ min: "2026-01-01", max: "2026-12-31" });

    expect(field?.minDate).toBe("2026-01-01");
    expect(field?.maxDate).toBe("2026-12-31");
  });
});

describe("validating a date", () => {
  const message = (data: Record<string, unknown>, value: string) =>
    PageFieldValidationService.getMessage(fieldOf(data)!, value);

  test("accepts one inside the range", () => {
    expect(message({ min: "2026-01-01", max: "2026-12-31" }, "2026-06-05")).toBeNull();
  });

  test("refuses one before the earliest", () => {
    expect(message({ min: "2026-01-01" }, "2025-12-31")).toBeTruthy();
  });

  test("refuses one after the latest", () => {
    expect(message({ max: "2026-12-31" }, "2027-01-01")).toBeTruthy();
  });

  test("refuses something that is not a date at all", () => {
    // The picker cannot produce this; a pasted value or an old answer can.
    expect(message({}, "igår")).toBeTruthy();
  });

  test("refuses a day that does not exist", () => {
    // The one a regex would let through, which is why this is not a regex.
    expect(message({}, "2026-02-31")).toBeTruthy();
  });

  test("leaves an empty answer to the required rule", () => {
    expect(message({ min: "2026-01-01" }, "")).toBeNull();
  });
});

/**
 * Story 087: *till* is after *från*. The bound points at a variable and is
 * the visitor's own answer, read when the field is checked.
 */
describe("a date bounded by another date field", () => {
  const period = (): GraphData =>
    ({
      startNodeId: "p",
      nodes: [
        { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Period" } } },
        {
          id: "fran",
          type: "date-question",
          parentPageId: "p",
          order: 0,
          position: { x: 0, y: 0 },
          data: { title: { sv: "Från" }, variableName: "fran" },
        },
        {
          id: "till",
          type: "date-question",
          parentPageId: "p",
          order: 1,
          position: { x: 0, y: 0 },
          data: { title: { sv: "Till" }, variableName: "till", min: "{{fran}}" },
        },
      ],
      connections: [],
    }) as unknown as GraphData;

  const tillField = (answers: Record<string, string>) => {
    const graph = period();
    return PageFieldsService.getFields(graph, graph.nodes[0], answers)[1];
  };

  test("the bound is the other field's answer, and the message names that field", () => {
    const till = tillField({ fran: "2026-03-01", till: "2026-02-28" });

    expect(till.minDate).toBe("2026-03-01");
    expect(till.minDateLabel).toBe("Från");
    expect(PageFieldValidationService.getMessage(till, "2026-02-28")).toBe(
      "Datumet måste vara samma som eller efter Från.",
    );
    expect(PageFieldValidationService.getMessage(till, "2026-03-01")).toBeNull();
  });

  test("an empty från is no bound", () => {
    const till = tillField({ fran: "" });

    expect(till.minDate).toBeUndefined();
    expect(PageFieldValidationService.getMessage(till, "2020-01-01")).toBeNull();
  });

  test("without answers — the editor's try-it box — the braces are not a date to compare with", () => {
    const graph = period();
    const till = PageFieldsService.getFields(graph, graph.nodes[0])[1];

    expect(till.minDate).toBeUndefined();
    expect(PageFieldValidationService.getMessage(till, "2020-01-01")).toBeNull();
  });
});
