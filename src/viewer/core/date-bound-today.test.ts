import { describe, expect, test } from "vitest";

import { resolveDateBound, validateDate } from "./date-validator";
import { PageFieldsService } from "../services/page-fields-service";
import { GuideTraversalEngine } from "./guide-traversal-engine";
import "../node-types/default-node-types";

import type { FlowNodeData, GraphData } from "../types/graph";

/**
 * Story 044: a bound that says "idag" means the day the question is asked.
 *
 * A fixed ISO string cannot point at a moving day, so the every-field guide
 * wrote `max: "2030-12-31"` on "När märkte du felet?" — the closest "today"
 * that could be written — and a tablet picker happily offered 2030 for a
 * question about something that already happened.
 */

/** Today, as the resident's local calendar writes it. */
function todayIso(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

describe("gränsen idag", () => {
  test("löses till dagens datum, i alla stavningar", () => {
    for (const spelling of ["idag", "i dag", "today", "IDAG", "Today"]) {
      expect(resolveDateBound(spelling), spelling).toBe(todayIso());
    }
  });

  test("medan ett fast datum och ingen gräns passerar orörda", () => {
    expect(resolveDateBound("2030-12-31")).toBe("2030-12-31");
    expect(resolveDateBound("")).toBeUndefined();
    expect(resolveDateBound(undefined)).toBeUndefined();
  });

  test("valideringen avvisar i morgon när gränsen är idag", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pad = (n: number): string => String(n).padStart(2, "0");
    const tomorrowIso = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

    expect(validateDate(tomorrowIso, undefined, "idag")).toEqual({
      key: "validation.date.max",
      // The refusal names the resolved day, not the word — a person can act on
      // a date; "idag" in an error message reads like the field is broken.
      values: { date: todayIso() },
    });
    expect(validateDate(todayIso(), undefined, "idag")).toBeNull();
    expect(validateDate(todayIso(), "idag", undefined)).toBeNull();
  });
});

describe("på en sida", () => {
  test("bär fältet gränsen som ett löst datum", () => {
    const page: FlowNodeData = {
      id: "p",
      type: "page",
      position: { x: 0, y: 0 },
      data: { title: "Sida" },
    } as FlowNodeData;
    const graph = {
      startNodeId: "p",
      nodes: [
        page,
        {
          id: "d",
          type: "date-question",
          parentPageId: "p",
          order: 1,
          position: { x: 0, y: 0 },
          data: { title: "När märkte du felet?", variableName: "datum", max: "idag" },
        },
      ],
      connections: [],
    } as unknown as GraphData;

    const field = PageFieldsService.getFields(graph, page)[0]!;

    expect(field.maxDate).toBe(todayIso());
  });
});

/**
 * Story 087: the bound is another field. On its own step, *från* is one step
 * back and the bound is read from the answers so far.
 */
describe("gränsen är ett annat fält, steg för steg", () => {
  const period = (): GraphData => ({
    startNodeId: "fran",
    nodes: [
      {
        id: "fran",
        type: "date-question",
        position: { x: 0, y: 0 },
        data: { title: "Från", variableName: "fran" },
      },
      {
        id: "till",
        type: "date-question",
        position: { x: 200, y: 0 },
        data: { title: "Till", variableName: "till", min: "{{fran}}" },
      },
      { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: "Klart" } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "fran", portId: "continue" }, to: { nodeId: "till", portId: "input" } },
      { id: "c2", from: { nodeId: "till", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  });

  test("ett till före från avvisas med från-fältets namn; samma dag går", () => {
    const engine = new GuideTraversalEngine(period());
    expect(engine.answerValue("2026-03-01")).toMatchObject({ success: true });

    expect(engine.answerValue("2026-02-28")).toMatchObject({
      success: false,
      error: { message: "Datumet måste vara samma som eller efter Från." },
    });
    expect(engine.answerValue("2026-03-01")).toMatchObject({ success: true });
  });

  test("ett tomt från är ingen gräns", () => {
    const engine = new GuideTraversalEngine(period());
    expect(engine.answerValue("")).toMatchObject({ success: true });
    expect(engine.answerValue("2020-01-01")).toMatchObject({ success: true });
  });
});
