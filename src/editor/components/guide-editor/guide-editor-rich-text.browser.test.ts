import { userEvent } from "@vitest/browser/context";
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import { BUNDLED_GRAPHS } from "../../../data/bundled-graphs";
import { getNodeType } from "../../../viewer/node-types/node-type-registry";

import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";
import type { PropertiesPanel } from "../properties-panel/properties-panel";
import type { RichTextField } from "../rich-text-field/rich-text-field";
import type { FlowNodeData, GraphData } from "../../../viewer/types/graph";

/**
 * Story 136 through the whole editor: the rich text field in the panel, the
 * guide's data around it, and the health list's way into it.
 *
 * Criterion 7 and 7b a, measured over every bundled guide rather than one
 * made for the test: open a guide, touch a field and leave it — nothing
 * changes; write in it — only that field changes; open the result again —
 * the field shows what was written.
 */

afterEach(() => document.body.replaceChildren());

const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );

async function open(graph: GraphData): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("feature-level", "advanced");
  editor.style.cssText = "display: block; width: 1200px; height: 700px;";
  document.body.append(editor);
  editor.graph = structuredClone(graph);
  await settle();

  return editor;
}

const panelOf = (editor: GuideEditor): PropertiesPanel =>
  editor.shadowRoot!.querySelector<PropertiesPanel>("properties-panel")!;

async function select(editor: GuideEditor, nodeId: string): Promise<void> {
  editor.shadowRoot!.querySelector<NodeEditor>("node-editor")!.selectNodeById(nodeId);
  await settle();
}

/** The first node whose description the viewer formats and that has text in it. */
function describedNode(graph: GraphData): FlowNodeData | undefined {
  return graph.nodes.find((node) => {
    const declared = getNodeType(node.type)?.properties?.find((property) => property.id === "description");
    const value = node.data.description;

    return declared?.formatting?.includes("bold") && (typeof value === "string" ? value : JSON.stringify(value ?? "")).length > 4;
  });
}

const withoutDescription = (graph: GraphData, nodeId: string): unknown =>
  graph.nodes.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, description: null } } : node));

describe("förlustfritt i editorn, över exempelguiderna (136 kriterium 7 och 7b a)", () => {
  const cases = BUNDLED_GRAPHS
    .map(([name, graph]) => [name, graph, describedNode(graph)] as const)
    .filter(([, , node]) => node !== undefined);

  test("det finns guider att pröva", () => {
    expect(cases.length).toBeGreaterThan(15);
  });

  test.each(cases)("%s", async (_name, graph, node) => {
    const editor = await open(graph);
    const before = editor.getData();

    await select(editor, node!.id);

    const field = panelOf(editor).shadowRoot!.querySelector<RichTextField>('rich-text-field[data-property="description"]');

    expect(field, "beskrivningen är det nya fältet, inte textläge").not.toBeNull();

    const text = field!.shadowRoot!.querySelector<HTMLElement>("[data-text]")!;

    // Öppna och lämna: samma sträng, ingenting ändrat.
    text.focus();
    text.blur();
    expect(editor.getData()).toEqual(before);

    // Skriv: bara det rörda fältet ändras.
    text.focus();
    await userEvent.keyboard("{Control>}{End}{/Control}!");
    const after = editor.getData();

    expect(withoutDescription(after, node!.id)).toEqual(withoutDescription(before, node!.id));
    const written = field!.value;

    expect(written.endsWith("!")).toBe(true);

    // Öppna igen — samma editor, guiden inläst på nytt: fältet visar det som skrevs.
    editor.graph = structuredClone(after);
    await settle();
    await select(editor, node!.id);
    expect(
      panelOf(editor).shadowRoot!.querySelector<RichTextField>('rich-text-field[data-property="description"]')!.value,
    ).toBe(written);
  });
});

