import { afterEach, describe, expect, it } from "vitest";
import { getStepRenderer, registerStepRenderer, stepRenderers, unregisterStepRenderer } from "./step-renderers";

describe("step renderers", () => {
  afterEach(() => unregisterStepRenderer("probe"));

  it("a type without a renderer has none", () => {
    expect(getStepRenderer("probe")).toBeNull();
  });

  it("a registered renderer is found by type, and listed; registering again replaces", () => {
    const first = { render: () => "<p>1</p>" };
    const second = { render: () => "<p>2</p>", entersWith: "nav.submit" };
    registerStepRenderer("probe", first);
    registerStepRenderer("probe", second);
    expect(getStepRenderer("probe")).toBe(second);
    expect(stepRenderers().filter((one) => one === second)).toHaveLength(1);
    unregisterStepRenderer("probe");
    expect(getStepRenderer("probe")).toBeNull();
  });
});
