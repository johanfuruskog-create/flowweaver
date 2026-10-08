import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { uniqueAcrossRepeatsGraph } from "../../../data/unique-across-repeats-graph";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Berättelse 138, kriterium 1: *Varje upprepning ska välja olika* finns på
 * frågans egenskaper bara när frågan sitter på en sida som upprepas. På en
 * vanlig sida betyder den ingenting, och en ruta som inte gör något är en
 * ruta att undra över.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function panelFor(graph: GraphData, nodeId: string): Promise<ShadowRoot> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1300px; height: 900px;";
  document.body.append(editor);
  editor.graph = structuredClone(graph) as never;
  await settle();
  await settle();

  (
    editor.shadowRoot!.querySelector("node-editor") as unknown as { selectNodeById?(id: string): void }
  ).selectNodeById?.(nodeId);
  await settle();
  await settle();

  const panel = editor.shadowRoot!.querySelector("properties-panel");
  if (!panel?.shadowRoot) throw new Error("properties-panel saknas.");
  return panel.shadowRoot;
}

const setting = (root: ShadowRoot) => root.querySelector<HTMLInputElement>('[data-property="uniqueAcrossRepeats"]');

describe("inställningen i panelen (berättelse 138, kriterium 1)", () => {
  test("en fråga på en upprepad sida har den, med redaktörens ord", async () => {
    const root = await panelFor(uniqueAcrossRepeatsGraph, "unique-time");

    expect(setting(root), "inställningen saknas").not.toBeNull();
    expect(setting(root)!.checked).toBe(true);
    expect(setting(root)!.closest("label")?.textContent).toContain("Varje upprepning ska välja olika");
  });

  test("av som standard: lunchen har den, urkryssad", async () => {
    const root = await panelFor(uniqueAcrossRepeatsGraph, "unique-lunch");

    expect(setting(root)?.checked).toBe(false);
  });

  test("textfältet har den också", async () => {
    expect(setting(await panelFor(uniqueAcrossRepeatsGraph, "unique-name"))).not.toBeNull();
  });

  test("hjälpraden efter frågetyp, Astras ord (29/9)", async () => {
    const help = (root: ShadowRoot) =>
      setting(root)?.closest(".properties-panel__field")?.querySelector(".properties-panel__help")?.textContent?.trim();

    expect(help(await panelFor(uniqueAcrossRepeatsGraph, "unique-time"))).toBe(
      "Alternativ som valts i en upprepning döljs i de andra.",
    );
    expect(help(await panelFor(uniqueAcrossRepeatsGraph, "unique-name"))).toBe(
      "Samma svar får inte anges i flera upprepningar.",
    );
  });

  test("formen (Fia 29/9): reglaget står med samma luft ovanför på textfrågan som på valfrågan", async () => {
    const above = (root: ShadowRoot) => {
      const field = setting(root)!.closest<HTMLElement>(".properties-panel__field")!;
      return field.getBoundingClientRect().top - field.previousElementSibling!.getBoundingClientRect().bottom;
    };

    // 12, not 20: since B7 (Astra 1/10 2026, bilaga 11) a group's fields
    // stand 12 apart and groups 24. On the choice question the setting sits
    // with the answers, on the text question in Validering — inside a group
    // on both, so the same 12 above it.
    const choice = above(await panelFor(uniqueAcrossRepeatsGraph, "unique-time"));
    expect(choice).toBe(12);
    expect(above(await panelFor(uniqueAcrossRepeatsGraph, "unique-name")), "textfrågans valideringsavsnitt").toBe(choice);
  });

  test("formen (Astra 29/9): reglagets etikett i meningsstil, samma typografi som Villkorsstyrd synlighet", async () => {
    const root = await panelFor(uniqueAcrossRepeatsGraph, "unique-time");
    const typography = (element: Element) => {
      const style = getComputedStyle(element);
      return [style.textTransform, style.fontWeight, style.fontSize, style.letterSpacing, style.color];
    };
    const unique = setting(root)!.closest("label")!;
    const visibility = root.querySelector('[data-visibility-property="enabled"]')!.closest("label")!.querySelector("span")!;

    expect(getComputedStyle(unique).textTransform).toBe("none");
    expect(getComputedStyle(unique).fontWeight).toBe("600");
    expect(typography(visibility), "samma form som Villkorsstyrd synlighet").toEqual(typography(unique));

    // Storleken och vikten är alternativkortets etiketters (ledaren 29/9).
    const cardLabel = root.querySelector('[data-option-property="value"]')!.closest("label")!;
    expect([getComputedStyle(unique).fontSize, getComputedStyle(unique).fontWeight], "som kortens etiketter").toEqual([
      getComputedStyle(cardLabel).fontSize,
      getComputedStyle(cardLabel).fontWeight,
    ]);
  });

  test("formen (ledaren 29/9): Ny rad före och kortens Villkorsstyrd synlighet har reglagens form", async () => {
    const root = await panelFor(uniqueAcrossRepeatsGraph, "unique-time");
    const typography = (element: Element) => {
      const style = getComputedStyle(element);
      return [style.textTransform, style.fontWeight, style.fontSize, style.letterSpacing, style.color];
    };
    const unique = typography(setting(root)!.closest("label")!);
    const breakBefore = root.querySelector('[data-layout-break-before]')!.closest("label")!;

    expect(typography(breakBefore.querySelector("span")!), "Ny rad före").toEqual(unique);

    const card = root.querySelector('[data-option-visibility-property="enabled"]')!.closest("label")!;
    expect(typography(card), "kortets Villkorsstyrd synlighet").toEqual(unique);
    // Kortets övriga etiketter står kvar: strong, samma storlek.
    const cardLabel = root.querySelector('[data-option-property="value"]')!.closest("label")!;
    expect(typography(cardLabel).slice(0, 3)).toEqual(["none", "600", "14px"]);
  });

  test("på en sida som inte upprepas visas den inte", async () => {
    const plain = structuredClone(uniqueAcrossRepeatsGraph);
    plain.nodes.find((node) => node.id === "unique-page")!.data.repeats = false;

    expect(setting(await panelFor(plain, "unique-lunch"))).toBeNull();
  });
});
