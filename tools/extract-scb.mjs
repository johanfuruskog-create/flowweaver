/**
 * Reads SCB's counties and municipalities into two code lists.
 *
 *     node tools/extract-scb.mjs <kommunlankod-2026.xlsx>
 *
 * The file is published at
 * https://www.scb.se/hitta-statistik/regional-statistik-och-kartor/regionala-indelningar/lan-och-kommuner/lan-och-kommuner-i-kodnummerordning/
 * under CC0, and its name carries the year — so a new one arrives annually and
 * regenerating has to be cheaper than re-deriving.
 *
 * ## Two lists rather than one
 *
 * A municipality's code begins with its county's — `0114` is in `01` — so one
 * list could serve both. It would only work because SCB happened to design the
 * codes that way, and a guide asking "which county" would carry 290 entries to
 * offer 21. Two lists need no new mechanism; a `parent` field can be added the
 * day something actually needs the hierarchy.
 *
 * ## The municipalities carry their full names, from Wikidata
 *
 * SCB says *Hultsfred*; the municipality is *Hultsfreds kommun*, and a result
 * that says "Ansökan går till Hultsfred" sounds like a town. No authority
 * publishes the full names as data (SCB, SKR, Skatteverket, Lantmäteriet all
 * list the short form — checked 6/9 2026), and no rule derives them: 133 take
 * a genitive s, 155 do not, and Falun is *Falu kommun*. Wikidata's Swedish
 * labels (CC0, one SPARQL query) have them all, so the names come from there
 * and the codes from SCB. Which source is right is the host's problem — this
 * list is a demonstration, and the demonstration should read like a letter.
 *
 * Gotland is the one label overridden: Wikidata says *Region Gotland*, the
 * municipality's own name for itself; the list is of municipalities.
 *
 * ## Why the names are not translated
 *
 * Municipality names are proper nouns: *Upplands Väsby* is Upplands Väsby in
 * every language, unlike a country, which has a name in each. The counties are
 * the one place it could be argued — *Stockholms län* against *Stockholm
 * County* — and inventing a set of English county names to sit beside an
 * authority's Swedish ones would be our words presented as theirs. They are left
 * as published, in both languages.
 */
import { writeFileSync, mkdirSync } from "node:fs";

import { readSheet } from "./xlsx.mjs";

const FILE = process.argv[2];

if (!FILE) {
  console.error("ange filen, t.ex. node tools/extract-scb.mjs kommunlankod-2026.xlsx");
  process.exit(1);
}

const YEAR = "2026";
const SOURCE = "SCB, Län och kommuner i kodnummerordning";
const SOURCE_URL =
  "https://www.scb.se/hitta-statistik/regional-statistik-och-kartor/regionala-indelningar/lan-och-kommuner/lan-och-kommuner-i-kodnummerordning/";

const counties = [];
const municipalities = [];

for (const row of readSheet(FILE).values()) {
  const code = (row.A ?? "").trim();
  const name = (row.B ?? "").trim();

  if (!name) continue;

  // Two digits is a county, four a municipality. Everything else is the sheet's
  // own heading rows, in Swedish and English.
  if (/^\d{2}$/.test(code)) counties.push({ value: code, name });
  else if (/^\d{4}$/.test(code)) municipalities.push({ value: code, name });
}

const problems = [];

if (counties.length !== 21) problems.push(`${counties.length} län, väntade 21`);
if (municipalities.length !== 290) {
  problems.push(`${municipalities.length} kommuner, väntade 290`);
}

for (const [what, items] of [["län", counties], ["kommuner", municipalities]]) {
  if (new Set(items.map((one) => one.value)).size !== items.length) {
    problems.push(`dubbletter bland ${what}`);
  }
}

/*
 * The counts are checked here rather than only in a test, because this is where
 * somebody stands when the next year's file arrives. A silent 289 is how a
 * municipality goes missing for a year.
 */
if (problems.length) {
  console.error(`Filen ser inte ut som väntat: ${problems.join("; ")}`);
  process.exit(1);
}

/*
 * Current municipalities only (`P576` is the dissolution date); the code is
 * `P525`. Grouped by code because a few items carry two, and the label is a
 * Swedish Wikipedia title — which follows the government's naming.
 */
const WIKIDATA = "https://query.wikidata.org/sparql";
const NAMES_QUERY = `
  SELECT ?code (SAMPLE(?label) AS ?name) WHERE {
    ?item wdt:P31 wd:Q127448 ; wdt:P525 ?code ; rdfs:label ?label .
    FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }
    FILTER(LANG(?label) = "sv")
  } GROUP BY ?code`;
const OVERRIDES = { "0980": "Gotlands kommun" };

