/**
 * Reads Skatteverket's country codes out of their PDF and writes the code list.
 *
 *     node tools/extract-navet.mjs <navet-landskoder.pdf>
 *
 * ## Why a tool and not a paste
 *
 * The list has a version number and a date — 2.1, 2025-11-05 when this was
 * written — which means it changes. A pasted copy is a copy that drifts, and the
 * drift shows up as a country somebody cannot pick rather than as a failing
 * build. Regenerating has to be cheaper than re-deriving, or nobody will.
 *
 * ## How the PDF is read
 *
 * The table is drawn cell by cell: every cell is its own `BT … ET` block with an
 * `1 0 0 1 x y Tm` matrix, so the column is the x and the row is the y. Names
 * sit at x≈105, codes at x≈326.
 *
 * The parts inside one `TJ` array are **kerning fragments of the same word** —
 * `[(A)-2(fghani)-3(s)-4(tan)]` is "Afghanistan", not four words. Joining them
 * with spaces is the obvious mistake and it produced "U SA" and "K ongo" on the
 * first run. A real space is its own run, `[( )]`, so joining with nothing and
 * keeping the space runs is what gives the right answer.
 *
 * The same page appears twice in the file, once positioned with `Tm` and once
 * with `Td`. Only the `Tm` form is read; matching both would double every glyph.
 *
 * ## Where the English names come from
 *
 * Skatteverket publishes Swedish only, and an English page that offers Swedish
 * labels is what prompted this: on `examples/citizenship.html`, "Sweden" found
 * nothing and "Sverige" found Sverige.
 *
 * ISO's own English short names were the obvious source and are the wrong one.
 * They are legally precise and unusable in a picker — *United States of America
 * (the)*, *Korea (the Republic of)*, *Netherlands (Kingdom of the)*. Taking them
 * would have made the English page worse than the Swedish one, whose labels
 * Skatteverket already chose for people rather than for lawyers.
 *
 * So English comes from CLDR through `Intl.DisplayNames`, which is what browsers
 * and operating systems show and needs no download: *United States*, *South
 * Korea*, *United Kingdom*. The names are baked in here rather than resolved at
 * runtime, so a guide renders the same on every machine.
 *
 * **Swedish stays Skatteverket's.** CLDR would answer there too and answers
 * differently — *Kongo-Kinshasa* against their *Demokratiska republiken Kongo* —
 * and for Swedish public sector theirs is the list that counts.
 *
 * ## Where the synonyms come from
 *
 * The official name and the one a person types are different words: the list
 * says *Belarus* and half the country says Vitryssland. Inventing those aliases
 * would have been us writing data and presenting it as the list's.
 *
 * SCB publishes their own country codes for trade statistics, and it is the
 * wrong list to *use* — no Sverige, no stateless, names sorted for a printed
 * index (*"Arabemiraten, Förenade"*) and some of them in English. But where the
 * two authorities disagree about a name, SCB's is a name Swedes also use, from
 * a source rather than from me. Sixteen of the twenty-seven differences are real
 * alternatives: Vitryssland, Burma, Mexico, Yemen, Ukraine, Kirgistan.
 *
 * Only differences that are not already reachable are kept. "Arabemiraten,
 * Förenade" is the same words in another order, and substring matching finds it
 * under the label we already have.
 *
 * ## The one deviation
 *
 * The source renders "Brittiska Jungfruöaarna" — two separate `a` glyphs 4.92 pt
 * apart, which is one character step at this size, so it is in the document and
 * not in this reader. It is written out corrected, and the source spelling is
 * kept beside it in the generated file. Correcting silently would be worse; so
 * would shipping a label nobody can type.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { inflateSync } from "node:zlib";

import { readSheet, searchKey } from "./xlsx.mjs";

const PDF = process.argv[2];
/* SCB:s landkoder — valfri, och det den ger är synonymer. Se nedan. */
const SCB = process.argv[3];

if (!PDF) {
  console.error("ange PDF:en, t.ex. node tools/extract-navet.mjs navet.pdf [scb-landkoder.xlsx]");
  process.exit(1);
}

