import { userEvent } from "@vitest/browser/context";
import { afterEach, describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";
import "../editor/components/guide-editor/guide-editor";

import { textProbeGraph } from "../data/text-probe-graph";
import { LocalStorageGraphStore } from "./local-storage-graph-store";
import { AutosaveController } from "./autosave-controller";
import { createSaveStatus } from "./save-status";

import type { GuideEditor } from "../editor/components/guide-editor/guide-editor";
import type { RichTextField } from "../editor/components/rich-text-field/rich-text-field";
import type { GraphData } from "../viewer/types/graph";

/**
 * Uppdrag 28/9, 1d: hela kedjan i exempelsidans lagring.
 *
 * `main.ts` sätter ihop tre delar för varje exempelsida: `AutosaveController`
 * (debouncar `graph-changed`), `LocalStorageGraphStore` (skriver till
 * `localStorage`, story 124) och `save-status.ts` (den fasta statusytan,
 * uppdrag 28/9 Del 6). Var för sig har de egna prov —
 * `autosave-controller.browser.test.ts` mäter debouncen mot en fejkad
 * lagring och en bar `EventTarget`, `save-status.browser.test.ts` mäter
 * ytan isolerad, `local-storage-graph-store.test.ts` mäter lagringens eget
 * format — men ingen av dem kör kedjan hela vägen: en RIKTIG redigering i
 * en RIKTIG `<guide-editor>`, genom den riktiga lagringen, till en NY
 * editor som läser tillbaka det som skrevs.
 *
 * Fixturen (`text-probe-graph.ts`, sidan `probe-page-wrap`) bär redan
 * bricka, fet stil, kursiv, länk och lista i BÅDA språken — precis den
 * standardformats-korsning som en `{ sv, en }`-sammanslagning kan tappa
 * (story 138s `[object Object]`, uppdrag 28/9 Del 1 var ett annat exempel).
 * Provet lägger bara till lite text i varje fält, i det aktiva språket
 * (sv), och kräver att ALLT — det gamla och det nya, i BÅDA språken —
 * kommer tillbaka oskadat efter en riktig sparning och en ny editor.
 */

const STORAGE_KEY = "flowweaver:test:autosave-chain";

afterEach(() => {
  document.body.replaceChildren();
  window.localStorage.removeItem(STORAGE_KEY);
});

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Samma ord som `main.ts`s `APP_TEXTS.sv` — sajtens egna, inte bibliotekets. */
const WORDS = {
  saved: (time: string) => `Sparad lokalt ${time}.`,
  failed: (reason: string) => reason,
  nothingToSave: "Allt är redan sparat lokalt.",
  dismiss: "Stäng",
};

async function mountEditor(graph: GraphData): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("active-locale", "sv");
  editor.style.cssText = "display: block; width: 1300px; height: 900px;";
  document.body.append(editor);
  editor.graph = structuredClone(graph) as never;
  await settle(300);
  return editor;
}

function selectNode(editor: GuideEditor, nodeId: string): void {
  (
    editor.shadowRoot!.querySelector("node-editor") as unknown as {
      selectNodeById?(id: string): void;
    }
  ).selectNodeById?.(nodeId);
}

function panelField(editor: GuideEditor, property: string): RichTextField {
  return editor.shadowRoot!
    .querySelector("properties-panel")!
    .shadowRoot!.querySelector<RichTextField>(`rich-text-field[data-property="${property}"]`)!;
}

/** Places the caret at the end of a rich-text-field's own editable and types. */
async function typeAtEnd(field: RichTextField, typed: string): Promise<void> {
  const text = field.shadowRoot!.querySelector<HTMLElement>("[data-text]")!;

  text.focus();
  await userEvent.keyboard(`{Control>}{End}{/Control}${typed}`);
}

