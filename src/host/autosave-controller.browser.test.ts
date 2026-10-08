import { describe, expect, test } from "vitest";

import { AutosaveController } from "./autosave-controller";

import type { GraphChangedDetail } from "../editor/types/events";
import type { GraphData } from "../viewer/types/graph";

/**
 * Story 124, criterion 3: **nothing is lost when the page goes away.**
 *
 * Between the last interval and the moment somebody closes the tab there is up
 * to `delay` of typing — three seconds against a server — and a storage that
 * drops it is a storage nobody can trust with an afternoon's work.
 *
 * ## Why this file is a browser test and its siblings are not
 *
 * Measured: in the node project `globalThis.addEventListener` does not exist,
 * so the controller's own listener was never registered and the check could not
 * fail for the right reason. `pagehide` is a window's event, and a claim about
 * a window belongs where there is one.
 */

const graph = (title: string): GraphData => ({
  startNodeId: "q",
  nodes: [{ id: "q", type: "question", position: { x: 0, y: 0 }, data: { title } }],
  connections: [],
});

const dispatchChange = (source: EventTarget, value: GraphData): void => {
  source.dispatchEvent(
    new CustomEvent<GraphChangedDetail>("graph-changed", {
      detail: { graph: value, reason: "node-updated" },
    }),
  );
};

describe("sidan som stängs", () => {
  test("pagehide spolar det som väntar, och säger till lagringen först", async () => {
    const source = new EventTarget();
    const written: string[] = [];
    const order: string[] = [];
    const store = {
      saveDraft: async (_id: string, value: GraphData) => {
        order.push("skriver");
        written.push(String(value.nodes[0]!.data.title));
        return { success: true as const, savedAt: "2026-09-17T10:00:00.000Z" };
      },
      /*
       * A store that talks to a server has to send this one write differently —
       * a request does not outlive its page unless it says so. It is told
       * before the write, not after, or the telling is pointless.
       */
      beforeUnload: () => {
        order.push("varnad");
      },
    };
    const controller = new AutosaveController({ source, store, guideId: "g1", delay: 60_000 });

    controller.connect();
    dispatchChange(source, graph("Det sista jag skrev"));

    // Nothing written yet: the interval is a minute away.
    expect(written).toEqual([]);

    globalThis.dispatchEvent(new Event("pagehide"));
    await Promise.resolve();

    expect(written, "det sista nådde lagringen").toEqual(["Det sista jag skrev"]);
    expect(order, "lagringen visste om det innan skrivningen").toEqual(["varnad", "skriver"]);

    controller.disconnect();
  });

  test("efter disconnect lyssnar ingenting kvar", async () => {
    const source = new EventTarget();
    const written: string[] = [];
    const controller = new AutosaveController({
      source,
      store: {
        saveDraft: async (_id: string, value: GraphData) => {
          written.push(String(value.nodes[0]!.data.title));
          return { success: true as const, savedAt: "x" };
        },
      },
      delay: 60_000,
    });

    controller.connect();
    dispatchChange(source, graph("Väntar"));
    controller.disconnect();

    globalThis.dispatchEvent(new Event("pagehide"));
    await Promise.resolve();

    expect(written).toEqual([]);
  });
});
