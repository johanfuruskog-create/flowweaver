// Plockar ut en versions avsnitt ur CHANGELOG.md.
//
// Release-texten byggs annars bara av commit-titlar, och de säger inte vad en
// värd måste göra vid en brytande ändring. Anvisningen ska stå på releasesidan,
// inte bara i repot.
//
// Kör: node scripts/changelog-section.mjs 0.2.0
// Skriver avsnittet på stdout. Saknas det blir utdatan tom och anropet lyckas
// ändå — en release utan changelog-post ska inte stoppa publiceringen.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = (process.argv[2] ?? "").replace(/^v/, "");

if (!version) {
  console.error("Ange en version, t.ex. 0.2.0");
  process.exit(1);
}

let text = "";

try {
  text = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
} catch {
  process.exit(0);
}

const rader = text.split("\n");
// Rubriken bär en titel efter versionen (`## 0.11.0 — …`); en exakt
// jämförelse hittade den aldrig, så ingen release sedan 0.2 fick sin post.
const start = rader.findIndex((rad) => rad.trim() === `## ${version}` || rad.startsWith(`## ${version} `));

if (start === -1) {
  process.exit(0);
}

const slut = rader.findIndex(
  (rad, index) => index > start && rad.startsWith("## "),
);

process.stdout.write(
  rader
    .slice(start + 1, slut === -1 ? rader.length : slut)
    .join("\n")
    .trim() + "\n",
);
