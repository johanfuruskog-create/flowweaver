import { afterEach, describe, expect, test, vi } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

afterEach(() => {
  document.body.replaceChildren();
});

function graf(meta?: GraphData["meta"]): GraphData {
  return {
    startNodeId: "q1",
    nodes: [
      {
        id: "q1",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: "Fråga",
          variableName: "a",
          options: [{ id: "o", label: "Ja", value: "ja" }],
        },
      },
    ],
    connections: [],
    ...(meta ? { meta } : {}),
  };
}

function montera(data: GraphData): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  // Opt in: the default is readonly, and this test builds.
  editor.setAttribute("mode", "administrator");
  document.body.append(editor);
  editor.graph = data;
  return editor;
}

function panel(editor: GuideEditor): ShadowRoot {
  const element = editor.shadowRoot?.querySelector("properties-panel");
  const root = element?.shadowRoot;

  if (!root) {
    throw new Error("Egenskapspanelen finns inte.");
  }

  return root;
}

function field(editor: GuideEditor, namn: string): HTMLInputElement {
  const element = panel(editor).querySelector<HTMLInputElement>(
    `[data-guide-meta="${namn}"]`,
  );

  if (!element) {
    throw new Error(`Fältet ${namn} finns inte i panelen.`);
  }

  return element;
}

function skriv(element: HTMLInputElement, text: string): void {
  element.value = text;
  element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
}

describe("guidens egna uppgifter", () => {
  // The panel shows the guide's settings when no node is selected. The details
  // about the guide belong at the top there: they answer what you are looking
  // at, before Språk and Visartexter answer how it should look.
  test("the fields show when no node is selected", () => {
    const editor = montera(graf());

    expect(field(editor, "name")).toBeTruthy();
    expect(field(editor, "description")).toBeTruthy();
    expect(field(editor, "owner")).toBeTruthy();
  });

  test("the section sits above Language and Viewer texts", () => {
    const editor = montera(graf());

    const rubriker = [...panel(editor).querySelectorAll("h3")].map(
      (rubrik) => rubrik.textContent?.trim() ?? "",
    );

    expect(rubriker[0]).toBe("Guiden");
    expect(rubriker.length).toBeGreaterThan(1);
  });

  test("ett skrivet namn hamnar i grafen", () => {
    const editor = montera(graf());

    skriv(field(editor, "name"), "Ansöka om bygglov");

    expect(editor.getData().meta?.name).toEqual({ sv: "Ansöka om bygglov" });
  });

  // The owner is a name or a shared mailbox. It is not translated, unlike the
  // name and the description.
  test("the owner is saved as plain text, not as a language map", () => {
    const editor = montera(graf());

    skriv(field(editor, "owner"), "bygglov@exempel.se");

    expect(editor.getData().meta?.owner).toBe("bygglov@exempel.se");
  });

  test("an empty field is removed rather than saved empty", () => {
    const editor = montera(graf({ owner: "gammal@exempel.se" }));

    skriv(field(editor, "owner"), "");

    expect(editor.getData().meta?.owner).toBeUndefined();
  });

  test("existing values are shown in the fields", () => {
    const editor = montera(
      graf({ name: "Bygglov", description: "Vad som krävs", owner: "enheten" }),
    );

    expect(field(editor, "name").value).toBe("Bygglov");
    expect(field(editor, "description").value).toBe("Vad som krävs");
    expect(field(editor, "owner").value).toBe("enheten");
  });

  // Criterion 7: an older guide without these fields must load as before.
  test("a guide without details loads and shows empty fields", () => {
    const editor = montera(graf());

    expect(editor.getData().meta).toBeUndefined();
    expect(field(editor, "name").value).toBe("");
    expect(editor.getData().nodes).toHaveLength(1);
  });

  // Stämpeln sätts vid sparning och export, aldrig vid varje ändring — annars
  // blir varje jämförelse mellan två versioner falskt positiv.
  test("typing in a field does not stamp the timestamp", () => {
    const editor = montera(graf());

    skriv(field(editor, "name"), "Bygglov");

    expect(editor.getData().meta?.updatedAt).toBeUndefined();
  });

  test("the timestamp is shown but cannot be changed", () => {
    const editor = montera(graf({ updatedAt: "2026-08-01T09:00:00.000Z" }));

    const visad = panel(editor).querySelector<HTMLElement>("[data-guide-updated]");

    expect(visad?.textContent?.trim()).not.toBe("");
    expect(
      panel(editor).querySelector('[data-guide-meta="updatedAt"]'),
    ).toBeNull();
  });

  test("a guide never saved says so", () => {
    const editor = montera(graf());

    const visad = panel(editor).querySelector<HTMLElement>("[data-guide-updated]");

    expect(visad?.textContent?.trim()).toBe("Inte sparad än");
  });
});

/**
 * Story 116 — redaktören slår på mätaren per guide.
 *
 * Panelen när ingen nod är markerad, bredvid guidens namn och beskrivning. En
 * switch av editorns eget slag, samma som en nods booleska egenskap får (Johan
 * 13/9: *"gör en switch ... som vi ibland gjort inställningarna"*). Att texten
 * inte säger "progress" är hela poängen och därför en av kontrollerna här.
 */
