import { afterEach, describe, expect, it, vi } from "vitest";
import { proModule, withPro } from "./optional-pro";

afterEach(() => {
  vi.restoreAllMocks();
});

/*
 * In the open repo `src/pro/` is not there, and every browser test that asks
 * for PRO must hear "absent", not an error. Each engine words a missing module
 * its own way — WebKit says "Importing a module script failed." (measured
 * 20/10 2026 in the open clone, where 42 test files failed at import on it) —
 * so the question is asked here of a path that is missing in both repos.
 */
describe("optional-pro in the browser", () => {
  it("answers null for a PRO module that is not there", async () => {
    expect(await proModule("not-there/nowhere.ts")).toBeNull();
    expect(await withPro("not-there/nowhere.ts")).toBe(false);
  });

  /*
   * A PRO module that is there but cannot be built must fail the test, not
   * skip it: the dev server answers it with 500, and a `runIf(PRO)` that read
   * that as "absent" would go quiet over a broken PRO (Eva 21/10).
   *
   * The server's answer is stubbed, not produced. A real module that fails to
   * build (tried 21/10: a fixture with an import that does not resolve) makes
   * Vite send its error overlay to every page on the server, and it lay over
   * other files' pages: guide-editor-duplicate, link-picker and menu-inside
   * failed on clicks that landed on it, 3–8 tests a run at load 4, and the
   * failure screenshots were the overlay. `server.hmr.overlay: false` on the
   * browser project did not stop it.
   */
  it("throws for a module the server answers with 500", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<!DOCTYPE html>", { status: 500 }));
    await expect(proModule("not-there/broken.ts")).rejects.toThrow();
  });
});
