import { defineConfig } from "vite";

import { buildId } from "./scripts/build-id";

// Fristående biblioteksbyggen för distribution: VISAREN och EDITORN var för
// sig, som självförsörjande web component-bundlar (varje komponent bäddar in
// sin SCSS i shadow DOM via `?inline`). Exempelsidans kod ingår aldrig —
// entry-filerna i src/entries importerar bara komponenterna, och entries.test.ts
// vaktar att inget skal-/exempel läcker in. Temavariablerna (:root) byggs
// separat till tokens.css (se package.json → build:lib:tokens).
//
// Ett mål per bygge, valt via LIB_TARGET. Kör via npm-scripten build:lib:*;
// ordningen viewer → editor spelar roll, se emptyOutDir nedan.
// `globalName` används bara av det klassiska bygget (iife), där bundeln måste
// exponera sina exporter på ett globalt namn. Web components registrerar sig
// ändå som sidoeffekt, så namnet behövs sällan av konsumenten.
//
// `license` blir en rad överst i bundeln. Filerna på Pages och i en release
// laddas utan package.json, så det är den enda licensuppgift som följer med
// dem — och MPL-2.0 kräver att mottagaren hittar licensen. `/*!` är
// esbuilds markering för en kommentar minifieringen ska låta stå.
const TARGETS = {
  viewer: {
    entry: "src/entries/viewer.ts",
    fileName: "flowweaver-viewer",
    globalName: "FlowWeaverViewer",
    license: "MIT",
  },
  editor: {
    entry: "src/entries/editor.ts",
    fileName: "flowweaver-editor",
    globalName: "FlowWeaverEditor",
    license: "MPL-2.0 – https://mozilla.org/MPL/2.0/",
  },
  // FlowWeaver PRO (open-core step 4): the same two bundles with the sending
  // steps in them. Never published to the open registry; licensed, not given.
  "pro-viewer": {
    entry: "src/entries/pro-viewer.ts",
    fileName: "flowweaver-pro-viewer",
    globalName: "FlowWeaverProViewer",
    license: "FlowWeaver PRO – licensed, see LICENSE",
  },
  "pro-editor": {
    entry: "src/entries/pro-editor.ts",
    fileName: "flowweaver-pro-editor",
    globalName: "FlowWeaverProEditor",
    license: "FlowWeaver PRO – licensed, see LICENSE",
  },
} as const;

const target = process.env.LIB_TARGET as keyof typeof TARGETS | undefined;
if (!target || !(target in TARGETS)) {
  throw new Error(
    `LIB_TARGET måste vara en av: ${Object.keys(TARGETS).join(", ")} (fick: ${
      target ?? "inget"
    })`,
  );
}

const { entry, fileName, globalName, license } = TARGETS[target];

export default defineConfig({
  // Which build a host runs: `document.querySelector("guide-editor").buildId`.
  plugins: [buildId()],
  build: {
    outDir: "dist-lib",
    // Ett bibliotek ska inte bära med sig sajtens statiska filer (favicon,
    // tutorial-bilder m.m.). tokens.css läggs dit separat av sass.
    copyPublicDir: false,
    // Töm katalogen bara för det första målet (viewer). Editorns bygge lägger
    // till sin fil (emptyOutDir=false), annars skulle det radera visaren.
    // tokens.css läggs till sist av sass.
    emptyOutDir: target === "viewer",
    lib: {
      entry,
      // Två format: ES-modulen för byggverktyg och `<script type="module">`,
      // och en klassisk iife-fil för sidor som bara kan klistra in en vanlig
      // `<script src>` — vanligt i CMS:er, och det enda som fungerar där
      // modulsyntax inte accepteras.
      formats: ["es", "iife"],
      name: globalName,
      fileName: (format) =>
        format === "iife" ? `${fileName}.global.js` : `${fileName}.js`,
    },
    rollupOptions: {
      output: {
        banner: `/*! FlowWeaver ${target} – ${license} – https://github.com/johanfuruskog-create/flowweaver */`,
        // Vite stänger av legal-kommentarer när det minifieras (det klassiska
        // bygget); utan den här raden försvinner bannern ur just de filer en
        // CMS-sida klistrar in. Alla tre nycklarna måste sättas: Vite sprider
        // in vårt objekt sist och ersätter sina standardvärden helt — med bara
        // `legal` följde JSDoc med och ES-bundeln växte 930 → 1 196 kB.
        comments: { legal: true, annotation: true, jsdoc: false },
      },
    },
  },
});
