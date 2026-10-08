// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { withPro } from "../../../testing/optional-pro";
const PRO = await withPro("viewer/index.ts");
import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * *Använd exempelfoto* — story 108, besökarens halva.
 *
 * En filfråga kan bära ett exempelfoto i sin data: en adress och en alt-text.
 * Knappen som bifogar det är **värdens**, inte bibliotekets: den finns bara på
 * en sida som satt `example-files` på `guide-preview`. En guide med ett
 * exempelfoto som körs på någon annans sida ser ut precis som förut — på en
 * riktig skadeanmälan finns ingen exempelbil att bifoga.
 *
 * Och fotot som bifogas är en **riktig fil**. Det är hela poängen med
 * kriterium 2: markeringarna, granskningen, inlämningen och gallringen är
 * filfältets egen maskineri, inte en andra väg bredvid den. Testerna nedan
 * mäter därför `getFiles()` och `getFormData()` och inte bara att ett namn
 * står i fältet.
 *
 * Adressen är en riktig fil ur `public/` — biblioteket hämtar den med `fetch`
 * när någon trycker, och en attrapp av `fetch` hade hållit med om vad som
 * helst (PRAXIS 13).
 */

const PHOTO = "/exempel/testbil-fyra-vyer.jpg";
const ALT = {
  sv: "En silverfärgad bil i fyra vyer.",
  en: "A silver car in four views.",
};

