import { readFileSync } from "node:fs";
import { playwright } from "@vitest/browser-playwright";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/*
 * Vitest stubs every stylesheet module to keep unit tests fast — even
 * `.scss?raw`, which Vite itself documents as "serve the file as text".
 * The css-ratchet gate counts raw SCSS source, so this pre-plugin
 * restores the documented `?raw` behavior for scss only. Component
 * styles import `?inline` and stay stubbed, exactly as before.
 */
function rawScss(): Plugin {
  const prefix = "\0fw-raw-scss:";
  const suffix = ".raw";
  return {
    name: "flowweaver:raw-scss",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!source.endsWith(".scss?raw")) return null;
      /* Resolve the real file, then hand back a virtual id the css
       * pipeline does not recognize as a stylesheet. */
      const resolved = await this.resolve(source.slice(0, -"?raw".length), importer, {
        ...options,
        skipSelf: true,
      });
      /* The trailing suffix keeps the virtual id from ending in ".scss" —
       * Vitest's css stubbing matches on that, transforms notwithstanding. */
      return resolved ? prefix + resolved.id + suffix : null;
    },
    load(id) {
      if (id.startsWith(prefix) && id.endsWith(suffix)) {
        return `export default ${JSON.stringify(readFileSync(id.slice(prefix.length, -suffix.length), "utf8"))};`;
      }
    },
  };
}

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [rawScss()],
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.browser.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.ts"],
          /*
           * Eight workers, not one per core. Measured 6/10 2026 on the 16-core
           * machine: three deploy-gate runs at the default parallelism failed
           * 11, 1 and 13 tests — all 15 s timeouts and timing-bound geometry,
           * a different set each time, every one green alone. At eight the
           * whole suite was green in 140 s wall; at sixteen it took 135–182 s.
           * Sixteen headless Chromiums buy nothing but contention.
           *
           * And one retry: four gate runs in a fresh tree failed four
           * different single tests (a 15 s timeout, a hover colour, a
           * contrast read before paint), each green alone and green on the
           * next run. A regression fails twice; a timing flake does not.
           */
          maxWorkers: 8,
          retry: 1,
          setupFiles: ["./src/test-setup/browser.ts"],
          // One browser suite at a time on the machine — the reason is in the file.
          globalSetup: ["./tools/browser-suite-lock.mjs"],
          browser: {
            enabled: true,
            headless: true,
            viewport: { width: 1280, height: 800 },
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
