import { userEvent } from "vitest/browser";
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { ruleCalcAstraGraph } from "../../../data/rule-calc-astra-graph";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Den tomma samlingens variant (grafiska profilen, Astra 30/9, bilaga 4).
 *
 * En regel utan regler och en fråga utan svarsalternativ visar en instruktion
 * och samma tilläggsknapp tonad i samlingens bredd. Med en regel är
 * ordningen regelkort → Lägg till regel → Annars; utan regler står
 * instruktionen där korten skulle stå: instruktion → Lägg till regel → Annars.
 * Den första delen gör knappen till konturknappen igen. Den tomma frågan
 * säger tomheten en gång: "0 alternativ" och dragtipset är borta.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function graphWith(edit: (graph: GraphData) => void): GraphData {
  const graph = structuredClone(ruleCalcAstraGraph);
  edit(graph);
  return graph;
}

const emptyRules = () =>
  graphWith((graph) => {
    graph.nodes.find((one) => one.id === "rc-rule")!.data.cases = [];
    graph.connections = graph.connections.filter((one) => one.from.nodeId !== "rc-rule" || one.from.portId === "default");
  });

const emptyQuestion = () =>
  graphWith((graph) => {
    graph.nodes.find((one) => one.id === "rc-housing")!.data.options = [];
  });

async function mount(nodeId: string, graph: GraphData): Promise<ShadowRoot> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1300px; height: 1400px;";
  document.body.append(editor);
  editor.graph = graph as never;
  await settle();
  await settle();
  (editor.shadowRoot!.querySelector("node-editor") as unknown as { selectNodeById(id: string): void }).selectNodeById(nodeId);
  await settle();
  await settle();

  return editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;
}

/*
 * Parks the real browser pointer on the panel's own aside, never a control
 * (measured 1/10, same mechanism as node-type-editor-remove-form.browser
 * .test.ts earlier today). The tinted add-button's resting edge
 * (`--fw-primary-border`) and its hovered edge (`--fw-primary`) are two
 * different colours by design (`properties-panel.scss`,
 * `.properties-panel__add-option--empty:hover`), and this fixture mounts
 * that button at the SAME screen coordinate on every run (a fixed 1300×1400
 * host, the same graph). A browser-mode `userEvent.click`/`.hover`
 * elsewhere in the suite moves the ACTUAL cursor and nothing moves it back
 * between tests — this file's own `afterEach` only clears the DOM — so a
 * button at that coordinate is born `:hover` the instant it renders there,
 * with no pointer event of its own, which these two tests' edge-colour
 * assertions read as a random failure depending on what ran immediately
 * before in the same worker. Reproduced directly: a prior test clicks the
 * button, then a fresh mount's "rest" reading comes back `rgb(79, 70, 229)`
 * (the hovered edge) instead of `rgb(199, 210, 254)` without the call below;
 * sett falla, and the exact message the flake reported.
 */
async function parkPointer(panel: ShadowRoot): Promise<void> {
  // The header, not the aside itself: a hover lands on the CENTRE of its
  // target, and the aside's centre can fall on the add-button it is meant
  // to stay off of (measured — the first attempt here did exactly that).
  await userEvent.hover(panel.querySelector<HTMLElement>(".properties-panel__header")!);
}

const EMPTY_RULES = "Inga regler har lagts till ännu. Lägg till den första regeln.";
const EMPTY_OPTIONS = "Frågan har inga svarsalternativ ännu. Lägg till det första.";