/** The source's own spelling on the left, what we publish on the right. */
const RÄTTELSER = new Map([["Brittiska Jungfruöaarna", "Brittiska Jungfruöarna"]]);

/**
 * English for the four codes CLDR cannot name, because they are not regions.
 *
 * Three of them come back as the code itself. `ZZ` is worse: CLDR answers
 * "Unknown Region", and Skatteverket means *under investigation* — a case being
 * looked into, not a place nobody recognises. Taking CLDR's word there would put
 * a wrong translation in front of somebody, which is why this map is explicit
 * rather than a fallback.
 */
const EGNA_ENGELSKA = new Map([
  ["XO", "Unknown country"],
  ["XS", "Stateless"],
  ["ZZ", "Under investigation"],
  ["XU", "Ceased country"],
]);

/**
 * The codes that cannot be held together with any other citizenship.
 *
 * The same four, and not by coincidence: they are the entries that are not
 * places. *Stateless* means no state counts you as a citizen, so *stateless
 * and German* is a contradiction rather than an unusual answer; *under
 * investigation* and *ceased country* are answers about the case, not about
 * a second passport. The flag is what makes the control replace instead of
 * letting a visitor write down something impossible — story 062.
 *
 * A set of its own beside `EGNA_ENGELSKA` even though the keys agree today:
 * one map says what CLDR cannot name, this one says what the codes mean
 * together. A fifth code could need one without the other.
 */
const ENSAMMA = new Set(["XO", "XS", "ZZ", "XU"]);

const engelska = new Intl.DisplayNames(["en"], { type: "region" });

/**
 * Alternative Swedish names, keyed by code, read out of SCB's list.
 *
 * A name is kept only when it brings a word the label does not already contain,
 * so a reordering adds nothing. Parenthesised forms are split out: *"Myanmar
 * (Burma)"* yields Burma, and *"Kosovo (under UN Security Council Resolution
 * 1244)"* yields nothing worth typing.
 */
function synonymsFrom(path, labelOf) {
  if (!path) return new Map();

  const found = new Map();

  for (const row of readSheet(path).values()) {
    const code = (row.A ?? "").trim();
    const name = (row.B ?? "").trim();

    if (!/^[A-Z]{2}$/.test(code) || !name) continue;

    const label = labelOf(code);

    if (!label) continue;

    /*
     * Candidate forms, in the order a person might actually type them.
     *
     * SCB sorts for a printed index — "Arabemiraten, Förenade" — so a comma form
     * is turned back into speaking order and the comma form itself dropped:
     * nobody types "Kongo, demokratiska republiken".
     */
    const outside = name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    const inverted = outside.match(/^([^,]+),\s*(.+)$/);
    const forms = new Set([inverted ? `${inverted[2]} ${inverted[1]}`.trim() : outside]);

    for (const inside of name.matchAll(/\(([^)]*)\)/g)) {
      // "alt Kanada" is SCB's note about an alternative, not part of a name.
      forms.add(inside[1].replace(/^alt\s+/i, "").trim());
    }

    const words = (text) =>
      new Set(
        text
          .split(/[^\p{L}\p{N}]+/u)
          .map(searchKey)
          .filter((word) => word.length > 2),
      );
    const labelWords = words(label);
    const same = (a, b) => a.size === b.size && [...a].every((word) => b.has(word));

    const useful = [...forms]
      .map((form) => form.replace(/\s+/g, " ").trim())
      .filter((form) => form.length > 2 && form.length < 60)
      .filter((form) => form.split(" ").length <= 4)
      // Already reachable: the label contains these very characters.
      .filter((form) => !searchKey(label).includes(searchKey(form)))
      /*
       * The same words in another order add nothing — each word is already a
       * substring of the label, and the field matches on substrings. This is
       * what kept "Jungfruöarna, Brittiska" out.
       */
      .filter((form) => !same(words(form), labelWords));

    if (useful.length) found.set(code, useful);
  }

  return found;
}

