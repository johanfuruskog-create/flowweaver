import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { configureHost, hostApi } from "./host-config";

/**
 * `?api=` may only point the guides app at this machine (security review 8/10,
 * measured 9/10 — the reasoning is beside `hostApi`).
 */
describe("which storage host ?api= may choose", () => {
  beforeEach(() => {
    configureHost({ api: "https://vard.example" });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("a link naming somebody else's server is not followed: the page keeps its own host", () => {
    expect(hostApi("?api=https://ond.example")).toEqual({ api: "https://vard.example", given: null });
    // And it says so, rather than dropping the address in silence.
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("https://ond.example"));
  });

  test.each([
    ["a name that begins with localhost", "?api=https://localhost.ond.example"],
    ["localhost as the user part of another host", "?api=http://localhost@ond.example"],
    ["a script address", "?api=javascript:alert(1)"],
    ["something that is not an address", "?api=ond"],
  ])("nor %s", (_name, search) => {
    expect(hostApi(search).api).toBe("https://vard.example");
  });

  test.each([
    "http://localhost:4332",
    "http://127.0.0.1:4310",
    "http://[::1]:4332",
    "https://localhost",
  ])("a receiver on this machine is used, and travels on: %s", (address) => {
    expect(hostApi(`?api=${encodeURIComponent(address)}`)).toEqual({ api: address, given: address });
  });

  test("without ?api= the page's own host, and no warning", () => {
    expect(hostApi("")).toEqual({ api: "https://vard.example", given: null });
    expect(console.warn).not.toHaveBeenCalled();
  });
});
