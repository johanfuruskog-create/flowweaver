// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { withPro } from "../../../testing/optional-pro";
const PRO = await withPro("index.ts");
import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../../viewer/node-types/default-node-types";
import "./properties-panel";

import type { PropertiesPanel } from "./properties-panel";
import type { RichTextField } from "../rich-text-field/rich-text-field";

/**
 * Story 092 — the editor draws the row the errand is in the receiver's
 * list, on the submission node. Columns are added, removed and ordered as
 * calculation rows are; the first is the title and stays first; the cell
 * takes variables from the same button and bold/italic from the same
 * toolbar as the mail body.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const VARIABLER = [
  { label: "Ditt namn", value: "namn", type: "text", options: [] },
  { label: "Adress", value: "adress", type: "text", options: [] },
];

function panelWith(data: Record<string, unknown>): { panel: PropertiesPanel; changes: Array<{ property: string; value: unknown }> } {
  const panel = document.createElement("properties-panel") as PropertiesPanel;
  const changes: Array<{ property: string; value: unknown }> = [];

  panel.editorMode = "administrator";
  document.body.append(panel);
  panel.variableOptions = VARIABLER as never;
  panel.nodeData = { id: "n", type: "submit-result", position: { x: 0, y: 0 }, data: { title: "Tack", ...data } } as never;
  panel.addEventListener("node-data-changed", (event) => {
    const detail = (event as CustomEvent<{ property: string; value: unknown }>).detail;
    changes.push({ property: detail.property, value: detail.value });
  });

  return { panel, changes };
}

const root = (panel: PropertiesPanel) => panel.shadowRoot!;
const lastRow = (changes: Array<{ property: string; value: unknown }>) =>
  changes.filter((change) => change.property === "row").at(-1)?.value as Array<{ id: string; label: unknown; cell: unknown }> | undefined;

describe.runIf(PRO)("raddesignern på Inlämning", () => {
  test("en ny kolumn läggs till och når noden med rubrik och cell", async () => {
    const { panel, changes } = panelWith({});

    expect(root(panel).querySelectorAll("[data-column-id]")).toHaveLength(0);
    await userEvent.click(root(panel).querySelector<HTMLButtonElement>('[data-action="add-column"]')!);
    await settle();

    const section = root(panel).querySelector<HTMLElement>("[data-column-id]")!;
    expect(section, "kolumnen ritas").not.toBeNull();
    expect(section.querySelector("strong")?.textContent?.trim()).toBe("Kolumn 1 — Titel");

    const heading = section.querySelector<HTMLInputElement>('[data-column-property="label"]')!;
    heading.value = "Titel";
    heading.dispatchEvent(new Event("input", { bubbles: true }));
    const cell = section.querySelector<HTMLTextAreaElement>('[data-column-property="cell"]')!;
    cell.value = "{{namn}}";
    cell.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();

    expect(lastRow(changes)).toEqual([{ id: section.dataset.columnId, label: "Titel", cell: "{{namn}}" }]);
  });

  test("första kolumnen är titeln och kan inte flyttas; den andra kan inte upp", async () => {
    const { panel } = panelWith({
      row: [
        { id: "t", label: "Titel", cell: "{{namn}}" },
        { id: "a", label: "Adress", cell: "{{adress}}" },
        { id: "b", label: "Övrigt", cell: "" },
      ],
    });
    const buttons = (id: string) => ({
      up: root(panel).querySelector<HTMLButtonElement>(`[data-column-id="${id}"] [data-action="move-column-up"]`)!,
      down: root(panel).querySelector<HTMLButtonElement>(`[data-column-id="${id}"] [data-action="move-column-down"]`)!,
    });

    expect(buttons("t").up.disabled && buttons("t").down.disabled, "titeln sitter fast").toBe(true);
    expect(buttons("a").up.disabled, "ingen flyttas ovanför titeln").toBe(true);
    expect(buttons("a").down.disabled).toBe(false);
    expect(buttons("b").up.disabled).toBe(false);
  });

  test("variabelknappen och fet/kursiv verkar i cellen", async () => {
    const { panel, changes } = panelWith({ row: [{ id: "t", label: "Titel", cell: "Ärende" }] });
    // A one-line `<rich-text-field>` since story 136: bold shows as bold, the answer as a chip.
    const cell = root(panel).querySelector<RichTextField>('[data-field-id="row-cell-t"]')!;
    const inner = cell.shadowRoot!;

    inner.querySelector<HTMLElement>("[data-text]")!.focus();
    await userEvent.keyboard("{End}{Shift>}{Home}{/Shift}");
    await userEvent.click(inner.querySelector<HTMLButtonElement>('[data-command="bold"]')!);
    await settle();
    expect(cell.value).toBe("**Ärende**");

    await userEvent.keyboard("{End}");
    await userEvent.click(inner.querySelector<HTMLButtonElement>("[data-answer-toggle]")!);
    await userEvent.click(inner.querySelector<HTMLButtonElement>('[data-insert="namn"]')!);
    await settle();

    // Inserted where bold ends, the answer is bold too — as a typed letter would be.
    expect(cell.value).toBe("**Ärende{{namn}}**");
    expect(lastRow(changes)?.[0]?.cell).toBe("**Ärende{{namn}}**");
  });

  test("cellerna håller sig inom panelens bredd", async () => {
    /*
     * Measured 25/9 on the claim example: the one-line rich cells made the
     * column section 694 px wide in a 343 px panel, and the panel scrolled
     * sideways. The panel is given the width it has in the editor.
     */
    const { panel } = panelWith({ row: [{ id: "t", label: "Belopp", cell: "{{namn}} kr, varav {{adress}} kr efter självrisk och avgifter" }] });

    panel.style.cssText = "display: block; width: 360px; height: 600px;";
    await settle();
    const content = root(panel).querySelector<HTMLElement>(".properties-panel__content")!;

    expect(root(panel).querySelector("rich-text-field[data-field-id]"), "cellen är det nya fältet").not.toBeNull();
    expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth);
  });

  test("ta bort kolumnen tar bort den ur noden", async () => {
    const { panel, changes } = panelWith({
      row: [{ id: "t", label: "Titel", cell: "{{namn}}" }, { id: "a", label: "Adress", cell: "{{adress}}" }],
    });

    await userEvent.click(root(panel).querySelector<HTMLButtonElement>('[data-column-id="a"] [data-action="remove-column"]')!);
    await settle();

    expect(lastRow(changes)?.map((column) => column.id)).toEqual(["t"]);
    expect(root(panel).querySelectorAll("[data-column-id]")).toHaveLength(1);
  });
});
