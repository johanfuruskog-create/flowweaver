import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./properties-panel";

import type { PropertiesPanel } from "./properties-panel";

/**
 * Del 4 (UPPDRAG-2026-09-28-ENHETLIGHET): flytta upp/ned vid ett
 * svarsalternativ (bild 75, 81, 107 i bildinventeringen) hade ingen egen
 * regel alls — mätt före ändringen: 22.7×21px, webbläsarens egen
 * `2px outset`-kant och grå UA-bakgrund, ett helt annat utseende än resten
 * av editorn. Under K6:s 44px-golv för en tät rad ikonknappar.
 *
 * Greppet (`.properties-panel__option-drag-handle`), samma rad och samma
 * jobb, växer med från 30 till 44px av samma skäl: tre kontroller som alla
 * ordnar om samma lista ska inte ha tre olika höjder.
 */

afterEach(() => document.body.replaceChildren());

function mount(): PropertiesPanel {
  const panel = document.createElement("properties-panel") as PropertiesPanel;

  panel.editorMode = "administrator";
  document.body.append(panel);
  panel.nodeData = {
    id: "q",
    type: "question",
    position: { x: 0, y: 0 },
    data: {
      title: "Vad gäller ärendet?",
      variableName: "amne",
      options: [
        { id: "a", label: "Bygglov", value: "bygglov" },
        { id: "b", label: "Avlopp", value: "avlopp" },
      ],
    },
  } as never;

  return panel;
}

const moveButton = (panel: PropertiesPanel, id: string, direction: "up" | "down") =>
  panel.shadowRoot!.querySelector<HTMLButtonElement>(
    `[data-action="move-option-${direction}"][data-option-id="${id}"]`,
  )!;

const dragHandle = (panel: PropertiesPanel, id: string) =>
  panel.shadowRoot!.querySelector<HTMLButtonElement>(
    `.properties-panel__option[data-option-id="${id}"] [data-action="drag-option"]`,
  )!;

describe("flytta upp/ned och greppet", () => {
  test("håller K6:s 44px-golv, alla tre", () => {
    const panel = mount();
    const controls = [
      moveButton(panel, "a", "down"),
      moveButton(panel, "b", "up"),
      dragHandle(panel, "a"),
    ];

    for (const control of controls) {
      const box = control.getBoundingClientRect();

      expect(box.width, `${control.dataset.action ?? "grepp"}: ${box.width}px bred`).toBeGreaterThanOrEqual(44);
      expect(box.height, `${control.dataset.action ?? "grepp"}: ${box.height}px hög`).toBeGreaterThanOrEqual(44);
    }
  });

  test("en inaktiverad knapp (redan först/sist) ser tydligt inaktiv ut, inte som en vilande", () => {
    const panel = mount();
    // Den första posten kan inte flyttas upp.
    const up = moveButton(panel, "a", "up");

    expect(up.disabled, "första alternativet ska ha upp-knappen inaktiverad").toBe(true);

    const active = moveButton(panel, "a", "down");
    const disabledColour = getComputedStyle(up).color;
    const activeColour = getComputedStyle(active).color;

    expect(disabledColour, "inaktiv ska inte se ut som vilande").not.toBe(activeColour);
  });

  test("har ett tillgängligt namn", () => {
    const panel = mount();

    expect(moveButton(panel, "a", "down").getAttribute("aria-label")).toBeTruthy();
    expect(moveButton(panel, "b", "up").getAttribute("aria-label")).toBeTruthy();
  });
});
