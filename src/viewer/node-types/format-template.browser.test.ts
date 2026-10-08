import { afterEach, describe, expect, test } from "vitest";

import "./default-node-types";
import "../components/guide-preview/guide-preview";

import { nodeFromTemplate } from "./node-templates";

import type { GuidePreview } from "../components/guide-preview/guide-preview";
import type { NodeTemplate } from "../types/graph";

/**
 * A foreign identifier as a template, with no code behind it.
 *
 * ## Johan's observation, which was better than the plan
 *
 * The field setups are already templates: `BUILTIN_TEMPLATES` holds
 * `nodmall-personnummer` as a text question plus `{ format: "personnummer" }`,
 * three lines. So the question "how do you set up an English personnummer" has
 * a much smaller answer than the format pack being designed around it — **write
 * a template**.
 *
 * Now that a text question carries a written shape of its own, a template can
 * bring the pattern with it. This proves the whole path without a line of code
 * anywhere: a template a host writes, a node made from it, and a field in the
 * viewer that shapes what is typed and refuses what does not fit.
 *
 * ## Where the line actually falls
 *
 * A template gives **shape** and, with `pattern`, **possibility**. What it
 * cannot give is *genuineness* — a check digit, a date that exists, the ten
 * zeros that are the first thing anybody types. That is what the registry and a
 * pack are for, and it is a much narrower job than "every country".
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 90) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The template a host would write. No code ships for this. */
const SSN_TEMPLATE: NodeTemplate = {
  type: "nodmall-ssn-us",
  label: "Social security number",
  icon: "#",
  base: "text-question",
  values: {
    title: "Your social security number",
    mask: "###-##-####",

    format: "regex",
    pattern: "^\\d{3}-\\d{2}-\\d{4}$",
    placeholder: "123-45-6789",
  },
};

describe("en mall med egen skrivform", () => {
  test("blir en nod med mönstret i sig", () => {
    const node = nodeFromTemplate(SSN_TEMPLATE)!;

    expect(node.type).toBe("text-question");
    expect(node.data.mask).toBe("###-##-####");
  });

  test("och fältet tar formen medan man skriver", async () => {
    const preview = document.createElement("guide-preview") as GuidePreview;
    const node = nodeFromTemplate(SSN_TEMPLATE)!;

    preview.style.cssText = "display: block; width: 600px;";
    document.body.append(preview);
    preview.graph = {
      startNodeId: "q",
      nodes: [{ ...node, id: "q", position: { x: 0, y: 0 }, data: { ...node.data, variableName: "ssn" } }],
      connections: [],
    } as never;

    await settle();
    await settle();

    const field = preview.shadowRoot!.querySelector<HTMLInputElement>("[data-text-answer]")!;

    [..."123456789"].forEach((character) => {
      const at = field.selectionStart ?? field.value.length;

      field.value = field.value.slice(0, at) + character + field.value.slice(at);
      field.setSelectionRange(at + 1, at + 1);
      field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    });

    expect(field.value).toBe("123-45-6789");
  });
});
