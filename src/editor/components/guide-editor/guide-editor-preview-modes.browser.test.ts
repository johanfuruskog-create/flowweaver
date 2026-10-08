import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";

/**
 * De två knapparna under förhandsvisningen, och skillnaden mellan dem.
 *
 * De öppnade samma dialog och skiljdes bara av var den började — en storlek och
 * en startpunkt, inte två syften. Johan, 31/8: *"öppna i stort borde bara vara
 * granska, visa hur det ser ut på skärmen. De andra handlar om att köra hela
 * guiden."*
 *
 * Alltså: **Visa i full storlek** visar det valda steget i besökarens storlek
 * och stannar där. **Testa från start** kör guiden. Det som håller isär dem är
 * inte en inställning utan den `nodeId` dialogen redan får — pekar den på en
 * nod är det ett steg som granskas.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 160): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function editorAtQuestion(): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1200px; height: 800px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Har du bil?" },
          variableName: "bil",
          options: [
            { id: "ja", label: { sv: "Ja" }, value: "y" },
            { id: "nej", label: { sv: "Nej" }, value: "n" },
          ],
        },
      },
      { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [{ id: "c", from: { nodeId: "q", portId: "ja" }, to: { nodeId: "r", portId: "input" } }],
  } as never;

  await settle();
  editor.shadowRoot!
    .querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!
    .selectNodeById("q");
  await settle();

  return editor;
}

const press = async (editor: GuideEditor, action: string): Promise<void> => {
  const button = editor.shadowRoot!.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);

  if (!button) throw new Error(`Knappen ${action} finns inte.`);

  button.click();
  await settle();
};

const dialogPreview = (editor: GuideEditor): ShadowRoot => {
  const preview = editor.shadowRoot!
    .querySelector("guide-preview-dialog")
    ?.shadowRoot?.querySelector("guide-preview");

  if (!preview?.shadowRoot) throw new Error("Dialogen har ingen visare.");

  return preview.shadowRoot;
};

const note = (editor: GuideEditor): HTMLElement | null =>
  editor.shadowRoot!
    .querySelector("guide-preview-dialog")
    ?.shadowRoot?.querySelector<HTMLElement>(".guide-preview-dialog__still") ?? null;

describe("Visa i full storlek", () => {
  test("visar steget som besökaren ser det", async () => {
    /*
     * Kortet självt är oförändrat: riktiga svarsalternativ i riktig storlek.
     * Det var hela poängen — inte en sammanfattning, som sidopanelen ger.
     */
    const editor = await editorAtQuestion();

    await press(editor, "preview-open-dialog");

    expect(dialogPreview(editor).querySelectorAll('input[type="radio"]')).toHaveLength(2);
  });

  test("men går inte vidare: navigeringen ritas inte", async () => {
    const editor = await editorAtQuestion();

    await press(editor, "preview-open-dialog");

    const preview = dialogPreview(editor);

    expect(preview.querySelector('[data-action="next"]'), "Nästa").toBeNull();
    expect(preview.querySelector('[data-action="previous"]'), "Föregående").toBeNull();
  });

  test("och säger var man kör guiden i stället", async () => {
    /*
     * Utan raden är den tomma platsen under kortet oförklarad, och en
     * förhandsvisning utan Nästa läses som trasig. Namnet på den andra knappen
     * hämtas ur samma strängregister, så de inte kan glida isär.
     */
    const editor = await editorAtQuestion();

    await press(editor, "preview-open-dialog");

    expect(note(editor)?.hidden).toBe(false);
    expect(note(editor)?.textContent).toContain("Prova guiden");
  });
});

