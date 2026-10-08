/**
 * Värdens felkoder → ord, på ett ställe.
 *
 * Varje kontrakt i `docs/VARDSYSTEM-KONTRAKT.md` svarar likadant när det säger
 * nej: `{ error: "<kod>", message?: "<för loggen, engelska>", …fält }`. Den här
 * filen är klientens halva av det — tabellen från kod till en **nyckel**, som
 * varje yta sedan slår upp i sin egen ordlista.
 *
 * ## Varför en nyckel och inte en mening
 *
 * Meningen beror på vem som läser. En redaktör i editorn ska höra *logga in
 * igen*; en besökare mitt i en guide ska inte höra något alls om lagring, för
 * hen kan inte göra något åt den och svaren ligger kvar hur som helst. Samma
 * kod, två olika ord. En tabell som gav meningar hade tvingat fram ett val här
 * som hör hemma på ytan.
 *
 * ## Vad som mättes innan den skrevs
 *
 * Måttet 22/9: klienten läste **inte** koderna alls. `ServerGraphStore` mappade
 * HTTP-statusen — 401 blev *Logga in igen*, 409 blev *Arbetskopian ändrades*,
 * allt annat blev *Värden svarade 503*. Det fungerade för de två fallen och
 * lämnade resten som ett tal på skärmen. Koderna fanns i svaren hela tiden;
 * ingen läste dem.
 *
 * Så det här är inte en hopslagning av tre tabeller — det är den första. Att
 * den ändå ligger i `viewer/core` och inte hos den ena ytan är för att
 * editorn, sajten och visaren alla når hit, och en andra kopia av den här
 * listan är precis det fel kodbasen oftast gör.
 *
 * ## Okänd kod är aldrig tyst
 *
 * En kod vi inte känner — en ny väg hos en värd, en äldre server — ger
 * `GENERAL`. Det är värre än en exakt mening och mycket bättre än ingenting:
 * *något gick fel hos värden* är sant, och tystnad läser som att sparningen
 * gick bra.
 */

/** Nyckeln varje yta slår upp i sin egen ordlista. */
export type HostErrorKey =
  | "host.signIn"
  | "host.forbidden"
  | "host.conflict"
  | "host.locked"
  | "host.missing"
  | "host.notConnected"
  | "host.rejected"
  | "host.general";

/**
 * Vad ytan får göra åt felet — tredje kolumnen, och den som gör tabellen värd
 * att ha (Astra 22/9).
 *
 * En nyckel utan åtgärd blir en mening, och en mening utan åtgärd blir en
 * återvändsgränd. Den här kolumnen säger vad ytan **ska** göra, och två av
 * raderna finns för att det motsatta har hänt: *logga in igen* på ett
 * rättighetsfel skickar redaktören ut och tillbaka till samma nej, och ett
 * fel som inte bevarar inmatningen gör om besökarens arbete till straffet.
 */
export type HostErrorAction =
  /** Bevara arbetet och erbjud inloggning. */
  | "signIn"
  /** Förklara begränsningen. Ny inloggning är inte lösningen. */
  | "explain"
  /** Bevara lokalt och erbjud krockhantering. */
  | "resolveClash"
  /** Visa vad och var — det går att rätta. */
  | "showWhat"
  /** Reservbesked, och bevara inmatningen. */
  | "keepAndTell";

/** Det beskedet en kod vi inte känner igen får. */
export const GENERAL: HostErrorKey = "host.general";

/**
 * Koderna ur `integrations/reference-receiver/errors.mjs`, grupperade efter
 * vad läsaren kan göra åt dem — inte efter HTTP-status.
 *
 * Tre koder har ingen egen rad med flit. `graph`, `provider` och `mail` är
 * fel i värdens maskineri som ingen läsare kan åtgärda: de faller till
 * `GENERAL` och hamnar i värdens logg, där de hör hemma.
 */
const KEY_BY_CODE: Record<string, HostErrorKey> = {
  unauthorized: "host.signIn",
  forbidden: "host.forbidden",
  conflict: "host.conflict",
  locked: "host.locked",
  "no-guide": "host.missing",
  "no-version": "host.missing",
  "no-lock": "host.missing",
  "no-note": "host.missing",
  "no-storage": "host.notConnected",
  "no-login": "host.notConnected",
  "no-recipient": "host.notConnected",
  rejected: "host.rejected",
  "no-route": "host.notConnected",
  "no-method": "host.notConnected",
};

/**
 * Åtgärden per nyckel. Ett ställe, så ingen yta hittar på en egen.
 *
 * `host.forbidden` är den enda raden som bytt sedan 22/9 och den viktigaste:
 * den gav `signIn` när servern svarade `401` på ett rollavslag. Med A8 svarar
 * servern `403`, och åtgärden är att förklara — inte att skicka redaktören
 * genom en inloggning som ger samma roll tillbaka.
 */
const ACTION_BY_KEY: Record<HostErrorKey, HostErrorAction> = {
  "host.signIn": "signIn",
  "host.forbidden": "explain",
  "host.conflict": "resolveClash",
  "host.locked": "resolveClash",
  "host.missing": "showWhat",
  "host.notConnected": "keepAndTell",
  "host.rejected": "showWhat",
  "host.general": "keepAndTell",
};

/** Vad ytan ska göra åt en kod. */
export function hostErrorAction(code: unknown): HostErrorAction {
  return ACTION_BY_KEY[hostErrorKey(code)];
}

/**
 * Nyckeln för en kod, eller det generella beskedet.
 *
 * Tar `unknown` med flit: det här läses ur ett JSON-svar som en värd skrivit,
 * och ett fält som skulle vara en sträng kan vara vad som helst.
 */
export function hostErrorKey(code: unknown): HostErrorKey {
  return typeof code === "string" && Object.hasOwn(KEY_BY_CODE, code)
    ? (KEY_BY_CODE[code] as HostErrorKey)
    : GENERAL;
}

/**
 * Koden ur ett svar, om det finns någon.
 *
 * Kroppen kan vara vad som helst — en värd som svarar med HTML på en 502 är
 * inte ovanligt — så allt utom en sträng i `error` räknas som ingen kod.
 */
export function hostErrorCode(body: unknown): string | null {
  const value = (body as { error?: unknown } | null)?.error;

  return typeof value === "string" ? value : null;
}
