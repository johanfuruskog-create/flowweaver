/**
 * A list of ids as a guide file may carry it: the list itself, or — from
 * before graph version 7 — a single value in an older field. The list wins
 * whenever it has anything in it; blanks and non-strings are dropped, and
 * every id is trimmed.
 *
 * Lived in submission-registry.ts as `readRecipientIds` until 2026-10-06
 * (open-core step 3b). Nothing in it is about recipients: the migration, the
 * properties panel and the health check all need the shape, and none of them
 * should have to import the receiver registry — the full version's file — for
 * ten lines of list reading.
 */
export function readIdList(list: unknown, single: unknown): string[] {
  const fromList = Array.isArray(list)
    ? list.filter((one): one is string => typeof one === "string" && one.trim() !== "")
    : [];

  if (fromList.length > 0) {
    return fromList.map((one) => one.trim());
  }

  return typeof single === "string" && single.trim() !== "" ? [single.trim()] : [];
}
