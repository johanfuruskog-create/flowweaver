import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { tmpdir } from "node:os";

import { chromium } from "playwright-core";

import { holdBrowserSuiteLock } from "../tools/hold-browser-suite-lock.mjs";

/**
 * Kör en **publicerad** release som en värd gör det.
 *
 * ## Varför den här och inte `smoke:lib`
 *
 * `smoke:lib` mäter `dist-lib/` — det vi just byggde. Den grinden är bra på vad
 * koden gör, men den kan inte se skillnad på *byggt* och *levererat*.
 *
 * Skillnaden var verklig. Vi bygger fyra filer och publicerade två: de
 * klassiska byggena kom aldrig med i en release. En vanlig `<script src>` mot
 * en release-fil mötte därför `export {` i en klassisk parser, kastade
 * `SyntaxError`, och `guide-editor` registrerades aldrig. Sitevision-modulens
 * inställningsdialog kunde aldrig öppna en editor — i någon version.
 *
 * Ingenting fångade det, för allt vi mätte fanns lokalt. Det hittades av att en
 * människa råkade ladda ner filen och köra den. Det här är den grinden som gör
 * att ingen behöver råka.
 *
 * ## Anropas med en tagg
 *
 *     node e2e/released-bundle-smoke.mjs v0.4.1
 *
 * Hämtar assets ur releasen, serverar dem lokalt och driver dem i en riktig
 * webbläsare. Kräver `gh` med läsrätt på repot; i CI räcker `GITHUB_TOKEN`.
 */

const PORT = 4183;
const TAG = process.argv[2];

if (!TAG) {
  console.error("Ange en tagg, t.ex. v0.4.1");
  process.exit(1);
}

const checks = [];
function check(name, ok, extra = "") {
  checks.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  — ${extra}` : ""}`);
}

const DEMO_GRAPH = {
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Bor du i kommunen?" },
        variableName: "bor",
        options: [{ id: "ja", label: { sv: "Ja" }, value: "ja" }],
      },
    },
  ],
  connections: [],
  settings: { locales: ["sv", "en"] },
};

/*
 * `<meta charset="UTF-8">` är inte pynt.
 *
 * Ett klassiskt skript utan egen teckenkodning i svaret ärver dokumentets. Utan
 * raden avkodas bundelns svenska text som latin-1, och filen kastar
 * `SyntaxError` — vilket ser ut precis som ett trasigt bygge. Jag rapporterade
 * nästan en oskyldig bundle som trasig av exakt det skälet.
 */
const CLASSIC_HTML = (fil, tagg, sättGraf) => `<!doctype html>
<html lang="sv">
  <head><meta charset="UTF-8"><title>Släppt bundle</title></head>
  <body>
    <${tagg} id="el" style="display:block;height:600px"></${tagg}>
    ${sättGraf ? `<script>document.getElementById("el").graph = ${JSON.stringify(DEMO_GRAPH)};</script>` : ""}
    <script src="./${fil}"></script>
    <script>window.__ready = true;</script>
  </body>
</html>
`;

const MODULE_HTML = (fil, tagg) => `<!doctype html>
<html lang="sv">
  <head><meta charset="UTF-8"><title>Släppt bundle, ESM</title></head>
  <body>
    <${tagg} id="el" style="display:block;height:600px"></${tagg}>
    <script type="module">
      import * as api from "./${fil}";
      window.__api = api;
      document.getElementById("el").graph = ${JSON.stringify(DEMO_GRAPH)};
      window.__ready = true;
    </script>
  </body>
</html>
`;

const CONTENT_TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

