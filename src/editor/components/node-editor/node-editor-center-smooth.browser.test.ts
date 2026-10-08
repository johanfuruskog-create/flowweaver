import { afterEach, describe, expect, test, vi } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./node-editor";

import type { NodeEditor } from "./node-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Åkningen mellan stegen i provläget glider, den klipper inte.
 *
 * ## Felet
 *
 * Promon 1/10 2026 visade provläget på canvasen: "Prova guiden" centrerade
 * startnoden, "Nästa" centrerade resultatet — varje gång som ett byte på en
 * bildruta. Johan: "så borde det fungera i produkten också, mjuk övergång
 * när man kör guiden i editorn på åkningen mellan noderna".
 *
 * ## Varför det är ett val per anrop och ingen stilregel
 *
 * `scroll-behavior: smooth` på fönstret hade animerat allt som sätter
 * scrollvärdet — även arbetsytans kompensation när den växer eller trimmas,
 * som finns för att INGET ska synas röra sig. Därför bär bara den
 * uttryckliga centreringen glidningen, och bara när anroparen ber om den.
 *
 * ## K5
 *
 * Med `prefers-reduced-motion: reduce` är åkningen ett klipp igen, samma
 * anrop. Mediefrågan stubbas här, för en testlöpare kan inte byta
 * systeminställning.
 */

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function graf(): GraphData {
  return {
    startNodeId: "q0",
    nodes: [
      {
        id: "q0",
        type: "question",
        position: { x: 0, y: 0 },
        data: { title: "Fråga", variableName: "v0", options: [{ id: "ja", label: "Ja", value: "ja" }] },
      },
      { id: "r1", type: "result", position: { x: 900, y: 700 }, data: { title: "Långt bort" } },
    ],
    connections: [{ id: "c1", from: { nodeId: "q0", portId: "ja" }, to: { nodeId: "r1", portId: "input" } }],
  };
}

async function montera(): Promise<{ editor: NodeEditor; viewport: HTMLElement }> {
  const editor = document.createElement("node-editor") as NodeEditor;
  editor.editorMode = "administrator";
  editor.style.cssText = "display: block; width: 520px; height: 380px;";
  document.body.append(editor);
  editor.graph = graf();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const viewport = editor.shadowRoot!.querySelector<HTMLElement>(".node-editor__viewport")!;
  return { editor, viewport };
}

function matchMediaSaying(reduce: boolean): void {
  const real = window.matchMedia.bind(window);
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) =>
    query.includes("prefers-reduced-motion")
      ? ({ matches: reduce, media: query, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList)
      : real(query),
  );
}

describe("centreringen av en nod", () => {
  test("glider dit när anroparen ber om det", async () => {
    matchMediaSaying(false);
    const { editor, viewport } = await montera();
    const scrollTo = vi.spyOn(viewport, "scrollTo");

    expect(editor.centerNodeById("r1", { smooth: true })).toBe(true);

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo.mock.calls[0]![0], "en glidning, inte ett klipp").toMatchObject({ behavior: "smooth" });
  });

  test("klipper som förut utan begäran — arbetsytans egna flyttar ska vara osynliga", async () => {
    matchMediaSaying(false);
    const { editor, viewport } = await montera();
    const scrollTo = vi.spyOn(viewport, "scrollTo");
    const before = { left: viewport.scrollLeft, top: viewport.scrollTop };

    editor.centerNodeById("r1");

    expect(scrollTo).not.toHaveBeenCalled();
    expect({ left: viewport.scrollLeft, top: viewport.scrollTop }, "vyn har flyttat, direkt").not.toEqual(before);
  });

  test("klipper också när besökaren bett om mindre rörelse (K5)", async () => {
    matchMediaSaying(true);
    const { editor, viewport } = await montera();
    const scrollTo = vi.spyOn(viewport, "scrollTo");

    editor.centerNodeById("r1", { smooth: true });

    expect(scrollTo, "ingen glidning under prefers-reduced-motion").not.toHaveBeenCalled();
  });
});
