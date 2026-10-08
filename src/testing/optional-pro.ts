/**
 * FlowWeaver PRO in a test that is otherwise about open code: loaded where
 * `src/pro/` is (the working repo), absent where it is not (the open repo the
 * export writes, open-core step 6). A static import of a missing file fails the
 * whole test file before any test runs; this answers false instead, and the
 * tests that need PRO run with `it.runIf(PRO)`.
 *
 * Why a dynamic import and not `import.meta.glob`: measured 7/10 2026, an
 * eager glob loaded the PRO modules under a different module id than the
 * test's own imports, so PRO registered its node types and health rules in a
 * second copy of each registry and the test saw neither. A dynamic import of a
 * URL built from this file resolves like any other import.
 *
 * Only a file that is not there counts as absent. A PRO module that is there
 * and throws is a broken test, and its error goes through.
 *
 * Name the PRO modules the test needs, relative to `src/pro/`, with their
 * extension — `"viewer/node-types/submission-node-types.ts"`. Not the whole
 * index in a unit test: the editor's side defines custom elements, which the
 * node environment cannot.
 */
const ABSENT = /Cannot find module|Failed to load url|Failed to fetch dynamically imported module|does the file exist|ERR_MODULE_NOT_FOUND|404/i;

/*
 * The base in a variable on purpose. Vite rewrites the literal pattern
 * `new URL(template, import.meta.url)` into an asset lookup, and the module
 * name came out as `undefined` (measured 7/10 in the browser project).
 */
const HERE = import.meta.url;

export async function withPro(...modules: string[]): Promise<boolean> {
  for (const module of modules) {
    if ((await proModule(module)) === null) return false;
  }
  return true;
}

/**
 * One PRO module's exports, or null where `src/pro/` is not. Typed loosely on
 * purpose: a test in the open repo cannot name PRO's types, since their file
 * is not there for the compiler either.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function proModule(module: string): Promise<Record<string, any> | null> {
  {
    const url = new URL("../pro/" + module, HERE).href;
    try {
      return (await import(/* @vite-ignore */ url)) as Record<string, unknown>;
    } catch (error) {
      const looksAbsent =
        ABSENT.test(String((error as Error)?.message ?? error)) || (error as { code?: string })?.code === "ERR_MODULE_NOT_FOUND";
      if (!looksAbsent) throw error;
      // In Chromium a module that throws while loading reports the same
      // "Failed to fetch dynamically imported module" as one that is not
      // there. Ask the server which. Not by status: the dev server answers a
      // path that does not exist with 200 and the site's HTML (measured 7/10).
      // A module comes back as JavaScript; anything else is absent.
      if (url.startsWith("http")) {
        const answer = await fetch(url);
        if (answer.ok && /javascript/.test(answer.headers.get("content-type") ?? "")) throw error;
      }
      return null;
    }
  }
}