function startServer(root) {
  const server = createServer((request, response) => {
    const file = join(root, decodeURIComponent(request.url.split("?")[0]));
    if (!file.startsWith(root)) return void response.writeHead(403).end("forbidden");
    // Läs först, skriv sedan. Skrivs headern före läsningen kan 404-vägen inte
    // längre svara — den försöker skriva headers en andra gång och servern
    // kraschar i stället för att rapportera. En saknad fil är precis vad den
    // här grinden finns för att upptäcka, så den vägen måste fungera.
    let body;
    try {
      body = readFileSync(file);
    } catch {
      return void response.writeHead(404).end("not found");
    }
    response.writeHead(200, {
      "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
    });
    response.end(body);
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

async function main() {
  const work = mkdtempSync(join(tmpdir(), "flowweaver-released-"));
  let server;
  let browser;

  try {
    // Hämtas ur releasen, inte ur dist-lib. Det är hela poängen.
    if (process.env.FLOWWEAVER_LOCAL_ASSETS) {
      // Bara för att pröva att grinden biter: peka på en katalog med assets.
      for (const fil of readdirSync(process.env.FLOWWEAVER_LOCAL_ASSETS)) {
        writeFileSync(
          join(work, fil),
          readFileSync(join(process.env.FLOWWEAVER_LOCAL_ASSETS, fil)),
        );
      }
    } else {
      execFileSync("gh", ["release", "download", TAG, "-D", work, "--clobber"], {
        stdio: "inherit",
      });
    }

    const hämtade = readdirSync(work);
    console.log(`\n${TAG}: ${hämtade.join(", ")}\n`);

    // Vad en värd faktiskt kan ladda. Saknas något är resten meningslöst.
    for (const fil of [
      "flowweaver-editor.global.js",
      "flowweaver-viewer.global.js",
      "flowweaver-editor.js",
      "flowweaver-viewer.js",
      "tokens.css",
    ]) {
      check(`releasen innehåller ${fil}`, hämtade.includes(fil));
    }

    writeFileSync(
      join(work, "classic-editor.html"),
      CLASSIC_HTML("flowweaver-editor.global.js", "guide-editor", true),
    );
    writeFileSync(
      join(work, "classic-viewer.html"),
      CLASSIC_HTML("flowweaver-viewer.global.js", "guide-preview", true),
    );
    writeFileSync(
      join(work, "module-editor.html"),
      MODULE_HTML("flowweaver-editor.js", "guide-editor"),
    );
    /*
     * `tokens.css` publiceras, alltså kan en värd länka den — men den laddades
     * aldrig av någon sida här, så en läcka i den var osynlig för grinden. Ett
     * sabotage som lade `:root{--fw-primary:#f00}` i filen passerade 16/16.
     *
     * Egen sida, utan bundle: filen ensam ska inte kunna nå värdens dokument.
     */
    writeFileSync(
      join(work, "stylesheet.html"),
      `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="UTF-8"><title>Släppt stilmall</title>
    <link rel="stylesheet" href="./tokens.css">
  </head>
  <body><p>utan bundle</p><script>window.__ready = true;</script></body>
</html>
`,
    );

    /*
     * Låset först, porten sedan (18/9).
     *
     * Det här provet tog inget webbläsarlås alls, så det kunde starta mitt i
     * någon annans körning — och en fast port är lika mycket maskinens som en
     * webbläsare är. Skälet i sin helhet står i `login-smoke.mjs`.
     */
    await holdBrowserSuiteLock();

    server = await startServer(work);
    browser = await chromium.launch();

    const open = async (sida) => {
      const page = await browser.newPage();
      const fel = [];
      page.on("pageerror", (error) => fel.push(String(error)));
      await page.goto(`http://localhost:${PORT}/${sida}.html`, {
        waitUntil: "networkidle",
      });
      await page.waitForTimeout(1500);
      check(`${sida} laddas utan konsolfel`, fel.length === 0, fel[0] ?? "");
      return page;
    };

    // Den klassiska vägen: en vanlig script-tagg, ingen bundlare. Det är den
    // Sitevision-modulen tar, och den som var trasig i varje release.
    const klassiskEditor = await open("classic-editor");
    check(
      "klassiska editorn registrerar guide-editor",
      await klassiskEditor.evaluate(() => Boolean(customElements.get("guide-editor"))),
    );
    check(
      "och renderar en graf som satts före skript-taggen",
      await klassiskEditor.evaluate(() =>
        Boolean(
          document
            .getElementById("el")
            ?.shadowRoot?.querySelector("node-editor")
            ?.shadowRoot?.querySelector("flow-node"),
        ),
      ),
    );

    const uppsättning = await klassiskEditor.evaluate(() => {
      const api = window.FlowWeaverEditor;
      if (!api?.checkSetup) return null;
      const el = document.getElementById("el");
      el.setAttribute("mode", "administrator");
      return api.checkSetup(el);
    });
    check("exponerar sitt API på det globala namnet", uppsättning !== null);
    check(
      "och säger att en gjord uppsättning är gjord",
      uppsättning?.ok === true,
      uppsättning?.findings?.map((f) => f.id).join(", ") ?? "",
    );

    check(
      "värdens dokument lämnas orört",
      await klassiskEditor.evaluate(
        () =>
          getComputedStyle(document.documentElement)
            .getPropertyValue("--fw-primary")
            .trim() === "",
      ),
    );

    const klassiskVisare = await open("classic-viewer");
    /*
     * `getByText`, inte `textContent`. Det senare läser elementets egen text och
     * ser inget inuti skuggroten — det ger ett tomt svar som ser ut som en
     * visare som inte renderat. Första versionen av den här raden gjorde det.
     */
    check(
      "klassiska visaren renderar startfrågan",
      await klassiskVisare
        .locator("guide-preview")
        .getByText("Bor du i kommunen?")
        .isVisible()
        .catch(() => false),
    );

    // Stilmallen ensam. En värd som länkar den ska inte få sin sida ommålad.
    const stilmall = await open("stylesheet");
    check(
      "den publicerade tokens.css rör inte värdens dokument",
      await stilmall.evaluate(() =>
        ["--fw-primary", "--fw-surface", "--fw-text"].every(
          (namn) =>
            getComputedStyle(document.documentElement)
              .getPropertyValue(namn)
              .trim() === "",
        ),
      ),
    );

    // Och modulvägen, för den som har en bundlare.
    const modul = await open("module-editor");
    check(
      "ES-modulen exporterar sitt API",
      await modul.evaluate(() => typeof window.__api?.checkSetup === "function"),
    );
    check(
      "och registrerar guide-editor",
      await modul.evaluate(() => Boolean(customElements.get("guide-editor"))),
    );
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
    rmSync(work, { recursive: true, force: true });
  }

  const failed = checks.filter((entry) => !entry.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
