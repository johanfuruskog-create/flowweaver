import { describe, expect, it } from "vitest";
import { reachableFiles } from "../gates/import-graph";

// Guards the distribution entries: the viewer and the editor must be built
// WITHOUT the example page's code (and the viewer additionally without the
// editor). Rather than building the bundles, the test follows the import graph
// statically from each entry and checks which project files become reachable.
//
// The graph itself — sources read as raw text via Vite's glob, no node
// builtins — lives in `gates/import-graph.ts`, shared with the open-core gate.

// Allowlist: a distribution bundle may reach ONLY library code. Everything else
// (example graphs under data/, app shells under site/, demo code and so on)
// must turn the test red. Stronger than a denylist — it also catches newly
// added files with unknown names, not just the ones we happened to enumerate.
//
// Since 8/9 the library is two trees: `viewer/` is what a visitor's page
// loads, `editor/` what only the editor needs. `code-lists/` (reference data
// the library ships — country codes and their like) and the tokens stylesheet
// live under `viewer/`; `data/` — the example graphs — stays outside both.
const ALLOWED_DIRS = new Set(["viewer", "editor", "entries"]);

/** True if the file is approved library code. */
function isLibraryCode(path: string): boolean {
  return ALLOWED_DIRS.has(path.split("/", 1)[0]);
}

describe("distribution entries", () => {
  for (const entry of ["entries/viewer.ts", "entries/editor.ts"]) {
    it(`${entry} drar bara in bibliotekskod, inget exempel-/appskal`, () => {
      const leaks = reachableFiles(entry).filter((f) => !isLibraryCode(f));
      expect(leaks, `Icke-bibliotekskod läckte in i ${entry}:\n${leaks.join("\n")}`).toEqual([]);
    });
  }

  // The direction rule of the split: nothing the viewer entry reaches lies
  // under `editor/`. Type-only imports count too — the test reads source, not
  // a bundle — so a shared *type* belongs in `viewer/types/`, as the editor
  // capability names do (`viewer/types/editor-capabilities.ts`). The editor
  // may import the viewer freely; the converse is what this guards.
  it("visaren drar inte in editorn", () => {
    const editorFiles = reachableFiles("entries/viewer.ts").filter((f) =>
      f.startsWith("editor/"),
    );
    expect(editorFiles, "Editorkod läckte in i visaren").toEqual([]);
  });

  // The editor's own words — 501 keys, a fifth of the viewer bundle — used to
  // travel with every guide a visitor opened, because the merged table was one
  // module. The viewer ships its own table; the editor adds its words when it
  // loads (`editor-ui-strings.ts`). Measured 8/9: the viewer bundle went from
  // 411 597 to 342 357 bytes (global build 352 927 → 292 240), the editor's
  // did not move.
  it("visaren drar inte in editorns strängar", () => {
    expect(reachableFiles("entries/viewer.ts")).not.toContain(
      "editor/localization/editor-strings.ts",
    );
  });

  // The converse of the allowlist above: a bundle can be entirely leak-free and
  // still unusable. Without the built-in node types the consumer's registry is
  // empty and the guide renders nothing — the example pages hide this because
  // their app shells import default-node-types separately.
  for (const entry of ["entries/viewer.ts", "entries/editor.ts"]) {
    it(`${entry} registrerar de inbyggda nodtyperna`, () => {
      expect(reachableFiles(entry)).toContain("viewer/node-types/default-node-types.ts");
    });
  }

  it("the editor embeds the viewer (needed for the preview)", () => {
    const files = reachableFiles("entries/editor.ts");
    expect(files).toContain("viewer/components/guide-preview/guide-preview.ts");
  });
});
