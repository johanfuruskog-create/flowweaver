import { userEvent } from "@vitest/browser/context";
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { ruleCalcAstraGraph } from "../../../data/rule-calc-astra-graph";
import { getEditorCapabilities } from "../../config/editor-capabilities";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { PropertiesPanel } from "./properties-panel";
import type { FieldPicker } from "../field-picker/field-picker";
import type { FlowNodeData, GraphData } from "../../../viewer/types/graph";

/**
 * Uppdrag 29/9, Del B: villkorsraden är EN kod på tre ställen — regelns
 * villkor, fältets "visas om" och alternativets "visas om" (Astras spec §3,
 * §4, §5). Samma tre staplade kontroller med synliga etiketter, samma
 * gruppering, samma kombinationsväljare och samma borttagning.
 *
 * Och 29/9-felet: ett villkor som inte är det första redigeras på sin egen
 * plats, och de andra — och `match` — står kvar.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The fixture, with an answer option that has a visibility of its own. */
function graphWithOptionVisibility(): GraphData {
  const graph = structuredClone(ruleCalcAstraGraph);
  const citizenship = graph.nodes.find((one) => one.id === "rc-citizenship")!;
  (citizenship.data.options as Array<Record<string, unknown>>)[4]!.visibility = {
    match: "all",
    conditions: [{ id: "rc-de-if-rent", variableName: "boende", operator: "equals", value: "hyresratt" }],
  };
  return graph;
}

async function mount(nodeId: string, graph: GraphData = graphWithOptionVisibility()) {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1300px; height: 1400px;";
  document.body.append(editor);
  editor.graph = structuredClone(graph) as never;
  await settle();
  await settle();
  (editor.shadowRoot!.querySelector("node-editor") as unknown as { selectNodeById(id: string): void }).selectNodeById(nodeId);
  await settle();
  await settle();
  const panel = editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;

  for (const toggle of panel.querySelectorAll<HTMLButtonElement>('[data-action^="toggle-"][aria-expanded="false"]')) toggle.click();
  await settle();

  return { editor, panel };
}

const node = (editor: GuideEditor, id: string): FlowNodeData =>
  (editor.getData() as GraphData).nodes.find((one) => one.id === id)!;

/** The visible words over a condition's three controls, in order. */
const labelsOf = (group: Element) =>
  [...group.querySelectorAll<HTMLElement>(":scope > label > span:first-child, :scope > div > label > span:first-child")]
    .map((one) => one.textContent!.trim());

describe("villkorsraden är samma på tre ställen", () => {
  test("regel, fältets och alternativets 'visas om' ritar samma tre kontroller med samma etiketter", async () => {
    const rule = await mount("rc-rule");
    const ruleGroup = rule.panel.querySelector<HTMLElement>('[data-rule-case-id="rc-case-income"] .properties-panel__condition')!;
    document.body.replaceChildren();
    const field = await mount("rc-town");
    const fieldGroup = field.panel.querySelector<HTMLElement>(".properties-panel__visibility .properties-panel__condition")!;
    document.body.replaceChildren();
    const option = await mount("rc-citizenship");
    const optionGroup = option.panel.querySelector<HTMLElement>('.properties-panel__option-visibility[data-option-id="rc-c-de"] .properties-panel__condition')!;

    for (const group of [ruleGroup, fieldGroup, optionGroup]) {
      expect(group, "gruppen finns").not.toBeNull();
      expect(labelsOf(group)).toEqual(["Svar eller värde", "Villkor", "Värde"]);
      // Story 143: the field is the searchable picker, the operator keeps its select.
      expect(group.querySelectorAll("field-picker"), "en fältväljare").toHaveLength(1);
      expect(group.querySelectorAll(".properties-panel__select > select"), "operatorn är kvar som select").toHaveLength(1);
      expect(group.querySelector(".properties-panel__rule-requirement-number"), "ingen nummerkolumn").toBeNull();
    }
  });

  test("i regelkortet står 'Kombinera villkor' i samma etikettstil som 'Regelns namn' — båda är kortets egna fält (Fia 29/9)", async () => {
    const { panel } = await mount("rc-rule");
    const card = panel.querySelector<HTMLElement>('[data-rule-case-id="rc-case-nordic"]')!;
    const name = card.querySelector<HTMLElement>(".properties-panel__option-body > label")!;
    const combine = card.querySelector<HTMLElement>(".properties-panel__condition-combine")!;
    const style = (el: HTMLElement) => ({ size: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight });

    expect(name.textContent).toContain("Regelns namn");
    // Measured 29/9: 12 px / 600 under a 14 px / 700 sibling.
    expect(style(combine)).toEqual(style(name));
    // The chosen value stays in the field's normal weight.
    expect(getComputedStyle(combine.querySelector("select")!).fontWeight).toBe("400");
  });

  test("ett ensamt villkor har ingen numrering och ingen kombinationsväljare", async () => {
    const { panel } = await mount("rc-rule");
    const single = panel.querySelector<HTMLElement>('[data-rule-case-id="rc-case-income"]')!;

    expect(single.textContent).not.toContain("Villkor 1");
    expect(single.querySelector('[data-rule-case-property="match"]')).toBeNull();
    expect(single.querySelector('[data-action="remove-rule-condition"]'), "det enda villkoret kan inte tas bort").toBeNull();
  });
});

