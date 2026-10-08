import { describe, expect, it } from "vitest";

import { FormattedTextService } from "./formatted-text-service";
import { relativeLinksGraph } from "../../data/relative-links-graph";

/**
 * Which addresses become links, and which stay as text.
 *
 * ## The failure this is written from
 *
 * A guide taken from a real agency had six links in it and not one of them was
 * rendered. They were all relative — `/kontakta-oss/kontaktvagar-for-arbetsgivare.html`
 * — and the filter allowed three schemes and refused everything else, so a path
 * with no scheme fell through with `javascript:` and was printed as raw
 * markdown. The editor who wrote them was told nothing.
 *
 * Relative is how a real site is written: it survives a domain change and works
 * in a test environment. It is also *safer* than absolute, because it cannot
 * leave the site. Refusing it was the opposite of careful.
 *
 * ## What is asserted
 *
 * Both halves, because a filter is only worth having if it still refuses. The
 * refusals are the reason the function exists, so they are the longer list.
 */

const render = (markdown: string): string =>
  FormattedTextService.render(markdown, ["link"], {}, undefined).html;

const linked = (url: string): boolean =>
  render(`[etikett](${url})`).includes(`href="`);

describe("addresses that become links", () => {
  it.each([
    ["/kontakta-oss/kontaktvagar-for-arbetsgivare.html", "a path on this site"],
    ["/arbetsgivare/du-vill-anstalla/medborgare-i-schweiz.html", "a deeper one"],
    ["kontakt.html", "a sibling page"],
    ["./kontakt.html", "explicitly relative"],
    ["../oversikt.html", "up one"],
    ["#steg-2", "an anchor on the page"],
    ["https://example.se/sida", "https"],
    ["http://example.se/sida", "http"],
    ["mailto:nagon@example.se", "an address to write to"],
  ])("%s — %s", (url) => {
    expect(linked(url)).toBe(true);
  });
});

describe("addresses that stay as text", () => {
  it.each([
    ["javascript:alert(1)", "the reason the filter exists"],
    ["JavaScript:alert(1)", "and it does not care about case"],
    ["data:text/html,<script>x</script>", "a document smuggled into an address"],
    ["vbscript:msgbox", "the other one"],
    ["//evil.example/x", "looks relative, is not — the browser reads it as another host"],
  ])("%s — %s", (url) => {
    expect(linked(url)).toBe(false);
  });

  it("leaves the markdown visible rather than swallowing it", () => {
    /*
     * Shown, not stripped. An editor whose link was refused should be able to
     * see that something is there — a link that silently vanished would be
     * found by a resident rather than by the person who wrote it.
     */
    expect(render("[etikett](javascript:alert(1))")).toContain("[etikett]");
  });
});

describe("a guide that links the way a real site does", () => {
  it("renders all six of its links", () => {
    // Our own guide with the six shapes the agency's guide had (decision 8:
    // the agency's text stays out of the open FlowWeaver). Not the agency's
    // file any more, but the same claim: six written, six rendered. It was six
    // and zero.
    const texts = relativeLinksGraph.nodes.flatMap((node) =>
      Object.values(node.data ?? {}).filter((value): value is string => typeof value === "string"),
    );

    const markdownLinks = texts.join("\n").match(/\]\(([^)]+)\)/g) ?? [];
    const rendered = texts
      .map((text) => render(text))
      .join("\n")
      .match(/<a href=/g) ?? [];

    expect(markdownLinks).toHaveLength(6);
    expect(rendered).toHaveLength(6);
  });
});
