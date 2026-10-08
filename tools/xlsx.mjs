/**
 * Reads a sheet out of an `.xlsx` file, without a dependency.
 *
 * An xlsx is a zip of XML: `xl/worksheets/sheet1.xml` holds the cells, and text
 * cells point into `xl/sharedStrings.xml` by index rather than carrying their
 * own contents. That is the whole format as far as a two-column code list is
 * concerned, so a library would be several megabytes to save thirty lines.
 *
 * Returns rows as `{ [column letter]: text }`, keyed by row number — the shape
 * that keeps a header row distinguishable from the data under it.
 */
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

/** Every file in the zip, by name. Stored and deflated entries both. */
function unzip(path) {
  const data = readFileSync(path);
  const files = new Map();
  let at = 0;

  while (at < data.length - 4) {
    // Local file header: PK\x03\x04
    if (data.readUInt32LE(at) !== 0x04034b50) {
      at += 1;
      continue;
    }

    const method = data.readUInt16LE(at + 8);
    const compressed = data.readUInt32LE(at + 18);
    const nameLength = data.readUInt16LE(at + 26);
    const extraLength = data.readUInt16LE(at + 28);
    const nameAt = at + 30;
    const name = data.subarray(nameAt, nameAt + nameLength).toString("utf8");
    const bodyAt = nameAt + nameLength + extraLength;

    if (compressed > 0) {
      const body = data.subarray(bodyAt, bodyAt + compressed);
      files.set(name, method === 8 ? inflateRawSync(body) : body);
      at = bodyAt + compressed;
    } else {
      at = bodyAt;
    }
  }

  return files;
}

const unescape = (text) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");

export function readSheet(path) {
  const files = unzip(path);
  const shared = [
    ...(files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "").matchAll(
      /<si>([\s\S]*?)<\/si>/g,
    ),
    // A shared string can be split across several <t> runs when part of it is
    // formatted differently; joining the runs inside one <si> is what keeps
    // "Upplands Väsby" from becoming two strings.
  ].map(([, item]) =>
    unescape([...item.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(([, t]) => t).join("")),
  );

  const sheet = files.get("xl/worksheets/sheet1.xml")?.toString("utf8") ?? "";
  const rows = new Map();

  for (const cell of sheet.matchAll(
    /<c r="([A-Z]+)(\d+)"([^>]*)>(?:<v>([^<]*)<\/v>|<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>)?/g,
  )) {
    const [, column, row, attributes, value, inline] = cell;
    const text =
      inline !== undefined
        ? unescape(inline)
        : value === undefined
          ? undefined
          : attributes.includes('t="s"')
            ? (shared[Number(value)] ?? "")
            : value;

    if (text === undefined) continue;

    const number = Number(row);
    rows.set(number, { ...(rows.get(number) ?? {}), [column]: text });
  }

  return rows;
}

/** Case- and diacritic-insensitive key, the same one the lookup field searches by. */
export const searchKey = (text) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
