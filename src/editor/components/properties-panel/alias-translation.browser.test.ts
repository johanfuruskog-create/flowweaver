import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./properties-panel";

import type { PropertiesPanel } from "./properties-panel";
import type { NodeDataChangedDetail } from "../../types/events";

/**
 * Story 080: the alias is translatable, like the title. In translation mode
 * the panel shows the source alias as the placeholder and saves the new
 * language BESIDE it. Before this, the alias field wrote a plain string over
 * the `{ sv, en }` map — the English vanished with nobody seeing it.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 100) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("aliaset i översättningsläge", () => {
  test("källan står som platshållare och det nya språket sparas bredvid", async () => {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    const changes: NodeDataChangedDetail[] = [];

    panel.editorMode = "administrator";
    document.body.append(panel);
    panel.sourceLocale = "sv";
    panel.activeLocale = "en";
    panel.nodeData = {
      id: "q1",
      type: "number-question",
      position: { x: 0, y: 0 },
      data: { title: { sv: "Månadsinkomst?", en: "Monthly income?" }, variableName: "income", variableLabel: "Månadsinkomst" },
    } as never;
    panel.addEventListener("node-data-changed", (event) => changes.push((event as CustomEvent<NodeDataChangedDetail>).detail));
    await settle();

    const field = panel.shadowRoot!.querySelector<HTMLInputElement>('[data-property="variableLabel"]')!;

    expect(field.disabled, "fältet är öppet i översättningsläge").toBe(false);
    expect(field.placeholder).toBe("Månadsinkomst");
    expect(field.value).toBe("");

    field.value = "Monthly income";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();

    expect(changes.at(-1)?.value).toEqual({ sv: "Månadsinkomst", en: "Monthly income" });
  });
});
