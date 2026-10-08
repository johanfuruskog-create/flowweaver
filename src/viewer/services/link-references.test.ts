import { describe, expect, test } from "vitest";

import { FormattedTextService } from "./formatted-text-service";
import { findLinkReferences, rewriteLinkAddresses, splitLinkTarget } from "./link-references";
import type { GraphData } from "../types/graph";

/**
 * Story 100: `[text](address "ref")` — the address for the world, the
 * host's reference for the host. The reference is carried, found and used
 * to rewrite a moved page's address; the visitor never sees it.
 */

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

describe("a link with the host's reference", () => {
  test("renders exactly as one without — the reference is neither title nor text", () => {
    const plain = FormattedTextService.render("Se [Ansök](/ansok.html) nu", ["link"]).html;
    const withRef = FormattedTextService.render(
      'Se [Ansök](/ansok.html "sv:4.1b914ea") nu',
      ["link"],
    ).html;

    expect(withRef).toBe(plain);
    expect(withRef).not.toContain("1b914ea");
  });

  test("splits into address and reference, also after HTML escaping", () => {
    expect(splitLinkTarget('/a.html "sv:1"')).toEqual({ url: "/a.html", ref: "sv:1" });
    expect(splitLinkTarget("/a.html &quot;sv:1&quot;")).toEqual({ url: "/a.html", ref: "sv:1" });
    expect(splitLinkTarget("/a.html")).toEqual({ url: "/a.html" });
  });

  test("is found on the node, and a plain link is not", () => {
    const refs = findLinkReferences(
      guide('[A](/a.html "sv:1") och [B](/b.html) och [C](/c.html "sv:3")'),
    );

    expect(refs).toEqual([
      { nodeId: "r", url: "/a.html", ref: "sv:1" },
      { nodeId: "r", url: "/c.html", ref: "sv:3" },
    ]);
  });

  test("gets its address rewritten when the host says the page moved", () => {
    const before = guide('[A](/a.html "sv:1") och [B](/b.html "sv:2")');
    const after = rewriteLinkAddresses(before, (ref) => (ref === "sv:1" ? "/ny/a.html" : undefined));

    expect(after).not.toBe(before);
    expect((after.nodes[0]!.data.description as { sv: string }).sv).toBe(
      '[A](/ny/a.html "sv:1") och [B](/b.html "sv:2")',
    );
    // The original is left alone — the editor decides whether to take the change.
    expect((before.nodes[0]!.data.description as { sv: string }).sv).toContain("(/a.html ");
  });

  test("is the same graph object when no address changed", () => {
    const before = guide('[A](/a.html "sv:1")');

    expect(rewriteLinkAddresses(before, () => "/a.html")).toBe(before);
    expect(rewriteLinkAddresses(before, () => undefined)).toBe(before);
  });
});
