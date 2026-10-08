import { afterEach, describe, expect, it } from "vitest";
import { exportStamps, registerExportStamp, unregisterExportStamp } from "./export-stamps";

describe("export stamps", () => {
  afterEach(() => unregisterExportStamp("probe"));

  it("a registered stamp is applied in order and replaced by id", () => {
    registerExportStamp("probe", () => ({ id: "first" }));
    registerExportStamp("probe", (graph) => ({ id: `n${graph.nodes.length}` }));
    const stamps = exportStamps();
    expect(stamps).toHaveLength(1);
    expect(stamps[0]!({ startNodeId: null, nodes: [], connections: [] })).toEqual({ id: "n0" });
  });
});
