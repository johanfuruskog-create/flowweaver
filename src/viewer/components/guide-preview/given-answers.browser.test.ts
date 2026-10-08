import { afterEach, describe, expect, test, vi } from "vitest";
import "../../node-types/default-node-types";
import "./guide-preview";
import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/*
 * Story 085: the answers the host already knows. A login gives a name and a
 * personnummer; a saved run gives everything back. Both arrive through
 * `given` — nothing is locked, everything is validated, the day is the
 * engine's own.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const graph: GraphData = {
  startNodeId: "who",
  settings: { sourceLocale: "sv" },
  nodes: [
    { id: "who", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Vem är du?" } } },
    { id: "f-namn", type: "text-question", parentPageId: "who", order: 0, position: { x: 0, y: 0 },
      data: { title: { sv: "Namn" }, variableName: "namn" } },
    { id: "f-pnr", type: "text-question", parentPageId: "who", order: 1, position: { x: 0, y: 0 },
      data: { title: { sv: "Personnummer" }, variableName: "pnr", format: "personnummer" } },
    { id: "more", type: "text-question", position: { x: 100, y: 0 },
      data: { title: { sv: "Hej {{namn}}, var bor du?" }, variableName: "ort" } },
    // Declared, unreached: a lookup answers in parts (`land.value`), never as `land`.
    { id: "land", type: "autocomplete-question", position: { x: 300, y: 0 },
      data: { title: { sv: "Land" }, variableName: "land", source: "codelist" } },
    { id: "r", type: "result", position: { x: 200, y: 0 },
      data: { title: { sv: "Klart, {{namn}} i {{ort}}" }, description: { sv: "Dagen är {{idag}}." } } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "who", portId: "continue" }, to: { nodeId: "more", portId: "input" } },
    { id: "c2", from: { nodeId: "more", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
  ],
} as never;

const mount = async (given: GuidePreview["given"], before = true): Promise<GuidePreview> => {
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.setAttribute("today", "2030-01-02");
  document.body.append(preview);
  if (before) preview.given = given;
  preview.graph = graph;
  if (!before) preview.given = given;
  await settle();
  return preview;
};

const field = (preview: GuidePreview, id: string): HTMLInputElement =>
  preview.shadowRoot!.querySelector<HTMLInputElement>(`[data-page-field-id="${id}"] input`)!;

describe("svaren som värden redan vet (story 085)", () => {
  test("satt före guiden: fälten står ifyllda, texten läser namnet, allt går att ändra", async () => {
    const preview = await mount({ answers: { namn: "Anna", pnr: "201209042389", idag: "1999-01-01" } });
    const root = preview.shadowRoot!;

    expect(field(preview, "f-namn").value).toBe("Anna");
    // Shown the way it is printed on the card, though the host gave twelve digits.
    expect(field(preview, "f-pnr").value).toBe("20120904-2389");

    root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();
    // Counts as answered: the next step's title reads the name.
    expect(root.querySelector("h2")!.textContent!.trim()).toBe("Hej Anna, var bor du?");
    // The host's `idag` lost to the engine's day (story 086).
    expect(preview.getAnswers()).toMatchObject({ namn: "Anna", pnr: "201209042389" });
    expect(preview.getAnswers()).not.toHaveProperty("idag");
  });

  test("satt efter guiden gäller också, och ett fel värde är ett fel som syns", async () => {
    const preview = await mount({ answers: { pnr: "abc" } }, false);
    const root = preview.shadowRoot!;

    expect(field(preview, "f-pnr").value).toBe("abc");
    field(preview, "f-namn").value = "Bo";
    field(preview, "f-namn").dispatchEvent(new Event("input", { bubbles: true }));
    root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();

    // Still on the page, with the format's own error at the field.
    expect(root.querySelector("h2")!.textContent!.trim()).toBe("Vem är du?");
    expect(root.querySelector('[data-page-field-id="f-pnr"] .guide-preview__field-error')).not.toBeNull();

    // Given again, mid-run: what was answered stays, the new value lands beside it.
    field(preview, "f-pnr").value = "201209042389";
    field(preview, "f-pnr").dispatchEvent(new Event("input", { bubbles: true }));
    root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();
    preview.given = { answers: { ort: "Kiruna" } };
    await settle();
    expect(preview.getAnswers()).toMatchObject({ namn: "Bo", pnr: "201209042389", ort: "Kiruna" });
    expect(root.querySelector<HTMLInputElement>("input")!.value).toBe("Kiruna");
  });

  test("fortsätt där du var: svaren och steget tillbaka, och Börja om behåller det värden gav", async () => {
    const preview = await mount({ answers: { namn: "Cia", pnr: "201209042389", ort: "Umeå" }, nodeId: "more" });
    const root = preview.shadowRoot!;

    expect(preview.getCurrentNodeId()).toBe("more");
    expect(root.querySelector("h2")!.textContent!.trim()).toBe("Hej Cia, var bor du?");
    expect(root.querySelector<HTMLInputElement>("input")!.value).toBe("Umeå");

    preview.restart();
    await settle();
    expect(preview.getCurrentNodeId()).toBe("who");
    expect(field(preview, "f-namn").value).toBe("Cia");
  });

  test("ett namn ingen nod känner fäller inget, men står att läsa", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const preview = await mount({
      answers: { namn: "Dan", kundnummer: "42", land: { value: "SE", label: "Sverige" } },
      nodeId: "finns-inte",
    });

    expect(preview.getCurrentNodeId()).toBe("who");
    // `land` is declared through its parts; `kundnummer` by nothing.
    expect(preview.unmatchedGiven()).toEqual(["kundnummer"]);
    expect(preview.getAnswers()).toMatchObject({ kundnummer: "42" });
    expect(info.mock.calls.map(([line]) => String(line))).toEqual([
      'guide-preview: no step "finns-inte" to resume at — starting from the first.',
      "guide-preview: given answers no node declares: kundnummer",
    ]);
    info.mockRestore();
  });

  test("satt som egen egenskap före uppgraderingen — värdens vanligaste ordning som script-tagg", async () => {
    const preview = document.createElement("guide-preview") as GuidePreview;
    // A host that runs before the class is registered leaves OWN properties.
    Object.defineProperty(preview, "given", { value: { answers: { namn: "Eva" } }, writable: true, configurable: true, enumerable: true });
    Object.defineProperty(preview, "graph", { value: graph, writable: true, configurable: true, enumerable: true });
    document.body.append(preview);
    await settle();

    expect(field(preview, "f-namn").value).toBe("Eva");
  });

  test("bara svar följer med: tal blir text, funktioner och null faller bort", async () => {
    const preview = await mount({
      answers: { namn: 7, pnr: null, ort: () => "x" } as never,
    });

    expect(preview.given).toEqual({ answers: { namn: "7" }, nodeId: null });
    expect(field(preview, "f-namn").value).toBe("7");
  });
});
