import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./node-editor";

import { pageBuilderExampleGraph } from "../../../data/page-builder-example-graph";

import type { NodeEditor } from "./node-editor";
import type { FlowNode } from "../flow-node/flow-node";

/**
 * A page drawing the visitor's view is not also a drop area.
 *
 * ## The fault this is written from
 *
 * The page surface — the dashed frame the fields are dropped into, its tinted
 * background and the "Släpp fält här" label — is a layer of its own at
 * `z-index: 2`, above the page node. With the eye lit on page two of
 * `page-builder` it lay across the drawn form: the fields showed through a
 * `rgb(238 242 255 / 55%)` wash inside a dashed border, and the radio group
 * *Kontaktväg* was cut off by the frame's top edge.
 *
 * The rule is the one read-only already follows: **what shows is the page's
 * content, not an invitation.** With the eye lit there is nothing to drop into
 * either, because what is drawn is the form and not the field cards.
 */

afterEach(() => document.body.replaceChildren());

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

function mount(): NodeEditor {
  const editor = document.createElement("node-editor") as NodeEditor;

  editor.editorMode = "administrator";
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = structuredClone(pageBuilderExampleGraph);
  return editor;
}

function page(editor: NodeEditor): FlowNode {
  const found = [
    ...(editor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []),
  ].find((element) => element.nodeId === "service-contact-page");

  if (!found) throw new Error("sidnoden saknas");
  return found;
}

function surface(editor: NodeEditor): HTMLElement {
  const found = editor.shadowRoot?.querySelector<HTMLElement>(
    '.node-editor__page-surface[data-page-id="service-contact-page"]',
  );

  if (!found) throw new Error("sidytan saknas");
  return found;
}

describe("sidytan med tänt öga", () => {
  test("ramen, hinten och insättningslinjen ritas inte", async () => {
    const editor = mount();
    await settle();

    const drawn = surface(editor);

    expect(getComputedStyle(drawn, "::before").display).not.toBe("none");

    page(editor).shadowRoot!
      .querySelector<HTMLButtonElement>("[data-visitor-toggle]")!
      .click();
    await settle();
    await settle();

    expect(getComputedStyle(drawn, "::before").display).toBe("none");
    expect(
      getComputedStyle(
        drawn.querySelector<HTMLElement>(".node-editor__page-drop-hint")!,
      ).display,
    ).toBe("none");
    expect(
      getComputedStyle(
        drawn.querySelector<HTMLElement>(".node-editor__page-insertion")!,
      ).display,
    ).toBe("none");
  });

  test("inget ligger över det första fältet i förhandsvyn", async () => {
    const editor = mount();
    await settle();

    /*
     * Den testade sidan (`service-contact-page`) ligger 1180 canvas-px till
     * höger om startnoden, som sedan Uppdrag 23/9 punkt 1 är vad startvyn
     * visar — inte grafens hela vidd. Utan den här centreringen sticker fältet
     * ut till höger om den 1400 px breda editorn, och punkten som testas hamnar
     * utanför hela sidan (inte bara utanför noden), vilket inte är det den här
     * kontrollen prövar.
     */
    editor.centerNodeById("service-contact-page");
    await settle();

    const node = page(editor);

    node.shadowRoot!
      .querySelector<HTMLButtonElement>("[data-visitor-toggle]")!
      .click();
    await settle();
    await settle();

    const field = node.shadowRoot!
      .querySelector("[data-visitor-preview]")!
      .shadowRoot!.querySelector<HTMLElement>(
        '[data-page-field-id="service-contact-method"]',
      )!;
    const box = field.getBoundingClientRect();
    const hit = editor.shadowRoot!.elementFromPoint(
      Math.round(box.left + box.width / 2),
      Math.round(box.top + box.height / 2),
    );

    /*
     * This one does not discriminate on its own today: the surface carries
     * `pointer-events: none`, so hit testing walks past it whether the frame is
     * drawn or not. It is here because the fault was reported as a hit on the
     * surface, and a rule that ever turns the pointer back on must not do it
     * over a drawn form. What actually bites is the case above.
     */
    expect(box.height).toBeGreaterThan(0);
    expect(hit?.closest(".node-editor__page-surface")).toBeNull();
  });
});