/** The source document's own version and date, and where it came from. */
const VERSION = "2.1";
const PUBLISHED = "2025-11-05";
const KÄLLA =
  "https://www.skatteverket.se/download/18.16f588619a39f2c14a405/1762351483613/navet-landskoder.pdf";

const data = readFileSync(PDF);
const streams = [];

for (const match of data.toString("latin1").matchAll(/stream\r?\n/g)) {
  const start = match.index + match[0].length;
  const end = data.toString("latin1").indexOf("endstream", start);

  if (end < 0) continue;

  try {
    streams.push(inflateSync(data.subarray(start, end)).toString("latin1"));
  } catch {
    /* Not every stream is deflated text; the fonts are not. */
  }
}

const cells = [];

streams.forEach((page, pageNumber) => {
  for (const block of page.matchAll(/BT\r?\n([\s\S]*?)ET/g)) {
    const body = block[1];
    const at = body.match(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/);

    if (!at) continue;

    const text = [...body.matchAll(/\((?:\\.|[^()\\])*\)/g)]
      .map((run) => run[0].slice(1, -1))
      .join("")
      .replace(/\\([()\\])/g, "$1");

    cells.push({ page: pageNumber, x: Number(at[1]), y: Number(at[2]), text });
  }
});

const rows = new Map();

for (const cell of cells) {
  const key = `${cell.page}:${cell.y.toFixed(1)}`;
  const row = rows.get(key) ?? { names: [], codes: [] };

  (cell.x < 250 ? row.names : row.codes).push([cell.x, cell.text]);
  rows.set(key, row);
}

const items = [];
const deviations = [];

for (const row of rows.values()) {
  const byX = (a, b) => a[0] - b[0];
  const raw = row.names.sort(byX).map(([, text]) => text).join("").replace(/\s+/g, " ").trim();
  const code = row.codes.sort(byX).map(([, text]) => text).join("").trim();

  if (!/^[A-Z]{2}$/.test(code) || !raw || raw === "Landsnamn") continue;

  const name = RÄTTELSER.get(raw);

  if (name) deviations.push([raw, name]);

  const egen = EGNA_ENGELSKA.get(code);
  let en;

  if (egen) {
    en = egen;
  } else {
    const cldr = engelska.of(code);
    // CLDR hands back the code itself for anything it does not know. Letting
    // that through would ship "XK" as a country name.
    en = cldr === code ? null : cldr;
  }

  if (!en) {
    console.error(`  ${code} (${raw}) saknar engelskt namn — lägg det i EGNA_ENGELSKA`);
    process.exitCode = 1;
  }

  items.push({
    value: code,
    label: name ?? raw,
    en: en ?? raw,
    ours: Boolean(egen),
    exclusive: ENSAMMA.has(code),
    source: name ? raw : null,
  });
}

const synonyms = synonymsFrom(
  SCB,
  (code) => items.find((item) => item.value === code)?.label ?? "",
);

items.forEach((item) => {
  item.synonyms = synonyms.get(item.value) ?? [];
});

items.sort((one, other) => one.label.localeCompare(other.label, "sv"));

const duplicates = items.length - new Set(items.map((item) => item.value)).size;

if (duplicates > 0) {
  console.error(`${duplicates} kod(er) förekommer mer än en gång — avbryter`);
  process.exit(1);
}

const rendered = items
  .map(
    (item) =>
      `  { value: "${item.value}", label: { sv: "${item.label}", en: "${item.en.replace(/"/g, '\\"')}" }${
        item.synonyms.length
          ? `, synonyms: [${item.synonyms.map((one) => `{ sv: "${one}" }`).join(", ")}]`
          : ""
      }${item.source ? `, sourceLabel: "${item.source}"` : ""}${
        item.exclusive ? ", exclusive: true" : ""
      } },`,
  )
  .join("\n");

