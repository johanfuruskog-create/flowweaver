import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./properties-panel";

import type { PropertiesPanel } from "./properties-panel";

/**
 * The editor's content fields read the way the text does — story 009,
 * criterion 3.
 *
 * A translator writing Arabic into a left-aligned field sees punctuation on the
 * wrong side and the line starting at the wrong edge. It is legible, but it is
 * not what the resident will see, so the translator cannot judge their own work.
 *
 * The interesting half is what stays put. A variable name and an option's value
 * are **identities**: codes the flow depends on, written left to right whatever
 * language the guide is in. Turning those around would render a Latin variable
 * name backwards beside its label.
 */

const TITLE = '[data-property="title"]';
const VARIABLE = '[data-property="variableName"]';
const OPTION_LABEL = '[data-option-property="label"]';
const OPTION_VALUE = '[data-option-property="value"]';

afterEach(() => document.body.replaceChildren());

/** A question with a title and an option, both translated into Arabic. */
function mount(locale: string): PropertiesPanel {
  const panel = document.createElement("properties-panel") as PropertiesPanel;
  // Opt in: the default is readonly, and this test builds.
  panel.editorMode = "administrator";
  document.body.append(panel);
  panel.activeLocale = locale;
  panel.nodeData = {
    id: "q",
    type: "question",
    position: { x: 0, y: 0 },
    data: {
      title: { sv: "Bor du i kommunen?", ar: "هل تعيش في البلدية؟" },
      variableName: "bor",
      options: [{ id: "ja", label: { sv: "Ja", ar: "نعم" }, value: "ja" }],
    },
  };
  return panel;
}

const field = (panel: PropertiesPanel, selector: string): Element => {
  const element = panel.shadowRoot?.querySelector(selector);
  // Without this the "no dir" assertions below would pass for a field that is
  // not rendered at all — which is exactly how the first version of this file
  // passed while measuring nothing.
  if (!element) {
    throw new Error(`no field matched ${selector}`);
  }
  return element;
};

const dirOf = (panel: PropertiesPanel, selector: string): string | null =>
  field(panel, selector).getAttribute("dir");

describe("a right-to-left content language", () => {
  test("the title field reads from the right", () => {
    expect(dirOf(mount("ar"), TITLE)).toBe("rtl");
  });

  test("so does an option's label", () => {
    expect(dirOf(mount("ar"), OPTION_LABEL)).toBe("rtl");
  });
});

describe("identities stay left to right", () => {
  // The half that would be a bug rather than a nicety: a variable name is a
  // code the rules depend on, and a Latin code in an rtl field renders
  // backwards beside its label.
  test("the variable name does not turn around", () => {
    expect(dirOf(mount("ar"), VARIABLE)).toBeNull();
  });

  test("nor does an option\'s value", () => {
    expect(dirOf(mount("ar"), OPTION_VALUE)).toBeNull();
  });
});

describe("a left-to-right language adds nothing", () => {
  // The common case should not grow the markup: `dir="ltr"` everywhere would be
  // noise repeating what the document already says.
  test.each([TITLE, VARIABLE, OPTION_LABEL, OPTION_VALUE])(
    "%s carries no dir in Swedish",
    (selector) => {
      expect(dirOf(mount("sv"), selector)).toBeNull();
    },
  );
});

describe("it follows the content language, not the tool\'s", () => {
  // Story 014: the two axes are independent.
  test("an Arabic guide in a Swedish tool still has Arabic fields", () => {
    const panel = mount("ar");
    panel.editorLocale = "sv";

    expect(dirOf(panel, TITLE)).toBe("rtl");
  });

  test("and an English tool does not turn a Swedish guide", () => {
    const panel = mount("sv");
    panel.editorLocale = "en";

    expect(dirOf(panel, TITLE)).toBeNull();
  });
});