describe("textläget (136 kriterium 8)", () => {
  test("ett fält tolken inte kan läsa öppnas som text, med en rad som säger det, och skrivs inte om", async () => {
    const editor = await open({
      startNodeId: "r1",
      nodes: [{ id: "r1", type: "result", position: { x: 0, y: 0 }, data: { title: "Tack", description: "**a [b** c](/x)" } }],
      connections: [],
    } as unknown as GraphData);
    const before = editor.getData();

    await select(editor, "r1");
    const root = panelOf(editor).shadowRoot!;

    expect(root.querySelector('rich-text-field[data-property="description"]')).toBeNull();
    expect(root.querySelector<HTMLTextAreaElement>('textarea[data-property="description"]')!.value).toBe("**a [b** c](/x)");
    expect(root.querySelector("[data-text-mode]")?.textContent).toContain("visas som den är lagrad");
    expect(editor.getData()).toEqual(before);
  });
});

describe("hälsolistan leder till brickan (136 kriterium 14)", () => {
  test("ett svar ingen fråga sätter: knappen bär fältet, och trycket markerar brickan", async () => {
    const editor = await open({
      startNodeId: "r1",
      nodes: [{ id: "r1", type: "result", position: { x: 0, y: 0 }, data: { title: "Tack", description: "Hej {{borttagen}}, välkommen." } }],
      connections: [],
    } as unknown as GraphData);
    const button = [...editor.shadowRoot!.querySelectorAll<HTMLButtonElement>("[data-health-node]")]
      .find((candidate) => candidate.dataset.healthField === "description");

    expect(button, "hälsoknappen bär fältet").toBeDefined();

    button!.click();
    await settle();
    await settle();

    const field = panelOf(editor).shadowRoot!.querySelector<RichTextField>('rich-text-field[data-property="description"]')!;
    const chip = field.shadowRoot!.querySelector<HTMLElement>("[data-chip]")!;

    expect(panelOf(editor).shadowRoot!.activeElement).toBe(field);
    expect(chip.hasAttribute("data-selected"), "brickan är markerad").toBe(true);
    expect(chip.textContent).toContain("borttagen (saknas)");
  });
});

/*
 * Johan 25/9, from Fia's pictures: the chip menu on a heading offered
 * *Öppettider*, a question further on — a chip the visitor always sees empty.
 * The field offers the answers set before its node, on some path there, and a
 * chip already naming a later one stays, as missing (136).
 */
describe("brickorna erbjuder bara svar som är satta före noden", () => {
  const guide = (order: "question-first" | "heading-first"): GraphData => {
    const heading = { id: "rubrik", type: "text-question", position: { x: 0, y: 0 }, data: { title: "Hej {{oppettider}}", variableName: "namn" } };
    const question = { id: "fraga", type: "text-question", position: { x: 300, y: 0 }, data: { title: "Öppettider", variableName: "oppettider" } };
    const [first, second] = order === "question-first" ? [question, heading] : [heading, question];

    return {
      startNodeId: first.id,
      nodes: [first, second],
      connections: [{ id: "c1", from: { nodeId: first.id, portId: "continue" }, to: { nodeId: second.id, portId: "input" } }],
    } as unknown as GraphData;
  };

  const offered = async (order: "question-first" | "heading-first") => {
    const editor = await open(guide(order));

    await select(editor, "rubrik");
    const field = panelOf(editor).shadowRoot!.querySelector<RichTextField>('rich-text-field[data-property="title"]')!;

    return {
      menu: [...field.shadowRoot!.querySelectorAll<HTMLElement>("[data-answer-menu] [data-insert]")].map((button) => button.dataset.insert),
      chip: field.shadowRoot!.querySelector<HTMLElement>("[data-chip]")!,
    };
  };

  test("frågan kommer efter rubriken: svaret erbjuds inte, och brickan står kvar som saknad", async () => {
    const { menu, chip } = await offered("heading-first");

    expect(menu).not.toContain("oppettider");
    expect(menu).toContain("idag");
    expect(chip.textContent).toContain("oppettider (saknas)");
  });

  test("frågan kommer före rubriken: svaret erbjuds", async () => {
    const { menu, chip } = await offered("question-first");

    expect(menu).toContain("oppettider");
    expect(chip.classList.contains("chip--missing")).toBe(false);
  });
});
