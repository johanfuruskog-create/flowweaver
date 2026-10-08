/**
 * E2E-röktest: startar den byggda appen och driver editorn på riktigt genom ett
 * realistiskt flöde — lägg till en nod, redigera ett fält, exportera JSON och
 * ladda om för att bekräfta att autosparet överlever. Fångar integrations-
 * regressioner som enhets-/komponenttesterna inte ser (bygg → server → DOM →
 * lagring → omladdning).
 *
 * Kör: `npm run build` och sedan `npm run smoke`. Scriptet startar en egen
 * `vite preview` om inte BASE_URL pekas om (t.ex. i CI mot en redan startad
 * server: `BASE_URL=http://host/ node e2e/editor-smoke.mjs`).
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

import { holdBrowserSuiteLock } from "../tools/hold-browser-suite-lock.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PORT = 4188;
const BASE = process.env.BASE_URL ?? `http://localhost:${PORT}/`;
const MANAGE_SERVER = !process.env.BASE_URL;
/*
 * Two trees, two pages. In the working repo the editor is the example
 * site's `examples/editor-advanced.html`, served from the site's build. The
 * open FlowWeaver has no site; it has `demo/editor.html`, a host page over the
 * built bundles, served by `tools/serve-demo.mjs` (open-core step 7,
 * 2026-10-07). Same checks either way — only the address and the back link
 * differ, because the back link goes to each tree's own front page.
 */
const DEMO = !existsSync(join(root, "examples/editor-advanced.html")) && existsSync(join(root, "demo/editor.html"));
const URL = DEMO ? `${BASE}demo/editor.html` : `${BASE}examples/editor-advanced.html`;
const BACK = DEMO ? "./index.html" : "../index.html";

const checks = [];
function check(name, ok) {
  checks.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

let server = null;
async function startServer() {
  if (DEMO) {
    server = spawn(process.execPath, [join(root, "tools/serve-demo.mjs"), String(PORT)], {
      stdio: "ignore",
      env: { ...process.env, FLOWWEAVER_TYST: "1" },
    });
    for (let i = 0; i < 60; i += 1) {
      try {
        if ((await fetch(URL)).ok) return;
      } catch {
        /* servern är inte uppe ännu */
      }
      await sleep(250);
    }
    throw new Error("demoservern startade inte i tid — finns dist-lib/? (`npm run build:lib`)");
  }
  if (!existsSync(new global.URL("../dist", import.meta.url))) {
    throw new Error("dist/ saknas – kör `npm run build` först.");
  }
  /*
   * Vite direkt och inte genom `npx`: skalet dog av `server.kill()` medan vite
   * levde vidare på porten, och nästa körning möttes av en port som var tagen
   * av ingen (mätt 18/9).
   */
  server = spawn(process.execPath, [join(root, "node_modules/vite/bin/vite.js"), "preview", "--port", String(PORT)], {
    stdio: "ignore",
  });
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(BASE);
      if (response.ok) return;
    } catch {
      /* servern är inte uppe ännu */
    }
    await sleep(500);
  }
  throw new Error("vite preview startade inte i tid.");
}

// Djup shadow-DOM-åtkomst körs i sidan; helpers skickas som strängar via evaluate.
const nodeCount = (page) =>
  page.evaluate(() =>
    document
      .querySelector("guide-editor")
      .shadowRoot.querySelector("node-editor")
      .shadowRoot.querySelectorAll("flow-node").length
  );

const canvasHasText = (page, text) =>
  page.evaluate((needle) => {
    const ne = document
      .querySelector("guide-editor")
      .shadowRoot.querySelector("node-editor").shadowRoot;
    return [...ne.querySelectorAll("flow-node")].some((node) =>
      node.shadowRoot.textContent.includes(needle)
    );
  }, text);

async function main() {
  /*
   * Låset först, porten sedan. Det här provet tog inget lås alls, så det kunde
   * starta mitt i någon annans körning — och `vite preview` på 4188 är lika
   * mycket maskinens som webbläsaren är. Skälet i sin helhet står i
   * `login-smoke.mjs`.
   */
  await holdBrowserSuiteLock();

  if (MANAGE_SERVER) await startServer();

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });

  // Nollställ lokalt sparat och ladda om till en ren exempelguide.
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL, { waitUntil: "networkidle" });
  await sleep(600);

  const before = await nodeCount(page);
  check("editorn laddar exempelnoder", before > 0);

  // Bakåtlänk till startsidan finns på exempelsidan.
  const backHref = await page.evaluate(
    () => document.querySelector("a.demo-back")?.getAttribute("href") ?? null
  );
  check("bakåtlänk till start finns", backHref === BACK);

  // Lägg till en regelnod via paletten.
  await page.evaluate(() => {
    document
      .querySelector("guide-editor")
      .shadowRoot.querySelector("node-palette")
      .shadowRoot.querySelector('button[data-node-type="rule"]')
      .click();
  });
  await sleep(300);
  check("palettklick lägger till en nod", (await nodeCount(page)) === before + 1);

  // Markera startnoden och redigera dess rubrik.
  const MARKER = "SMOKE-RUBRIK-42";
  await page.evaluate((marker) => {
    const editor = document.querySelector("guide-editor");
    const ne = editor.shadowRoot.querySelector("node-editor").shadowRoot;
    const startId = editor.graph.startNodeId;
    const node = [...ne.querySelectorAll("flow-node")].find(
      (candidate) => candidate.nodeData?.id === startId
    );
    node.shadowRoot
      .querySelector(".flow-node")
      .dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
    const input = editor.shadowRoot
      .querySelector("properties-panel")
      .shadowRoot.querySelector("#property-title");
    input.value = marker;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, MARKER);
  await sleep(300);
  check("redigerad rubrik syns på canvasen", await canvasHasText(page, MARKER));

  // Exportera guiden och läs den nedladdade filen.
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 5000 }),
    page.evaluate(() =>
      document
        .querySelector("guide-editor")
        .shadowRoot.querySelector("editor-toolbar")
        .shadowRoot.querySelector('[data-action="export"]')
        .click()
    ),
  ]);
  const exportedJson = readFileSync(await download.path(), "utf8");
  check("export ger JSON med redigeringen", exportedJson.includes(MARKER));

  // Vänta in autosparet (debounce 500 ms), ladda om, bekräfta att allt består.
  await sleep(900);
  await page.reload({ waitUntil: "networkidle" });
  await sleep(600);
  check("autospar överlever omladdning (rubrik)", await canvasHasText(page, MARKER));
  check(
    "autospar överlever omladdning (tillagd nod)",
    (await nodeCount(page)) === before + 1
  );

  await page.evaluate(() => localStorage.clear());
  await browser.close();
}

main()
  .then(() => {
    if (server) server.kill();
    const failed = checks.filter((c) => !c.ok);
    console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
    process.exit(failed.length ? 1 : 0);
  })
  .catch((error) => {
    if (server) server.kill();
    console.error("\nE2E-smoke kraschade:", error.message);
    process.exit(1);
  });
