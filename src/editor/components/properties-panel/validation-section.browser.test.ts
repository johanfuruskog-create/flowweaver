import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * The rules about an answer, gathered under one heading.
 *
 * ## Why they were hard to find
 *
 * Validation was spread down the panel in declaration order: *obligatoriskt*
 * near the top, *minsta antal tecken* further down, *format* below that, the
 * pattern under it, and the width control after them all. Each was a box to
 * fill in, none of them said what it did, and nothing said they belonged
 * together.
 *
 * ## Why the regex is last
 *
 * Not decoration. A named format carries its own message — *"Ange ett giltigt
 * personnummer"* — while a pattern can only say that the value has the wrong
 * shape, which tells somebody their answer is refused and nothing about why. So
 * it sits at the bottom, after everything that can explain itself, and its
 * description says as much.
 *
 * ## What is asserted
 *
 * Not the order of a list of strings, which would break on every wording change.
 * That the heading exists, that the rules are under it, and that the pattern is
 * the last thing in it.
 */

afterEach(() => document.body.replaceChildren());

const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ),
  );

const guide = (): GraphData =>
  ({
    startNodeId: "t",
    settings: { sourceLocale: "sv" },
    nodes: [
      {
        id: "t",
        type: "text-question",
        position: { x: 40, y: 40 },
        data: { title: { sv: "Ditt namn" }, variableName: "namn" },
      },
    ],
    connections: [],
  }) as unknown as GraphData;

async function panel(): Promise<ShadowRoot> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("feature-level", "advanced");
  editor.style.cssText = "display: block; width: 1200px; height: 700px;";
  document.body.append(editor);

  editor.graph = guide();
  await settle();
  await settle();

  const node = editor.shadowRoot
    ?.querySelector("node-editor")
    ?.shadowRoot?.querySelector("flow-node")
    ?.shadowRoot?.querySelector<HTMLElement>(".flow-node");

  node?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, composed: true }));
  node?.click();
  await settle();
  await settle();

  return editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;
}

const section = (root: ShadowRoot): HTMLElement | null =>
  root.querySelector<HTMLElement>('[data-property-section="validation"]');

const propertiesIn = (element: HTMLElement | null): string[] =>
  [...(element?.querySelectorAll<HTMLElement>("[data-property]") ?? [])].map(
    (one) => one.dataset.property ?? "",
  );

describe("the validation section", () => {
  test("exists, with a heading of its own", async () => {
    const root = await panel();

    expect(section(root)).toBeTruthy();
    expect(section(root)?.textContent).toMatch(/validering/i);
  });

  test("holds the rules about the answer", async () => {
    const inside = propertiesIn(section(await panel()));

    expect(inside).toContain("required");
    expect(inside).toContain("minLength");
    expect(inside).toContain("maxLength");
    expect(inside).toContain("format");
  });

  test("leaves everything else where it was", async () => {
    const root = await panel();
    const inside = propertiesIn(section(root));

    // The title and the variable are not rules about the answer, and moving
    // them under a heading called Validering would be worse than not grouping.
    expect(inside).not.toContain("title");
    expect(inside).not.toContain("variableName");
    expect(inside).not.toContain("description");
  });

  test("puts the pattern last, after everything that can explain itself", async () => {
    const inside = propertiesIn(section(await panel()));

    expect(inside.at(-1)).toBe("pattern");
  });

  test("says the pattern is a last resort, where somebody will read it", async () => {
    const root = await panel();
    /*
     * The whole field, not the input: `data-property` sits on the control and
     * the description is its sibling. Reading the input's own text would have
     * measured an empty string and passed for nothing.
     */
    const pattern = section(root)
      ?.querySelector<HTMLElement>('[data-property="pattern"]')
      ?.closest<HTMLElement>(".properties-panel__field");

    // The reason has to sit beside the control. A rule written down in a
    // document is a rule nobody applies at the moment they are choosing.
    expect(pattern?.textContent).toMatch(/sista utvägen|last resort/i);
  });
});
