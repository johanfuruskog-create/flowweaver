import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";
// Some of these run the viewer as the editor does — `editor-view`, `proving` —
// and read the editor's words on the canvas. Those load with the editor's
// lookup, never with the viewer (entries.test.ts).
import "../../../editor/localization/editor-ui-strings";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Provbilden och provfilen — story 065:s uppföljning.
 *
 * Ett obligatoriskt filsteg går inte att svara på med tangentbordet: enda
 * kontrollen är en filväljare, och i ett prov på arbetsytan vill ingen leta
 * upp en riktig fil för att få se resten av flödet. I provet byter fältet
 * därför kontroll — en knapp som lägger in provets egen bild eller fil.
 *
 * Trycker man inte händer ingenting särskilt: samma valideringsfel som
 * besökaren möter. Det är avsiktligt (Johan 1/9: "lägger man inte till
 * någon bild så får man valideringsfel") och står som första fallet här.
 */

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const fileGraph = (data: Record<string, unknown>): GraphData => ({
  startNodeId: "s",
  nodes: [
    {
      id: "s",
      type: "file-question",
      position: { x: 0, y: 0 },
      data: { title: { sv: "Bifoga en fil" }, variableName: "bild", required: true, ...data },
    },
    { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Klart" } } },
  ],
  connections: [
    { id: "c", from: { nodeId: "s", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
  ],
});

async function mounted(
  data: Record<string, unknown> = {},
  attributes: string[] = ["proving"],
): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  attributes.forEach((name) => preview.setAttribute(name, ""));
  document.body.append(preview);
  preview.graph = fileGraph(data);
  await settle();
  return preview;
}

const shadow = (preview: GuidePreview): ShadowRoot => preview.shadowRoot as ShadowRoot;
const next = (root: ShadowRoot): HTMLButtonElement | null =>
  root.querySelector<HTMLButtonElement>('[data-action="next"]');

afterEach(() => {
  document.body.replaceChildren();
});

describe("provbilden i provet", () => {
  test("Nästa utan att trycka ger samma valideringsfel som för besökaren", async () => {
    const preview = await mounted();
    const root = shadow(preview);

    next(root)?.click();
    await settle();

    expect(preview.getCurrentNodeId()).toBe("s");
    // Under the field, in its cell — no longer a box over the card (Astra 1/10, bilaga 10 punkt 6).
    expect(root.querySelector("[data-page-field-id] .guide-preview__field-error")?.textContent?.trim()).toBe(
      "Bifoga en fil för att gå vidare.",
    );
    expect(root.querySelector(".guide-preview__error")).toBeNull();
    expect(preview.getAnswers()).toEqual({});
  });

  test("knappen lägger in provbilden som svar och steget går att lämna", async () => {
    const preview = await mounted();
    const root = shadow(preview);
    const button = root.querySelector<HTMLButtonElement>("[data-proving-file]");

    expect(button?.textContent?.trim()).toBe("Lägg till provbild");
    button?.click();
    await settle();

    expect(root.querySelector<HTMLInputElement>("[data-file-name]")?.value).toBe("provbild.svg");
    expect(root.querySelector("[data-proving-note]")?.textContent?.trim()).toBe(
      "på låtsas, bara i provet",
    );

    next(root)?.click();
    await settle();

    expect(preview.getCurrentNodeId()).toBe("r");
    // Utan markering är svaret filnamnet rakt av; med markering är det
    // namnet och prickarna som delar av samma svar (mätt 1/9).
    expect(preview.getAnswers()).toEqual({ bild: "provbild.svg" });
  });

  test("provet öppnar ingen filväljare — knappen står i dess ställe", async () => {
    const preview = await mounted();
    const root = shadow(preview);

    expect(root.querySelector('input[type="file"]')).toBeNull();
    expect(root.querySelector("[data-proving-file]")).not.toBeNull();
  });

  test("utanför provet finns ingen provknapp, bara filväljaren", async () => {
    const preview = await mounted({}, []);
    const root = shadow(preview);

    expect(root.querySelector("[data-proving-file]")).toBeNull();
    expect(root.querySelector("[data-proving-note]")).toBeNull();
    expect(root.querySelector('input[type="file"]')).not.toBeNull();
  });

  test("markeringen ritas ovanpå provbilden, som på riktigt", async () => {
    const preview = await mounted({ allowMarking: true });
    const root = shadow(preview);

    root.querySelector<HTMLButtonElement>("[data-proving-file]")?.click();
    await settle();

    const area = root.querySelector<HTMLElement>("[data-marking-area]");

    expect(area?.hidden).toBe(false);
    expect(root.querySelector<HTMLImageElement>("[data-marking-image]")?.src ?? "").toContain(
      "image/svg+xml",
    );
  });

  test("fältet visar vilken fil provet lade in, och kommer ihåg den", async () => {
    const preview = await mounted();
    const root = shadow(preview);

    root.querySelector<HTMLButtonElement>("[data-proving-file]")?.click();
    await settle();

    expect(root.querySelector("[data-proving-chosen]")?.textContent?.trim()).toBe("provbild.svg");

    // Om igen ur svaret: en omritning bygger ny markup, och namnet får inte
    // hänga på att någon råkade trycka just nu.
    next(root)?.click();
    await settle();
    preview.previous();
    await settle();

    expect(shadow(preview).querySelector("[data-proving-chosen]")?.textContent?.trim()).toBe(
      "provbild.svg",
    );
  });

  test("provbilden syns på riktigt i markeringsytan, inte bara som src", async () => {
    const preview = await mounted({ allowMarking: true });
    const root = shadow(preview);

    root.querySelector<HTMLButtonElement>("[data-proving-file]")?.click();
    await settle(200);

    const img = root.querySelector<HTMLImageElement>("[data-marking-image]");
    const box = img?.getBoundingClientRect();

    // Bilden var laddad (naturlig storlek 229x150) och ändå 0x0 på skärmen:
    // en SVG med bara viewBox har ingen egen storlek, och markeringsytan
    // krymper till sin bild. Bara src räcker alltså inte som påstående.
    expect(img?.complete).toBe(true);
    expect(box?.width ?? 0).toBeGreaterThan(50);
    expect(box?.height ?? 0).toBeGreaterThan(50);
  });

  /*
   * Story 108: steget bär ett eget exempelfoto, och provet visar DET.
   *
   * En redaktör som provkör skadeanmälan ska se en bil med en buckla att peka
   * på, inte den ritade provbilden — annars provar man flödet men inte frågan.
   * Fotot är en adress i nodens data; provet ritar den och bifogar fortfarande
   * ingen fil (se sista testet i filen: provsvar reser aldrig).
   */
  test("ett steg med eget exempelfoto får det i provet i stället för provbilden", async () => {
    const preview = await mounted({
      allowMarking: true,
      exampleImage: "/exempel/testbil-fyra-vyer.jpg",
      exampleImageAlt: { sv: "En silverfärgad bil i fyra vyer.", en: "A silver car." },
    });
    const root = shadow(preview);

    root.querySelector<HTMLButtonElement>("[data-proving-file]")?.click();
    await settle(400);

    expect(root.querySelector<HTMLInputElement>("[data-file-name]")?.value).toBe(
      "testbil-fyra-vyer.jpg",
    );

    const img = root.querySelector<HTMLImageElement>("[data-marking-image]");

    expect(img?.getAttribute("src")).toBe("/exempel/testbil-fyra-vyer.jpg");
    expect(img?.alt).toBe("En silverfärgad bil i fyra vyer.");
  });

  test("utan eget exempelfoto ritar provet provbilden, precis som förut", async () => {
    const preview = await mounted({ allowMarking: true });
    const root = shadow(preview);

    root.querySelector<HTMLButtonElement>("[data-proving-file]")?.click();
    await settle();

    expect(root.querySelector<HTMLInputElement>("[data-file-name]")?.value).toBe("provbild.svg");
  });

  test("ett filsteg som inte tar bilder får provfilen i stället", async () => {
    const preview = await mounted({ accept: ".pdf" });
    const root = shadow(preview);
    const button = root.querySelector<HTMLButtonElement>("[data-proving-file]");

    expect(button?.textContent?.trim()).toBe("Lägg till provfil");
    button?.click();
    await settle();

    expect(root.querySelector<HTMLInputElement>("[data-file-name]")?.value).toBe("provfil.pdf");
  });

  test("provsvaret finns bara i provets motor — aldrig i en inlämning", async () => {
    const preview = await mounted();
    const root = shadow(preview);

    root.querySelector<HTMLButtonElement>("[data-proving-file]")?.click();
    await settle();
    next(root)?.click();
    await settle();

    expect(preview.getFiles()).toEqual([]);
    expect([...preview.getFormData().keys()]).toEqual(["bild"]);

    preview.restart();
    await settle();

    expect(preview.getAnswers()).toEqual({});
    expect(shadow(preview).querySelector<HTMLInputElement>("[data-file-name]")?.value).toBe("");
  });
});