describe("mätaren slås på per guide", () => {
  const box = (editor: GuideEditor): HTMLInputElement => {
    const element = panel(editor).querySelector<HTMLInputElement>(
      "[data-guide-progress]",
    );

    if (!element) {
      throw new Error("Switchen för mätaren finns inte i panelen.");
    }

    return element;
  };

  const toggle = (element: HTMLInputElement, on: boolean): void => {
    element.checked = on;
    element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  };

  test("kontrollen är en switch och talar om vad besökaren får se", () => {
    const editor = montera(graf());

    expect(box(editor).type).toBe("checkbox");
    expect(box(editor).getAttribute("role")).toBe("switch");
    expect(box(editor).checked).toBe(false);
    expect(panel(editor).textContent).toContain("Visa hur långt det är kvar");
    expect(panel(editor).textContent).not.toContain("progress");
  });

  test("påslagen skriver settings.progress", () => {
    const editor = montera(graf());

    toggle(box(editor), true);

    expect(editor.getData().settings?.progress).toBe(true);
  });

  // K7: en guide som aldrig haft fältet ska komma ut som den gick in. Ett
  // `false` ingen bett om är en ändring av en fil editorn bara öppnat.
  test("avslagen tar bort nyckeln i stället för att skriva false", () => {
    const editor = montera({ ...graf(), settings: { progress: true } });

    expect(box(editor).checked).toBe(true);

    toggle(box(editor), false);

    expect(editor.getData().settings?.progress).toBeUndefined();
  });

  test("en guide utan fältet laddas som förut", () => {
    const editor = montera(graf());

    expect(editor.getData().settings?.progress).toBeUndefined();
  });
});

/*
 * Guidens egen identitet (berättelse 123).
 *
 * `serviceId` i en inlämning är den här: det som skiljer två guider som båda
 * skapar en felanmälan. Den myntas en gång, vid första spara eller export, och
 * byter aldrig — hela värdet ligger i att den är densamma i morgon.
 *
 * Exporten mäts genom den riktiga vägen och inte genom en privat metod: filen
 * är det som når mottagaren, och `createObjectURL` är det enda stället där den
 * går att läsa.
 */
describe("guidens id", () => {
  const exportedaFiler = (): Promise<string>[] => {
    const filer: Promise<string>[] = [];

    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      filer.push((blob as Blob).text());
      return "blob:test";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    return filer;
  };

  /** Arkiv → Exportera, den väg en redaktör faktiskt tar. */
  const exportera = (editor: GuideEditor): void => {
    const toolbar = editor.shadowRoot?.querySelector("editor-toolbar")?.shadowRoot;
    const item = toolbar?.querySelector<HTMLButtonElement>('[data-action="export"]');

    if (!item) throw new Error("Arkiv saknar Exportera.");

    item.click();
  };

  test("en guide utan id får ett när värden ombeds spara", () => {
    const editor = montera(graf());

    expect(editor.getData().meta?.id, "inget id innan någon sparar").toBeUndefined();

    editor.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true }),
    );

    const id = editor.getData().meta?.id;

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  test("och samma id nästa gång — två exporter av samma guide bär ett id", async () => {
    const filer = exportedaFiler();
    const editor = montera(graf());

    exportera(editor);
    exportera(editor);

    const [forsta, andra] = await Promise.all(filer);
    const id = (JSON.parse(forsta!) as GraphData).meta?.id;

    expect(id, "första exporten myntar").toBeTypeOf("string");
    expect((JSON.parse(andra!) as GraphData).meta?.id, "andra exporten myntar inte om").toBe(id);
    expect(editor.getData().meta?.id, "och editorn bär samma id").toBe(id);
  });

  test("ett id som guiden redan har behålls", () => {
    const editor = montera(graf({ id: "redan-mitt-id" }));

    editor.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true }),
    );

    expect(editor.getData().meta?.id).toBe("redan-mitt-id");
  });

  // QA, mutationskontroll (17/9): innehållsspråket redaktören översätter till
  // är en helt annan axel än guidens identitet — samma id ska stå kvar oavsett
  // vilket språk som visas i panelerna.
  test("id:t rör sig inte när redaktören byter innehållsspråk", () => {
    const editor = montera(graf({ id: "redan-mitt-id" }));

    editor.shadowRoot?.dispatchEvent(
      new CustomEvent("locale-change", {
        detail: { locale: "en" },
        bubbles: true,
        composed: true,
      }),
    );

    expect(editor.getData().meta?.id).toBe("redan-mitt-id");
  });

  /*
   * QA, mutationskontroll (berättelse 124): `meta.versionId` är den frysta
   * versionens eget id, skrivet av LAGRINGEN när den fryser en version —
   * aldrig av editorn, som inte vet något om versioner. Ett `serviceVersion`
   * en editor hittat på hade varit ospårbart hos värden.
   */
  test("versionId är inte editorns att sätta — spara skriver det aldrig", () => {
    const editor = montera(graf());

    editor.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true }),
    );

    expect(editor.getData().meta?.versionId).toBeUndefined();
  });

  test("och ett versionId som redan fanns i filen rörs inte av en sparning", () => {
    const editor = montera(graf({ id: "redan-mitt-id", versionId: "v-3f2a" }));

    editor.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true }),
    );

    expect(editor.getData().meta?.versionId).toBe("v-3f2a");
  });
});
