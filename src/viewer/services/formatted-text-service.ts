import type { Answers } from "../core/answer-values";
import { LINK_PATTERN, splitLinkTarget } from "./link-references";
import { TemplateVariableService } from "./template-variable-service";
import type { GraphData } from "../types/graph";
import type { FormattingFeature } from "../types/node-types";

export interface FormattedTextResult {
  html: string;
  missingVariables: string[];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * The address of a link, or null when it is one we will not write.
 *
 * ## Why this is a deny-list around a scheme, not an allow-list of two
 *
 * It used to allow `http:`, `https:` and `mailto:` and reject everything else.
 * That reads as the careful choice and is the wrong shape, because the most
 * common address on a public-sector page has **no scheme at all**:
 * `/kontakta-oss/kontaktvagar-for-arbetsgivare.html`. Relative links are how a
 * real site is written — they survive a domain change and work in a test
 * environment — and they are *safer* than absolute ones, because they cannot
 * leave the site.
 *
 * Every one of the six links in a guide taken from a real agency's site was
 * relative. All six were printed as raw markdown, and the editor who wrote
 * them had no way to find out why. (Our own guide with the same six shapes is
 * `src/data/relative-links-graph.ts`.)
 *
 * So: anything carrying a scheme must carry one of the three we accept.
 * Anything carrying none is a path on this site and is let through.
 *
 * `//evil.example` is the case that looks relative and is not — the browser
 * reads it as *the current protocol, that host* — so it is refused with the
 * schemes.
 */
function safeLink(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed || trimmed.startsWith("//")) {
    return null;
  }

  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed);

  if (scheme && !/^(https?|mailto)$/i.test(scheme[1] ?? "")) {
    return null;
  }

  return escapeHtml(trimmed);
}

function renderInline(value: string, features: Set<FormattingFeature>): string {
  let output = value;
  if (features.has("link")) {
    output = output.replace(LINK_PATTERN, (source, label: string, target: string) => {
      // The host's reference (story 100) is for the editor's upkeep only —
      // never a title, never text. The visitor gets the address.
      const href = safeLink(splitLinkTarget(target).url);
      return href ? '<a href="' + href + '">' + label + "</a>" : source;
    });
  }
  if (features.has("bold")) {
    output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  }
  if (features.has("italic")) {
    output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }
  return output;
}

