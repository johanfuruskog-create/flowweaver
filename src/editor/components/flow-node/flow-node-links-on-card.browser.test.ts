import { afterEach, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./flow-node";

import type { FlowNode } from "./flow-node";

/**
 * A link in a description shows as its label on the card, not as markdown.
 *
 * The three guides once imported from a real agency (`examples/imported/`, removed 7/10 by decision 8) carried
 * their links as `[Ansök om uppehållstillstånd](/du-vill-ansoka/…/uppehallstillstand.html)`,
 * and the card printed all of it — an address nobody reads, eight lines
 * where the visitor sees four. The card now draws the text through the same
 * renderer as the visitor's view, so a link is its label, bold is bold.
 *
 * Inert, though: a click on the canvas selects the node, it never navigates.
 * An `<a>` without `href` is the platform's own word for that — not
 * focusable, not clickable, a "placeholder link" in the spec — so the test
 * asks for the tag and refuses the attribute.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function mount(description: string): FlowNode {
  const element = document.createElement("flow-node") as FlowNode;
  element.setAttribute("active-locale", "sv");
  element.nodeData = {
    id: "r",
    type: "result",
    position: { x: 0, y: 0 },
    data: { title: { sv: "Svar" }, description: { sv: description } },
  } as never;
  document.body.append(element);
  return element;
}

test("länken visas som sin etikett, utan adress och utan href", async () => {
  const element = mount(
    "Läs mer: [Ansök om uppehållstillstånd](/du-vill-ansoka/studera/doktorandstudier.html).",
  );
  await settle();

  const description = element.shadowRoot!.querySelector(".flow-node__description")!;
  expect(description.textContent!.replace(/\s+/g, " ").trim()).toBe(
    "Läs mer: Ansök om uppehållstillstånd.",
  );

  const link = description.querySelector("a");
  expect(link, "en <a> för etiketten").not.toBeNull();
  expect(link!.hasAttribute("href"), "ingen adress på canvasen").toBe(false);
  // Underlined like a link — the editor should see that it is one.
  expect(getComputedStyle(link!).textDecorationLine).toContain("underline");
});

test("fet och variabel följer med, och markup i texten förblir text", async () => {
  const element = mount("**Viktigt**: {{namn}} <b>rå</b>");
  await settle();

  const description = element.shadowRoot!.querySelector(".flow-node__description")!;
  expect(description.querySelector("strong")?.textContent).toBe("Viktigt");
  // The variable is still the dashed gap the card has drawn since story 077.
  expect(description.querySelector(".flow-node__variable-gap")).not.toBeNull();
  // Escaped, not interpreted.
  expect(description.querySelector("b")).toBeNull();
  expect(description.textContent).toContain("<b>rå</b>");
});
