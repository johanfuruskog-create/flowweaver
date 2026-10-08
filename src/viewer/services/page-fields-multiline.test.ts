import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { PageFieldsService } from "./page-fields-service";

import type { GraphData } from "../types/graph";

/**
 * A long answer stays long when it is put on a page.
 *
 * The same fault `format` had, in the same place: a question carries
 * `presentation: "textarea"`, the field built from it did not, and the viewer
 * had nothing to draw a textarea from. Measured on the fault report's own page,
 * where a 600-character description of the problem had one line to live on.
 *
 * Asserted here rather than in the viewer because this is where it was lost —
 * the markup could only ever have been as good as the field handed to it.
 */

const graph = (data: Record<string, unknown>): GraphData =>
  ({
    startNodeId: "p",
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
      {
        id: "f",
        type: "text-question",
        parentPageId: "p",
        order: 1,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Beskriv felet" }, variableName: "text", ...data },
      },
    ],
    connections: [],
  }) as GraphData;

const fieldOf = (data: Record<string, unknown>) =>
  PageFieldsService.getFields(graph(data), graph(data).nodes[0], {}, "sv")[0];

describe("a page's text field", () => {
  test("is multiline when the question said so", () => {
    expect(fieldOf({ presentation: "textarea" }).multiline).toBe(true);
  });

  test("and is not when it did not", () => {
    expect(fieldOf({}).multiline).toBe(false);
  });
});
