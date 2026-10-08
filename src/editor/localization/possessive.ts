import { DEFAULT_UI_LOCALE } from "../../viewer/core/localized-text";

/**
 * *Anna Anderssons* — ett namn i genitiv, på det språk gränssnittet talar.
 *
 * ## Varför en regel och inte ett `+ "s"`
 *
 * Ett namn som slutar på s, x eller z får inget till s i svenskan: *Nils
 * version*, aldrig *Nilss*. Engelskan gör tvärtom något annat — *Nils'*, med
 * apostrof och utan s. Skrivet på plats blir det fel på det ena språket varje
 * gång, och felet syns bara för den som heter så.
 *
 * ## Varför den bor i biblioteket
 *
 * Två ytor behöver samma svar om samma person: krockrutan
 * (`<conflict-dialog>`, *Ladda om och se Anna Anderssons ändringar*) och
 * värdsidans rad efter en omladdning (*börja från Anna Anderssons version?*).
 * Två kopior av en tvåradersregel är två kopior som en dag stavar olika —
 * och den som rättar den ena har ingen anledning att leta efter den andra.
 *
 * Här och inte i `editor-strings.ts` för att det är en **regel** och ingen
 * sträng: ordlistan innehåller det någon skrivit, det här räknar ut något.
 *
 * ## Vad den inte gör
 *
 * Den böjer inte namn i andra språk än de två gränssnittet har. Ett tredje
 * språk får engelskans form tills någon som talar det säger något annat —
 * vilket är synligt fel snarare än tyst fel, och det är avsikten.
 */
export function possessive(name: string, locale: string = DEFAULT_UI_LOCALE): string {
  /*
   * `String(...)` och inte bara `.trim()`: det här är en textgräns, och det
   * som kommer in är ett namn en värd hämtat ur sin egen session. En värd
   * skriver JavaScript, där ett fält som borde vara en sträng kan vara ett tal
   * — och ett kast här hade slagit ut hela rutan i stället för att stava ett
   * namn konstigt.
   */
  const trimmed = String(name ?? "").trim();

  if (trimmed === "") {
    return "";
  }

  const sibilant = /[sxzSXZ]$/.test(trimmed);

  if (locale === "sv") {
    return sibilant ? trimmed : `${trimmed}s`;
  }

  return sibilant ? `${trimmed}'` : `${trimmed}'s`;
}
