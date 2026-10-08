import { afterEach, beforeEach, describe, expect, test } from "vitest";

import sheet from "./styles/guide-storage.scss?inline";
import { contrastRatio } from "../testing/contrast-ratio";

/*
 * Det tysta valet i räddningsraden måste synas som en knapp.
 *
 * Johan mätte den skarpt 19/9 i mörkt tema: *Börja från Anna Anderssons
 * version* stod utan ram och utan bakgrund på egen rad under den fyllda
 * knappen, och läste som lös text. En text är inte en knapp.
 *
 * Grinden mäter det som faktiskt ritas — den beräknade kantfärgen mot den
 * beräknade bakgrunden i rutan bakom — och inte vilket token filen nämner. Ett
 * token som byter värde, eller en regel som vinner över den här, syns bara på
 * det sättet. WCAG 1.4.11: 3:1 mot det som ligger bakom.
 */

/** `rgb(208, 213, 221)` → `#d0d5dd`, formen `contrastRatio` räknar på. */
function hex(color: string): string {
  const parts = color.match(/\d+(\.\d+)?/g) ?? [];

  return `#${parts
    .slice(0, 3)
    .map((one) => Math.round(Number(one)).toString(16).padStart(2, "0"))
    .join("")}`;
}

let style: HTMLStyleElement;
let row: HTMLElement;

beforeEach(() => {
  style = document.createElement("style");
  style.textContent = sheet;
  document.head.append(style);

  /*
   * Samma träd som `dev/guide-storage.html` bygger — raden, valet, knappen.
   * Mätningen är meningslös på en knapp som står någon annanstans: det är
   * rutans gula yta bakom kanten som är hela frågan.
   */
  row = document.createElement("div");
  row.className = "row__rescue";
  row.innerHTML = `
    <p class="row__rescue-text">Dina ändringar finns kvar i den här webbläsaren.</p>
    <div class="row__rescue-choices">
      <p class="row__rescue-choice">
        <button type="button" class="row__button row__button--quiet">Börja från Anna Anderssons version</button>
        <span class="row__rescue-cost">Dina ändringar från 08:49 kastas.</span>
      </p>
    </div>
  `;
  document.body.append(row);
});

afterEach(() => {
  row.remove();
  style.remove();
  delete document.documentElement.dataset.theme;
  delete document.body.dataset.fwTheme;
});

/*
 * Båda vägarna sätts, precis som sidan gör det: sajtens tokens hänger på
 * `:root[data-theme]` (`demo-tokens.scss`), bibliotekets på sin egen tagg — och
 * testuppsättningen har lagt den klassen på `body`, som annars hade skuggat
 * `:root` med ljusa värden hur mörk sidan än är.
 */
function wear(theme: "light" | "dark"): void {
  document.documentElement.dataset.theme = theme;
  document.body.dataset.fwTheme = theme;
}

describe.each([["ljust läge", "light"], ["mörkt läge", "dark"]] as const)(
  "räddningsradens tysta knapp (%s)",
  (_name, theme) => {
    test("har en kant som syns mot rutan bakom (3:1, WCAG 1.4.11)", () => {
      wear(theme);

      const button = row.querySelector(".row__button--quiet") as HTMLElement;
      const edge = hex(getComputedStyle(button).borderTopColor);
      const behind = hex(getComputedStyle(row).backgroundColor);

      expect(edge, "ingen kantfärg alls").not.toBe("#000000");
      expect(contrastRatio(edge, behind), `${edge} mot ${behind}`).toBeGreaterThanOrEqual(3);
    });

    test("och är lika hög som en knapp man ska kunna träffa (K6, 44 px)", () => {
      wear(theme);

      const button = row.querySelector(".row__button--quiet") as HTMLElement;

      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    });

    /*
     * Och den håller sig inne i rutan i en telefon.
     *
     * Knappen bär ett namn — *Börja från Johan Furuskogs version* — och radens
     * knappar ärver `white-space: nowrap` från verktygsraden. En rad som inte
     * får brytas blir bredare än rutan i stället, och då står knappen utanför
     * sin egen ram.
     */
    test("och håller sig innanför rutan när rutan är smalare än namnet", () => {
      wear(theme);
      /*
       * 200 px, och inte 390 px sidbredd: etiketten här är 252 px, och ett
       * längre namn — eller ett större teckensnitt hos den som ställt upp det
       * — gör varje ruta för smal. Bredden står alltså för fallet, inte för en
       * enhet. Med `nowrap` blir texten bredare än sin knapp; mätt så, och det
       * är den mätningen som faller.
       */
      row.style.width = "200px";

      const button = row.querySelector(".row__button--quiet") as HTMLElement;

      expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth);
      expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(
        row.getBoundingClientRect().right,
      );
    });
  },
);
