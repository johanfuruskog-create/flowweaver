import { describe, expect, it } from "vitest";
import { readIdList } from "./id-list";

describe("readIdList", () => {
  it("takes the list when it has anything in it, trimmed and without blanks", () => {
    expect(readIdList([" a ", "", "b", 3, null], "z")).toEqual(["a", "b"]);
  });

  it("falls back to the single pre-v7 value only when the list is empty", () => {
    expect(readIdList([], " z ")).toEqual(["z"]);
    expect(readIdList(undefined, "z")).toEqual(["z"]);
    expect(readIdList(["a"], "z")).toEqual(["a"]);
  });

  it("gives an empty list for nothing at all", () => {
    expect(readIdList(undefined, undefined)).toEqual([]);
    expect(readIdList([""], "  ")).toEqual([]);
    expect(readIdList("not-a-list", 7)).toEqual([]);
  });
});
