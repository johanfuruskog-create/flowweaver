// Gör dist-lib/ publicerbar: staplar bygget till TVÅ npm-paket under
// dist-lib/packages/, vart och ett med sitt package.json, sin licens och sin
// README.
//
//   flowweaver-viewer  — visaren, tokens.css och visarens typer      MIT
//   flowweaver-editor  — editorn och dess typer; de lutar mot visarens
//                        genom ett beroende på visarpaketet          MPL-2.0
//
// Två paket för att `license` i package.json är ett fält, inte en karta: ett
// registervy, en SBOM-skanner och en inköpare läser fältet och inget annat.
// Ett paket med två licenser hade behövt "SEE LICENSE IN LICENSE" och en
// förklaring — och det var beslutet från början att visaren är fristående
// (docs/ARCHITECTURE.md, "Två träd"; docs/PRODUCT-VISION.md, *Where the line
// is drawn*).
//
// Repots rot-package.json förblir den privata appen — paketen innehåller bara
// de byggda artefakterna plus typdeklarationerna. Versionen kommer från
// argumentet (tagg vX.Y.Z eller X.Y.Z) och är samma för båda.
//
// Körs i release-workflowet före `npm publish`, en gång per paket. Fristående
// node-script — ingen TS-typkontroll, inga extra beroenden.
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const version = process.argv[2]?.replace(/^v/, "");
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`Ogiltig version: "${process.argv[2] ?? ""}" (förväntar vX.Y.Z)`);
  process.exit(1);
}

// Sökvägar relativa scriptet, inte anropskatalogen: scriptet körs med cwd satt
// till den katalog som innehåller dist-lib/ (repotroten i workflowet, en
// temporär katalog i röktestet).
const REPO = new URL("..", import.meta.url);
const DIST = "dist-lib";

const SCOPE = "@johanfuruskog-create";
const REPOSITORY = {
  type: "git",
  url: "git+https://github.com/johanfuruskog-create/flowweaver.git",
};

const VIEWER_NAME = `${SCOPE}/flowweaver-viewer`;

/**
 * Vad som skiljer paketen. `files` är det som kopieras ur dist-lib/ (kataloger
 * kopieras rekursivt); `licenses` är repofil → namn i paketet.
 *
 * Varje paket bär bara sin egen licens' kod. Visaren tar sina egna typer —
 * `types/editor/` är MPL-kod och hör inte hemma i ett MIT-paket. Editorn tar
 * sina, och där de importerar visarens (`../viewer/...`) skrivs importen om
 * till visarpaketet, som blir ett beroende. Det är därför visaren exponerar
 * `./types/*`. Att i stället kopiera visarens typer in i editorpaketet
 * prövades: en konsument med båda paketen fick då två deklarationer av
 * `guide-preview` i HTMLElementTagNameMap och TS2717.
 *
 * Bundeln bäddar fortfarande in visaren; beroendet är för typerna och för
 * tokens.css, som editorns konsument tar från visarpaketet.
 */
