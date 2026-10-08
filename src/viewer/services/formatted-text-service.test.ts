import { describe, expect, test } from "vitest";

import { FormattedTextService } from "./formatted-text-service";

describe("FormattedTextService", () => {
  test("renders only explicitly allowed formatting", () => {
    const value = [
      "**Viktigt** och *kursivt*",
      "",
      "[Läs mer](https://example.se)",
      "",
      "- Ett",
      "- Två",
      "",
      "1. Först",
      "2. Sedan",
    ].join(String.fromCharCode(10));
    const result = FormattedTextService.render(
      value,
      ["bold", "italic", "link", "bullet-list", "numbered-list"]
    );

    expect(result.html).toContain("<strong>Viktigt</strong>");
    expect(result.html).toContain("<em>kursivt</em>");
    expect(result.html).toContain('<a href="https://example.se">Läs mer</a>');
    expect(result.html).toContain("<ul><li>Ett</li><li>Två</li></ul>");
    expect(result.html).toContain("<ol><li>Först</li><li>Sedan</li></ol>");
  });

  test("leaves links and lists as text when the profile disallows them", () => {
    const result = FormattedTextService.render(
      ["[Läs mer](https://example.se)", "- Punkt"].join(String.fromCharCode(10)),
      ["bold", "italic"]
    );

    expect(result.html).not.toContain("<a ");
    expect(result.html).not.toContain("<ul>");
    expect(result.html).toContain("[Läs mer](https://example.se)");
    expect(result.html).toContain("- Punkt");
  });

  test("treats variable values as text and rejects unsafe links", () => {
    const result = FormattedTextService.render(
      "**{{answer}}** [Farlig](javascript:alert(1))",
      ["bold", "link", "variable"],
      { answer: "<script>**inte egen formatering**</script>" }
    );

    expect(result.html).toContain("<strong>&lt;script&gt;**inte egen formatering**&lt;/script&gt;</strong>");
    expect(result.html).not.toContain("<script>");
    expect(result.html).not.toContain('href="javascript:');
  });

  // The card in the editor: a link is its label with no address, a variable
  // stays a placeholder for the card to draw as a gap, and no block markup —
  // the card wraps the text in its own tag.
  test("renderInert keeps the label, drops the href and leaves variables in place", () => {
    const html = FormattedTextService.renderInert(
      "Se [Ansök](/ansok.html) för {{namn}}\n\n**Fet**",
      ["bold", "link", "variable"],
    );

    expect(html).toBe("Se <a>Ansök</a> för {{namn}}  <strong>Fet</strong>");
    expect(html).not.toContain("href");
    expect(html).not.toContain("<p>");
  });

  // Listan från en upprepad sida (story 084) kommer som rader; de ska
  // radbrytas som de skrevs, inte falla ihop till en rad i stycket. (En
  // sträng med radbrytning i är däremot den gamla flervärdesformen och
  // läses som en lista — därför en riktig upprepad sida här.)
  test("a repeating page's records keep their lines, a blank one between records", () => {
    const graph = {
      startNodeId: "p", settings: { sourceLocale: "sv" }, connections: [],
      nodes: [
        { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: "Barn", repeats: true, repeatWord: "barn", repeatVariable: "barn" } },
        { id: "n", type: "text-question", parentPageId: "p", order: 1, position: { x: 0, y: 0 }, data: { title: "Namn", variableName: "namn" } },
      ],
    } as never;
    const result = FormattedTextService.render(
      "Barnen:" + String.fromCharCode(10) + "{{barn}}",
      ["variable"],
      { barn: [{ namn: "Alva" }, { namn: "Nils" }] },
      graph,
    );

    expect(result.html).toBe("<p>Barnen:<br>Barn 1<br>Namn: Alva<br><br>Barn 2<br>Namn: Nils</p>");
  });
});
