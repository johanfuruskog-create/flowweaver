import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GraphData } from "../../../viewer/types/graph";
import type { FlowNode } from "../flow-node/flow-node";

/**
 * Portarna i läsläge: **ritade, men inte kontroller** (berättelse 129).
 *
 * ## Varför de ritas
 *
 * De var gömda med `visibility: hidden`, och en gömd port ankrar ändå sin
 * linje. Varje koppling gick alltså till en punkt bakom kortet och slutade
 * där, utan ände — Johan 18/9, om bilden av en låst guide: *"Låst läge ska ha
 * portar — ser dumt ut när linjerna ligger bakom noderna."* Ritningen sa *den
 * här linjen går ingenstans* om en guide vars enda fel var att någon annan höll
 * den öppen.
 *
 * Det gäller **båda** läsande lägena: den äldre versionen (*Läsläge*) och den
 * låsta guiden (*Låst*). Det är samma `EditorMode`.
 *
 * ## Varför de ändå inte går att röra
 *
 * En synlig port som inte gör något är ett löfte, och ett löfte som inte
 * infrias är sämre än ingen port alls. Så tre lager, och det här provet mäter
 * alla tre:
 *
 *  - **Ytan**: `pointer-events: none`, alltså ingen träffyta för en pekare.
 *  - **Tangentbordet**: inget tabbstopp, och `aria-hidden` — i det här läget är
 *    porten slutet på en linje och ingen knapp.
 *  - **Canvasen**: `canMutate()` avvisar gesten oavsett hur den kom in. Det är
 *    garden; de två ovan är det som gör att ingen försöker.
 *
 * Mutationen provet skrevs mot: ta bort `pointer-events: none` och låt porten
 * vara ett vanligt tabbstopp igen. Då faller kontrollerna om träffytan och om
 * tabbordningen — men **inte** den om grafen, för canvasen vägrar ändå. Det är
 * precis därför alla tre mäts: den sista ensam hade varit grön hela vägen genom
 * en yta som ljuger.
 */

afterEach(() => document.body.replaceChildren());

const guide = (): GraphData =>
  ({
    startNodeId: "fraga",
    settings: { sourceLocale: "sv" },
    nodes: [
      {
        id: "fraga",
        type: "question",
        position: { x: 100, y: 100 },
        data: {
          title: { sv: "Har du egen tomt?" },
          options: [
            { id: "ja", label: { sv: "Ja" }, value: "ja" },
            { id: "nej", label: { sv: "Nej" }, value: "nej" },
          ],
        },
      },
      {
        id: "svar",
        type: "result",
        position: { x: 600, y: 60 },
        data: { title: { sv: "Du söker själv" } },
      },
    ],
    connections: [
      { id: "c1", from: { nodeId: "fraga", portId: "ja" }, to: { nodeId: "svar", portId: "input" } },
    ],
  }) as unknown as GraphData;

const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ),
  );

async function mount(mode: string): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", mode);
  editor.setAttribute("feature-level", "basic");
  editor.style.cssText = "display: block; width: 1200px; height: 700px;";
  document.body.append(editor);

  editor.graph = guide();
  await settle();
  await settle();

  return editor;
}

const canvasRoot = (editor: GuideEditor): ShadowRoot =>
  editor.shadowRoot!.querySelector("node-editor")!.shadowRoot!;

const nodeElement = (editor: GuideEditor, id: string): FlowNode =>
  [...canvasRoot(editor).querySelectorAll<FlowNode>("flow-node")].find(
    (one) => (one as unknown as { nodeId: string }).nodeId === id,
  )!;

const port = (editor: GuideEditor, nodeId: string, portId: string): HTMLButtonElement =>
  nodeElement(editor, nodeId).shadowRoot!.querySelector<HTMLButtonElement>(
    `[data-port-id="${portId}"]`,
  )!;

describe("portarna i läsläge", () => {
  test("ritas, och tar plats där linjen ska sluta", async () => {
    const editor = await mount("readonly");
    const ruta = port(editor, "fraga", "ja").getBoundingClientRect();

    expect(ruta.width, "en gömd port mäter noll och drar linjen in i kortet").toBeGreaterThan(0);
    expect(ruta.height).toBeGreaterThan(0);
    expect(
      getComputedStyle(port(editor, "fraga", "ja")).visibility,
      "gömd med visibility var precis felet",
    ).toBe("visible");
  });

  test("men går inte att träffa med en pekare", async () => {
    const editor = await mount("readonly");

    expect(getComputedStyle(port(editor, "fraga", "ja")).pointerEvents).toBe("none");
  });

  test("och är varken tabbstopp eller knapp för den som lyssnar", async () => {
    const editor = await mount("readonly");
    const ja = port(editor, "fraga", "ja");

    expect(ja.getAttribute("tabindex"), "ingen väg in med Tab").toBe("-1");
    expect(ja.hasAttribute("aria-hidden"), "slutet på en linje, ingen knapp").toBe(true);
  });

  /*
   * Och samma port i ett läge som får skriva — annars mäter provet ovan bara
   * att en sträng finns i en fil.
   */
  test("i redigeringsläge är de kontroller igen", async () => {
    const editor = await mount("administrator");
    const ja = port(editor, "fraga", "ja");

    expect(getComputedStyle(ja).pointerEvents).not.toBe("none");
    expect(ja.hasAttribute("aria-hidden")).toBe(false);
  });

  /*
   * Garden, mätt på grafen: ett drag från en port i läsläge skapar ingen
   * koppling. Gesten skickas som editorn skickar den — `node-port-pointerdown`
   * på utgången och `node-port-pointerup` på ingången — så provet mäter
   * canvasens svar och inte om ett syntetiskt klick nådde fram genom stilen.
   */
  test("och ett drag från en port skapar ingen koppling", async () => {
    const editor = await mount("readonly");
    const före = editor.getData().connections.length;

    const dra = (nodeId: string, portId: string, name: string) =>
      port(editor, nodeId, portId).dispatchEvent(
        new CustomEvent(name, {
          bubbles: true,
          composed: true,
          detail: {
            nodeId,
            portId,
            direction: portId === "input" ? "input" : "output",
            clientX: 0,
            clientY: 0,
            pointerId: 1,
          },
        }),
      );

    dra("fraga", "nej", "node-port-pointerdown");
    dra("svar", "input", "node-port-pointerup");
    await settle();

    expect(editor.getData().connections).toHaveLength(före);
  });

  /*
   * Och tangentbordsvägen, som är den andra halvan av samma gest: Enter på en
   * utgång och Enter på en ingång. Den kommer inte åt porten via Tab längre,
   * men den som når den på annat sätt ska inte heller kunna koppla.
   */
  test("inte heller med tangentbordet", async () => {
    const editor = await mount("readonly");
    const före = editor.getData().connections.length;

    for (const [nodeId, portId] of [
      ["fraga", "nej"],
      ["svar", "input"],
    ] as const) {
      port(editor, nodeId, portId).dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }),
      );
    }

    await settle();

    expect(editor.getData().connections).toHaveLength(före);
    expect(port(editor, "fraga", "nej").hasAttribute("data-pending")).toBe(false);
  });
});