describe("hela kedjan: redigering, autosparning, omladdning (uppdrag 28/9, 1d)", () => {
  test("standardformatet (bricka, fet, lista) kommer tillbaka i båda fälten och båda språken, sparstatusen visar tiden, och ett lagringsfel syns och stängs", async () => {
    const editorA = await mountEditor(textProbeGraph);

    selectNode(editorA, "probe-page-wrap");
    await settle();

    const store = new LocalStorageGraphStore(window.localStorage, STORAGE_KEY);
    const saveStatus = createSaveStatus(WORDS, { announceDelay: 10 });

    document.body.append(saveStatus.element);

    const controller = new AutosaveController({
      source: editorA,
      store,
      delay: 40,
      onSave: (result) => {
        if (!result.success) {
          saveStatus.failed(result.message);
          return;
        }
        saveStatus.saved(
          new Date(result.savedAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }),
        );
      },
    });

    controller.connect();

    // Redigera rubriken: lägg till text sist, på det aktiva språket (sv).
    // Brickan ({{namn}}) rörs inte — den ska bara överleva resan.
    await typeAtEnd(panelField(editorA, "title"), " Ändrad.");
    await settle();

    // Redigera beskrivningen: lägg till text sist. Brickan, fetstilen och
    // listan som redan står där rörs inte heller.
    await typeAtEnd(panelField(editorA, "description"), " Mer text.");
    await settle();

    // Vänta ut autosparningen (40 ms delay, marginal för debounce + skrivning).
    await settle(250);

    const savedStatusText = saveStatus.element.querySelector("[data-save-text]")!.textContent ?? "";

    expect(savedStatusText, "sparstatusen visar tiden, som HH:MM").toMatch(/^Sparad lokalt \d{2}:\d{2}\.$/);

    const loaded = await store.load("");

    expect(loaded.status, "sparat till lagringen").toBe("success");
    if (loaded.status !== "success") return;

    const originalNode = textProbeGraph.nodes.find((node) => node.id === "probe-page-wrap")!;
    const savedNode = loaded.graph.nodes.find((node) => node.id === "probe-page-wrap")!;
    // `data` är `Record<string, unknown>` i grafen; CI:s `tsc` fällde en oformad läsning (28/9).
    const originalTitle = originalNode.data.title as { sv: string; en: string };
    const savedTitle = savedNode.data.title as { sv: string; en: string };
    const savedDescription = savedNode.data.description as { sv: string; en: string };

    // Det redigerade språket: det nya OCH det gamla, i samma fält.
    expect(savedTitle.sv, "rubriken (sv): det nya").toContain("Ändrad.");
    expect(savedTitle.sv, "rubriken (sv): brickan kvar").toContain("{{namn}}");
    expect(savedDescription.sv, "beskrivningen (sv): det nya").toContain("Mer text.");
    expect(savedDescription.sv, "beskrivningen (sv): fetstilen kvar").toContain("**fet text**");
    expect(savedDescription.sv, "beskrivningen (sv): listan kvar").toContain("- En punkt i en lista");
    expect(savedDescription.sv, "beskrivningen (sv): brickan kvar").toContain("{{namn}}");

    // Det ORÖRDA språket: oförändrat, inte sammanslaget eller tappat.
    expect(savedTitle.en, "rubriken (en), orörd").toBe(originalTitle.en);
    expect(savedDescription.en, "beskrivningen (en): fetstilen kvar").toContain("**bold text**");
    expect(savedDescription.en, "beskrivningen (en): listan kvar").toContain("- A list item");
    expect(savedDescription.en, "beskrivningen (en): brickan kvar").toContain("{{namn}}");

    // "Omladdning": en NY editor, som bara känner det lagringen gav tillbaka.
    const editorB = await mountEditor(loaded.graph);

    selectNode(editorB, "probe-page-wrap");
    await settle();

    expect(panelField(editorB, "title").value, "rubriken (sv) tillbaka i den nya editorn").toContain("Ändrad.");
    expect(panelField(editorB, "description").value, "beskrivningen (sv) tillbaka").toContain("Mer text.");
    expect(panelField(editorB, "description").value, "listan tillbaka").toContain("En punkt i en lista");

    editorB.setAttribute("active-locale", "en");
    await settle(200);

    expect(panelField(editorB, "title").value, "rubriken (en), fortfarande orörd").toBe(savedTitle.en);
    expect(panelField(editorB, "description").value, "beskrivningen (en), fortfarande orörd").toContain("A list item");

    // Ett provocerat lagringsfel: en trasig lagring bakom samma editor och
    // samma statusyta som förut — mockad, inte en fylld localStorage (uppdraget
    // ger båda som alternativ), för att felet ska vara deterministiskt.
    controller.disconnect();
    const failureMessage = "Guiden kunde inte sparas lokalt i webbläsaren.";
    const failingController = new AutosaveController({
      source: editorA,
      store: { saveDraft: async () => ({ success: false as const, message: failureMessage }) },
      delay: 40,
      onSave: (result) => {
        if (!result.success) {
          saveStatus.failed(result.message);
          return;
        }
        saveStatus.saved("x");
      },
    });

    failingController.connect();
    await typeAtEnd(panelField(editorA, "title"), " Igen.");
    await settle(200);

    expect(
      saveStatus.element.querySelector("[data-save-text]")!.textContent,
      "felet syns i statusytan, med lagringens egen mening",
    ).toBe(failureMessage);
    expect(saveStatus.element.hasAttribute("data-failed"), "märkt som fel").toBe(true);

    const dismiss = saveStatus.element.querySelector<HTMLButtonElement>(".save-status__dismiss")!;

    expect(dismiss.hidden, "Stäng syns när det är fel").toBe(false);
    dismiss.click();

    expect(saveStatus.element.hasAttribute("data-failed"), "felet stängt").toBe(false);
    expect(
      saveStatus.element.querySelector("[data-save-text]")!.textContent,
      "tillbaka till senaste lyckade sparning",
    ).toBe(savedStatusText);

    failingController.disconnect();
  });
});
