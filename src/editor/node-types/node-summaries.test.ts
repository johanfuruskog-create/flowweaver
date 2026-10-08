import { afterEach, describe, expect, it } from "vitest";
import { nodeSummary, registerNodeSummary, unregisterNodeSummary } from "./node-summaries";

import type { FlowNodeData } from "../../viewer/types/graph";

const node = (type: string): FlowNodeData => ({ id: "n", type, position: { x: 0, y: 0 }, data: {} });

describe("node summaries", () => {
  afterEach(() => unregisterNodeSummary("probe"));

  it("a type without a summary draws nothing", () => {
    expect(nodeSummary(node("probe"), "sv")).toBe("");
  });

  it("a registered summary is drawn for its type, in the asked-for locale", () => {
    registerNodeSummary("probe", (one, locale) => `<p>${one.id}:${locale}</p>`);
    expect(nodeSummary(node("probe"), "en")).toBe("<p>n:en</p>");
    expect(nodeSummary(node("other"), "en")).toBe("");
  });
});
