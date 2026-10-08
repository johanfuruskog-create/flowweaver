import { describe, expect, test } from "vitest";

import { migrateIncoming } from "./accepted-graph";
import { CURRENT_GRAPH_VERSION } from "./graph-migrations";

import type { GraphData } from "../types/graph";

/**
 * The object door checks what the file door has always checked.
 *
 * ## Why there are two doors at all
 *
 * A guide arrives either as a file somebody imported or as an object a host
 * assigns — `element.graph = …`, which is what the SiteVision module does. The
 * file door validates: not JSON, not an object, or made in a newer version, and
 * it says so. The object door did neither check.
 *
 * **A newer version rendered anyway.** A graph stamped v99 is not migrated —
 * there is nothing to migrate it *to* — and it was branded accepted regardless
 * and drawn with today's rules. Fields written by a future node type simply do
 * not appear. That is the same failure class as the one the viewer's missing
 * migration caused, arriving from the other direction: a page that looks built
 * badly rather than broken.
 *
 * **A non-object crashed.** `null`, a string, an array: the door read
 * `.version` off it without checking, and what reached the resident was either
 * an uncaught `TypeError` or the misleading "Guiden saknar startnod".
 *
 * ## Why a result and not an exception
 *
 * The doors are the two places where a decision has to be made about somebody
 * else's data, and a caller that ignores the answer should be visible as such.
 * A thrown error crossing a property setter is caught by nobody in a host page
 * written in plain JS — which is exactly the audience this guards.
 */

const validGraph = (extra: Record<string, unknown> = {}): unknown => ({
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "text-question",
      position: { x: 0, y: 0 },
      data: { title: { sv: "Fråga" }, variableName: "a" },
    },
  ],
  connections: [],
  ...extra,
});

describe("a graph from a newer version", () => {
  test("is refused rather than drawn with today's rules", () => {
    const answer = migrateIncoming(validGraph({ version: 99 }) as GraphData);

    expect(answer.ok).toBe(false);
  });

  test("and the refusal names both versions, so somebody can act on it", () => {
    const answer = migrateIncoming(validGraph({ version: 99 }) as GraphData);

    expect(answer.ok === false && answer.message).toContain("99");
    expect(answer.ok === false && answer.message).toContain(String(CURRENT_GRAPH_VERSION));
  });
});

describe("something that is not a graph at all", () => {
  test.each([
    ["null", null],
    ["a string", "min guide"],
    ["an array", []],
    ["a number", 7],
  ])("%s is refused at the door", (_name, value) => {
    const answer = migrateIncoming(value as unknown as GraphData);

    expect(answer.ok).toBe(false);
  });
});

describe("what still passes", () => {
  test("today's format goes through untouched", () => {
    const answer = migrateIncoming(validGraph() as GraphData);

    expect(answer.ok).toBe(true);
    expect(answer.ok === true && answer.graph.nodes).toHaveLength(1);
  });

  test("and an older one is lifted, as before", () => {
    const old = {
      version: 3,
      startNodeId: "p",
      nodes: [
        {
          id: "p",
          type: "page",
          position: { x: 0, y: 0 },
          data: { title: "Om dig", firstLabel: "Ditt namn", firstVariableName: "namn" },
        },
      ],
      connections: [],
    };

    const answer = migrateIncoming(old as unknown as GraphData);

    expect(answer.ok).toBe(true);
    // The v3→v4 migration turns the page's built-in fields into child nodes.
    expect(answer.ok === true && answer.graph.nodes.length).toBeGreaterThan(1);
  });

  test("a graph at exactly the current version is not refused", () => {
    // The boundary. `>` and `>=` differ by one guide that works.
    const answer = migrateIncoming(
      validGraph({ version: CURRENT_GRAPH_VERSION }) as GraphData,
    );

    expect(answer.ok).toBe(true);
  });
});
