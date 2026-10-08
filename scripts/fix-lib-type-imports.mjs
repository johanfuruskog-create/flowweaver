// Sätter .js-ändelse på relativa importer i de emitterade typdeklarationerna.
//
// tsc emitterar specifierarna precis som de står i källan, och källan använder
// `moduleResolution: "bundler"` — alltså utan ändelse. En konsument som kör
// `node16`/`nodenext` avvisar det (TS2834), och eftersom filen då inte löser ut
// försvinner även de vidareexporterade typerna (TS2305). Med `.js` fungerar
// båda lägena: nodenext kräver det, och bundler-resolution mappar `.js` till
// motsvarande `.d.ts`.
//
// Körs av build:lib:types efter tsc. Alternativet vore att bunta ihop
// deklarationerna till en fil per ingång, vilket kräver ett extra beroende.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = "dist-lib/types";

// Relativa specifierare utan ändelse: `from "…"`, sidoeffekt-import och
// typuttrycket `import("…")`, som tsc skriver för typer den inte kunde namnge.
const SPECIFIER = /((?:from\s+|import\s+|import\()")(\.\.?\/[^"]*)(")/g;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.name.endsWith(".d.ts")) yield path;
  }
}

let changed = 0;
for await (const file of walk(ROOT)) {
  const before = await readFile(file, "utf8");
  const after = before.replace(SPECIFIER, (match, head, spec, tail) =>
    // Lämna det som redan har en ändelse ifred (t.ex. "./styles.css").
    /\.[a-z0-9]+$/i.test(spec) ? match : `${head}${spec}.js${tail}`,
  );
  if (after !== before) {
    await writeFile(file, after);
    changed += 1;
  }
}

console.log(`Satte .js-ändelse på relativa importer i ${changed} typdeklarationer.`);
