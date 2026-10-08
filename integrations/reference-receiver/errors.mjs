/**
 * Felkoderna — ett hem.
 *
 * Varje kontrakt i `docs/VARDSYSTEM-KONTRAKT.md` svarar på samma sätt när det
 * säger nej: `{ error: "<kod>", message?: "<för loggen, engelska>", …fält }`.
 * Koden är en kort kebab-sträng ur listan nedan, och HTTP-statusen följer
 * koden i stället för att motsäga den.
 *
 * ## Varför listan finns som kod och inte bara som tabell
 *
 * Fram till 22/9 svarade servern `{ error: "okänd väg GET /x" }` och
 * `{ error: "GET finns inte på /x" }` — svenska meningar i ett fält klienten
 * ska jämföra strängar med. Det är inte en kod, det är en logg­rad på fel
 * plats: den går inte att matcha på, den går inte att översätta, och den byter
 * ordalydelse så fort någon putsar en mening.
 *
 * Listan står här och provet `test/error-codes.mjs` går igenom varje
 * `send(4xx|5xx …)` i `server.mjs` och kräver att koden finns. Tabellen i
 * VARDSYSTEM-KONTRAKT är samma lista i ord; den här filen är den som biter.
 */

/** Kod → den status den alltid svarar med. Två status betyder att båda är rätt. */
export const ERROR_CODES = {
  unauthorized: [401],
  forbidden: [403],
  locked: [409],
  conflict: [409],
  "no-guide": [404],
  "no-version": [404],
  "no-lock": [404],
  "no-note": [404],
  "no-storage": [503],
  "no-login": [404],
  graph: [400, 413],
  /* Kroppen gick inte att läsa som JSON, eller var för stor. Skild från
     `graph`: den ena är en trasig graf, den andra en trasig begäran. */
  payload: [400, 413],
  rejected: [400],
  /* Samma inlämnings-id, annat innehåll: ett lånat id, inte ett återförsök. */
  "submission-conflict": [409],
  "no-recipient": [503],
  mail: [502],
  provider: [502],
  "no-route": [404],
  "no-method": [405],
};

/** Är det här en kod vi känner? */
export const isErrorCode = (value) =>
  typeof value === "string" && Object.hasOwn(ERROR_CODES, value);