describe("flera villkor", () => {
  test("numreras, kombineras med en väljare ovanför, och binds med stilla OCH eller ELLER", async () => {
    const { panel } = await mount("rc-rule");
    const all = panel.querySelector<HTMLElement>('[data-rule-case-id="rc-case-nordic"]')!;
    const any = panel.querySelector<HTMLElement>('[data-rule-case-id="rc-case-house"]')!;
    const match = all.querySelector<HTMLSelectElement>('select[data-rule-case-property="match"]')!;
    const groups = [...all.querySelectorAll<HTMLElement>(".properties-panel__condition")];

    expect(match.closest("label")!.textContent).toContain("Kombinera villkor");
    expect([...match.options].map((one) => one.textContent!.trim())).toEqual(["Alla villkor", "Minst ett villkor"]);
    expect(match.compareDocumentPosition(groups[0]!) & Node.DOCUMENT_POSITION_FOLLOWING, "väljaren ovanför grupperna").toBeTruthy();
    expect(groups.map((one) => one.querySelector(".properties-panel__condition-heading")?.textContent?.trim())).toEqual(["Villkor 1", "Villkor 2"]);
    const joinAll = all.querySelector<HTMLElement>(".properties-panel__condition-join")!;
    expect(joinAll.textContent!.trim()).toBe("OCH");
    expect(joinAll.closest("button"), "ordet är ingen knapp").toBeNull();
    expect(any.querySelector(".properties-panel__condition-join")!.textContent!.trim()).toBe("ELLER");
    expect(all.querySelectorAll('[data-action="remove-rule-condition"]'), "en borttagning per grupp").toHaveLength(2);
  });

  test("fältets 'visas om' med två villkor: det andra redigeras på sin plats, det första och match står kvar", async () => {
    const graph = graphWithOptionVisibility();
    const town = graph.nodes.find((one) => one.id === "rc-town")!;
    town.visibility = {
      match: "any",
      conditions: [
        { id: "rc-town-if-house", variableName: "boende", operator: "equals", value: "villa" },
        { id: "rc-town-if-rich", variableName: "inkomst", operator: "greater-than", value: "1000" },
      ],
    };
    const { editor, panel } = await mount("rc-town", graph);
    const second = panel.querySelector<HTMLElement>('[data-visibility-condition-id="rc-town-if-rich"]')!;
    const value = second.querySelector<HTMLInputElement>('input[data-visibility-property="value"]')!;

    expect(panel.querySelectorAll(".properties-panel__visibility .properties-panel__condition"), "båda villkoren ritas").toHaveLength(2);
    value.focus();
    await userEvent.keyboard("{Control>}a{/Control}5000");
    await userEvent.tab();
    await settle(400);

    expect(node(editor, "rc-town").visibility).toEqual({
      match: "any",
      conditions: [
        { id: "rc-town-if-house", variableName: "boende", operator: "equals", value: "villa" },
        { id: "rc-town-if-rich", variableName: "inkomst", operator: "greater-than", value: "5000" },
      ],
    });
  });

  test("att ta bort ett villkor tar bort just det", async () => {
    const { editor, panel } = await mount("rc-rule");
    const second = panel.querySelector<HTMLElement>('[data-rule-condition-id="rc-cond-flat"]')!;

    await userEvent.click(second.querySelector<HTMLElement>('[data-action="remove-rule-condition"]')!);
    await settle(300);

    const cases = node(editor, "rc-rule").data.cases as Array<{ id: string; conditions: Array<{ id: string }> }>;
    expect(cases[0]!.conditions.map((one) => one.id)).toEqual(["rc-cond-nordic"]);
  });
});

