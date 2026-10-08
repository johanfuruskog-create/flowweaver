import { afterEach, describe, expect, it } from "vitest";
import { registerStepBody, stepBody, unregisterStepBody } from "./step-bodies";

describe("step bodies", () => {
  afterEach(() => unregisterStepBody("probe"));

  it("a type without a body has none; a registered one is found by type", () => {
    expect(stepBody("probe")).toBeNull();
    registerStepBody("probe", () => "hello");
    expect(stepBody("probe")?.({} as never, {}, {} as never, "sv")).toBe("hello");
  });
});
