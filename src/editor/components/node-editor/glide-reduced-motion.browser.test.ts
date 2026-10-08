import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "./node-editor";

/**
 * Glidningen efter ett svep slutar när besökaren bett om mindre rörelse.
 *
 * ## Vad som mättes
 *
 * Astras punkt C3, 21/9: fjorton stilmallar bär `prefers-reduced-motion`, men
 * arbetsytans panorering drivs av skript och frågade aldrig. Mätt i webbläsaren
 * med `emulateMedia({ reducedMotion: "reduce" })`: arbetsytan flyttade sig
 * **583 px i x och 185 i y under 700 ms efter att pekaren släppt** — alltså
 * exakt lika mycket som utan inställningen.
 *
 * **Panoreringen själv är kvar.** Så länge fingret ligger kvar flyttas ytan av
 * handen som flyttar den; det är direkt manipulation, inte animering. Det som
 * stängs av är glidningen *efter* släppet, som fortsätter på egen hand när
 * gesten tagit slut (WCAG 2.3.3).
 *
 * ## Varför provet byter ut `matchMedia` i stället för att emulera
 *
 * En browsertest-körning har ingen knapp för webbläsarens inställning —
 * emuleringen finns i Playwright, inte här. Provet byter därför ut den fråga
 * koden ställer, vilket är just den gren som ska mätas. Båda svaren körs, och
 * det är hela poängen: ett prov som bara körde *reduce* hade gått grönt även om
 * glidningen aldrig fungerat, vilket är samma fel som att mäta ett tomt läge
 * och kalla det lugnt (PRAXIS 12).
 */

afterEach(() => {
  document.body.replaceChildren();
  restoreMatchMedia();
});

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const realMatchMedia = window.matchMedia.bind(window);

/** Låter koden få det svar provet vill mäta mot. */
function answerReducedMotion(reduce: boolean): void {
  window.matchMedia = ((query: string) =>
    query.includes("prefers-reduced-motion")
      ? ({ matches: reduce, media: query, addEventListener() {}, removeEventListener() {} } as never)
      : realMatchMedia(query)) as typeof window.matchMedia;
}

function restoreMatchMedia(): void {
  window.matchMedia = realMatchMedia;
}

async function canvas(): Promise<{ nodeEditor: NodeEditor; viewport: HTMLElement }> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 900px; height: 600px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "n0",
    nodes: Array.from({ length: 6 }, (_, index) => ({
      id: `n${index}`,
      type: "text-question",
      position: { x: index * 260, y: index * 180 },
      data: { title: `Nod ${index}`, variableName: `v${index}` },
    })),
    connections: [],
  } as never;

  await settle();
  await settle();

  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(".node-editor__viewport");

  if (!nodeEditor || !viewport) throw new Error("node-editor saknas.");

  return { nodeEditor, viewport };
}

/**
 * Ett svep som slutar i ett kast.
 *
 * En bildruta mellan stegen, inte sextio millisekunder: glidningen startar
 * först över 0,35 px/ms, så ett makligt drag lämnar ingenting efter sig — och
 * då mäter provet ingenting alls.
 */
async function flick(viewport: HTMLElement): Promise<void> {
  const send = (type: string, x: number, y: number): void => {
    viewport.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true, pointerId: 9, pointerType: "touch", clientX: x, clientY: y,
      }),
    );
  };

  viewport.scrollTop = 600;
  viewport.scrollLeft = 600;
  send("pointerdown", 400, 700);
  for (let step = 1; step <= 10; step += 1) {
    send("pointermove", 400, 700 - step * 70);
    await settle(16);
  }
  send("pointerup", 400, 0);
}

/** Hur långt ytan flyttar sig efter att fingret släppt. */
async function driftAfterRelease(viewport: HTMLElement): Promise<number> {
  const at = viewport.scrollTop;

  await settle(600);

  return Math.abs(viewport.scrollTop - at);
}

describe("glidningen och mindre rörelse", () => {
  test("utan inställningen glider arbetsytan vidare", async () => {
    answerReducedMotion(false);

    const { viewport } = await canvas();

    await flick(viewport);

    /*
     * Raden som gör provet läsbart: utan den kan ett stillastående resultat
     * längre ned lika gärna betyda "ingen glidning finns" som "glidningen är
     * avstängd", och det är två helt olika svar.
     */
    expect(await driftAfterRelease(viewport), "det finns en glidning att stänga av")
      .toBeGreaterThan(20);
  });

  test("med inställningen stannar den där fingret släppte", async () => {
    answerReducedMotion(true);

    const { viewport } = await canvas();

    await flick(viewport);

    expect(await driftAfterRelease(viewport), "ingen rörelse efter släppet").toBe(0);
  });
});
