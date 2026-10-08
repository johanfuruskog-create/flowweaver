/**
 * The body of `/api.html` — the API reference for FlowWeaver and FlowWeaver
 * PRO on one page (Johan 8/10: "dokumentation av api:et både för vanilla och
 * pro"). Rendered into the page's placeholder at build time, in the language
 * the path says, like `/pro/` (pro-page.ts). The open sections come from
 * `api-reference.ts`; PRO's are handed in by the build, because nothing open
 * may import PRO (src/gates/open-core.test.ts).
 */
import type { SiteLocale } from "./example-catalog";
import type { ApiEntry, ApiSection } from "./api-reference-types";

const REPO = "https://github.com/johanfuruskog-create/flowweaver/blob/main/docs/";

const WORDS = {
  contents: { sv: "Innehåll", en: "Contents" },
  contract: { sv: "Kontrakt", en: "Contract" },
  proContract: { sv: "följer med FlowWeaver PRO", en: "ships with FlowWeaver PRO" },
  values: { sv: "Värden", en: "Values" },
  dispatchedBy: { sv: "Skickas av", en: "Dispatched by" },
  kind: {
    attribute: { sv: "attribut", en: "attribute" },
    property: { sv: "egenskap", en: "property" },
    method: { sv: "metod", en: "method" },
    event: { sv: "händelse", en: "event" },
    function: { sv: "funktion", en: "function" },
    constant: { sv: "konstant", en: "constant" },
    type: { sv: "typ", en: "type" },
    class: { sv: "klass", en: "class" },
    note: { sv: "om", en: "about" },
  },
} as const;

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** Prose with `code` spans: escaped first, then the backticks become <code>. */
function proseHtml(value: string): string {
  return escapeHtml(value).replace(/`([^`]+)`/g, "<code>$1</code>");
}

/** A stable anchor: the section and the name, so a link can point at one entry. */
export function anchorOf(section: ApiSection, entry: ApiEntry): string {
  return `${section.id}-${entry.name}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+$/, "");
}

function renderEntry(section: ApiSection, entry: ApiEntry, locale: SiteLocale): string {
  const meta: string[] = [];
  if (entry.values) meta.push(`<p class="api-page__meta"><span>${WORDS.values[locale]}:</span> <code>${escapeHtml(entry.values)}</code></p>`);
  if (entry.element) meta.push(`<p class="api-page__meta"><span>${WORDS.dispatchedBy[locale]}:</span> <code>&lt;${escapeHtml(entry.element)}&gt;</code></p>`);
  if (entry.contract) {
    const name = escapeHtml(entry.contract);
    meta.push(
      section.pro
        ? `<p class="api-page__meta"><span>${WORDS.contract[locale]}:</span> ${name} (${WORDS.proContract[locale]})</p>`
        : `<p class="api-page__meta"><span>${WORDS.contract[locale]}:</span> <a href="${REPO}${name}">${name}</a></p>`,
    );
  }
  return `
          <div class="api-page__entry" id="${anchorOf(section, entry)}">
            <dt><code>${escapeHtml(entry.name)}</code> <span class="api-page__kind">${WORDS.kind[entry.kind][locale]}</span></dt>
            <dd>${entry.signature ? `<pre><code>${escapeHtml(entry.signature)}</code></pre>` : ""}
              <p>${proseHtml(entry.text[locale])}</p>${meta.join("")}
            </dd>
          </div>`;
}

function renderSection(section: ApiSection, locale: SiteLocale): string {
  const badge = section.pro ? ' <span class="api-page__pro">PRO</span>' : "";
  return `
      <section class="api-page__section" id="${section.id}" aria-labelledby="${section.id}-heading">
        <h2 id="${section.id}-heading">${escapeHtml(section.heading[locale])}${badge}</h2>
        <p class="api-page__intro">${proseHtml(section.intro[locale])}</p>
        <dl class="api-page__entries">${section.entries.map((entry) => renderEntry(section, entry, locale)).join("")}
        </dl>
      </section>`;
}

export function renderApiPage(sections: ApiSection[], locale: SiteLocale): string {
  const contents = sections
    .map((section) => `<li><a href="#${section.id}">${escapeHtml(section.heading[locale])}</a>${section.pro ? ' <span class="api-page__pro">PRO</span>' : ""}</li>`)
    .join("");
  return `
      <nav class="api-page__contents" aria-label="${WORDS.contents[locale]}">
        <h2>${WORDS.contents[locale]}</h2>
        <ul>${contents}</ul>
      </nav>${sections.map((section) => renderSection(section, locale)).join("")}`;
}
