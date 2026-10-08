/**
 * Återskapar helskärmsfelet på en bred skärm, i en riktig webbläsare.
 *
 * Rapporten: på en 50-tums ultrawide fyller editorn inte hela ytan första
 * gången man går i helskärm, och det går inte att flytta noderna åt vänster.
 * Andra gången fungerar det.
 *
 * Det går inte att fånga i vitest browser: felet kräver att centreringen kommer
 * via resize-observern efter ett riktigt fullscreenbyte, och fullscreen kräver
 * en användargest. Ett reducerat test passerade både med och utan fixen, vilket
 * gör det till ett skydd som ljuger. Det här körs för hand i stället.
 *
 *   npx vite --port 5199
 *   node scripts/repro-fullscreen-wide.mjs
 *
 * Före fixen:  vänsterBas 0    (kodens egen regel säger 300)
 * Efter fixen: vänsterBas 549
 */
import { chromium } from "/home/johan/utveckling/flowweawer/node_modules/playwright-core/index.mjs";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 5120, height: 1440 } });
await page.goto("http://localhost:5199/en/examples/versions.html", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const g = () => page.evaluate(() => {
  const ne = document.querySelector("guide-editor").shadowRoot.querySelector("node-editor");
  const vp = ne.shadowRoot.querySelector(".node-editor__viewport");
  const ws = ne.shadowRoot.querySelector(".node-editor__workspace");
  const zoom = Number(getComputedStyle(ne.shadowRoot.querySelector(".node-editor__scaled")).transform.match(/matrix\(([^,]+)/)?.[1] ?? 1);
  const bas = (v) => Math.round(v / (zoom || 1));
  return { zoom, vy: vp.clientWidth, yta: ws.offsetWidth,
    vänsterBas: bas(vp.scrollLeft),
    högerBas: bas(ws.offsetWidth - (vp.scrollLeft + vp.clientWidth)) };
});

// Skrolla arbetsytan hela vagen at hoger sa underskottet blir stort vid hoppet.
await page.evaluate(() => {
  const ne = document.querySelector("guide-editor").shadowRoot.querySelector("node-editor");
  const vp = ne.shadowRoot.querySelector(".node-editor__viewport");
});
await page.waitForTimeout(500);
console.log("före helskärm ", JSON.stringify(await g()));

await page.locator("guide-editor").evaluate((editor) => {
  const tb = editor.shadowRoot.querySelector("editor-toolbar");
  [...tb.shadowRoot.querySelectorAll("button")]
    .find((b) => /helskärm|fullscreen/i.test(b.getAttribute("aria-label") || b.title || b.textContent || "")).click();
});
await page.waitForTimeout(1400);
console.log("efter 1:a     ", JSON.stringify(await g()));
await browser.close();
