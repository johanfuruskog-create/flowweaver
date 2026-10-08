import { escapeHtml } from "./escape-html";
import { interpolate } from "./ui-strings";

/**
 * Valda saker som borttagbara etiketter, som markup.
 *
 * ## Varför den här finns
 *
 * Två kontroller ritade exakt samma `<li><span>…</span><button>×</button></li>`
 * — samma form, samma `aria-label`, olika klassprefix. `_chips.scss` tog redan
 * prefixet som parameter; markupen gjorde inte det, och låg därför i två
 * exemplar som kunde ändras var för sig.
 *
 * ## Vad den INTE vet
 *
 * Var alternativen kommer ifrån, hur tangentbordet fungerar, vad som händer
 * när man klickar. Den bygger en remsa och slutar där — vilket är hela skälet
 * att den kan delas av två kontroller som annars inte går att slå ihop.
 */

export interface ChipItem {
  /** Det som lagras — en kod, ett id. */
  value: string;
  /** Det som läses. */
  label: string;
}

export interface ChipStripNames {
  /** Klassprefixet, samma som `_chips.scss` fick: `chip-picker__chip`. */
  prefix: string;
  /** Attributet som bär värdet på `<li>`, t.ex. `data-chosen`. */
  itemAttribute: string;
  /** Attributet som märker ut borttagningsknappen, t.ex. `data-remove`. */
  removeAttribute: string;
}

/**
 * @param removeLabel Mall med `{label}`, t.ex. "Ta bort {label}". Krysset är
 *   ett `×` och behöver ett namn som säger VAD som tas bort — annars läses
 *   femton likadana "×" upp i rad.
 */
export function chipStrip(
  items: ChipItem[],
  removeLabel: string,
  names: ChipStripNames,
): string {
  return items
    .map(
      (item) => `
        <li class="${names.prefix}" ${names.itemAttribute}="${escapeHtml(item.value)}">
          <span class="${names.prefix}-label">${escapeHtml(item.label)}</span>
          <button
            type="button"
            class="${names.prefix}-remove"
            ${names.removeAttribute}
            data-value="${escapeHtml(item.value)}"
            aria-label="${escapeHtml(interpolate(removeLabel, { label: item.label }))}"
          >×</button>
        </li>`,
    )
    .join("");
}
