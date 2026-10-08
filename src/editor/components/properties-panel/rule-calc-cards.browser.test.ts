import { userEvent } from "@vitest/browser/context";
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { ruleCalcAstraGraph } from "../../../data/rule-calc-astra-graph";
import { evaluateRule } from "../../../viewer/core/rule-evaluator";
import { exportGraphJson, importGraphJson } from "../../core/graph-io";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { FlowNodeData, GraphData } from "../../../viewer/types/graph";

/**
 * Uppdrag 29/9, Del A: regler och uträkningsrader är samma hopfällbara kort
 * som svarsalternativen (Astras spec §1, §2, §6, §7).
 *
 * Kortet är ett gränssnittstillstånd ovanpå oförändrad data: ordningen i
 * `cases`/`assignments` är det enda en flytt ändrar, id:n och kopplingarna
 * följer med, och *första regel vinner* läses ur den nya ordningen.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount(nodeId: string, graph: GraphData = ruleCalcAstraGraph): Promise<{ editor: GuideEditor; panel: ShadowRoot }> {
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

  return { editor, panel: editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot! };
}

const node = (editor: GuideEditor, id: string): FlowNodeData =>
  (editor.getData() as GraphData).nodes.find((one) => one.id === id)!;
const caseIds = (editor: GuideEditor) =>
  (node(editor, "rc-rule").data.cases as Array<{ id: string }>).map((one) => one.id);
const card = (panel: ShadowRoot, kind: string, id: string) =>
  panel.querySelector<HTMLElement>(`.properties-panel__option[data-${kind}-id="${id}"]`)!;
const isOpen = (panel: ShadowRoot, kind: string, id: string) =>
  !card(panel, kind, id).querySelector<HTMLElement>(`[data-${kind}-body]`)!.hidden;
const titleOf = (element: HTMLElement, kind: string) => {
  const title = element.querySelector<HTMLElement>(`[data-${kind}-title]`)!;
  return [...title.childNodes]
    .filter((one) => !(one instanceof HTMLElement && one.hasAttribute(`data-${kind}-position`)))
    .map((one) => one.textContent)
    .join("")
    .trim();
};

describe("regelkorten", () => {
  test("huvudet är en rad: grepp, regelns namn, upp, ned, chevron — stängt från början", async () => {
    const { panel } = await mount("rc-rule");
    const first = card(panel, "rule-case", "rc-case-nordic");
    const head = first.querySelector<HTMLElement>(".properties-panel__option-header")!;
    const actions = [...head.querySelectorAll<HTMLElement>("button")].map((one) => one.dataset.action);

    expect(actions).toEqual(["drag-rule-case", "move-rule-case-up", "move-rule-case-down", "toggle-rule-case"]);
    expect(titleOf(first, "rule-case")).toBe("Nordisk i lägenhet");
    expect(isOpen(panel, "rule-case", "rc-case-nordic")).toBe(false);
    expect(head.querySelector<HTMLElement>('[data-action="toggle-rule-case"]')!.getAttribute("aria-expanded")).toBe("false");
  });

  test("en regel utan namn visar reservnamnet som text, inget annat", async () => {
    const graph = structuredClone(ruleCalcAstraGraph);
    const rule = graph.nodes.find((one) => one.id === "rc-rule")!;
    (rule.data.cases as Array<{ label: string }>)[1]!.label = "";
    const { panel } = await mount("rc-rule", graph);

    expect(titleOf(card(panel, "rule-case", "rc-case-income"), "rule-case")).toBe("Regel 2");
  });

  test("flera kort kan vara öppna samtidigt, och huvudet har samma höjd öppet som stängt", async () => {
    const { panel } = await mount("rc-rule");
    const head = card(panel, "rule-case", "rc-case-income").querySelector<HTMLElement>(".properties-panel__option-header")!;
    const closedHeight = head.getBoundingClientRect().height;

    await userEvent.click(card(panel, "rule-case", "rc-case-nordic").querySelector<HTMLElement>('[data-action="toggle-rule-case"]')!);
    await userEvent.click(card(panel, "rule-case", "rc-case-income").querySelector<HTMLElement>('[data-action="toggle-rule-case"]')!);

    expect(isOpen(panel, "rule-case", "rc-case-nordic")).toBe(true);
    expect(isOpen(panel, "rule-case", "rc-case-income")).toBe(true);
    expect(card(panel, "rule-case", "rc-case-income").querySelector<HTMLElement>(".properties-panel__option-header")!.getBoundingClientRect().height).toBe(closedHeight);
  });

  test("en flytt ändrar ordningen, behåller id och kopplingar, och första regel vinner i den nya ordningen", async () => {
    const { editor, panel } = await mount("rc-rule");
    // A visitor in a house with an income over 60 000 meets both "Hög inkomst" and "Villa eller Malmö".
    const answers = { boende: "villa", medborgarskap: ["TR"], inkomst: "70000", postort: "Lund" };

    expect(evaluateRule(node(editor, "rc-rule"), answers as never)).toMatchObject({ portId: "rc-case-income" });

    await userEvent.click(card(panel, "rule-case", "rc-case-house").querySelector<HTMLElement>('[data-action="toggle-rule-case"]')!);
    await userEvent.click(card(panel, "rule-case", "rc-case-house").querySelector<HTMLElement>('[data-action="move-rule-case-up"]')!);
    await settle(300);

    expect(caseIds(editor)).toEqual(["rc-case-nordic", "rc-case-house", "rc-case-income"]);
    expect(evaluateRule(node(editor, "rc-rule"), answers as never)).toMatchObject({ portId: "rc-case-house" });
    expect(
      (editor.getData() as GraphData).connections
        .filter((one) => one.from.nodeId === "rc-rule")
        .map((one) => `${one.from.portId}>${one.to.nodeId}`)
        .sort(),
    ).toEqual([
      "default>rc-r-default",
      "rc-case-house>rc-r-house",
      "rc-case-income>rc-r-income",
      "rc-case-nordic>rc-r-nordic",
    ]);
    expect(isOpen(panel, "rule-case", "rc-case-house"), "öppet läge följer kortet").toBe(true);
    expect(isOpen(panel, "rule-case", "rc-case-income")).toBe(false);
    const focused = panel.activeElement as HTMLElement | null;
    expect(focused?.dataset.action, "fokus på samma knapp").toBe("move-rule-case-up");
    expect(focused?.closest<HTMLElement>("[data-rule-case-id]")?.dataset.ruleCaseId).toBe("rc-case-house");
  });

  test("ordningen efter en flytt överlever sparning och omladdning", async () => {
    const first = await mount("rc-rule");

    await userEvent.click(card(first.panel, "rule-case", "rc-case-nordic").querySelector<HTMLElement>('[data-action="move-rule-case-down"]')!);
    await settle(300);

    const saved = exportGraphJson(first.editor.getData() as GraphData);
    if (!saved.success) throw new Error(saved.errors.join("; "));
    document.body.replaceChildren();
    const loaded = importGraphJson(saved.json);
    if (!loaded.success) throw new Error(loaded.errors.join("; "));
    const second = await mount("rc-rule", loaded.graph);

    expect(caseIds(second.editor)).toEqual(["rc-case-income", "rc-case-nordic", "rc-case-house"]);
    expect([...second.panel.querySelectorAll<HTMLElement>("[data-rule-case-id].properties-panel__option")].map((one) => one.dataset.ruleCaseId))
      .toEqual(["rc-case-income", "rc-case-nordic", "rc-case-house"]);
  });

  test("en ny regel läggs före Annars, öppnas, och får fokus i sitt namnfält", async () => {
    const { editor, panel } = await mount("rc-rule");

    await userEvent.click(panel.querySelector<HTMLElement>('[data-action="add-rule-case"]')!);
    await settle(300);

    const ids = caseIds(editor);
    expect(ids).toHaveLength(4);
    const added = ids[3]!;
    const list = panel.querySelector<HTMLElement>(".properties-panel__options")!;
    const otherwise = panel.querySelector<HTMLElement>("[data-rule-otherwise]")!;

    const add = panel.querySelector<HTMLElement>('[data-action="add-rule-case"]')!;

    // Ordningen är regelkort → Lägg till regel → Annars (Astra 30/9, profilens
    // beslut 13): tillägget direkt efter sin samling, Annars sist. Annars
    // stands outside the cards' own container: the shared drag gesture
    // re-appends the cards there, and Annars must never be among them.
    expect(list.nextElementSibling, "Lägg till regel står direkt efter korten").toBe(add);
    expect(add.nextElementSibling, "Annars står efter Lägg till regel").toBe(otherwise);
    expect(otherwise.nextElementSibling, "Annars står sist").toBeNull();
    expect((list.lastElementChild as HTMLElement).dataset.ruleCaseId, "den nya regeln står före Annars").toBe(added);
    expect(isOpen(panel, "rule-case", added)).toBe(true);
    expect((panel.activeElement as HTMLElement | null)?.dataset.ruleCaseProperty).toBe("label");
    expect(panel.activeElement!.closest<HTMLElement>("[data-rule-case-id]")!.dataset.ruleCaseId).toBe(added);
  });

  test("Annars är ett fast sista kort: rubrik, hjälprad, namnet på utfallet — inga flytt-, villkors- eller borttagskontroller", async () => {
    const { editor, panel } = await mount("rc-rule");
    const otherwise = panel.querySelector<HTMLElement>("[data-rule-otherwise]")!;

    expect(otherwise.textContent).toContain("Annars");
    expect(otherwise.textContent).toContain("När ingen regel uppfylls");
    const field = otherwise.querySelector<HTMLInputElement>('input[data-property="fallbackLabel"]')!;
    expect(field.checkVisibility(), "innehållet syns direkt").toBe(true);
    expect(field.value).toBe("Vanligt besked");
    expect(otherwise.querySelectorAll("button, select, [data-rule-condition-id]")).toHaveLength(0);
    expect(panel.querySelectorAll('[data-property="fallbackLabel"]'), "fältet ritas en gång").toHaveLength(1);

    field.focus();
    await userEvent.keyboard("{Control>}a{/Control}Övrigt");
    await settle(600);

    expect(node(editor, "rc-rule").data.fallbackLabel).toBe("Övrigt");
    expect(
      (editor.getData() as GraphData).connections.find((one) => one.from.nodeId === "rc-rule" && one.from.portId === "default")?.to.nodeId,
      "utgången default och dess koppling står kvar",
    ).toBe("rc-r-default");
  });

  test("två stilla hjälprader står ovanför listan: vad regeln gäller, och att första regel vinner", async () => {
    const { panel } = await mount("rc-rule");
    const list = panel.querySelector<HTMLElement>(".properties-panel__options")!;
    const scope = panel.querySelector<HTMLElement>("[data-rule-scope]")!;
    const order = panel.querySelector<HTMLElement>("[data-rule-order]")!;

    expect(scope.textContent).toContain("visas om");
    expect(order.textContent).toContain("uppifrån");
    for (const help of [scope, order]) {
      expect(help.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING, "ovanför listan").toBeTruthy();
    }
  });
});

describe("uträkningskorten", () => {
  const assignmentIds = (editor: GuideEditor) =>
    (node(editor, "rc-calc").data.assignments as Array<{ id: string }>).map((one) => one.id);

  test("huvudet visar etiketten, annars variabelnamnet, annars ett reservnamn", async () => {
    const graph = structuredClone(ruleCalcAstraGraph);
    const calc = graph.nodes.find((one) => one.id === "rc-calc")!;
    const rows = calc.data.assignments as Array<{ label?: unknown; variableName: string }>;
    delete rows[1]!.label;
    delete rows[2]!.label;
    rows[2]!.variableName = "";
    const { panel } = await mount("rc-calc", graph);

    expect(titleOf(card(panel, "assignment", "rc-a-base"), "assignment")).toBe("Grundbelopp");
    expect(titleOf(card(panel, "assignment", "rc-a-children"), "assignment")).toBe("barntillagg");
    expect(titleOf(card(panel, "assignment", "rc-a-total"), "assignment")).toBe("Ny uträkning");
  });

  test("öppet kort: etikett, variabelnamn, formel i den ordningen, formeln en växande textruta", async () => {
    const { panel } = await mount("rc-calc");
    await userEvent.click(card(panel, "assignment", "rc-a-total").querySelector<HTMLElement>('[data-action="toggle-assignment"]')!);

    const fields = [...card(panel, "assignment", "rc-a-total").querySelectorAll<HTMLElement>("[data-assignment-property]")];
    expect(fields.map((one) => one.dataset.assignmentProperty)).toEqual(["label", "variableName", "formula"]);
    // Del C (139): the formula is the formula field, with chips; it grows like the textarea did.
    expect(fields[2]!.tagName).toBe("RICH-TEXT-FIELD");
    expect(fields[2]!.hasAttribute("formula")).toBe(true);
    expect((fields[2] as HTMLTextAreaElement).value).toBe("round(min(grund + barntillagg; 9000))");
  });

  test("att ändra etiketten skriver aldrig över variabelnamnet", async () => {
    const { editor, panel } = await mount("rc-calc");
    await userEvent.click(card(panel, "assignment", "rc-a-base").querySelector<HTMLElement>('[data-action="toggle-assignment"]')!);
    const label = card(panel, "assignment", "rc-a-base").querySelector<HTMLInputElement>('[data-assignment-property="label"]')!;

    label.focus();
    await userEvent.keyboard("{Control>}a{/Control}Bas");
    await settle(400);

    const row = (node(editor, "rc-calc").data.assignments as Array<{ id: string; variableName: string; label: unknown }>)[0]!;
    expect(row.variableName).toBe("grund");
    expect(titleOf(card(panel, "assignment", "rc-a-base"), "assignment"), "huvudet följer etiketten").toBe("Bas");
  });

  test("en flytt behåller id och öppet läge, och fokus stannar på knappen", async () => {
    const { editor, panel } = await mount("rc-calc");

    await userEvent.click(card(panel, "assignment", "rc-a-base").querySelector<HTMLElement>('[data-action="toggle-assignment"]')!);
    await userEvent.click(card(panel, "assignment", "rc-a-base").querySelector<HTMLElement>('[data-action="move-assignment-down"]')!);
    await settle(300);

    expect(assignmentIds(editor)).toEqual(["rc-a-children", "rc-a-base", "rc-a-total"]);
    expect(isOpen(panel, "assignment", "rc-a-base")).toBe(true);
    const focused = panel.activeElement as HTMLElement | null;
    expect(focused?.dataset.action).toBe("move-assignment-down");
    expect(focused?.closest<HTMLElement>("[data-assignment-id]")?.dataset.assignmentId).toBe("rc-a-base");
  });

  test("en ny uträkning öppnas med fokus i etiketten", async () => {
    const { editor, panel } = await mount("rc-calc");

    await userEvent.click(panel.querySelector<HTMLElement>('[data-action="add-assignment"]')!);
    await settle(300);

    const added = assignmentIds(editor)[3]!;
    expect(isOpen(panel, "assignment", added)).toBe(true);
    expect((panel.activeElement as HTMLElement | null)?.dataset.assignmentProperty).toBe("label");
  });

  test("en hjälprad ovanför listan säger att raderna räknas uppifrån", async () => {
    const { panel } = await mount("rc-calc");
    const order = panel.querySelector<HTMLElement>("[data-assignment-order]")!;
    const list = panel.querySelector<HTMLElement>(".properties-panel__options")!;

    expect(order.textContent).toContain("uppifrån");
    expect(order.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
