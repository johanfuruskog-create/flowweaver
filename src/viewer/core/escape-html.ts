/**
 * Text som ska in i markup, ofarliggjord.
 *
 * ## Varför den här filen finns
 *
 * Den fanns i **tio** kopior: varje komponent som bygger sin skugg-DOM med en
 * mall-literal hade en egen `escapeHtml`, alla identiska, alla fyra
 * `.replace()`. Johan frågade varför koden dupliceras så, och svaret var inte
 * ett skäl utan en väg: när man bygger en komponent arbetar man inuti den, och
 * att räcka utanför kostar en sökning — medan en kopia kostar fem sekunder.
 *
 * Att den kopierades tio gånger säger också att det inte gick att hitta någon.
 * Nu går det, och `src/gates/no-duplicate-helpers.test.ts` fäller den elfte.
 *
 * ## Varför just de fyra tecknen
 *
 * `&` först, annars skulle den ersätta de `&` som de andra tre precis skapat.
 * Citattecknet finns med för att värden hamnar i attribut, där ett `"` bryter
 * sig ut ur attributet. Apostrofen behövs inte: attributen skrivs med
 * dubbelfnuttar genomgående, och att lägga till den hade varit att skydda mot
 * något ingen skriver.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