const response = await fetch(`${WIKIDATA}?query=${encodeURIComponent(NAMES_QUERY)}`, {
  headers: {
    Accept: "text/csv",
    "User-Agent": "flowweaver-extract-scb/1.0 (https://github.com/johanfuruskog-create/flowweaver)",
  },
});

if (!response.ok) {
  console.error(`Wikidata svarade ${response.status}`);
  process.exit(1);
}

const fullNames = new Map(
  (await response.text())
    .replace(/\r/g, "")
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => line.split(",", 2))
    .map(([code, name]) => [code, OVERRIDES[code] ?? name]),
);

const unnamed = municipalities.filter((one) => !fullNames.get(one.value));

if (unnamed.length) {
  console.error(`kommuner utan namn i Wikidata: ${unnamed.map((one) => one.value).join(", ")}`);
  process.exit(1);
}

// The full name must still be the short one plus something, or SCB and
// Wikidata disagree about which municipality a code is.
const strangers = municipalities.filter(
  (one) => !fullNames.get(one.value).startsWith(one.name.slice(0, 3)),
);

if (strangers.length) {
  console.error(
    `namnen går isär: ${strangers.map((one) => `${one.value} ${one.name} / ${fullNames.get(one.value)}`).join(", ")}`,
  );
  process.exit(1);
}

for (const one of municipalities) one.name = fullNames.get(one.value);

const orphans = municipalities.filter(
  (one) => !counties.some((county) => one.value.startsWith(county.value)),
);

if (orphans.length) {
  console.error(`kommuner utan län: ${orphans.map((one) => one.value).join(", ")}`);
  process.exit(1);
}

const NAMES_SOURCE = "Wikidata, svenska Wikipedias titlar";

const list = (id, label, items, names = SOURCE) => ({
  id,
  standard: "custom",
  label,
  version: YEAR,
  published: `${YEAR}-01-01`,
  source: names === SOURCE ? SOURCE : `${SOURCE}; ${names}`,
  sourceUrl: SOURCE_URL,
  labelSources: { sv: names, en: `${names} (namnen är egennamn och översätts inte)` },
  items: items.map((one) => ({
    value: one.value,
    label: { sv: one.name, en: one.name },
  })),
});

const lists = [
  {
    file: "scb-counties",
    constant: "scbCounties",
    data: list(
      "scb-counties",
      { sv: "Län — SCB", en: "Counties — Statistics Sweden" },
      counties,
    ),
  },
  {
    file: "scb-municipalities",
    constant: "scbMunicipalities",
    data: list(
      "scb-municipalities",
      { sv: "Kommuner — SCB", en: "Municipalities — Statistics Sweden" },
      municipalities,
      NAMES_SOURCE,
    ),
  },
];

mkdirSync("src/code-lists", { recursive: true });
mkdirSync("public/code-lists", { recursive: true });

for (const { file, constant, data } of lists) {
  const clean = data;
  const items = clean.items
    .map((one) => `  { value: "${one.value}", label: { sv: "${one.label.sv}", en: "${one.label.en}" } },`)
    .join("\n");

  writeFileSync(
    `src/code-lists/${file}.ts`,
    `import type { CodeList } from "./code-list-registry";

/**
 * ${data.label.sv}, as published for ${YEAR}.
 *
 * **Generated by \`tools/extract-scb.mjs\` — edit the tool, not this file.**
 *
 * The codes are SCB's own and not an ISO standard, which is what \`standard:
 * "custom"\` says: four digits for a municipality, two for a county, and a
 * municipality's code begins with its county's. That last part is SCB's design
 * rather than a rule anything here relies on.
 *
 * The names are proper nouns and are the same in both languages. A county could
 * be argued — *Stockholms län* against *Stockholm County* — and inventing
 * English county names to sit beside an authority's Swedish ones would be our
 * words presented as theirs.
 *
${
  data.source === SOURCE
    ? ""
    : ` * The names are the municipalities' full ones — *Hultsfreds kommun*, *Falu
 * kommun* — taken from Wikidata, because no authority publishes them as data
 * and no rule derives them. The codes are still SCB's. The tool says why.
 *
`
} * Published under CC0. The file carries the year in its name, so a new one
 * arrives annually.
 */
export const ${constant}: CodeList = {
  id: "${clean.id}",
  standard: "custom",
  label: { sv: "${clean.label.sv}", en: "${clean.label.en}" },
  version: "${clean.version}",
  published: "${clean.published}",
  source: "${clean.source}",
  sourceUrl:
    "${clean.sourceUrl}",
  items: [
${items}
  ],
};
`,
    "utf8",
  );

  writeFileSync(
    `public/code-lists/${file}.json`,
    `${JSON.stringify(clean, null, 1)}\n`,
    "utf8",
  );

  console.log(`${clean.items.length} poster → src/code-lists/${file}.ts + public/code-lists/${file}.json`);
}