const PACKAGES = {
  viewer: {
    name: VIEWER_NAME,
    description:
      "FlowWeaver – visaren som web component (guide-preview): kör en färdig guide åt besökaren.",
    license: "MIT",
    files: [
      "flowweaver-viewer.js",
      "flowweaver-viewer.global.js",
      "tokens.css",
      "types/viewer",
      "types/entries/viewer.d.ts",
      "types/entries/init.d.ts",
      "types/entries/setup-check.d.ts",
    ],
    exports: {
      ".": {
        types: "./types/entries/viewer.d.ts",
        default: "./flowweaver-viewer.js",
      },
      "./tokens.css": "./tokens.css",
      "./global.js": "./flowweaver-viewer.global.js",
      // Bara för editorpaketets deklarationer; ingen JavaScript bor här.
      "./types/*": "./types/*",
    },
    sideEffects: ["./flowweaver-viewer.js", "./flowweaver-viewer.global.js"],
    licenses: { "LICENSE-MIT": "LICENSE" },
    readme: "scripts/viewer-readme.md",
  },
  editor: {
    name: `${SCOPE}/flowweaver-editor`,
    description:
      "FlowWeaver – editorn som web component (guide-editor): redaktören bygger guiden. Mozilla Public License 2.0.",
    license: "MPL-2.0",
    files: [
      "flowweaver-editor.js",
      "flowweaver-editor.global.js",
      "types/editor",
      "types/entries/editor.d.ts",
      "types/entries/init.d.ts",
      "types/entries/setup-check.d.ts",
    ],
    exports: {
      ".": {
        types: "./types/entries/editor.d.ts",
        default: "./flowweaver-editor.js",
      },
      "./global.js": "./flowweaver-editor.global.js",
    },
    sideEffects: ["./flowweaver-editor.js", "./flowweaver-editor.global.js"],
    dependencies: { [VIEWER_NAME]: version },
    licenses: { "src/editor/LICENSE": "LICENSE" },
    readme: "scripts/editor-readme.md",
  },
};

/** Alla .d.ts under en katalog. */
async function* declarations(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* declarations(path);
    else if (entry.name.endsWith(".d.ts")) yield path;
  }
}

/**
 * `"../../viewer/core/graph.js"` → `"@…/flowweaver-viewer/types/viewer/core/graph.js"`.
 * Trädet under types/editor/ har ingen egen katalog som heter viewer, så varje
 * relativ väg upp till `viewer/` är visarens träd.
 */
async function pointViewerImportsAtPackage(dir) {
  for await (const file of declarations(dir)) {
    const before = await readFile(file, "utf8");
    const after = before.replace(/"(?:\.\.\/)+viewer\//g, `"${VIEWER_NAME}/types/viewer/`);
    if (after !== before) await writeFile(file, after);
  }
}

for (const [key, pkg] of Object.entries(PACKAGES)) {
  const dir = `${DIST}/packages/flowweaver-${key}`;
  // Börja om från tomt: en fil som slutat följa med får inte ligga kvar från
  // en tidigare körning och se ut som att den fortfarande gör det.
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  for (const file of pkg.files) {
    await cp(`${DIST}/${file}`, `${dir}/${file}`, { recursive: true });
  }
  // Licenstexten måste följa med koden — att publicera den utan villkoren
  // vore tomt. README:n är paketets egen, inte repots: den senare handlar om
  // att utveckla projektet, inte använda det.
  for (const [source, target] of Object.entries(pkg.licenses)) {
    await cp(new URL(source, REPO), `${dir}/${target}`);
  }
  await cp(new URL(pkg.readme, REPO), `${dir}/README.md`);
  if (key === "editor") await pointViewerImportsAtPackage(`${dir}/types`);

  const manifest = {
    name: pkg.name,
    version,
    description: pkg.description,
    type: "module",
    license: pkg.license,
    repository: REPOSITORY,
    // Huvudingången registrerar elementet; `./global.js` är det klassiska
    // bygget för sidor som bara kan klistra in `<script src>`.
    //
    // `types` måste stå före `default` — villkoren prövas i ordning, och
    // TypeScript ska hitta deklarationen innan den faller igenom till
    // JavaScript-filen.
    exports: pkg.exports,
    // Inget `files`: katalogen innehåller bara det vi just kopierade dit.
    // Bundlarna registrerar custom elements som sidoeffekt — får inte skakas bort.
    sideEffects: pkg.sideEffects,
    // Bara editorn har ett (visaren); JSON.stringify utelämnar undefined.
    dependencies: pkg.dependencies,
    publishConfig: { registry: "https://npm.pkg.github.com" },
  };
  await writeFile(`${dir}/package.json`, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Skrev ${dir}/ för ${pkg.name}@${version} (${pkg.license})`);
}
