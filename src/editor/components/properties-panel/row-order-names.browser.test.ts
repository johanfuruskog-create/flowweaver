// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { withPro } from "../../../testing/optional-pro";
const PRO = await withPro("index.ts");
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./properties-panel";

import type { PropertiesPanel } from "./properties-panel";

/**
 * K4: the ↑ and ↓ beside a service call's response rows and a submission's
 * columns had the arrow as their only name — a screen reader said
 * "uppåtpil", twice per row, with nothing to say which row
 * (GRAFISK-PROFIL, avvikelse 6, measured 30/9). The option cards already
 * name theirs *Flytta Kök uppåt*; these take the same words, with the row's
 * heading as the thing moved.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function panelWith(type: string, data: Record<string, unknown>): ShadowRoot {
  const panel = document.createElement("properties-panel") as PropertiesPanel;
  panel.editorMode = "administrator";
  document.body.append(panel);
  panel.nodeData = { id: "n", type, position: { x: 0, y: 0 }, data: { title: "Nod", ...data } } as never;
  return panel.shadowRoot!;
}

/** Each arrow's name, next to the heading of the row it sits in. */
function arrows(root: ShadowRoot, rowSelector: string) {
  return [...root.querySelectorAll<HTMLElement>(rowSelector)].flatMap((row) => {
    const heading = row.querySelector(".properties-panel__option-header strong")!.textContent!.trim();
    return [...row.querySelectorAll<HTMLButtonElement>(".properties-panel__option-order button")].map((button) => ({
      heading,
      direction: button.dataset.action!.endsWith("-up") ? "uppåt" : "nedåt",
      name: button.getAttribute("aria-label") ?? "",
    }));
  });
}

describe("flyttpilarnas namn i panelens rader (K4)", () => {
  test("tjänsteanropets rader: namnet säger vilken rad och åt vilket håll", async () => {
    const root = panelWith("service-call", {
      responseMappings: [
        { id: "a", field: "maxLoan", variableName: "maxLan" },
        { id: "b", field: "rate", variableName: "ranta" },
      ],
    });
    await settle();

    const found = arrows(root, "[data-mapping-id]");
    expect(found).toHaveLength(4);
    for (const { heading, direction, name } of found) {
      expect(name).toContain(heading);
      expect(name).toContain(direction);
    }
  });

  test.runIf(PRO)("inlämningens kolumner: samma sak", async () => {
    const root = panelWith("submit-result", {
      row: [
        { id: "t", label: "Titel", cell: "Ärende" },
        { id: "a", label: "Adress", cell: "Gatan" },
        { id: "b", label: "Belopp", cell: "5 kr" },
      ],
    });
    await settle();

    const found = arrows(root, "[data-column-id]");
    expect(found).toHaveLength(6);
    for (const { heading, direction, name } of found) {
      expect(name).toContain(heading);
      expect(name).toContain(direction);
    }
  });
});
