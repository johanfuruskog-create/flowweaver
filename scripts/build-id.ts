import { execSync } from "node:child_process";

import type { Plugin } from "vite";

/**
 * The build's identity, written into the bundle at every build (fynd f, 26/9).
 *
 * Johan measured the same fault on the iPad twice after it was fixed, and
 * nothing on the device said which build it was running: a cached page, a
 * tunnel still serving the last `share:live` round, or the fix itself — three
 * readings of one screenshot. `src/editor/core/build-id.ts` holds a
 * placeholder; this puts the commit, whether the tree had uncommitted
 * changes, and the time into it.
 *
 * In `renderChunk` and not a `define`: `define` is read once when the config
 * loads, and `share:live` runs `vite build --watch` for hours — every rebuild
 * would carry the first one's stamp. A chunk is rendered on every build.
 */
const PLACEHOLDER = "__FW_BUILD_ID__";

function describe(): string {
  const run = (command: string): string => {
    try {
      return execSync(command, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    } catch {
      return "";
    }
  };
  const hash = run("git rev-parse --short HEAD") || "okänd";
  const dirty = run("git status --porcelain --untracked-files=no") !== "";

  return `${hash}${dirty ? "+ändringar" : ""} ${new Date().toISOString()}`;
}

export function buildId(): Plugin {
  let id = PLACEHOLDER;

  return {
    name: "flowweaver-build-id",
    apply: "build",
    buildStart() {
      id = describe();
    },
    renderChunk(code) {
      return code.includes(PLACEHOLDER) ? { code: code.replaceAll(PLACEHOLDER, id), map: null } : null;
    },
  };
}
