import { describe, expect, test } from "vitest";

import "../../viewer/node-types/default-node-types";
import { BUILTIN_TEMPLATES } from "./builtin-templates";
import { nodeFromTemplate } from "../../viewer/node-types/node-templates";

describe("inbyggda nodmallar", () => {
  test("contains email, phone and personnummer with the right format", () => {
    const byType = new Map(
      BUILTIN_TEMPLATES.map((template) => [template.type, template])
    );

    const cases: Array<[string, string]> = [
      ["nodmall-email", "email"],
      ["nodmall-phone", "phone"],
      ["nodmall-personnummer", "personnummer"],
    ];

    for (const [type, format] of cases) {
      const template = byType.get(type);
      expect(template, type).toBeDefined();
      expect(template?.base).toBe("text-question");
      expect(template?.values.format).toBe(format);
    }
  });

  // Each of them used to carry a copy of the text question's twelve fields.
  test("each is a base type plus a single value", () => {
    for (const template of BUILTIN_TEMPLATES) {
      expect(Object.keys(template.values), template.label).toEqual(["format"]);
    }
  });

  test("they yield text questions with their format filled in", () => {
    const skapad = nodeFromTemplate(BUILTIN_TEMPLATES[0]);

    expect(skapad?.type).toBe("text-question");
    expect(skapad?.template).toBe("nodmall-email");
    expect(skapad?.data.format).toBe("email");
    // The rest comes from the text question, not from a copy in the template.
    expect(skapad?.data.presentation).toBe("input");
    expect(skapad?.data.variableName).toBe("");
  });
});