describe("den tomma samlingen: regel", () => {
  test("utan regler: instruktionen med Astras ordalydelse, sedan den tonade knappen, sedan Annars", async () => {
    const panel = await mount("rc-rule", emptyRules());
    await parkPointer(panel);
    const hint = panel.querySelector<HTMLElement>("[data-empty-hint]");
    const add = panel.querySelector<HTMLElement>('[data-action="add-rule-case"]')!;
    const otherwise = panel.querySelector<HTMLElement>("[data-rule-otherwise]")!;

    expect(hint?.textContent?.trim()).toBe(EMPTY_RULES);
    expect(hint!.nextElementSibling, "knappen direkt efter instruktionen").toBe(add);
    expect(add.nextElementSibling, "Annars efter knappen").toBe(otherwise);
    expect(add.classList.contains("properties-panel__add-option--empty"), "tonad").toBe(true);
    // The plus is the icon since B3 (Astra 30/9), not the character "+".
    expect(add.textContent?.replace(/\s+/g, " ").trim(), "samma ord som konturknappen").toBe("Lägg till regel");
    expect(add.querySelector("svg"), "samma plus-ikon som konturknappen").not.toBeNull();

    // Tonad, aldrig fylld: ytan är primary-surface, texten primary-strong.
    const style = getComputedStyle(add);
    const probe = document.createElement("div");
    probe.style.cssText = "background: var(--fw-primary-surface); color: var(--fw-primary-strong); border: 1px solid var(--fw-primary-border);";
    add.parentElement!.append(probe);
    expect(style.backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
    expect(style.color).toBe(getComputedStyle(probe).color);
    expect(style.borderTopColor).toBe(getComputedStyle(probe).borderTopColor);
    probe.remove();

    // Samlingens bredd: lika bred som Annars-kortet under den.
    expect(add.getBoundingClientRect().width).toBeCloseTo(otherwise.getBoundingClientRect().width, 0);
  });

  test("den tonade knappen svarar på hovring: kanten blir konturknappens --fw-primary", async () => {
    // Fias granskning av B-omgången 30/9: the tint is the ordinary button's
    // hover surface, so hovering the tinted one changed nothing — measured
    // the same background, text and border at rest and hovered, both themes.
    const panel = await mount("rc-rule", emptyRules());
    await parkPointer(panel);
    const add = panel.querySelector<HTMLElement>('[data-action="add-rule-case"]')!;
    const rest = getComputedStyle(add).borderTopColor;

    await userEvent.hover(add);
    await settle(250);

    const probe = document.createElement("div");
    probe.style.cssText = "border: 1px solid var(--fw-primary);";
    add.parentElement!.append(probe);
    expect(getComputedStyle(add).borderTopColor, "hovrad: konturknappens kant").toBe(getComputedStyle(probe).borderTopColor);
    expect(getComputedStyle(add).borderTopColor, "skild från vilan").not.toBe(rest);
    probe.remove();
  });

  test("med en regel: konturknappen, ingen instruktion, kort → knapp → Annars", async () => {
    const panel = await mount("rc-rule", structuredClone(ruleCalcAstraGraph));
    const list = panel.querySelector<HTMLElement>(".properties-panel__options")!;
    const add = panel.querySelector<HTMLElement>('[data-action="add-rule-case"]')!;

    expect(panel.querySelector("[data-empty-hint]")).toBeNull();
    expect(add.classList.contains("properties-panel__add-option--empty")).toBe(false);
    expect(getComputedStyle(add).backgroundColor, "konturknappen: genomskinlig, inte tonad").toBe("rgba(0, 0, 0, 0)");
    expect(list.nextElementSibling).toBe(add);
    expect(add.nextElementSibling).toBe(panel.querySelector("[data-rule-otherwise]"));
  });

  test("den första regeln gör den tonade knappen till konturknappen och tar bort instruktionen", async () => {
    const panel = await mount("rc-rule", emptyRules());

    await userEvent.click(panel.querySelector<HTMLElement>('[data-action="add-rule-case"]')!);
    await settle(300);

    const add = panel.querySelector<HTMLElement>('[data-action="add-rule-case"]')!;
    expect(panel.querySelectorAll("[data-rule-case-id].properties-panel__option")).toHaveLength(1);
    expect(panel.querySelector("[data-empty-hint]")).toBeNull();
    expect(add.classList.contains("properties-panel__add-option--empty")).toBe(false);
    expect(panel.querySelector<HTMLElement>(".properties-panel__options")!.nextElementSibling).toBe(add);
  });
});

describe("den tomma samlingen: fråga", () => {
  test("utan alternativ: instruktionen och den tonade knappen; 0 alternativ och dragtipset dolda", async () => {
    const panel = await mount("rc-housing", emptyQuestion());
    const hint = panel.querySelector<HTMLElement>("[data-empty-hint]");
    const add = panel.querySelector<HTMLElement>('[data-action="add-option"]')!;
    const count = panel.querySelector<HTMLElement>("[data-options-count]")!;

    expect(hint?.textContent?.trim()).toBe(EMPTY_OPTIONS);
    expect(hint!.nextElementSibling).toBe(add);
    expect(add.classList.contains("properties-panel__add-option--empty")).toBe(true);
    expect(count.hidden, "0 alternativ sägs inte").toBe(true);
    expect(count.getBoundingClientRect().height).toBe(0);
    expect(add.closest(".properties-panel__field")!.querySelector(".properties-panel__options-hint"), "inget dragtips").toBeNull();
  });

  test("med alternativ: som förut — antal, dragtips, konturknappen, ingen instruktion", async () => {
    const panel = await mount("rc-housing", structuredClone(ruleCalcAstraGraph));
    const add = panel.querySelector<HTMLElement>('[data-action="add-option"]')!;
    const count = panel.querySelector<HTMLElement>("[data-options-count]")!;

    expect(panel.querySelector("[data-empty-hint]")).toBeNull();
    expect(count.hidden).toBe(false);
    expect(count.textContent).toContain("3");
    expect(add.closest(".properties-panel__field")!.querySelector(".properties-panel__options-hint")).not.toBeNull();
    expect(add.classList.contains("properties-panel__add-option--empty")).toBe(false);
    expect(getComputedStyle(add).backgroundColor, "konturknappen: genomskinlig, inte tonad").toBe("rgba(0, 0, 0, 0)");
  });

  test("det första alternativet gör knappen till konturknappen och visar antalet igen", async () => {
    const panel = await mount("rc-housing", emptyQuestion());

    await userEvent.click(panel.querySelector<HTMLElement>('[data-action="add-option"]')!);
    await settle(300);

    const add = panel.querySelector<HTMLElement>('[data-action="add-option"]')!;
    expect(panel.querySelector("[data-empty-hint]")).toBeNull();
    expect(add.classList.contains("properties-panel__add-option--empty")).toBe(false);
    expect(panel.querySelector<HTMLElement>("[data-options-count]")!.hidden).toBe(false);
  });
});
