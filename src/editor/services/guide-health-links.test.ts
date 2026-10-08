import { afterEach, describe, expect, test } from "vitest";

import {
  registerLinkPicker,
  resolveLinkReference,
  unregisterLinkPicker,
} from "../core/link-picker-registry";
import { GuideHealthService } from "./guide-health-service";
import type { GraphData } from "../../viewer/types/graph";

/**
 * Story 100, criterion 1c: a page the host says is gone is a warning on the
 * node. The health check reads the registry's memory of what `resolve`
 * answered — nothing is fetched, and without a host that answers nothing is
 * judged.
 */

afterEach(() => unregisterLinkPicker());

const guide = (description: string): GraphData => ({
  version: 1,
  startNodeId: "r",
  settings: { sourceLocale: "sv", locales: ["sv"] },
  nodes: [
    {
      id: "r",
      type: "result",
      position: { x: 0, y: 0 },
      data: { title: { sv: "Svar" }, description: { sv: description } },
    },
  ],
  connections: [],
}) as unknown as GraphData;

const dead = (graph: GraphData) =>
  GuideHealthService.analyze(graph).filter((issue) => issue.code === "dead-link");

describe("a link to a page the host says is gone", () => {
  test("is a warning on the node once the host has answered null", async () => {
    registerLinkPicker({
      pick: async () => null,
      resolve: async (ref) => (ref === "sv:borta" ? null : { url: "/kvar.html" }),
    });
    const graph = guide('[A](/borta.html "sv:borta") och [B](/kvar.html "sv:kvar")');

    expect(dead(graph), "innan värden svarat").toEqual([]);

    await resolveLinkReference("sv:borta");
    await resolveLinkReference("sv:kvar");

    expect(dead(graph)).toEqual([
      {
        code: "dead-link",
        severity: "warning",
        nodeId: "r",
        message: '"Svar": sidan länken pekar på finns inte längre.',
      },
    ]);
  });

  test("is not judged without a host, and forgotten when the host leaves", async () => {
    registerLinkPicker({ pick: async () => null, resolve: async () => null });
    await resolveLinkReference("sv:borta");
    unregisterLinkPicker();

    expect(dead(guide('[A](/borta.html "sv:borta")'))).toEqual([]);
  });

  test("a host that throws has not said the page is gone", async () => {
    registerLinkPicker({
      pick: async () => null,
      resolve: async () => {
        throw new Error("nätet nere");
      },
    });

    expect(await resolveLinkReference("sv:x")).toBeUndefined();
    expect(dead(guide('[A](/x.html "sv:x")'))).toEqual([]);
  });
});
