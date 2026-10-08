import { afterEach, describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";
import "../viewer/components/guide-preview/guide-preview";

import { repeatOptionsGraph } from "./repeat-options-graph";

import type { GuidePreview } from "../viewer/components/guide-preview/guide-preview";

/**
 * Berättelse 138, kriterium 6 — alternativen i en upprepad post vägs om
 * medan besökaren fyller i posten.
 *
 * Det här är vad som inte gick 21/9: ett alternativ som beror på ett fält i
 * *samma* post ritades ur svaren posten hade när sidan ritades, och vägdes
 * aldrig om. Konferensguiden gick runt det genom att peka bakåt på ett
 * tidigare steg (134 kriterium 8, `conference-sessions.browser.test.ts`).
 * Här pekar villkoren dit de ville: på dagen i samma post, och på passet i
 * posten före.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount(): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "sv");
  document.body.append(preview);
  preview.graph = structuredClone(repeatOptionsGraph) as never;
  await settle();

  return preview;
}

const root = (preview: GuidePreview): ShadowRoot => preview.shadowRoot!;
const group = (preview: GuidePreview, index: number): HTMLElement =>
  root(preview).querySelector<HTMLElement>(`[data-repeat-group="${index}"]`)!;

/** Kryssar för ett alternativ i en post, som ett finger gör. */
async function pick(preview: GuidePreview, index: number, variable: string, value: string): Promise<void> {
  const radio = group(preview, index).querySelector<HTMLInputElement>(
    `input[data-page-variable="${variable}"][value="${value}"]`,
  );

  expect(radio, `post ${index + 1} erbjuder inte ${variable} = ${value}`).toBeTruthy();
  radio!.checked = true;
  radio!.dispatchEvent(new Event("change", { bubbles: true }));
  await settle();
}

/** Passen en post erbjuder just nu, i ordning. */
const sessions = (preview: GuidePreview, index: number): string[] =>
  [...group(preview, index).querySelectorAll<HTMLInputElement>('input[data-page-variable="pass"]')].map(
    (radio) => radio.value,
  );

async function add(preview: GuidePreview): Promise<void> {
  root(preview).querySelector<HTMLButtonElement>('[data-action="repeat-add"]')!.click();
  await settle();
}

describe("alternativen i en upprepad post, medan besökaren fyller i (berättelse 138, kriterium 6)", () => {
  test("ett villkor på ett fält i samma post håller: dagen styr passen", async () => {
    const preview = await mount();

    expect(sessions(preview, 0), "ingen dag vald: inget dagsberoende pass").toEqual([]);

    await pick(preview, 0, "dag", "1");
    expect(sessions(preview, 0)).toEqual(["klarsprak", "matning"]);

    await pick(preview, 0, "dag", "2");
    expect(sessions(preview, 0)).toEqual(["panel"]);
  });

  test("omvägningen behåller fokus på kontrollen besökaren just använde", async () => {
    const preview = await mount();
    const radio = group(preview, 0).querySelector<HTMLInputElement>('input[data-page-variable="dag"][value="1"]')!;

    radio.focus();
    await pick(preview, 0, "dag", "1");

    const active = root(preview).activeElement as HTMLInputElement | null;
    expect(active?.dataset.pageVariable).toBe("dag");
    expect(active?.value).toBe("1");
    expect(active?.checked).toBe(true);
  });

  test("post 2 ser post 1:s svar, och följer med när post 1 ändras", async () => {
    const preview = await mount();

    await pick(preview, 0, "dag", "1");
    await pick(preview, 0, "pass", "klarsprak");
    await add(preview);
    expect(sessions(preview, 1), "fördjupningen kräver klarspråk i en tidigare post").toEqual(["fordjupning"]);

    await pick(preview, 1, "pass", "fordjupning");

    // Post 1 byter till mätning: fördjupningen går inte längre att välja i
    // post 2, valet töms och sägs (samma rad som 134 kriterium 6).
    await pick(preview, 0, "pass", "matning");
    expect(sessions(preview, 1)).toEqual([]);
    expect(group(preview, 1).querySelector("[data-choice-redo]"), "tömt val utan besked").toBeTruthy();
    // Post 1 behåller sitt eget val genom omritningen.
    expect(group(preview, 0).querySelector<HTMLInputElement>('input[data-page-variable="pass"]:checked')?.value).toBe(
      "matning",
    );
  });
});