describe("Prova guiden från panelen", () => {
  // "Testa från start" öppnade dialogen med en EGEN motor — en andra väg att
  // köra guiden, utan spåret och provsvaren. Johan 1/9: onödig; knappen
  // startar nu samma prov som Guide-menyn, och Nästa panorerar arbetsytan.
  const bar = (editor: GuideEditor): HTMLElement | null =>
    editor.shadowRoot!
      .querySelector("node-editor")
      ?.shadowRoot?.querySelector<HTMLElement>("[data-proving-bar]") ?? null;

  const dialogOpen = (editor: GuideEditor): boolean =>
    editor.shadowRoot!
      .querySelector("guide-preview-dialog")
      ?.shadowRoot?.querySelector("dialog")?.open ?? false;

  test("knappen startar provet i stället för dialogen", async () => {
    const editor = await editorAtQuestion();

    await press(editor, "prove-guide");

    expect(bar(editor)?.hidden).toBe(false);
    expect(bar(editor)?.textContent).toContain("Provar guiden");
    expect(dialogOpen(editor)).toBe(false);
  });

  test("och Visa i full storlek är kvar som titt, opåverkad", async () => {
    const editor = await editorAtQuestion();

    await press(editor, "preview-open-dialog");
    editor.shadowRoot!
      .querySelector("guide-preview-dialog")
      ?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="close"]')
      ?.click();
    await settle();

    await press(editor, "prove-guide");

    expect(bar(editor)?.hidden).toBe(false);
    expect(dialogOpen(editor)).toBe(false);
  });
});

/**
 * Samma obesvarade variabel, två ytor, två svar — och skillnaden är inte
 * komponenten utan vad ytan är till för.
 *
 * `<guide-preview>` svarar på frågan *"hur ser en variabel utan värde ut?"*
 * med två grenar: besökarens streck och redaktörens etikettlucka. Vilken gren
 * en yta får avgörs av `editor-view`, och ytorna valde fel så länge ingen
 * frågade dem vad de var till för:
 *
 * - **Panelen** används *medan man bygger*. Där säger "Ålder" något som "–"
 *   inte gör, och den ska ha redaktörens bild.
 * - **Dialogen "Visa i full storlek"** finns för att visa vad *besökaren* ser.
 *   Då ska den visa det, streck och allt.
 *
 * Två ytor med olika svar på samma fråga glider isär om ingen vaktar dem, och
 * det är därför båda står i samma test (Johan 13/9).
 */

const withResultText = async (): Promise<GuideEditor> => {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1200px; height: 800px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "number-question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Hur gammal är du?" },
          variableName: "alder",
          variableLabel: { sv: "Ålder" },
        },
      },
      {
        id: "r",
        type: "result",
        position: { x: 400, y: 0 },
        // Obesvarad: ingen har svarat något i någon av de två ytorna.
        data: { title: { sv: "Klart" }, description: { sv: "Du fyller {{alder}} i år." } },
      },
    ],
    connections: [{ id: "c", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "r", portId: "input" } }],
  } as never;

  await settle();
  editor.shadowRoot!
    .querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!
    .selectNodeById("r");
  // Panelen ritar bara när dess flik står framme — den är sidofältets andra
  // läge, och utan klicket säger den "Ingen guide har valts".
  editor.shadowRoot!
    .querySelector<HTMLButtonElement>('[data-sidebar-mode="preview"]')!
    .click();
  await settle();

  return editor;
};

const panelPreview = (editor: GuideEditor): ShadowRoot => {
  const preview = editor.shadowRoot!.querySelector(
    ".guide-editor__preview-panel guide-preview",
  );

  if (!preview?.shadowRoot) throw new Error("Panelen har ingen visare.");

  return preview.shadowRoot;
};

describe("en obesvarad variabel i editorns två ytor", () => {
  test("panelen visar variabelns namn — den används medan man bygger", async () => {
    const editor = await withResultText();
    const panel = panelPreview(editor);

    /*
     * Först att panelen över huvud taget ritade texten. Utan den raden går
     * testet rött med samma ord för två helt olika fel — "panelen ritade inget"
     * och "panelen ritade besökarens streck" — och det första var vad den
     * första versionen av testet i själva verket mätte (fliken var stängd).
     */
    expect(panel.textContent).toContain("Du fyller");

    const gaps = [...panel.querySelectorAll(".guide-preview__variable-gap")].map(
      (gap) => gap.textContent?.trim(),
    );

    expect(gaps).toEqual(["Ålder"]);
    expect(panel.textContent).not.toContain("–");
  });

  test("dialogen visar strecket — den visar vad besökaren ser", async () => {
    const editor = await withResultText();

    await press(editor, "preview-open-dialog");

    const dialog = dialogPreview(editor);

    expect(dialog.querySelector(".guide-preview__variable-gap")).toBeNull();
    expect(dialog.textContent).toContain("Du fyller – i år.");
  });
});