describe("ett ensamt villkor skriver aldrig om match", () => {
  test("en regel med match 'any' och ett villkor behåller 'any' när villkoret redigeras", async () => {
    const graph = graphWithOptionVisibility();
    const rule = graph.nodes.find((one) => one.id === "rc-rule")!;
    (rule.data.cases as Array<{ match: string }>)[1]!.match = "any";
    const { editor, panel } = await mount("rc-rule", graph);
    const value = panel.querySelector<HTMLInputElement>('[data-rule-condition-id="rc-cond-income"] input[data-rule-condition-property="value"]')!;

    value.focus();
    await userEvent.keyboard("{Control>}a{/Control}70000");
    await settle(300);

    const cases = node(editor, "rc-rule").data.cases as Array<{ match: string; conditions: Array<{ value: string }> }>;
    expect(cases[1]!.conditions[0]!.value).toBe("70000");
    expect(cases[1]!.match).toBe("any");
  });
});

describe("Logik av: låst struktur", () => {
  function mountBasic(): ShadowRoot {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    const rule = structuredClone(ruleCalcAstraGraph.nodes.find((one) => one.id === "rc-rule")!);

    panel.editorMode = "administrator";
    panel.capabilities = getEditorCapabilities("basic");
    panel.variableOptions = [
      { label: "Boendeform", value: "boende", type: "choice", options: [{ label: "Villa eller radhus", value: "villa" }] },
      { label: "Inkomst", value: "inkomst", type: "number", options: [] },
      { label: "Postort", value: "postort", type: "text", options: [] },
      { label: "Medborgarskap", value: "medborgarskap", type: "choice", multiple: true, options: [{ label: "Sverige", value: "SE" }] },
    ] as never;
    document.body.append(panel);
    panel.nodeData = rule as FlowNodeData;
    for (const toggle of panel.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-action="toggle-rule-case"]')) toggle.click();
    return panel.shadowRoot!;
  }

  test("en förklaring överst, en gång; berörda regler märkta 'Låst struktur'; värdena redigerbara", () => {
    const root = mountBasic();
    const notes = [...root.querySelectorAll<HTMLElement>(".properties-panel__rule-locked")];

    expect(notes).toHaveLength(1);
    expect(notes[0]!.textContent!.trim()).toBe(
      "Regler med flera villkor har låst struktur. Du kan ändra värdena. Aktivera Logik för att ändra kombinationen eller lägga till och ta bort villkor.",
    );
    expect(notes[0]!.compareDocumentPosition(root.querySelector(".properties-panel__options")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const locked = root.querySelector<HTMLElement>('[data-rule-case-id="rc-case-nordic"]')!;
    const open = root.querySelector<HTMLElement>('[data-rule-case-id="rc-case-income"]')!;
    expect(locked.textContent).toContain("Låst struktur");
    expect(open.textContent).not.toContain("Låst struktur");
    expect(locked.querySelector('[data-rule-case-property="match"]'), "kombinationen går inte att ändra").toBeNull();
    expect(locked.querySelector('[data-action="remove-rule-condition"]')).toBeNull();
    expect(locked.querySelector('[data-action="add-rule-condition"]')).toBeNull();
    expect(locked.querySelector<HTMLSelectElement>('[data-rule-condition-property="operator"]')!.disabled, "värdena ser redigerbara ut").toBe(false);
  });
});

/**
 * Story 143: en variabel som tagits bort ur guiden ("variabel borttagen")
 * får inte tysta bort villkorets sparade referens — datamodellen ändras inte
 * (punkt 1). Fältväljaren tar in den saknade variabeln som ett eget
 * alternativ (`editor.properties.variable-missing`, properties-panel.ts) i
 * stället för att tappa den ur listan, så det stängda fältet fortsätter
 * visa namnet i stället för platshållaren och `picker.value` behåller den
 * sparade — inte längre giltiga — identifieraren.
 */
describe("en borttagen variabel behåller sitt sparade värde i väljaren", () => {
  test("villkoret pekar fortfarande på den saknade variabeln, som ett eget alternativ märkt '(saknas)'", () => {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    const rule = structuredClone(ruleCalcAstraGraph.nodes.find((one) => one.id === "rc-rule")!);
    (rule.data.cases as Array<{ id: string; conditions: Array<{ variableName: string }> }>)
      .find((c) => c.id === "rc-case-income")!.conditions[0]!.variableName = "removed_var";

    panel.editorMode = "administrator";
    panel.capabilities = getEditorCapabilities("basic");
    // "removed_var" finns med flit inte här — det är variabeln som togs bort.
    panel.variableOptions = [
      { label: "Boendeform", value: "boende", type: "choice", options: [{ label: "Villa eller radhus", value: "villa" }] },
      { label: "Inkomst", value: "inkomst", type: "number", options: [] },
    ] as never;
    document.body.append(panel);
    panel.nodeData = rule as FlowNodeData;
    for (const toggle of panel.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-action="toggle-rule-case"]')) toggle.click();

    const picker = panel.shadowRoot!.querySelector<FieldPicker>('[data-rule-case-id="rc-case-income"] field-picker')!;

    expect(picker.value, "det sparade värdet finns kvar trots att variabeln saknas").toBe("removed_var");
    const stale = picker.options.find((one) => one.value === "removed_var");
    expect(stale, "den saknade variabeln finns som ett eget alternativ").not.toBeUndefined();
    expect(stale!.label).toBe("removed_var (saknas)");
    expect(picker.shadowRoot!.querySelector(".control__text")!.textContent, "namnet syns, inte platshållaren")
      .toBe("removed_var (saknas)");
  });
});

/**
 * Story 143, point 10: the searchable field picker is one component in the
 * three places, and behaves the same in each. What the panel adds to the
 * component's own tests: a search never reaches the saved condition (Fia's
 * find in the sketch — the search's `input` crossed the shadow root and the
 * row redrew on the first letter), a choice does, focus comes back to the
 * field after the panel's redraw, and nothing in the panel covers the open
 * surface.
 */
describe("fältväljaren är samma komponent på tre ställen (story 143)", () => {
  type Place = { name: string; nodeId: string; picker: string; saved: (one: FlowNodeData) => string };
  const conditionsOf = (one: FlowNodeData, key: string) =>
    (one as unknown as Record<string, { conditions: Array<{ variableName: string }> }>)[key]!.conditions;
  const places: Place[] = [
    {
      name: "regelns villkor",
      nodeId: "rc-rule",
      picker: '[data-rule-case-id="rc-case-income"] field-picker',
      saved: (one) => (one.data.cases as Array<{ id: string; conditions: Array<{ variableName: string }> }>)
        .find((c) => c.id === "rc-case-income")!.conditions[0]!.variableName,
    },
    {
      name: "fältets synlighet",
      nodeId: "rc-town",
      picker: ".properties-panel__visibility field-picker",
      saved: (one) => conditionsOf(one, "visibility")[0]!.variableName,
    },
    {
      name: "alternativets synlighet",
      nodeId: "rc-citizenship",
      picker: '.properties-panel__option-visibility[data-option-id="rc-c-de"] field-picker',
      saved: (one) => (one.data.options as Array<{ visibility: { conditions: Array<{ variableName: string }> } }>)[4]!
        .visibility.conditions[0]!.variableName,
    },
  ];

  const deepActive = (): Element | null => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
  };

  for (const place of places) {
    test(`${place.name}: ett klick på etiketten fokuserar väljarens fält, som select:en fick det`, async () => {
      const { panel } = await mount(place.nodeId);
      const picker = panel.querySelector<FieldPicker>(place.picker)!;
      const caption = picker.closest("label")!.querySelector<HTMLElement>(":scope > span")!;

      expect(caption.textContent!.trim()).toBe("Svar eller värde");
      await userEvent.click(caption);

      expect(deepActive(), "fokus på fältet").toBe(picker.shadowRoot!.querySelector(".control"));
      expect(picker.isOpen, "etiketten öppnar inte listan").toBe(false);
    });

    test(`${place.name}: sökning rör inte villkoret, ett val gör det och fokus står kvar på fältet`, async () => {
      const { editor, panel } = await mount(place.nodeId);
      const picker = panel.querySelector<FieldPicker>(place.picker)!;
      const before = place.saved(node(editor, place.nodeId));

      expect(picker, "väljaren finns").not.toBeNull();
      expect(picker.value).toBe(before);

      await userEvent.click(picker.shadowRoot!.querySelector(".control")!);
      await userEvent.keyboard("o");
      await settle();

      expect(picker.isConnected, "panelen ritade inte om av sökningen").toBe(true);
      expect(picker.isOpen, "listan står kvar öppen").toBe(true);
      expect(place.saved(node(editor, place.nodeId)), "sökningen skrev inget").toBe(before);

      /*
       * Nothing in the panel lies over the open surface and nothing clips
       * it: at its top, middle and bottom edge the point is the picker's
       * own, seen from the panel and from inside the picker. Measured on the
       * surface's box, not on a row — the list scrolls, and a row out of its
       * view is rightly not there.
       */
      const surface = picker.shadowRoot!.querySelector<HTMLElement>(".popup")!;
      const box = surface.getBoundingClientRect();
      expect(box.bottom, "ytan ryms i fönstret").toBeLessThanOrEqual(window.innerHeight);
      for (const y of [box.top + 4, box.top + box.height / 2, box.bottom - 4]) {
        const x = box.left + box.width / 2;
        expect(panel.elementFromPoint(x, y), `panelen täcker inte ytan vid y=${Math.round(y)}`).toBe(picker);
        expect(surface.contains(picker.shadowRoot!.elementFromPoint(x, y)), `ytan själv vid y=${Math.round(y)}`).toBe(true);
      }

      await userEvent.keyboard("{Escape}");
      expect(place.saved(node(editor, place.nodeId)), "Escape skrev inget").toBe(before);

      await userEvent.click(picker.shadowRoot!.querySelector(".control")!);
      const target = [...picker.shadowRoot!.querySelectorAll<HTMLElement>('[role="option"]')]
        .find((row) => row.querySelector(".chip")!.textContent !== before)!;
      const chosen = target.querySelector(".chip")!.textContent!;
      await userEvent.click(target);
      await settle();

      expect(place.saved(node(editor, place.nodeId)), "valet sparades").toBe(chosen);
      const now = editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!.querySelector<FieldPicker>(place.picker)!;
      expect(now.value).toBe(chosen);
      expect(deepActive(), "fokus på fältet efter panelens omritning").toBe(now.shadowRoot!.querySelector(".control"));
    });
  }
});
