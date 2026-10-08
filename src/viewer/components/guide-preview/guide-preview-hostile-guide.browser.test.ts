import { afterEach, beforeEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * A guide written by somebody who means harm.
 *
 * ## Why this is the threat that matters
 *
 * A guide is data, and it arrives from places nobody vetted: an editor imports
 * a JSON a colleague sent, a guide is copied between installations, an account
 * is borrowed. The person who wrote the content and the person who reads it are
 * not the same person, and the second one is a resident asking about their
 * benefits.
 *
 * So every field an author controls is treated here as an attack: the title,
 * the description, the options, the captions, the image address, the button
 * text, and the viewer's own strings, which a guide may override.
 *
 * ## Why a flag rather than a look at the markup
 *
 * Reading the HTML and deciding it looks safe is the same mistake as counting
 * `escapeHtml` calls and concluding they are in the right places. The payloads
 * here *set a variable* if they ever run. The assertion is that the variable is
 * still false — which no amount of clever escaping can fake.
 *
 * ## What this does not cover
 *
 * The editor, the Sitevision module, and anything a host does with the answers
 * afterwards. This is the viewer's own promise: content in, no execution.
 */

declare global {
  interface Window {
    __flowweaverPwned?: boolean;
  }
}

/** Every shape that runs something, if the page lets it. */
const PAYLOADS = {
  script: '<script>window.__flowweaverPwned = true;<\/script>',
  breakout: '"><img src=x onerror="window.__flowweaverPwned = true">',
  handler: "<img src=x onerror='window.__flowweaverPwned = true'>",
  svg: "<svg onload=\"window.__flowweaverPwned = true\"></svg>",
  link: "[Klicka](javascript:window.__flowweaverPwned = true)",
  closing: "</h2><script>window.__flowweaverPwned = true;<\/script><h2>",
};

const hostile = (): GraphData =>
  ({
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: PAYLOADS.script,
          description: PAYLOADS.link,
          variableName: "svar",
          options: [
            { id: "a", label: PAYLOADS.breakout, value: "a" },
            { id: "b", label: PAYLOADS.handler, value: "b" },
          ],
        },
      },
      {
        id: "picture",
        type: "image",
        position: { x: 0, y: 0 },
        data: {
          title: PAYLOADS.closing,
          // An address is a string like any other, and an author picks it.
          imageUrl: 'x" onerror="window.__flowweaverPwned = true',
          alt: PAYLOADS.svg,
          caption: PAYLOADS.breakout,
        },
      },
      {
        id: "done",
        type: "result",
        position: { x: 0, y: 0 },
        data: { title: PAYLOADS.handler, description: PAYLOADS.script },
      },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q", portId: "a" }, to: { nodeId: "picture", portId: "input" } },
      { id: "c2", from: { nodeId: "picture", portId: "continue" }, to: { nodeId: "done", portId: "input" } },
    ],
    settings: {
      /*
       * The viewer's own words, which a guide is allowed to override. It is the
       * least obvious way in and therefore worth naming: a host that trusted
       * these would be handing an author the frame around the content as well
       * as the content.
       */
      strings: {
        "nav.next": { sv: PAYLOADS.breakout },
        "validation.selectOption": { sv: PAYLOADS.script },
      },
    },
  }) as unknown as GraphData;

afterEach(() => {
  document.body.replaceChildren();
  delete window.__flowweaverPwned;
});

beforeEach(() => {
  window.__flowweaverPwned = false;
});

function mount(): GuidePreview {
  const preview = document.createElement("guide-preview") as GuidePreview;

  document.body.append(preview);
  preview.graph = hostile();
  return preview;
}

/** Everything rendered, shadow roots and all. */
function everything(preview: GuidePreview): Element[] {
  const found: Element[] = [];
  const walk = (root: ParentNode) => {
    for (const element of root.querySelectorAll("*")) {
      found.push(element);
      if (element.shadowRoot) {
        walk(element.shadowRoot);
      }
    }
  };

  walk(preview.shadowRoot ?? preview);
  return found;
}

describe("a guide that tries to run something", () => {
  test("nothing executes while it is rendered", async () => {
    mount();

    // A payload that runs sets this. Escaping cannot fake it staying false.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(window.__flowweaverPwned).toBe(false);
  });

  test("no script element is created, anywhere", () => {
    const preview = mount();

    expect(everything(preview).filter((el) => el.tagName === "SCRIPT")).toHaveLength(0);
  });

  test("no element carries an inline event handler", () => {
    const preview = mount();

    const handlers = everything(preview).flatMap((element) =>
      [...element.attributes]
        .filter((attribute) => attribute.name.startsWith("on"))
        .map((attribute) => `${element.tagName}[${attribute.name}]`),
    );

    // `onerror` on an image is the payload that survives most escaping
    // mistakes, because the attribute needs no click and no script tag.
    expect(handlers).toEqual([]);
  });

  test("no link points at a script", () => {
    const preview = mount();

    const hrefs = everything(preview)
      .filter((element): element is HTMLAnchorElement => element.tagName === "A")
      .map((anchor) => anchor.getAttribute("href") ?? "");

    expect(hrefs.filter((href) => /^\s*javascript:/i.test(href))).toEqual([]);
  });

  test("the payload is shown as text, which is the point", () => {
    const preview = mount();
    const shown = preview.shadowRoot?.textContent ?? "";

    /*
     * Escaped rather than stripped. A viewer that silently removed what it did
     * not like would leave an author unable to see that their heading was
     * mangled — and would hide a real attack from whoever reviews the guide.
     */
    expect(shown).toContain("<script>");
  });

  test("stepping through it runs nothing either", async () => {
    const preview = mount();
    const scripts = () => everything(preview).filter((el) => el.tagName === "SCRIPT");

    preview.shadowRoot?.querySelector<HTMLInputElement>("input[type=radio]")?.click();
    preview.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="next"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    /*
     * Standing on the image node, and proving it before claiming anything.
     *
     * Each node carries its own payloads and none of them is rendered until
     * somebody walks there — so a step that silently failed would leave every
     * assertion true about a page that was never shown. The first version of
     * this test stepped twice and asserted once, which meant it checked the
     * result page and never looked at the image node at all.
     */
    expect(everything(preview).some((el) => el.tagName === "IMG")).toBe(true);
    expect(window.__flowweaverPwned).toBe(false);
    expect(scripts()).toHaveLength(0);

    preview.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="next"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // And on the result, whose title and description are payloads of their own.
    expect(preview.shadowRoot?.textContent ?? "").toContain("<img src=x");
    expect(window.__flowweaverPwned).toBe(false);
    expect(scripts()).toHaveLength(0);
  });
});
