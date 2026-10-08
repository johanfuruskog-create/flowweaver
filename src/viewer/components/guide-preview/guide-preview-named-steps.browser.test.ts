import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * The step row: the steps answered on the way here (Astra 1/10, bilaga 10
 * punkt 8, on IDEAS kandidat 1, Fia 24/9 and Johan 25/9: "Gillade
 * brödsmulorna", "Bockar mellan sidor").
 *
 * One form for pages and standalone questions alike; only the way actually
 * taken; never the current step, so the row never repeats the heading under
 * it; never the node type's word (*Resultat*). "avklarat" is read by a screen
 * reader while the eye gets the check mark. A long history wraps — it is
 * never clipped and never scrolls sideways on a phone.
 */

afterEach(() => document.body.replaceChildren());

const page = (id: string, title: string, x: number) => ({ id, type: "page", position: { x, y: 0 }, data: { title: { sv: title } } });
const field = (id: string, parent: string, order: number) => ({ id, type: "text-question", parentPageId: parent, order, position: { x: 0, y: 0 }, data: { title: { sv: `Fält ${id}` }, variableName: id } });

const graph = (): GraphData =>
  ({
    startNodeId: "p1",
    nodes: [
      page("p1", "Om dig", 0), field("f1", "p1", 0),
      page("p2", "Om felet", 400), field("f2", "p2", 0),
      { id: "q", type: "question", position: { x: 800, y: 0 }, data: { title: { sv: "Vill du bli kontaktad?" }, variableName: "kontakt", options: [{ id: "ja", label: { sv: "Ja" }, value: "ja" }] } },
      { id: "r", type: "result", position: { x: 1200, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "p1", portId: "continue" }, to: { nodeId: "p2", portId: "input" } },
      { id: "c2", from: { nodeId: "p2", portId: "continue" }, to: { nodeId: "q", portId: "input" } },
      { id: "c3", from: { nodeId: "q", portId: "ja" }, to: { nodeId: "r", portId: "input" } },
    ],
  }) as unknown as GraphData;

const settle = () => new Promise<void>((r) => setTimeout(r, 120));

async function mount(): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.style.cssText = "display:block;width:560px;";
  document.body.append(preview);
  preview.graph = graph();
  await settle();
  return preview;
}

const next = async (preview: GuidePreview) => {
  preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
  await settle();
};

const steps = (preview: GuidePreview) =>
  [...preview.shadowRoot!.querySelectorAll<HTMLElement>(".guide-preview__steps li")].map((li) => ({
    text: li.textContent!.replace(/\s+/g, " ").trim(),
    current: li.getAttribute("aria-current"),
  }));

describe("namngivna steg", () => {
  test("på andra sidan: den första avklarad och uppläst så, den aktuella inte med", async () => {
    const preview = await mount();
    await next(preview);

    expect(preview.shadowRoot!.querySelector("h2")!.textContent!.trim()).toBe("Om felet");
    expect(steps(preview)).toEqual([{ text: "✓ Om dig, avklarat", current: null }]);
  });

  test("på en fråga efter sidorna: båda avklarade", async () => {
    const preview = await mount();
    await next(preview);
    await next(preview);

    expect(preview.shadowRoot!.querySelector("h1, h2")!.textContent!.trim()).toBe("Vill du bli kontaktad?");
    expect(steps(preview).map((s) => s.current)).toEqual([null, null]);
    expect(steps(preview).map((s) => s.text)).toEqual(["✓ Om dig, avklarat", "✓ Om felet, avklarat"]);
  });

  test("bocken är dold för skärmläsaren och ordet dolt för ögat", async () => {
    const preview = await mount();
    await next(preview);
    const first = preview.shadowRoot!.querySelector<HTMLElement>(".guide-preview__steps li")!;
    const mark = first.querySelector<HTMLElement>("[aria-hidden='true']")!;
    const word = first.querySelector<HTMLElement>(".guide-preview__visually-hidden")!;

    expect(mark.textContent).toContain("✓");
    expect(word.textContent).toContain("avklarat");
    expect(word.getBoundingClientRect().width).toBeLessThanOrEqual(1);
  });

  test("en fristående fråga är ett steg som en sida, och resultatet visar vägen dit", async () => {
    const preview = await mount();
    await next(preview);
    await next(preview);
    preview.shadowRoot!.querySelector<HTMLInputElement>("input[type='radio']")!.click();
    await next(preview);

    expect(preview.shadowRoot!.querySelector("h2")!.textContent!.trim()).toBe("Tack");
    expect(steps(preview).map((s) => s.text)).toEqual([
      "✓ Om dig, avklarat",
      "✓ Om felet, avklarat",
      "✓ Vill du bli kontaktad?, avklarat",
    ]);
    expect(preview.shadowRoot!.querySelector(".guide-preview__step-row")!.textContent).not.toContain("Resultat");
  });

  test("första steget har inget att visa", async () => {
    const preview = await mount();

    expect(preview.shadowRoot!.querySelector(".guide-preview__step-row")).toBeNull();
  });

  test("en lång historik bryts på telefonbredd, klipps inte och rullar inte i sidled", async () => {
    const long = (n: number) => ({
      id: `q${n}`, type: "question", position: { x: n * 400, y: 0 },
      data: { title: { sv: `En ganska lång fråga nummer ${n} om något besökaren svarade på` }, variableName: `v${n}`, options: [{ id: `ja${n}`, label: { sv: "Ja" }, value: "ja" }] },
    });
    const questions = [1, 2, 3, 4, 5, 6].map(long);
    const preview = document.createElement("guide-preview") as GuidePreview;
    preview.style.cssText = "display:block;width:358px;";
    document.body.append(preview);
    preview.graph = {
      startNodeId: "q1",
      nodes: [...questions, { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Tack" } } }],
      connections: questions.map((q, i) => ({ id: `c${i}`, from: { nodeId: q.id, portId: `ja${i + 1}` }, to: { nodeId: questions[i + 1]?.id ?? "r", portId: "input" } })),
    } as unknown as GraphData;
    await settle();
    for (let i = 0; i < 6; i++) {
      preview.shadowRoot!.querySelector<HTMLInputElement>("input[type='radio']")!.click();
      await next(preview);
    }
    const root = preview.shadowRoot!;
    const row = root.querySelector<HTMLElement>(".guide-preview__steps")!;
    const card = root.querySelector<HTMLElement>("article")!;

    expect(root.querySelectorAll(".guide-preview__steps li")).toHaveLength(6);
    expect(row.getBoundingClientRect().height, "bryts på flera rader").toBeGreaterThan(60);
    expect(row.scrollWidth, "ingenting klipps").toBeLessThanOrEqual(row.clientWidth);
    expect(card.scrollWidth, "kortet rullar inte i sidled").toBeLessThanOrEqual(card.clientWidth);
    for (const item of root.querySelectorAll<HTMLElement>(".guide-preview__steps li")) {
      // A wrapped line never starts with the separator: it ends the item before.
      expect(getComputedStyle(item, "::before").content, "ingen rad börjar med ·").toBe("none");
      expect(item.getBoundingClientRect().right, "inom kortet").toBeLessThanOrEqual(card.getBoundingClientRect().right);
      expect(item.scrollWidth, "hela texten syns").toBeLessThanOrEqual(item.clientWidth);
    }
  });
});
