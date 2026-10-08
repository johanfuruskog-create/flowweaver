/**
 * Serves the open FlowWeaver's demo — `demo/` and the built bundles in
 * `dist-lib/` — on http://localhost:4190/demo/, loopback only.
 *
 * A Vite dev server, not a static one, since the guides app came along
 * (*Mina guider*, open-core step 7, 2026-10-07): `demo/guides.html` and
 * `demo/guide-storage.html` run the app from its TypeScript source in
 * `src/host/`, the way the example site does. The editor and viewer pages still
 * load the built bundles with a script tag; Vite serves those files as they are.
 * No config file: the demo needs none of the example site's plugins, and a page
 * that worked only with them would not be a page a host could copy.
 *
 * Loopback only, like `npm run share`. The dev server serves the whole source
 * tree — that is how it compiles the app — and nothing outside this machine
 * should reach it.
 *
 * The demo is a host page, written the way a host would write one: plain HTML
 * that loads the published bundles with a script tag and keeps the guide in
 * localStorage. Nothing here is the example site (which stays in the working
 * repo); it is the smallest page that shows the editor and the viewer working,
 * and what `e2e/editor-smoke.mjs` drives in the open repo (open-core step 7,
 * 2026-10-07).
 *
 * `/demo/guide.json` is not a file: it is read from
 * `src/data/housing-screening-example-graph.ts` at each request (Node reads the
 * TypeScript; it imports only a type), so the demo's starting guide has one
 * home and cannot drift from the example the tests use.
 *
 *     npm run build:lib && npm run serve:demo
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? process.argv[2] ?? 4190);

if (!existsSync(join(ROOT, "dist-lib", "flowweaver-editor.global.js"))) {
  console.error("dist-lib/ saknas — kör `npm run build:lib` först.");
  process.exit(1);
}

/** `/` and `/demo` go to the demo; `/demo/guide.json` is the example guide. */
const demoRoutes = {
  name: "demo-routes",
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const path = new URL(request.url ?? "/", "http://x").pathname;
      if (path === "/" || path === "/demo") {
        response.writeHead(302, { location: "/demo/" });
        response.end();
        return;
      }
      if (path === "/demo/guide.json") {
        const module = await import(join(ROOT, "src/data/housing-screening-example-graph.ts"));
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(module.housingScreeningExampleGraph));
        return;
      }
      next();
    });
  },
};

const server = await createServer({
  configFile: false,
  root: ROOT,
  logLevel: process.env.FLOWWEAVER_TYST ? "error" : "info",
  plugins: [demoRoutes],
  server: { host: "127.0.0.1", port: PORT, strictPort: true },
  /* Nothing to pre-bundle: the shipped code has no npm dependencies. */
  optimizeDeps: { noDiscovery: true, include: [] },
});
await server.listen();
if (!process.env.FLOWWEAVER_TYST) console.log(`FlowWeaver-demon: http://localhost:${PORT}/demo/`);

export { server, PORT };
