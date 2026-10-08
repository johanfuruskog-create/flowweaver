import { describe, expect, test } from "vitest";

import "../../viewer/node-types/default-node-types";

import { importGraphJson } from "./graph-io";

/**
 * A connection's colour has to survive being written down and read back.
 *
 * ## The fault this is written from
 *
 * Reported as "the colour is not saved". It was saved: measured through the real
 * store, the JSON in storage contained `"color":"content"` every time. It was
 * **stripped on the way back in** — `parseConnection` rebuilt every connection as
 * `{ id, from, to }`, so reopening a guide drew every line in the default colour.
 *
 * Import from a file went the same road, so a colour survived neither. Nothing
 * failed and nothing was reported; the work was simply gone.
 *
 * ## Why an unknown colour is dropped rather than refused
 *
 * This is the boundary where a stranger's JSON becomes a guide, so the value is
 * checked against the list rather than trusted. But refusing the whole guide over
 * it would be the worse trade: the field is purely visual, older builds already
 * ignore it, and a file written by a newer build should still open — with a line
 * in the default colour rather than an error page.
 */

const guide = (color: unknown): string =>
  JSON.stringify({
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "text-question", position: { x: 0, y: 0 }, data: { title: "Ett", variableName: "a" } },
      { id: "q2", type: "text-question", position: { x: 300, y: 0 }, data: { title: "Två", variableName: "b" } },
    ],
    connections: [
      {
        id: "c1",
        from: { nodeId: "q1", portId: "continue" },
        to: { nodeId: "q2", portId: "input" },
        ...(color === undefined ? {} : { color }),
      },
    ],
  });

const imported = (color: unknown) => {
  const result = importGraphJson(guide(color), { allowDraftWithoutStartNode: true });

  if (!result.success) throw new Error(result.errors[0]);

  return result.graph.connections[0] as { color?: string };
};

describe("a colour on a connection", () => {
  test.each(["content", "rule", "calc", "service", "end", "danger"])(
    "%s comes back",
    (color) => {
      expect(imported(color).color).toBe(color);
    },
  );

  test("and a connection without one stays without one", () => {
    // Not `undefined` as a present key: a guide that never had a colour should
    // round-trip byte for byte, or every open would look like an edit.
    expect("color" in imported(undefined)).toBe(false);
  });
});

describe("a colour this build does not know", () => {
  test("is left out, and the guide still opens", () => {
    expect(imported("chartreuse").color).toBeUndefined();
  });

  test("and neither is anything that is not a colour at all", () => {
    expect(imported(42).color).toBeUndefined();
    expect(imported({ nyans: "blå" }).color).toBeUndefined();
  });
});
