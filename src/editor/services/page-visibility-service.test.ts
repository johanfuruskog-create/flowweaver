import { describe, expect, test } from "vitest";

// The badge is the author's (editor-view only), so its words come with the
// editor's lookup.
import "../localization/editor-ui-strings";
import { PageVisibilityService } from "../../viewer/services/page-visibility-service";
import type { FlowNodeData } from "../../viewer/types/graph";

const field = (match: "all" | "any" = "all"): FlowNodeData => ({
  id: "field",
  type: "text-question",
  position: { x: 0, y: 0 },
  parentPageId: "page",
  data: {},
  visibility: {
    match,
    conditions: [
      { id: "condition", variableName: "contact", operator: "equals", value: "email" },
    ],
  },
});

describe("PageVisibilityService", () => {
  test("shows unconditional fields and matching conditions", () => {
    const unconditional = field();
    delete unconditional.visibility;
    expect(PageVisibilityService.isVisible(unconditional, {})).toBe(true);
    expect(PageVisibilityService.isVisible(field(), { contact: "email" })).toBe(true);
  });

  test("hides fields when the variable is missing or the condition does not match", () => {
    expect(PageVisibilityService.isVisible(field(), {})).toBe(false);
    expect(PageVisibilityService.isVisible(field(), { contact: "phone" })).toBe(false);
  });

  test("supports all and any plus numeric operators", () => {
    const node = field("any");
    node.visibility!.conditions.push({
      id: "age",
      variableName: "age",
      operator: "greater-than-or-equal",
      value: "18",
    });
    expect(PageVisibilityService.isVisible(node, { contact: "phone", age: "20" })).toBe(true);
    node.visibility!.match = "all";
    expect(PageVisibilityService.isVisible(node, { contact: "phone", age: "20" })).toBe(false);
  });

  /*
   * Story 077: the band speaks the editor's words — the question's title and
   * the answer's label, in the guide's language — with the chrome from the
   * string registry (the band was hard-coded Swedish until 3/9). A name with
   * no question, or a value with no option, stands as it is: `email` beats
   * nothing.
   */
  describe("villkorsraden", () => {
    const question: FlowNodeData = {
      id: "contact-q",
      type: "question",
      position: { x: 0, y: 0 },
      parentPageId: "page",
      data: {
        title: { sv: "Kontaktväg", en: "Contact method" },
        variableName: "contact",
        options: [
          { id: "o1", label: { sv: "E-post", en: "Email" }, value: "email" },
          { id: "o2", label: { sv: "Telefon", en: "Phone" }, value: "phone" },
        ],
      },
    };

    test("frågans rubrik och svarets text, i guidens språk", () => {
      expect(PageVisibilityService.getBadgeLabel(field(), { nodes: [question] })).toBe(
        "Visas bara om Kontaktväg är E-post",
      );
      expect(
        PageVisibilityService.getBadgeLabel(field(), {
          nodes: [question],
          locale: "en",
          contentLocale: "en",
        }),
      ).toBe("Only shown if Contact method is Email");
    });

    test("aliaset går före rubriken, som i regeleditorn", () => {
      // Johan 3/9: har variabeln ett alias är det det man ser i regeleditorn,
      // så kortet ska säga samma sak — inte rubriken, som ofta är en fråga.
      const aliased: FlowNodeData = {
        ...question,
        data: { ...question.data, title: { sv: "Hur vill du bli nådd?" }, variableLabel: "Kontaktväg" },
      };
      expect(PageVisibilityService.getBadgeLabel(field(), { nodes: [aliased] })).toBe(
        "Visas bara om Kontaktväg är E-post",
      );
    });

    test("utan fråga eller alternativ står namnet och värdet som de är", () => {
      expect(PageVisibilityService.getBadgeLabel(field())).toBe("Visas bara om contact är email");
      const other = field();
      other.visibility!.conditions[0].value = "letter";
      expect(PageVisibilityService.getBadgeLabel(other, { nodes: [question] })).toBe(
        "Visas bara om Kontaktväg är letter",
      );
    });

    test("fler villkor än ett markeras med en ellips", () => {
      const node = field("any");
      node.visibility!.conditions.push({
        id: "age",
        variableName: "age",
        operator: "greater-than-or-equal",
        value: "18",
      });
      expect(PageVisibilityService.getBadgeLabel(node, { nodes: [question] })).toBe(
        "Visas bara om Kontaktväg är E-post …",
      );
    });
  });
});