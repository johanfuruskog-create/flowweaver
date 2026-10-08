/**
 * E2E-röktest av DISTRIBUTIONEN: paketerar de byggda bundlarna precis som
 * release-workflowen gör, installerar dem i ett tomt projekt och kör visaren
 * och editorn där — utan en enda fil från det här repot.
 *
 * Varför ett eget test: enhetstesterna importerar från `src/`, så de ser inte
 * vad en konsument faktiskt får. v0.1.0 publicerades med web-komponenterna
 * registrerade men ett tomt nodtypsregister: guiden renderade ingenting, tyst,
 * utan konsolfel. Det här testet fångar den klassen av fel — allt mellan
 * bygget och `import` hos någon annan (manifestet, exports-kartan, filurvalet,
 * sidoeffekterna som registrerar elementen).
 *
 * Kör: `npm run build:lib` och sedan `npm run smoke:lib`.
 */
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";

import { chromium } from "playwright-core";

import { holdBrowserSuiteLock } from "../tools/hold-browser-suite-lock.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "dist-lib");
const PORT = 4192;
/* Filerna staleness-kontrollen mäter mot. Hela dist-lib/ kopieras ändå. */
const BUNDLES = [
  "flowweaver-viewer.js",
  "flowweaver-viewer.global.js",
  "flowweaver-editor.js",
  "flowweaver-editor.global.js",
  "tokens.css",
];
// Versionen är godtycklig här; den ska bara ta sig igenom manifest-scriptets
// formatkontroll och aldrig publiceras.
const VERSION = "0.0.0-smoke";

const checks = [];
function check(name, ok, extra = "") {
  checks.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  — ${extra}` : ""}`);
}

/** Kör ett kommando och kastar med utdata om det failar — tysta fel döljer orsaken. */
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} misslyckades (${result.status}):\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

/**
 * Bygger tarballerna på exakt samma sätt som release-workflowen: samma
 * manifest-script, samma `npm pack`, ett paket per träd. Manifesten skrivs i
 * en kopia så repots dist-lib/ lämnas orörd (workflowen zippar den innan
 * manifesten finns).
 *
 * Returnerar paketen som { viewer: { name, tarball }, editor: { ... } }.
 */
function packLibrary(work) {
  const staged = join(work, "dist-lib");
  cpSync(DIST, staged, { recursive: true });
  run("node", [join(ROOT, "scripts", "write-lib-manifest.mjs"), VERSION], work);

  const packages = {};
  for (const key of ["viewer", "editor"]) {
    const dir = join(staged, "packages", `flowweaver-${key}`);
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    // Två paket för att licensfältet ska kunna vara ett värde per paket —
    // det är hela skälet till delningen, så det är det första som mäts.
    check(
      `${key}-paketet heter ${manifest.name} och är ${key === "viewer" ? "MIT" : "MPL-2.0"}`,
      manifest.name.endsWith(`/flowweaver-${key}`) &&
        manifest.license === (key === "viewer" ? "MIT" : "MPL-2.0"),
      `${manifest.name} ${manifest.license}`,
    );
    // tokens.css bor bara hos visaren; editorn pekar dit genom sitt beroende.
    const expected = key === "viewer" ? [".", "./global.js", "./tokens.css"] : [".", "./global.js"];
    check(
      `${key}-manifestet exponerar ${expected.join(", ")}`,
      expected.every((sub) => sub in manifest.exports),
      Object.keys(manifest.exports).join(", "),
    );

    const packed = run("npm", ["pack", dir, "--loglevel=error"], work).trim().split("\n").pop();
    packages[key] = { name: manifest.name, tarball: join(work, packed) };
  }
  return packages;
}

/** Installerar båda tarballerna i ett tomt projekt — konsumentens verkliga startläge. */
function installConsumer(work, packages) {
  const consumer = join(work, "consumer");
  mkdirSync(consumer, { recursive: true });
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ name: "consumer", private: true, version: "1.0.0", type: "module" }, null, 2),
  );
  const tarballs = Object.values(packages).map((pkg) => pkg.tarball);
  run("npm", ["install", ...tarballs, "--no-audit", "--no-fund", "--loglevel=error"], consumer);
  return consumer;
}