mkdirSync("src/code-lists", { recursive: true });
writeFileSync(
  "src/code-lists/navet-country-codes.ts",
  `import type { CodeList } from "./code-list-registry";

/**
 * Skatteverket's country codes, as published for NAVET.
 *
 * **Generated by \`tools/extract-navet.mjs\` — edit the tool, not this file.**
 *
 * The codes are ISO 3166-1 alpha-2, which settles the standard question for
 * Swedish public sector. The list is not plain ISO though: it ends with four
 * codes ISO does not have, in the user-assigned range —
 *
 *   XO  Okänt land        XS  Statslös
 *   ZZ  Under utredning   XU  Upphört land
 *
 * — and those are not edge cases. A guide about permits or benefits that cannot
 * express **stateless** is broken for the applicants it exists for, which is why
 * a generic ISO package is the wrong thing to reach for here.
 *
 * The names are the official Swedish forms and not what people type: *Belarus*
 * rather than Vitryssland, *Storbritannien* rather than England. Aliases belong
 * in \`synonyms\` on the entries that need them; see the registry.
 *
 * \`sourceLabel\` appears where we publish something other than the source. There
 * is one, and it is a typo in the source document rather than a decision of ours.
 */
export const navetCountryCodes: CodeList = {
  id: "navet-country-codes",
  standard: "iso-3166-1-alpha-2",
  label: { sv: "Länder — Skatteverket (NAVET)", en: "Countries — Swedish Tax Agency (NAVET)" },
  version: "${VERSION}",
  published: "${PUBLISHED}",
  source: "Skatteverket, NAVET – Landskoder",
  sourceUrl:
    "${KÄLLA}",
  labelSources: {
    sv: "Skatteverket, NAVET – Landskoder ${VERSION}",
    en: "CLDR via Intl.DisplayNames (ICU ${process.versions.icu}), utom XO/XS/ZZ/XU som är våra",
  },
  items: [
${rendered}
  ],
};
`,
  "utf8",
);

/*
 * The same list as JSON, beside the bundles.
 *
 * Both artifacts come out of this one run on purpose. Generating the JSON
 * separately is how the two would drift, and a host fetching a file that
 * disagrees with the module we test against is the worst of both.
 */
const asJson = {
  id: "navet-country-codes",
  standard: "iso-3166-1-alpha-2",
  label: {
    sv: "Länder — Skatteverket (NAVET)",
    en: "Countries — Swedish Tax Agency (NAVET)",
  },
  version: VERSION,
  published: PUBLISHED,
  source: "Skatteverket, NAVET – Landskoder",
  sourceUrl: KÄLLA,
  labelSources: {
    sv: `Skatteverket, NAVET – Landskoder ${VERSION}`,
    en: `CLDR via Intl.DisplayNames (ICU ${process.versions.icu}), utom ${[...EGNA_ENGELSKA.keys()].join("/")} som är våra`,
    ...(SCB ? { "sv-synonym": "SCB, Landkoder — alternativa svenska namn" } : {}),
  },
  items: items.map((item) => ({
    value: item.value,
    label: { sv: item.label, en: item.en },
    ...(item.synonyms.length
      ? { synonyms: item.synonyms.map((one) => ({ sv: one })) }
      : {}),
    ...(item.source ? { sourceLabel: item.source } : {}),
    ...(item.exclusive ? { exclusive: true } : {}),
  })),
};

mkdirSync("public/code-lists", { recursive: true });
writeFileSync(
  "public/code-lists/navet-country-codes.json",
  `${JSON.stringify(asJson, null, 1)}\n`,
  "utf8",
);

console.log(`${items.length} koder skrivna till src/code-lists/navet-country-codes.ts`);
console.log(`  och till public/code-lists/navet-country-codes.json`);
console.log(`  engelska: CLDR via ICU ${process.versions.icu}, ${[...EGNA_ENGELSKA.keys()].length} egna`);
console.log(
  SCB
    ? `  synonymer: ${synonyms.size} koder ur SCB:s landkoder`
    : "  synonymer: inga (ange SCB:s landkoder.xlsx som andra argument)",
);
deviations.forEach(([from, to]) => console.log(`  rättat: "${from}" → "${to}"`));