const settle = (ms = 140) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const guide = (data: Record<string, unknown> = {}): GraphData => ({
  startNodeId: "s",
  settings: { sourceLocale: "sv", locales: ["sv", "en"] },
  nodes: [
    {
      id: "s",
      type: "file-question",
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Har du bilder på skadan?", en: "Do you have pictures?" },
        variableName: "bilder",
        accept: ".jpg,.jpeg,.png",
        exampleImage: PHOTO,
        exampleImageAlt: ALT,
        ...data,
      },
    },
    { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Tack" } } },
  ],
  connections: [
    { id: "c", from: { nodeId: "s", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
  ],
});

async function mounted(
  data: Record<string, unknown> = {},
  attributes: string[] = ["example-files"],
): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  attributes.forEach((name) => preview.setAttribute(name, ""));
  document.body.append(preview);
  preview.graph = guide(data);
  await settle();
  return preview;
}

const shadow = (preview: GuidePreview): ShadowRoot => preview.shadowRoot as ShadowRoot;
const exampleButton = (preview: GuidePreview): HTMLButtonElement | null =>
  shadow(preview).querySelector<HTMLButtonElement>("[data-example-file]");

/** Trycker på knappen och väntar ut hämtningen. */
async function useExample(preview: GuidePreview): Promise<void> {
  exampleButton(preview)?.click();
  await settle(600);
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("knappen är värdens", () => {
  test("utan example-files finns ingen knapp, bara filväljaren", async () => {
    const preview = await mounted({}, []);

    expect(exampleButton(preview)).toBeNull();
    expect(shadow(preview).querySelector('input[type="file"]')).not.toBeNull();
  });

  test("med example-files står knappen under väljaren, med sitt namn", async () => {
    const preview = await mounted();

    expect(exampleButton(preview)?.textContent?.trim()).toBe("Använd exempelfoto");
    // Väljaren står kvar: den som har ett eget foto ska inte behöva vårt.
    expect(shadow(preview).querySelector('input[type="file"]')).not.toBeNull();
  });

  test("en filfråga utan exempelfoto får ingen knapp, hur värden än frågar", async () => {
    const preview = await mounted({ exampleImage: "", exampleImageAlt: "" });

    expect(exampleButton(preview)).toBeNull();
  });

  test("knappen talar guidens språk", async () => {
    const preview = document.createElement("guide-preview") as GuidePreview;

    preview.setAttribute("example-files", "");
    preview.setAttribute("active-locale", "en");
    document.body.append(preview);
    preview.graph = guide();
    await settle();

    expect(exampleButton(preview)?.textContent?.trim()).toBe("Use example photo");
  });
});

describe.runIf(PRO)("fotot blir en riktig fil", () => {
  test("svaret är filens namn, och filen finns att lämna in", async () => {
    const preview = await mounted();

    await useExample(preview);

    expect(shadow(preview).querySelector<HTMLInputElement>("[data-file-name]")?.value).toBe(
      "testbil-fyra-vyer.jpg",
    );

    const files = preview.getFiles();

    expect(files).toHaveLength(1);
    expect(files[0]?.variableName).toBe("bilder");
    expect(files[0]?.file).toBeInstanceOf(File);
    expect(files[0]?.file.name).toBe("testbil-fyra-vyer.jpg");
    // Bytesen är fotots, inte ett tomt skal: filen på disk är ~170 kB.
    expect(files[0]?.file.size).toBeGreaterThan(10000);
  });

  test("och den reser med inlämningen som ett vanligt formulär kodar den", async () => {
    const preview = await mounted();

    await useExample(preview);

    const body = preview.getFormData();
    const sent = body.get("bilder");

    expect(sent).toBeInstanceOf(File);
    expect((sent as File).name).toBe("testbil-fyra-vyer.jpg");
  });

  test("markeringarna landar på exempelfotot som på ett eget", async () => {
    const preview = await mounted({ allowMarking: true });

    await useExample(preview);

    const area = shadow(preview).querySelector<HTMLElement>("[data-marking-area]");
    const image = shadow(preview).querySelector<HTMLImageElement>("[data-marking-image]");

    expect(area?.hidden).toBe(false);
    // Alt-texten är redaktörens ord om vad fotot visar — det enda en som inte
    // ser bilden har att gå på, och skälet till att den är obligatorisk.
    expect(image?.alt).toBe(ALT.sv);

    const canvas = shadow(preview).querySelector<HTMLElement>("[data-marking-canvas]");
    const box = canvas?.getBoundingClientRect();

    expect(box?.width ?? 0).toBeGreaterThan(50);

    canvas?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        clientX: (box?.left ?? 0) + (box?.width ?? 0) * 0.3,
        clientY: (box?.top ?? 0) + (box?.height ?? 0) * 0.5,
      }),
    );
    await settle();

    const marks = JSON.parse(
      shadow(preview).querySelector<HTMLInputElement>("[data-marking-store]")?.value || "[]",
    ) as { x: number; y: number }[];

    expect(marks).toHaveLength(1);
    // En tiondels procent hit eller dit är musens, inte markeringens.
    expect(marks[0]?.x).toBeCloseTo(30, 0);
    expect(marks[0]?.y).toBeCloseTo(50, 0);
  });

  test("ett eget foto efteråt ersätter exemplet — och dess alt-text", async () => {
    const preview = await mounted({ allowMarking: true });

    await useExample(preview);

    const input = shadow(preview).querySelector<HTMLInputElement>('input[type="file"]');
    const transfer = new DataTransfer();

    transfer.items.add(new File(["egen"], "egen-bild.jpg", { type: "image/jpeg" }));
    input!.files = transfer.files;
    input?.dispatchEvent(new Event("change"));
    await settle();

    expect(preview.getFiles()).toHaveLength(1);
    expect(preview.getFiles()[0]?.file.name).toBe("egen-bild.jpg");
    // Vi har ingenting sant att säga om besökarens eget foto.
    expect(shadow(preview).querySelector<HTMLImageElement>("[data-marking-image]")?.alt).toBe("");
  });

  /*
   * Adressen finns inte — och servern svarar ändå 200 med en HTML-sida, vilket
   * är precis vad en utvecklingsserver och många värdar gör. Det är därför
   * fältet prövar vad som kom tillbaka och inte bara att hämtningen gick.
   */
  test("en adress som inte svarar med ett foto säger till i fältet, och fältet står kvar", async () => {
    const preview = await mounted({ exampleImage: "/exempel/finns-inte.jpg" });

    await useExample(preview);

    expect(shadow(preview).querySelector("[data-file-notice]")?.textContent?.trim()).toBe(
      "Exempelfotot kunde inte hämtas. Välj en egen bild.",
    );
    expect(preview.getFiles()).toEqual([]);
    expect(shadow(preview).querySelector('input[type="file"]')).not.toBeNull();
  });
});