/** En fråga med två utfall — nog för att se att traverseringen lever. */
const DEMO_GRAPH = {
  startNodeId: "age",
  nodes: [
    {
      id: "age",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: "Har du fyllt 18 år?",
        description: "Välj ett alternativ.",
        variableName: "isAdult",
        variableLabel: "Har fyllt 18 år",
        options: [
          { id: "age-yes", label: "Ja", value: "yes" },
          { id: "age-no", label: "Nej", value: "no" },
        ],
      },
    },
    {
      id: "ok",
      type: "result",
      position: { x: 400, y: -100 },
      data: { title: "Du kan gå vidare", description: "Klart." },
    },
    {
      id: "wait",
      type: "result",
      position: { x: 400, y: 100 },
      data: { title: "Du behöver vänta", description: "Inte ännu." },
    },
  ],
  connections: [
    { id: "c1", from: { nodeId: "age", portId: "age-yes" }, to: { nodeId: "ok", portId: "input" } },
    { id: "c2", from: { nodeId: "age", portId: "age-no" }, to: { nodeId: "wait", portId: "input" } },
  ],
};

/**
 * En sida per bundle, aldrig båda på samma. Laddas de tillsammans registrerar
 * vardera bundeln nodtyperna, och då kan visarens checkar passera tack vare
 * editorn — testet skulle bevisa något svagare än det påstår. Konsumenten som
 * bara vill visa en färdig guide importerar dessutom aldrig editorn.
 */
const PAGE_HTML = (name, target, tokensPackage = name) => `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="UTF-8">
    <title>Konsumenttest – ${target}</title>
    <link rel="stylesheet" href="/node_modules/${tokensPackage}/tokens.css">
    <script type="importmap">
      {
        "imports": {
          "${name}": "/node_modules/${name}/flowweaver-${target}.js"
        }
      }
    </script>
  </head>
  <body>
    ${target === "viewer" ? "<guide-preview></guide-preview>" : '<guide-editor mode="administrator"></guide-editor>'}
    <script type="module">
      // Importerar bara paketets ingång, aldrig något ur repot.
      import "${name}";

      document.querySelector("${target === "viewer" ? "guide-preview" : "guide-editor"}").graph =
        ${JSON.stringify(DEMO_GRAPH)};
      window.__ready = true;
    </script>
  </body>
</html>
`;

/**
 * Klassiska bygget: en vanlig `<script src>` utan modulsyntax, vägen som
 * fungerar i CMS:er där man bara kan klistra in en tagg. Grafen sätts med
 * FLIT före bundeln laddat — det är den ordning en inklistrad tagg oftast
 * hamnar i, och utan komponentens upgrade-guard tappas värdet tyst.
 */
const GLOBAL_HTML = (name) => `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="UTF-8">
    <title>Konsumenttest – klassisk tagg</title>
    <link rel="stylesheet" href="/node_modules/${name}/tokens.css">
  </head>
  <body>
    <guide-preview></guide-preview>
    <script>
      document.querySelector("guide-preview").graph = ${JSON.stringify(DEMO_GRAPH)};
    </script>
    <script src="/node_modules/${name}/flowweaver-viewer.global.js"></script>
    <script>
      window.__ready = true;
    </script>
  </body>
</html>
`;

const CONTENT_TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

