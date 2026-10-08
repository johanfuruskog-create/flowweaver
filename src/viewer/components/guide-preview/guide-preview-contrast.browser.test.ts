import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";
import { kontrastbrott } from "../../../testing/contrast";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Colour contrast in what the resident meets, in both themes.
 *
 * `tokens.scss` carries traces of a review done by hand — "AA-audit: 2.96 →
 * 3.75". It held on the day it was done. A token changed six months later knows
 * nothing about it, and **K3** promises accessibility. The measurement therefore
 * lives in the code rather than in a comment.
 */

function graf(): GraphData {
  return {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Bor du i kommunen?" },
          description: { sv: "Svaret avgör vilka regler som gäller." },
          variableName: "bor",
          options: [
            { id: "ja", label: { sv: "Ja" }, value: "ja" },
            { id: "nej", label: { sv: "Nej" }, value: "nej" },
          ],
        },
      },
      {
        id: "t",
        type: "text-question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Din e-postadress" },
          variableName: "epost",
          placeholder: { sv: "namn@exempel.se" },
          required: true,
        },
      },
      {
        id: "r",
        type: "result",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Du kan ansöka" },
          description: { sv: "Handläggningstiden är cirka sex veckor." },
        },
      },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q", portId: "ja" }, to: { nodeId: "t", portId: "input" } },
      { id: "c2", from: { nodeId: "t", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  };
}

afterEach(() => document.body.replaceChildren());

function montera(tema?: "dark"): GuidePreview {
  const preview = document.createElement("guide-preview") as GuidePreview;

  /*
   * On the element, because that is the only place the viewer looks.
   *
   * This used to set `document.documentElement.dataset.theme`, which the viewer
   * ignores — its tokens hang off `data-fw-theme` on itself, deliberately, so an
   * embedded viewer cannot recolour a host page that uses `data-theme` for its
   * own purposes. The component's own comment says so in as many words.
   *
   * So for as long as this file has existed it has measured the light theme
   * twice and reported it as two. Found while sweeping for 1.4.11: the probe
   * printed `--fw-surface` and it was `#ffffff` under the heading "mörkt". An
   * accessibility gate that names a theme it never enters is worse than one that
   * admits it only covers the other.
   */
  if (tema) {
    preview.theme = tema;
  }

  preview.style.cssText = "display: block; width: 600px;";
  document.body.append(preview);
  preview.graph = graf();
  return preview;
}

function vidare(preview: GuidePreview): void {
  preview.shadowRoot
    ?.querySelector<HTMLInputElement>('input[type="radio"]')
    ?.click();
  preview.shadowRoot
    ?.querySelector<HTMLButtonElement>('[data-action="next"]')
    ?.click();
}

describe.each([["ljust", undefined], ["mörkt", "dark" as const]])(
  "visaren i %s tema",
  (_namn, tema) => {
    test("the question meets AA", () => {
      expect(kontrastbrott(montera(tema).shadowRoot!)).toEqual([]);
    });

    test("the text field meets AA", () => {
      const preview = montera(tema);
      vidare(preview);

      expect(kontrastbrott(preview.shadowRoot!)).toEqual([]);
    });

    // Validation errors are the most important thing to be able to read, and
    // the thing most often drawn in a colour chosen to be noticed rather than
    // to be read.
    test("the validation error meets AA", () => {
      const preview = montera(tema);
      vidare(preview);
      preview.shadowRoot
        ?.querySelector<HTMLButtonElement>('[data-action="next"]')
        ?.click();

      expect(kontrastbrott(preview.shadowRoot!)).toEqual([]);
    });

    test("the result meets AA", () => {
      const preview = montera(tema);
      vidare(preview);
      preview.shadowRoot
        ?.querySelector<HTMLInputElement>('input[type="text"], input:not([type])')
        ?.setAttribute("value", "namn@exempel.se");
      const field = preview.shadowRoot?.querySelector<HTMLInputElement>("input");
      if (field) {
        field.value = "namn@exempel.se";
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
      preview.shadowRoot
        ?.querySelector<HTMLButtonElement>('[data-action="next"]')
        ?.click();

      expect(kontrastbrott(preview.shadowRoot!)).toEqual([]);
    });
  },
);
