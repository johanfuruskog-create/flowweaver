import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Trying the rules out, in the panel, on a value you type.
 *
 * ## The failure this answers
 *
 * The way validation goes wrong is not that an editor misunderstands a setting.
 * It is that they believe a setting does something it does not — and nothing in
 * the panel can tell them otherwise, because a setting looks the same whether or
 * not anything reads it.
 *
 * That is not a worry. It happened here: `format` was never carried on to fields
 * inside a page, so an editor could choose *Personnummer*, see it sit there, and
 * never learn that it was not applied. A box that answers "godkänns" for
 * `12a45` would have said so in one keystroke.
 *
 * ## Why it must use the same code as the viewer
 *
 * A second implementation that agrees today is a second implementation that
 * disagrees later, and the one somebody trusts is the one in front of them. So
 * this asks `PageFieldValidationService` — the service the page itself asks —
 * and shows what it returns, message and all.
 *
 * ## Why the message and not a tick
 *
 * A tick says the value passed. The message is what a person will actually be
 * told, and it is the half nobody sees while building. Showing it turns
 * *"format: personnummer"* into *"Ange ett giltigt personnummer"* — which is the
 * thing to judge, and sometimes the thing to rewrite.
 */

afterEach(() => document.body.replaceChildren());

const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ),
  );

const guide = (data: Record<string, unknown>): GraphData =>
  ({
    startNodeId: "t",
    settings: { sourceLocale: "sv" },
    nodes: [
      {
        id: "t",
        type: "text-question",
        position: { x: 40, y: 40 },
        data: { title: { sv: "Ditt namn" }, variableName: "namn", ...data },
      },
    ],
    connections: [],
  }) as unknown as GraphData;

async function panel(data: Record<string, unknown> = {}): Promise<ShadowRoot> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("feature-level", "advanced");
  editor.style.cssText = "display: block; width: 1200px; height: 700px;";
  document.body.append(editor);

  editor.graph = guide(data);
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

const box = (root: ShadowRoot): HTMLInputElement | null =>
  root.querySelector<HTMLInputElement>("[data-validation-tryout]");

const verdict = (root: ShadowRoot): string =>
  root.querySelector<HTMLElement>("[data-validation-verdict]")?.textContent?.trim() ?? "";

async function tryOut(root: ShadowRoot, value: string): Promise<string> {
  const input = box(root);

  if (!input) return "ingen prövningsruta";

  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();

  return verdict(root);
}

describe("the try-it box", () => {
  test("sits in the validation section, where the rules are", async () => {
    const root = await panel({ format: "personnummer" });
    const section = root.querySelector('[data-property-section="validation"]');

    expect(section?.querySelector("[data-validation-tryout]")).toBeTruthy();
  });

  test("is not there when the field has no rules to try", async () => {
    /*
     * A box on a field with nothing to check would answer "godkänns" to
     * everything — teaching exactly the opposite of what it exists for, and
     * teaching it convincingly. Checked by mutation: without the guard, sixty
     * panel tests still passed.
     */
    const root = await panel();

    expect(box(root)).toBeNull();
  });

  test("appears as soon as there is one", async () => {
    expect(box(await panel({ required: true }))).toBeTruthy();
  });

  test("says nothing until something is typed", async () => {
    // An empty box that already claims a verdict is a verdict about nothing.
    const root = await panel({ format: "personnummer" });

    expect(verdict(root)).toBe("");
  });
});

describe("what it answers", () => {
  test("accepts a value that keeps the rules", async () => {
    const root = await panel({ format: "personnummer" });

    expect(await tryOut(root, "19900101-0017")).toMatch(/godkänns/i);
  });

  test("shows the message a person would actually be told", async () => {
    const root = await panel({ format: "personnummer" });

    // Not a cross, and not "invalid": the sentence itself, which is the half
    // nobody sees while building and sometimes the half worth rewriting.
    expect(await tryOut(root, "19900101-0018")).toContain(
      "Ange ett giltigt personnummer",
    );
  });

  test("answers for the length rules too, not only the format", async () => {
    const root = await panel({ minLength: 5 });

    expect(await tryOut(root, "abc")).toMatch(/minst|least/i);
  });

  test("catches a pattern that does not do what its author thought", async () => {
    /*
     * The case the box exists for. A regex looks right in a panel and is wrong
     * about a real value, and there is no other way to find out but to ship it.
     */
    const root = await panel({ format: "regex", pattern: "^\\d{5}$" });

    expect(await tryOut(root, "123 45")).toMatch(/fel format|wrong format/i);
    expect(await tryOut(root, "12345")).toMatch(/godkänns/i);
  });
});

describe("what it does not do", () => {
  test("leaves the guide alone", async () => {
    const root = await panel({ format: "personnummer" });
    const editor = document.querySelector("guide-editor") as GuideEditor;

    await tryOut(root, "19900101-0018");

    // Typing into a test box must not become an answer, a default or a change
    // anybody has to save. It is a question asked of the rules, nothing more.
    expect(editor.getData().nodes[0]?.data.variableName).toBe("namn");
    expect(JSON.stringify(editor.getData().nodes[0]?.data)).not.toContain("19900101");
  });
});
