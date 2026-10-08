/**
 * Varje avvisning i `server.mjs` svarar med en kod ur listan.
 *
 *     node integrations/reference-receiver/test/error-codes.mjs
 *
 * ## Vad det fångar
 *
 * En `send(404, { error: "okänd väg GET /x" })` — en svensk mening i ett fält
 * klienten jämför strängar med. Två sådana levde i servern till 22/9, och
 * ingenting sa ifrån: de var syntaktiskt oklanderliga och semantiskt en
 * loggrad på fel plats.
 *
 * Provet läser **källan** och inte ett svar, med flit. Ett svep som ringde
 * servern hade bara sett de vägar det råkade gå; källan har alla, inklusive
 * de som kräver ett tillstånd som är svårt att ställa upp.
 *
 * Listan läses ur `errors.mjs`, alltså det ena hemmet. Ett prov som bar sin
 * egen kopia hade gått grönt den dag listan ändrades.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { ERROR_CODES, isErrorCode } from "../errors.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "..", "server.mjs"), "utf8");

const checks = [];
const check = (name, ok, extra = "") => {
  checks.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  — ${extra}` : ""}`);
};

/*
 * Varje `error:`-fält i källan, oavsett hur statusen räknas fram.
 *
 * Första försöket matchade `send(<status>, { error: … })` med statusen som en
 * siffra, och missade därmed de tre `send(body.tooLarge ? 413 : 400, { error:
 * "graph" })` — en hel kod osedd, och provet sa ändå PASS på "varje avvisning
 * bär en kod". Grinden fällde sig själv på att `graph` såg oanvänd ut, vilket
 * var tur. Nu läses fältet för sig och statusen för sig.
 */
const fields = [...source.matchAll(/\{\s*error:\s*([^,\n}]+)/g)];

check("provet hittar avvisningar att mäta", fields.length > 15, `${fields.length} stycken`);

const bad = [];
const seen = new Set();

for (const [, raw] of fields) {
  const literal = /^"([a-z-]+)"$/.exec(raw.trim());

  if (!literal) {
    bad.push(`{ error: ${raw.trim()} } — inte en kodsträng`);
    continue;
  }

  seen.add(literal[1]);

  if (!isErrorCode(literal[1])) {
    bad.push(`{ error: "${literal[1]}" } — koden saknas i errors.mjs`);
  }
}

check("varje error-fält bär en kod ur listan", bad.length === 0, bad.join("; "));

/* Och där statusen står som en siffra: att den är den listan säger. */
const wrongStatus = [];

for (const [, status, raw] of source.matchAll(/send\(\s*([45]\d\d)\s*,\s*\{\s*error:\s*"([a-z-]+)"/g)) {
  if (isErrorCode(raw) && !ERROR_CODES[raw].includes(Number(status))) {
    wrongStatus.push(`send(${status}, { error: "${raw}" }) — listan säger ${ERROR_CODES[raw].join(" eller ")}`);
  }
}

check("statusen följer koden", wrongStatus.length === 0, wrongStatus.join("; "));

/*
 * Och åt andra hållet: en kod i listan som ingen skickar är antingen en
 * bortglömd väg eller en rad som aldrig stämde.
 *
 * Listan var tom fram till 22/9 utom `forbidden`, som stod reserverad medan
 * A8 väntade på Johans ja. Jaet kom, koden skickas, och undantaget är borta —
 * en reservation som blir kvar när skälet försvunnit är en död rad som sänker
 * grinden utan att någon märker det.
 */
const PLANNED = new Set([]);
const unused = Object.keys(ERROR_CODES).filter((code) => !seen.has(code) && !PLANNED.has(code));

check("ingen kod i listan är oanvänd", unused.length === 0, unused.join(", "));

const failed = checks.filter((ok) => !ok).length;
console.log(`\n${checks.length - failed}/${checks.length} kontroller`);
process.exit(failed === 0 ? 0 : 1);
