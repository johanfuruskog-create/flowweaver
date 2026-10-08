import { describe, expect, test } from "vitest";

import "./default-node-types";
import { getNodeType } from "./node-type-registry";
import { resolveText } from "../core/localized-text";

/**
 * New nodes' default content must be bilingual (LocalizedText), so an author
 * editing content in English gets English defaults instead of Swedish. The
 * content axis, distinct from the editor's UI language.
 */
describe("new nodes' default content is bilingual", () => {
  test("the question's title and default options resolve per language", () => {
    const data = getNodeType("question")!.createData();
    expect(resolveText(data.title as never, "sv")).toBe("Ny fråga");
    expect(resolveText(data.title as never, "en")).toBe("New question");

    const options = data.options as Array<{ label: unknown }>;
    expect(resolveText(options[0].label as never, "en")).toBe("Option 1");
    expect(resolveText(options[0].label as never, "sv")).toBe("Alternativ 1");
  });

  test("the other node types' titles have an English translation", () => {
    const cases: Array<[string, string]> = [
      ["multi-choice", "New multiple-choice question"],
      ["number-question", "New number question"],
      ["text-question", "New text question"],
      ["result", "New result"],
      ["page", "New page"],
    ];
    for (const [type, en] of cases) {
      const title = getNodeType(type)!.createData().title;
      expect(resolveText(title as never, "en")).toBe(en);
    }
  });
});
