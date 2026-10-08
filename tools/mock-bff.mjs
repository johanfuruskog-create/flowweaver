/**
 * A stand-in BFF for lookup fields, speaking the documented contract.
 *
 *     node tools/mock-bff.mjs [port]        # förvald port 4310
 *
 * ## Why this exists
 *
 * `docs/UPPSLAG-KONTRAKT.md` describes an endpoint nobody could run against.
 * The contract was written, the client was written, the *shape* was agreed — and
 * `source: "service"` had never gone a whole way, because there was nothing at
 * the other end. A contract with no runnable side is a contract that is right
 * until the first time somebody checks.
 *
 * So this answers it, over the code lists that already ship as JSON. Point a
 * field's endpoint here and the service path runs for real:
 *
 *     http://localhost:4310/lookup/lander
 *     http://localhost:4310/lookup/kommuner
 *     http://localhost:4310/lookup/lan
 *
 * ## What it is for, beyond running the path
 *
 * It is the reference a host can read. The document says what the answer must
 * look like; this is that answer, in code, small enough to read in a sitting.
 * Whoever builds the real BFF has something to compare against rather than a
 * table to interpret.
 *
 * ## What it deliberately also does
 *
 * Answers badly, on purpose, under `/broken/*`. Every rejection rule in the
 * contract has a route that breaks exactly that rule, because the rules exist
 * for cases nobody produces on purpose and therefore nobody tests:
 *
 *     /broken/version     version: 2 — a contract we do not speak
 *     /broken/items       items missing entirely
 *     /broken/value       a suggestion with no code
 *     /broken/label       a suggestion with an empty label
 *     /broken/status      HTTP 500
 *     /broken/slow        a correct answer, eight seconds late
 *
 * A field that shows "Uppslaget kunde inte nås" for each of those is a field
 * doing its job. One that shows a list is one that would let somebody pick a
 * suggestion with no code behind it, and the fault would surface much later.
 *
 * ## What it is not
 *
 * Not a BFF. There are no keys, no third party, no permissions and no rate
 * limit — the parts a mock cannot teach are the same ones as ever.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const PORT = Number(process.argv[2] ?? 4310);

/** The lists this serves, read from what ships. */
const LISTS = {
  lander: "public/code-lists/navet-country-codes.json",
  kommuner: "public/code-lists/scb-municipalities.json",
  lan: "public/code-lists/scb-counties.json",
};

const lists = new Map();

for (const [name, path] of Object.entries(LISTS)) {
  try {
    lists.set(name, JSON.parse(readFileSync(path, "utf8")));
  } catch {
    console.error(`kunde inte läsa ${path} — kör verktygen som skapar listorna först`);
    process.exit(1);
  }
}

/** The same search the bundled lists use: case- and diacritic-insensitive. */
const key = (text) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const textIn = (value, locale) =>
  typeof value === "string" ? value : (value?.[locale] ?? value?.sv ?? value?.en ?? "");

function search(list, term, locale, limit) {
  const wanted = key(term);

  return list.items
    .map((item) => ({
      value: item.value,
      label: textIn(item.label, locale),
      synonyms: (item.synonyms ?? []).map((one) => textIn(one, locale)),
      exclusive: item.exclusive === true,
    }))
    .filter((item) => item.label !== "")
    .filter(
      (item) =>
        key(item.label).includes(wanted) ||
        key(item.value).includes(wanted) ||
        item.synonyms.some((one) => key(one).includes(wanted)),
    )
    .slice(0, limit)
    /*
     * `exclusive` följer med när listan bär den — Skatteverkets XS, XO, ZZ och
     * XU. Ett valfritt fält: en BFF som aldrig skickar det ändrar ingenting,
     * och det är därför kontraktet kunde få det utan en ny version.
     */
    .map(({ value, label, exclusive }) =>
      exclusive ? { value, label, exclusive: true } : { value, label },
    );
}

/** Answers that break exactly one rule each. */
const BROKEN = {
  version: () => ({ status: 200, body: { version: 2, items: [] } }),
  items: () => ({ status: 200, body: { version: 1 } }),
  value: () => ({ status: 200, body: { version: 1, items: [{ label: "Utan kod" }] } }),
  label: () => ({
    status: 200,
    body: { version: 1, items: [{ value: "SE", label: "" }] },
  }),
  status: () => ({ status: 500, body: { error: "Uppslaget föll" } }),
  slow: () => ({ status: 200, body: { version: 1, items: [] }, delay: 8000 }),
};

const server = createServer((request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);
  const send = (status, body, delay = 0) => {
    const write = () => {
      response.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        // The field runs in a page of its own; a real BFF would be stricter.
        "access-control-allow-origin": "*",
      });
      response.end(JSON.stringify(body));
      console.log(`${status} ${request.method} ${url.pathname}${url.search}`);
    };

    if (delay) setTimeout(write, delay);
    else write();
  };

  const broken = url.pathname.match(/^\/broken\/(\w+)$/);

  if (broken && BROKEN[broken[1]]) {
    const { status, body, delay } = BROKEN[broken[1]]();

    send(status, body, delay);
    return;
  }

  const lookup = url.pathname.match(/^\/lookup\/(\w+)$/);
  const list = lookup ? lists.get(lookup[1]) : null;

  if (!list) {
    send(404, {
      error: `okänd väg ${url.pathname}`,
      finns: [
        ...Object.keys(LISTS).map((name) => `/lookup/${name}`),
        ...Object.keys(BROKEN).map((name) => `/broken/${name}`),
      ],
    });
    return;
  }

  const term = url.searchParams.get("q") ?? "";
  const locale = url.searchParams.get("locale") ?? "sv";
  const limit = Number(url.searchParams.get("limit")) || 8;

  /*
   * An empty term gives an empty list rather than everything. The contract says
   * an empty list means "no matches" and not an error, and a field that has not
   * been typed into is exactly that case.
   */
  send(200, {
    version: 1,
    items: term.trim() === "" ? [] : search(list, term, locale, limit),
  });
});

export { server, PORT };

server.listen(PORT, () => {
  // Quiet when something else started it, loud when a person did.
  if (!process.env.FLOWWEAVER_TYST) {
    console.log(`Uppslags-BFF (mock) på http://localhost:${PORT}`);
    for (const name of Object.keys(LISTS)) {
      console.log(`  /lookup/${name.padEnd(9)} ${lists.get(name).items.length} poster`);
    }
    console.log(`  /broken/…    ${Object.keys(BROKEN).join(", ")}`);
  }
});