export class FormattedTextService {
  static render(
    template: string,
    features: FormattingFeature[],
    answers: Answers = {},
    graph?: GraphData,
    /*
     * The language the text is being read in. Optional, so a caller that does
     * not know one behaves exactly as before — but a caller that does must pass
     * it, or an English description reports its numbers grouped the Swedish
     * way, three lines from the field the reader typed them into.
     */
    locale?: string,
    /*
     * Utan blockmarkup. En rubrik är ett `<h2>`, och ett `<p>` inuti ett `<h2>`
     * är ogiltig markup — men rubriken kan mycket väl bära fet stil eller en
     * länk. Samtyckesnoden deklarerar just `link` på sin rubrik, och den
     * visades som `[villkoren](/villkor)` med klamrar för att den enda vägen
     * hit escapade allt.
     */
    inline = false
  ): FormattedTextResult {
    const allowed = new Set(features);
    const values: string[] = [];
    const missing = new Set<string>();
    /*
     * A backslash before `*`, `[` or `{` makes it a character (story 136,
     * 7b e; Johan 25/9). Without it the Markdown had no way to say `2*3*4`:
     * two stars around text on a line are italic whatever was meant, and the
     * editor could not store what the redaktör typed. Taken out first, before
     * variables, links, bold and italic look, and put back as the bare
     * character last. A backslash before anything else stays as it is, so no
     * text written before this changes (measured 25/9: no formatted text in
     * any bundled or imported guide has a backslash).
     */
    const escaped: string[] = [];
    const withoutEscapes = template.replace(/\\([*[{])/g, (_whole, char: string) => {
      const index = escaped.push(char) - 1;
      return "__FLOWWEAVER_ESCAPE_" + index + "__";
    });
    const protectedTemplate = withoutEscapes.replace(
      /{{\s*([^{}]+?)\s*}}/g,
      (placeholder) => {
        const resolved = TemplateVariableService.resolve(placeholder, answers, graph, locale);
        resolved.missingVariables.forEach((variable) => missing.add(variable));
        if (resolved.missingVariables.length > 0) return placeholder;
        const index = values.push(resolved.resolved) - 1;
        return "__FLOWWEAVER_VARIABLE_" + index + "__";
      }
    );

    const lines = escapeHtml(protectedTemplate).split(/\r?\n/);
    const blocks: string[] = [];
    let paragraph: string[] = [];
    let listType: "ul" | "ol" | null = null;
    let listItems: string[] = [];

    const flushParagraph = (): void => {
      if (paragraph.length === 0) return;
      blocks.push("<p>" + paragraph.map((line) => renderInline(line, allowed)).join("<br>") + "</p>");
      paragraph = [];
    };
    const flushList = (): void => {
      if (!listType || listItems.length === 0) return;
      blocks.push("<" + listType + ">" + listItems.map((item) => "<li>" + renderInline(item, allowed) + "</li>").join("") + "</" + listType + ">");
      listType = null;
      listItems = [];
    };

    lines.forEach((line) => {
      const bullet = allowed.has("bullet-list") ? line.match(/^\s*-\s+(.+)$/) : null;
      const numbered = allowed.has("numbered-list") ? line.match(/^\s*\d+\.\s+(.+)$/) : null;
      const nextList = bullet ? "ul" : numbered ? "ol" : null;
      if (nextList) {
        flushParagraph();
        if (listType && listType !== nextList) flushList();
        listType = nextList;
        listItems.push((bullet?.[1] ?? numbered?.[1]) as string);
        return;
      }
      flushList();
      if (line.trim() === "") {
        flushParagraph();
      } else {
        paragraph.push(line);
      }
    });
    flushList();
    flushParagraph();

    let html = inline
      ? renderInline(template === "" ? "" : lines.join(" "), allowed)
      : blocks.join("");
    values.forEach((value, index) => {
      // A value on several lines — a repeating page's records (story 084) —
      // keeps its lines; inside a paragraph a bare newline is a space.
      html = html.replaceAll("__FLOWWEAVER_VARIABLE_" + index + "__", escapeHtml(value).replaceAll("\n", "<br>"));
    });
    escaped.forEach((char, index) => {
      html = html.replaceAll("__FLOWWEAVER_ESCAPE_" + index + "__", char);
    });
    return { html, missingVariables: [...missing] };
  }

  /**
   * The same text as it is drawn on a card in the editor.
   *
   * Inline, unanswered and inert. Unanswered: the card has no visitor, so a
   * `{{variabel}}` is left in place for the card to draw as its gap. Inert:
   * a click on the canvas selects the node and must never navigate, so every
   * link is written without its `href` — an `<a>` with no address is the
   * platform's own word for "a link that does nothing" (not focusable, not
   * clickable), and the card can still style it as one. The address is only
   * an address; the editor reads it in the properties panel.
   *
   * Here and not in the card because the anchor is written three methods up:
   * the one place that knows what a link looks like is the one that unhooks
   * it. Before this the card escaped everything, and the three guides
   * imported from a real agency (7/9 2026) showed
   * `[Ansök om uppehållstillstånd](/du-vill-ansoka/…/uppehallstillstand.html)`
   * in full — eight lines on the card for four in the visitor's view.
   */
  static renderInert(
    template: string,
    features: FormattingFeature[],
    graph?: GraphData,
    locale?: string,
  ): string {
    return this.render(template, features, {}, graph, locale, true).html.replace(
      /<a href="[^"]*">/g,
      "<a>",
    );
  }
}
