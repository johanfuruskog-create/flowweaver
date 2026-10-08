import { answerText, readPath } from "../../core/answer-values";
import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";

/**
 * Story 047: marking one's own photo.
 *
 * The resident attaches a picture and taps where the damage is. The file
 * stays the file; the marks are data beside it — percent coordinates in
 * `{variableName}Markeringar`, resolution-independent, the annotated-image
 * form. The original photo is never altered.
 */

afterEach(() => {
  document.body.replaceChildren();
});

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/*
 * En bild med riktiga mått: en 1×1-pixel gav en yta där heltalsklick landade
 * utanför och procenten blev 0 i stället för 50 — fotona ytan finns för är
 * aldrig en pixel.
 */
async function testImage(): Promise<Blob> {
  const canvas = document.createElement("canvas");

  canvas.width = 200;
  canvas.height = 120;
  canvas.getContext("2d")!.fillRect(0, 0, 200, 120);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/png"));
}

async function mounted(data: Record<string, unknown> = {}): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  document.body.append(preview);
  preview.graph = {
    startNodeId: "f",
    nodes: [
      {
        id: "f",
        type: "file-question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Så här ser skadan ut" },
          variableName: "foto",
          accept: ".png,.jpg",
          ...data,
        },
      },
      { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "f", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as never;

  await settle();
  await settle();

  return preview;
}

async function chooseImage(preview: GuidePreview, name = "skada.png"): Promise<void> {
  const input = preview.shadowRoot!.querySelector<HTMLInputElement>("[data-file-field]")!;
  const transfer = new DataTransfer();

  transfer.items.add(new File([await testImage()], name, { type: "image/png" }));
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await settle();

  // Vänta in att bilden fått sina mått — ytan ärver dem.
  const image = preview.shadowRoot!.querySelector<HTMLImageElement>("[data-marking-image]");

  if (image) {
    for (let i = 0; i < 20 && image.getBoundingClientRect().width < 50; i += 1) {
      await settle(50);
    }
  }
}

describe("utan markering påslagen", () => {
  test("finns ingen markeringsyta, även med bild vald", async () => {
    const preview = await mounted();

    await chooseImage(preview);

    expect(preview.shadowRoot!.querySelector("[data-marking-area]")).toBeNull();
  });
});

describe("med markering påslagen", () => {
  test("ytan visas först när en bild är vald", async () => {
    const preview = await mounted({ allowMarking: true });
    const root = preview.shadowRoot!;

    expect(root.querySelector("[data-marking-area]")?.hasAttribute("hidden")).toBe(true);

    await chooseImage(preview);

    expect(root.querySelector("[data-marking-area]")?.hasAttribute("hidden")).toBe(false);
    expect(
      root.querySelector<HTMLImageElement>("[data-marking-image]")?.src.startsWith("blob:"),
    ).toBe(true);
  });

  test("tryck markerar i procent, texten följer sin siffra, och allt lagras", async () => {
    const preview = await mounted({ allowMarking: true });
    const root = preview.shadowRoot!;

    await chooseImage(preview);

    const canvas = root.querySelector<HTMLElement>("[data-marking-canvas]")!;
    const rect = canvas.getBoundingClientRect();

    // Mitt i bilden — 50 %, 50 %, oavsett hur stor ytan råkar vara.
    canvas.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      }),
    );
    await settle();

    const dots = root.querySelectorAll("[data-marking-index]");

    expect(dots.length).toBe(1);
    // Pricken bär sin siffra, som annoterade bildens nålar.
    expect(dots[0].textContent?.trim()).toBe("1");

    const textInput = root.querySelector<HTMLInputElement>('[data-marking-text="0"]')!;

    textInput.value = "Bucklan vid strålkastaren";
    textInput.dispatchEvent(new Event("input", { bubbles: true }));

    root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();

    expect(answerText(preview.getAnswers().foto)).toBe("skada.png");

    const marks = JSON.parse(answerText(readPath(preview.getAnswers(), "foto.markings"))) as Array<{
      x: number;
      y: number;
      text: string;
    }>;

    expect(marks.length).toBe(1);
    expect(Math.abs(marks[0].x - 50)).toBeLessThan(2);
    expect(Math.abs(marks[0].y - 50)).toBeLessThan(2);
    expect(marks[0].text).toBe("Bucklan vid strålkastaren");
  });

  test("raden tar bort, siffrorna räknas om, pricken går till sin text, och Rensa tömmer", async () => {
    const preview = await mounted({ allowMarking: true });
    const root = preview.shadowRoot!;

    await chooseImage(preview);

    const canvas = root.querySelector<HTMLElement>("[data-marking-canvas]")!;
    const rect = canvas.getBoundingClientRect();
    const tap = (fx: number, fy: number) =>
      canvas.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          clientX: rect.left + rect.width * fx,
          clientY: rect.top + rect.height * fy,
        }),
      );

    tap(0.25, 0.25);
    tap(0.75, 0.75);
    await settle();

    expect(root.querySelectorAll("[data-marking-index]").length).toBe(2);
    expect(root.querySelectorAll("[data-marking-text]").length).toBe(2);

    /*
     * Pricken tar INTE bort — en feltryckning ska inte kasta skriven text.
     * Den går till sin rad; borttagningen bor på radens egen knapp.
     */
    root.querySelector<HTMLButtonElement>("[data-marking-index='0']")!.click();
    await settle();

    expect(root.activeElement?.getAttribute("data-marking-text")).toBe("0");
    expect(root.querySelectorAll("[data-marking-index]").length).toBe(2);

    root.querySelector<HTMLButtonElement>("[data-marking-remove='0']")!.click();
    await settle();

    expect(root.querySelectorAll("[data-marking-index]").length).toBe(1);
    // Kvarvarande pricken har räknats om till 1.
    expect(root.querySelector("[data-marking-index]")?.textContent?.trim()).toBe("1");

    root.querySelector<HTMLButtonElement>("[data-marking-clear]")!.click();
    await settle();

    expect(root.querySelectorAll("[data-marking-index]").length).toBe(0);
    expect(root.querySelectorAll("[data-marking-text]").length).toBe(0);
  });

  test("byts bilden ut följer inte markeringarna med till fel foto", async () => {
    const preview = await mounted({ allowMarking: true });
    const root = preview.shadowRoot!;

    await chooseImage(preview, "forsta.png");

    const canvas = root.querySelector<HTMLElement>("[data-marking-canvas]")!;
    const rect = canvas.getBoundingClientRect();

    canvas.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      }),
    );
    await settle();

    await chooseImage(preview, "andra.png");

    expect(root.querySelectorAll("[data-marking-index]").length).toBe(0);
  });
});
