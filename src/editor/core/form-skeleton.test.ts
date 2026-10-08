import { describe, expect, test } from "vitest";

import "../../viewer/node-types/default-node-types";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { withPro } from "../../testing/optional-pro";
const PRO = await withPro("viewer/node-types/submission-node-types.ts", "editor/services/submission-health-rules.ts");
import { formSkeleton } from "./form-skeleton";
import { GuideHealthService } from "../services/guide-health-service";

import type { FlowNodeData, GraphData } from "../../viewer/types/graph";

/**
 * Formulärspårets steg 1 (Läget 1/9): stommen är ett FÄRDIGT formulär, inte
 * en sida med ett fält. Sida "Om dig" med namn, e-post och telefon i
 * tredjedelar, sida "Om ditt ärende", granskning och inlämning — och hälsan
 * tyst utom "ingen mottagare vald", som är exakt nästa handling (052 k3-4).
 */

const asGraph = (): GraphData => {
  const skeleton = formSkeleton({ x: 0, y: 0 });

  return {
    version: 8,
    startNodeId: skeleton.startNodeId,
    nodes: skeleton.nodes,
    connections: skeleton.connections,
  } as unknown as GraphData;
};

const fieldsOf = (graph: GraphData, pageId: string): FlowNodeData[] =>
  graph.nodes
    .filter((node) => node.parentPageId === pageId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const sv = (value: unknown): string =>
  typeof value === "object" && value !== null
    ? String((value as Record<string, string>).sv ?? "")
    : String(value ?? "");

describe("formulärstommen", () => {
  test("två sidor: Om dig i tredjedelar, sedan ärendet", () => {
    const graph = asGraph();
    const pages = graph.nodes.filter((node) => node.type === "page");

    expect(pages.length).toBe(2);
    const [omDig, omArendet] = pages;
    expect(sv(omDig!.data.title)).toBe("Om dig");
    expect(sv(omArendet!.data.title)).toBe("Om ditt ärende");
    expect(graph.startNodeId).toBe(omDig!.id);

    const digFalt = fieldsOf(graph, omDig!.id);
    expect(digFalt.map((node) => node.data.variableName)).toEqual([
      "namn",
      "epost",
      "telefon",
    ]);
    for (const falt of digFalt) {
      expect(falt.type).toBe("text-question");
      expect(falt.layout?.columnSpan, sv(falt.data.title)).toBe(4);
    }
    // Ett ärende utan namn och kontaktväg kan ingen besvara (granskningen
    // 2/9): namn och e-post är obligatoriska, telefonen frivillig.
    expect(digFalt[0]!.data.required, "namn").toBe(true);
    expect(digFalt[1]!.data.required, "epost").toBe(true);
    expect(digFalt[2]!.data.required, "telefon").toBeFalsy();
    expect(digFalt[1]!.data.format).toBe("email");
    expect(digFalt[2]!.data.format).toBe("phone");

    const arendeFalt = fieldsOf(graph, omArendet!.id);
    expect(arendeFalt.length).toBe(1);
    expect(arendeFalt[0]!.data.presentation).toBe("textarea");
    expect(arendeFalt[0]!.data.required).toBe(true);
    expect(arendeFalt[0]!.layout?.columnSpan).toBe(12);
  });

  test.runIf(PRO)("kedjan: Om dig → ärendet → granska → inlämning", () => {
    const graph = asGraph();
    const byType = (type: string) =>
      graph.nodes.find((node) => node.type === type)!;
    const pages = graph.nodes.filter((node) => node.type === "page");

    const hop = (fromId: string): string | undefined =>
      graph.connections.find((connection) => connection.from.nodeId === fromId)
        ?.to.nodeId;

    expect(hop(pages[0]!.id)).toBe(pages[1]!.id);
    expect(hop(pages[1]!.id)).toBe(byType("review").id);
    expect(hop(byType("review").id)).toBe(byType("submit-result").id);
  });

  test.runIf(PRO)("hälsan är tyst utom 'ingen mottagare vald'", () => {
    const codes = GuideHealthService.analyze(asGraph()).map(
      (issue) => issue.code,
    );

    expect(codes).toContain("no-recipient-chosen");
    expect(codes.filter((code) => code !== "no-recipient-chosen")).toEqual([]);
  });
});
