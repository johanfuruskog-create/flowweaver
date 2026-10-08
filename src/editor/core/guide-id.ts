/**
 * The guide's own identity, minted once (story 123).
 *
 * ## Why the guide needs a name of its own
 *
 * An errand carries `serviceId` so a receiver can tell two guides apart that
 * both produce a *Felanmälan*. The guide's name cannot do that job: it is
 * translated, it is edited, and two units may well pick the same words. So the
 * identity is a value nobody reads and nothing derives — a UUID.
 *
 * ## Why not `crypto.randomUUID()` alone
 *
 * `randomUUID` is a secure-context API. On `https` and on `localhost` it is
 * there; on a plain-`http` intranet address — which is exactly where a host
 * pilots an editor before anything is public — it is `undefined`, and the
 * editor would throw on the first save. `crypto.getRandomValues` has no such
 * limit, so the fallback builds the same v4 shape from it.
 *
 * Both paths produce the same thing: 122 random bits with the version and
 * variant nibbles set, in the canonical spelling. Nothing reads the bits.
 */
export function newGuideId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));

  // Version 4 in the high nibble of byte 6, variant 10xx in byte 8 — the two
  // places the shape is not random.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
