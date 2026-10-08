import { describe, expect, test } from "vitest";

import { FormattedTextService } from "./formatted-text-service";

/*
 * A backslash before `*`, `[` or `{` makes it a character, not markup (story
 * 136, criterion 7b e; Johan 25/9). The editor writes it when a redaktör types
 * a pair the Markdown would otherwise read: `2*3*4`, `[a](b)`, `{{namn}}`.
 */
const ALL = ["variable", "bold", "italic", "link", "bullet-list", "numbered-list"] as const;
const render = (text: string, inline = false): string =>
  FormattedTextService.render(text, [...ALL], {}, undefined, undefined, inline).html;

describe("backslash som escape", () => {
  test("stjärnor kring text blir stjärnor, inte kursiv", () => {
    expect(render("2\\*3\\*4")).toBe("<p>2*3*4</p>");
  });

  test("dubbla stjärnor blir inte fetstil", () => {
    expect(render("\\*\\*inte fet\\*\\*")).toBe("<p>**inte fet**</p>");
  });

  test("en hakparentes öppnar ingen länk", () => {
    expect(render("\\[a](/b)")).toBe("<p>[a](/b)</p>");
  });

  test("klamrar blir inget svar", () => {
    const result = FormattedTextService.render("Skriv \\{{namn}} här", [...ALL], { namn: "Anna" });

    expect(result.html).toBe("<p>Skriv {{namn}} här</p>");
    expect(result.missingVariables).toEqual([]);
  });

  test("också i en rubrik", () => {
    expect(render("5 \\* 3 \\* 2", true)).toBe("5 * 3 * 2");
  });

  test("en backslash före något annat står kvar", () => {
    expect(render("C:\\temp och a\\b")).toBe("<p>C:\\temp och a\\b</p>");
  });

  test("oescapad markup fungerar som förut bredvid", () => {
    expect(render("**fet** och \\*inte kursiv\\*")).toBe("<p><strong>fet</strong> och *inte kursiv*</p>");
  });
});
