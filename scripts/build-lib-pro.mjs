/**
 * The two FlowWeaver PRO bundles — `flowweaver-pro-viewer` and
 * `flowweaver-pro-editor` — when `src/pro/` is here, and nothing when it is
 * not. The open FlowWeaver is exported without `src/pro/`
 * (tools/open-core/export-allowlist.mjs) and builds the same `build:lib`
 * script; there this says so and steps aside instead of failing the build
 * (open-core step 6, measured in an exported tree 6/10 2026).
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (!existsSync("src/pro")) {
  console.log("build:lib:pro — src/pro/ finns inte här (öppna FlowWeaver); inga PRO-bundlar.");
  process.exit(0);
}
for (const target of ["pro-viewer", "pro-editor"]) {
  const result = spawnSync("npx", ["vite", "build", "--config", "vite.lib.config.ts"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, LIB_TARGET: target },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