function startServer(root) {
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(request.url.split("?")[0]);
    const file = join(root, path === "/" ? "index.html" : path);
    // Servar bara under konsumentkatalogen; en utbrytning ska bli 404, inte fil.
    if (!file.startsWith(root)) return void response.writeHead(403).end("forbidden");
    // Läs först, skriv sedan: skrivs headern före läsningen kan 404-vägen inte
    // svara, för headers är redan skickade. Latent här eftersom alla filer
    // finns — men den dagen en saknas vill vi ha ett 404, inte en krasch.
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

/**
 * Vägrar mäta ett inaktuellt bibliotek.
 *
 * Skriptet packar `dist-lib/` och bygger den inte. Utan den här kontrollen kan
 * grinden rapportera grönt för kod som inte finns i bygget — vilket den också
 * gjorde: ett helt arbetspass av "19/19" mätte en byggnad från innan
 * ändringarna. En grind som kan mäta fel sak är ingen grind.
 */
function kastaOmByggetÄrGammalt() {
  const senaste = (dir) =>
    readdirSync(dir, { withFileTypes: true }).reduce((max, post) => {
      const sökväg = join(dir, post.name);
      const tid = post.isDirectory() ? senaste(sökväg) : statSync(sökväg).mtimeMs;
      return Math.max(max, tid);
    }, 0);

  const källa = senaste(join(ROOT, "src"));
  const bygge = Math.min(...BUNDLES.map((f) => statSync(join(DIST, f)).mtimeMs));

  if (källa > bygge) {
    throw new Error(
      "dist-lib/ är äldre än src/ – kör `npm run build:lib` först, annars " +
        "mäter den här grinden en byggnad som inte speglar koden.",
    );
  }
}

/**
 * Paketet ska anropa värden med data, inte lagra åt den.
 *
 * Guiden, nodmallarna, temavalet och startknuffens avfärdande ägs alla av
 * värdsystemet — biblioteket applicerar och berättar (K6d). Det syns bäst i
 * bundeln: står `localStorage` där har någon börjat spara igen.
 *
 * Kontrollen läser texten i stället för att köra koden, för en skrivning kan
 * ligga bakom en gren som ett smoke-test aldrig når.
 */
function kontrolleraAttPaketetInteLagrar() {
  const lagringsApier = ["localStorage", "sessionStorage", "indexedDB"];

  for (const fil of BUNDLES.filter((f) => f.endsWith(".js"))) {
    const innehåll = readFileSync(join(DIST, fil), "utf8");
    const funna = lagringsApier.filter((api) => innehåll.includes(api));

    check(
      `${fil} rör inte värdens lagring`,
      funna.length === 0,
      funna.join(", "),
    );
  }
}

async function main() {
  if (!existsSync(DIST) || !BUNDLES.every((f) => existsSync(join(DIST, f)))) {
    throw new Error("dist-lib/ saknas eller är ofullständig – kör `npm run build:lib` först.");
  }

  kastaOmByggetÄrGammalt();

  kontrolleraAttPaketetInteLagrar();

  const work = await mkdtemp(join(tmpdir(), "flowweaver-lib-smoke-"));
  let server = null;
  let browser = null;

  try {
    const packages = packLibrary(work);
    const consumer = installConsumer(work, packages);
    const { name } = packages.viewer;
    const editorName = packages.editor.name;

    // Node löser exports-kartorna innan någon webbläsare är inblandad: felstavad
    // subpath eller saknad fil syns här, med ett tydligare fel än i DOM:en.
    const resolver = `${[name, `${name}/global.js`, `${name}/tokens.css`, editorName, `${editorName}/global.js`]
      .map((specifier) => `import.meta.resolve(${JSON.stringify(specifier)});`)
      .join("")}console.log("ok");`;
    const resolved = spawnSync("node", ["--input-type=module", "-e", resolver], {
      cwd: consumer,
      encoding: "utf8",
    });
    check(
      "ingångarna går att lösa ut från båda paketen",
      resolved.status === 0,
      resolved.stderr.trim().split("\n")[0] ?? "",
    );

    // Licensfältet utan texten är tomt: MIT-texten hos visaren, MPL-2.0 hos
    // editorn. README:n är paketets ansikte i varje registervy. Och varje
    // paket bär bara sin egen licens' kod: visarens inte editorns typer (MPL
    // i ett MIT-paket), editorns inte visarens (den lutar mot visarpaketet —
    // en kopia gav TS2717 hos en konsument med båda paketen).
    const packageDir = (pkg) => join(consumer, "node_modules", ...pkg.split("/"));
    const licence = (pkg) => readFileSync(join(packageDir(pkg), "LICENSE"), "utf8");
    check(
      "visarens paket har LICENSE (MIT) och README",
      existsSync(join(packageDir(name), "README.md")) && licence(name).includes("MIT License"),
    );
    check(
      "editorns paket har LICENSE (MPL-2.0) och README",
      existsSync(join(packageDir(editorName), "README.md")) &&
        licence(editorName).includes("Mozilla Public License Version 2.0"),
    );
    check(
      "varje paket bär bara sin egen licens' typer",
      !existsSync(join(packageDir(name), "types", "editor")) &&
        !existsSync(join(packageDir(editorName), "types", "viewer")),
    );

    // TypeScript-konsumenter fick tidigare implicit any (TS7016). Körs i båda
    // upplösningslägena: `bundler` är vad en webbapp använder, `nodenext` är
    // strängare och avslöjar ändelselösa importer i deklarationerna.
    writeFileSync(
      join(consumer, "app.ts"),
      [
        `import { GuidePreview } from "${name}";`,
        `import type { GraphData } from "${name}";`,
        `import { GuideEditor } from "${editorName}";`,
        `const graph: GraphData = { startNodeId: "a", nodes: [], connections: [] };`,
        `new GuidePreview().graph = graph;`,
        `new GuideEditor().graph = graph;`,
      ].join("\n"),
    );
    for (const [mode, options] of [
      ["bundler", { module: "esnext", moduleResolution: "bundler" }],
      ["nodenext", { module: "nodenext", moduleResolution: "nodenext" }],
    ]) {
      writeFileSync(
        join(consumer, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            ...options,
            target: "es2022",
            lib: ["ES2022", "DOM"],
            strict: true,
            noEmit: true,
          },
        }),
      );
      const tsc = spawnSync("npx", ["--prefix", ROOT, "tsc", "-p", "."], {
        cwd: consumer,
        encoding: "utf8",
      });
      check(
        `TypeScript-typerna fungerar (moduleResolution: ${mode})`,
        tsc.status === 0,
        (tsc.stdout || tsc.stderr).trim().split("\n")[0]?.slice(0, 140) ?? "",
      );
    }

    writeFileSync(join(consumer, "viewer.html"), PAGE_HTML(name, "viewer"));
    writeFileSync(join(consumer, "editor.html"), PAGE_HTML(editorName, "editor", name));
    writeFileSync(join(consumer, "global.html"), GLOBAL_HTML(name));
    // Editorns klassiska bygge, laddat precis som Sitevision-modulens dialog
    // gör det. Det var den vägen som var trasig i varje release före v0.4.0.
    writeFileSync(
      join(consumer, "global-editor.html"),
      `<!doctype html>
<html lang="sv">
  <head><meta charset="UTF-8"><title>Konsumenttest – klassisk editor</title></head>
  <body>
    <guide-editor></guide-editor>
    <script src="/node_modules/${editorName}/flowweaver-editor.global.js"></script>
    <script>window.__ready = true;</script>
  </body>
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

    server = await startServer(consumer);

    browser = await chromium.launch();

    /** Öppnar en sida som bara laddat EN bundle och samlar dess konsolfel. */
    const open = async (target) => {
      const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
      await page.goto(`http://localhost:${PORT}/${target}.html`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
      check(
        `${target}-bundeln laddas utan konsolfel`,
        errors.length === 0,
        errors.join(" | ").slice(0, 200),
      );
      return page;
    };

    // Playwrights lokatorer går genom shadow DOM; textContent på översta roten
    // räcker inte, eftersom noderna ligger i nästlade shadow-rötter.
    const seen = async (locator, name, timeout = 8000) => {
      try {
        await locator.first().waitFor({ state: "visible", timeout });
        check(name, true);
      } catch {
        check(name, false, "syns inte i DOM");
      }
    };

    // ---- Visaren, ensam på sidan ----
    const page = await open("viewer");

    const viewerRegistered = await page.evaluate(() => ({
      preview: Boolean(customElements.get("guide-preview")),
      editor: Boolean(customElements.get("guide-editor")),
    }));
    check("visar-bundeln registrerar guide-preview", viewerRegistered.preview);
    // Visaren ska inte dra in editorn – det är halva poängen med två bundlar.
    check("visar-bundeln drar inte in editorn", !viewerRegistered.editor);

    /*
     * Tokens ligger ett steg ner från `:root`, på våra egna taggar. En värd som
     * bäddar in oss ska inte få sin sida ommålad, och därför mäts variablerna
     * där de faktiskt hör hemma.
     *
     * Båda hållen kontrolleras: att elementet får dem, och att dokumentet inte
     * gör det. Det andra är löftet till värden, och det som lätt går förlorat.
     */
    const tokens = await page.evaluate(() => {
      const el = document.querySelector("guide-preview");
      return {
        påElementet: getComputedStyle(el).getPropertyValue("--fw-logo-blue").trim(),
        påDokumentet: getComputedStyle(document.documentElement)
          .getPropertyValue("--fw-logo-blue")
          .trim(),
      };
    });
    check(
      "bundeln levererar temavariabler till sina egna taggar",
      tokens.påElementet.length > 0,
      tokens.påElementet || "(tom)",
    );
    check(
      "och lämnar värdens dokument orört",
      tokens.påDokumentet.length === 0,
      tokens.påDokumentet || "(inga)",
    );

    const preview = page.locator("guide-preview");
    await seen(preview.getByText("Har du fyllt 18 år?"), "visaren renderar startfrågan");

    // Hela poängen: utan registrerade nodtyper finns inget att klicka på, och
    // ett tomt register ser annars ut som en fungerande bundle. Frågenoden
    // kräver ett val och sedan navigeringsknappen (`nav.next`).
    //
    // Klicken får inte kasta vidare: en trasig bundle ska ge en fullständig
    // rapport, inte ett stackspår vid första interaktionen.
    let interacted = true;
    try {
      await preview.getByText("Ja", { exact: true }).first().click({ timeout: 8000 });
      await preview.getByRole("button", { name: "Nästa" }).first().click({ timeout: 8000 });
    } catch {
      interacted = false;
    }
    if (interacted) {
      await seen(preview.getByText("Du kan gå vidare"), "visaren går vidare till resultatet");
    } else {
      check("visaren går vidare till resultatet", false, "gick inte att interagera med frågan");
    }

    // ---- Editorn, ensam på sin egen sida ----
    const editorPage = await open("editor");

    check(
      "editor-bundeln registrerar guide-editor",
      await editorPage.evaluate(() => Boolean(customElements.get("guide-editor"))),
    );
    // Editorn ska däremot bädda in visaren – förhandsvisningen behöver den.
    check(
      "editor-bundeln bäddar in visaren",
      await editorPage.evaluate(() => Boolean(customElements.get("guide-preview"))),
    );

    await seen(
      editorPage.locator("guide-editor").getByText("Har du fyllt 18 år?"),
      "editorn renderar grafen",
    );

    // Läget är opt in: sidan ovan sätter "administrator" för att kunna bygga,
    // precis som en riktig värd måste. Utan attributet ska paketet ge en guide
    // att titta på — annars ger vi bort förmåga av misstag i varje installation
    // som inte känner till lägena.
    const standardläge = await editorPage.evaluate(() => {
      const editor = document.createElement("guide-editor");
      document.body.append(editor);
      const läge = editor.mode;
      editor.remove();
      return läge;
    });
    check(
      "utan mode-attribut är paketets editor readonly",
      standardläge === "readonly",
      standardläge,
    );

    // Canvasen ritar nodrubriker ur grafdatan och ser därför riktig ut även med
    // ett tomt register — paletten gör det inte. Den byggs ur nodtyperna, så
    // det är här editorns halva av samma brist faktiskt syns.
    const paletteTypes = await editorPage.evaluate(() => {
      const palette = document
        .querySelector("guide-editor")
        ?.shadowRoot?.querySelector("node-palette")?.shadowRoot;
      if (!palette) return null;
      return [...palette.querySelectorAll("button[data-node-type]")].map(
        (button) => button.dataset.nodeType,
      );
    });
    // Räknar inte antalet — det ändras varje gång en nodtyp tillkommer. Kräver
    // i stället de två mest grundläggande typerna: utan dem går ingen guide att
    // bygga, och båda kommer från just det register som saknades i v0.1.0.
    // (Paletten var inte tom då utan hade 3 av 17 poster, så ett `> 0`-krav
    // hade sett grönt ut.)
    // ---- Klassisk script-tagg, utan modulsyntax ----
    const globalPage = await open("global");

    check(
      "klassiska bygget registrerar guide-preview",
      await globalPage.evaluate(() => Boolean(customElements.get("guide-preview"))),
    );
    // Grafen sattes före taggen på den sidan: det här bevisar upgrade-guarden,
    // utan vilken värdet tappas tyst och ytan blir tom.
    await seen(
      globalPage.locator("guide-preview").getByText("Har du fyllt 18 år?"),
      "klassiska bygget renderar en graf satt före laddningen",
    );

    check(
      "editorns palett erbjuder fråge- och resultatnoder",
      paletteTypes?.includes("question") && paletteTypes?.includes("result"),
      paletteTypes === null ? "paletten hittades inte" : `${paletteTypes.length} nodtyper`,
    );

    // ---- Värdens språkpaket (berättelse 010) ----
    // Hela poängen med registret är att ett värdsystem kan nå det. Fungerar det
    // i källkoden men inte ur bundeln finns funktionen inte, och det syns bara
    // här: unit-testerna importerar modulen direkt och skulle inte märka om
    // ingången slutade exportera den.
    const localeCheck = await globalPage.evaluate(() => {
      const api = window.FlowWeaverViewer;
      if (!api || typeof api.registerLocale !== "function") {
        return { fanns: false };
      }
      const mall = api.localeStrings("sv");
      api.registerLocale("ar", { "nav.next": "التالي" });
      const preview = document.querySelector("guide-preview");
      preview.activeLocale = "ar";
      return {
        fanns: true,
        mallStorlek: Object.keys(mall).length,
        mallHarNästa: mall["nav.next"] === "Nästa",
        mallHarEditorn: "editor.close" in mall,
        inbyggda: api.builtInLocales().join(","),
        arabiskaFinns: api.availableLocales().includes("ar"),
      };
    });

    check(
      "värdsystemet kan registrera ett språkpaket ur bundeln",
      localeCheck.fanns && localeCheck.arabiskaFinns,
      localeCheck.fanns ? "" : "registerLocale saknas på det globala namnet",
    );
    check(
      "paketets egna texter går att hämta som mall",
      localeCheck.mallHarNästa && localeCheck.mallStorlek > 100,
      `${localeCheck.mallStorlek ?? 0} nycklar`,
    );
    // Visarens mall är visarens ord. Editorns 500 nycklar följde med varje
    // besökare fram till 8/9 (en femtedel av bundeln); nu kommer de med
    // editorn, och en översättare som frågar visaren får det visaren visar.
    check(
      "visarens mall bär inte editorns ord",
      !localeCheck.mallHarEditorn,
      localeCheck.mallHarEditorn ? "editor.close finns i visarens mall" : "",
    );
    check(
      "svenska och engelska följer med paketet",
      localeCheck.inbyggda === "en,sv",
      localeCheck.inbyggda,
    );
    await seen(
      globalPage.locator("guide-preview").getByText("التالي"),
      "den registrerade texten når invånaren",
    );

    /*
     * Editorn via en vanlig script-tagg — Sitevision-modulens väg.
     *
     * Varje release före v0.4.0 publicerade bara ES-modulen, så den taggen
     * mötte `export {` i en klassisk parser och kastade SyntaxError. Editorn
     * registrerades aldrig, och dialogen visade sitt loadError. Ingenting här
     * såg det, för grinden mätte den lokala `dist-lib/` där båda funnits.
     */
    const editorGlobalPage = await open("global-editor");

    /*
     * Allt vi bygger publiceras också.
     *
     * Två listor som måste stämma överens: vad `build:lib` producerar och vad
     * `release.yml` laddar upp. Ingenting band ihop dem, och de gled isär —
     * varje release före v0.4.0 saknade de klassiska byggena. En konsument som
     * laddade en vanlig script-tagg mötte `export {` och fick SyntaxError.
     *
     * Kontrollerna nedan om att det klassiska bygget *fungerar* såg det aldrig,
     * för de mäter den lokala `dist-lib/` där filen alltid funnits. Den här
     * mäter i stället att den kommer med.
     */
    /*
     * The open FlowWeaver is exported without .github/ (step 6, 2026-10-06):
     * its publishing is step 7. There the check has nothing to compare with,
     * and it says so in the output rather than passing or crashing.
     */
    const releaseFile = join(ROOT, ".github/workflows/release.yml");
    if (!existsSync(releaseFile)) {
      console.log("SKIP  allt vi bygger publiceras också  — release.yml finns inte här (öppna FlowWeaver, steg 7)");
    } else {
      const workflow = readFileSync(
        releaseFile,
        "utf8",
      );
      const publicerade = [...workflow.matchAll(/dist-lib\/([\w.-]+)/g)].map(
        (match) => match[1],
      );
      const byggda = readdirSync(DIST).filter(
        (fil) => fil.endsWith(".js") || fil === "tokens.css",
      );
      const opublicerade = byggda.filter((fil) => !publicerade.includes(fil));

      check(
        "allt vi bygger publiceras också",
        opublicerade.length === 0,
        opublicerade.length > 0 ? `saknas i release.yml: ${opublicerade.join(", ")}` : "",
      );
    }

    check(
      "klassiska editorbygget registrerar guide-editor",
      await editorGlobalPage.evaluate(() =>
        Boolean(customElements.get("guide-editor")),
      ),
    );
    check(
      "och exponerar sina funktioner på det globala namnet",
      await editorGlobalPage.evaluate(
        () => typeof window.FlowWeaverEditor?.checkSetup === "function",
      ),
    );
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
    rmSync(work, { recursive: true, force: true });
  }
}

main()
  .then(() => {
    const failed = checks.filter((c) => !c.ok);
    console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
    process.exit(failed.length ? 1 : 0);
  })
  .catch((error) => {
    console.error("\nDistributions-smoke kraschade:", error.message);
    process.exit(1);
  });
