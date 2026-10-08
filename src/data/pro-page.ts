/**
 * The body of `/pro/` — everything about FlowWeaver PRO on one page (Johan
 * 6/10): what it adds, the comparison with the open version, and the guides
 * that demonstrate it. Rendered into the page's placeholder by the same Vite
 * plugin that fills the start page, in the language the path says; the words
 * come from the catalogues, so neither language is hand-copied HTML.
 */
import { renderProAdds, renderProGuides, type SiteLocale } from "./example-catalog";
import { OPEN_MEETS_PRO, PRO_ROWS, SHARED_ROWS, type VersionRow } from "./versions-catalog";

const WORDS = {
  adds: { sv: "Vad PRO lägger till", en: "What PRO adds" },
  compare: { sv: "Vad versionerna innehåller", en: "What the versions contain" },
  both: { sv: "Båda versionerna", en: "Both versions" },
  proOnly: { sv: "Bara FlowWeaver PRO", en: "FlowWeaver PRO only" },
  area: { sv: "Område", en: "Area" },
  content: { sv: "Innehåll", en: "Content" },
  demos: { sv: "Prova e-tjänsterna", en: "Try the e-services" },
  demosIntro: {
    sv: "Varje guide här skickar något in. Bygg om den i editorn eller prova den som besökare — mottagaren är en demo som svarar med ett referensnummer.",
    en: "Every guide here sends something in. Rebuild it in the editor or try it as a visitor — the receiver is a demo that answers with a reference number.",
  },
} as const;

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function renderTable(rows: VersionRow[], caption: string, locale: SiteLocale): string {
  return `
        <table class="pro-page__table">
          <caption>${escapeHtml(caption)}</caption>
          <thead><tr><th scope="col">${escapeHtml(WORDS.area[locale])}</th><th scope="col">${escapeHtml(WORDS.content[locale])}</th></tr></thead>
          <tbody>${rows
            .map((row) => `
            <tr><th scope="row">${escapeHtml(row.area[locale])}</th><td>${escapeHtml(row.content[locale])}</td></tr>`)
            .join("")}
          </tbody>
        </table>`;
}

export function renderProPage(locale: SiteLocale): string {
  return `
      <section class="pro-page__adds" aria-labelledby="pro-adds">
        <h2 id="pro-adds">${escapeHtml(WORDS.adds[locale])}</h2>
        ${renderProAdds(locale)}
      </section>

      <section class="pro-page__compare" aria-labelledby="pro-compare">
        <h2 id="pro-compare">${escapeHtml(WORDS.compare[locale])}</h2>${renderTable(SHARED_ROWS, WORDS.both[locale], locale)}${renderTable(PRO_ROWS, WORDS.proOnly[locale], locale)}
        <p class="pro-page__note">${escapeHtml(OPEN_MEETS_PRO[locale])}</p>
      </section>

      <section class="pro-page__demos examples-index" aria-labelledby="pro-demos">
        <h2 id="pro-demos">${escapeHtml(WORDS.demos[locale])}</h2>
        <p>${escapeHtml(WORDS.demosIntro[locale])}</p>
        <nav aria-label="${escapeHtml(WORDS.demos[locale])}">
${renderProGuides(locale)}
        </nav>
      </section>`;
}
