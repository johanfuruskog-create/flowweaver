import { afterEach, describe, expect, test } from "vitest";
import "../../node-types/default-node-types";
import "./guide-preview";
import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/*
 * Story 087: *till* är efter *från*. Gränsen är det andra fältet, och felet
 * står där det uppstår — vid *till*, med *från*-fältets ord — som ett
 * obligatoriskt-fel gör. Ändras *från* så att felet försvinner, försvinner
 * meddelandet med det.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Från och till på samma sida, eller från ett steg före. */
function graph(shape: "same-page" | "earlier-step"): GraphData {
  const fran = shape === "same-page"
    ? { id: "fran", type: "date-question", parentPageId: "period", order: 1, position: { x: 0, y: 0 },
        data: { title: { sv: "Från" }, variableName: "fran" } }
    : { id: "fran", type: "date-question", position: { x: 0, y: 0 },
        data: { title: { sv: "Från" }, variableName: "fran" } };

  return {
    startNodeId: shape === "same-page" ? "period" : "fran",
    settings: { sourceLocale: "sv" },
    nodes: [
      fran,
      { id: "period", type: "page", position: { x: 100, y: 0 }, data: { title: { sv: "Period" } } },
      { id: "till", type: "date-question", parentPageId: "period", order: 2, position: { x: 0, y: 0 },
        data: { title: { sv: "Till" }, variableName: "till", min: "{{fran}}" } },
      { id: "r", type: "result", position: { x: 200, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [
      ...(shape === "earlier-step"
        ? [{ id: "c0", from: { nodeId: "fran", portId: "continue" }, to: { nodeId: "period", portId: "input" } }]
        : []),
      { id: "c1", from: { nodeId: "period", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as never;
}

const next = (root: ShadowRoot) => root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
const input = (root: ShadowRoot, key: string) => root.querySelector<HTMLInputElement>(`[data-page-field-id="${key}"] input`)!;
const type = (element: HTMLInputElement, value: string) => {
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
};
const errorAt = (root: ShadowRoot, key: string): string | null =>
  root.querySelector(`[data-page-field-id="${key}"] .guide-preview__field-error`)?.textContent?.trim() ?? null;

async function mount(shape: "same-page" | "earlier-step"): Promise<ShadowRoot> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  document.body.append(preview);
  preview.graph = graph(shape);
  await settle();
  return preview.shadowRoot!;
}

describe("till före från (story 087)", () => {
  test("på samma sida: felet står vid till med från-fältets ord, och försvinner när från ändras", async () => {
    const root = await mount("same-page");

    type(input(root, "fran"), "2026-03-10");
    type(input(root, "till"), "2026-03-01");
    next(root);
    await settle();

    expect(errorAt(root, "till")).toBe("Datumet måste vara samma som eller efter Från.");
    expect(errorAt(root, "fran")).toBeNull();
    // Kopplat till fältet som andra fältfel (K3, K4).
    const till = input(root, "till");
    expect(till.getAttribute("aria-invalid")).toBe("true");
    expect(root.getElementById(till.getAttribute("aria-describedby")!)?.textContent?.trim())
      .toBe("Datumet måste vara samma som eller efter Från.");

    // Besökaren rättar från i stället för till — felet gäller inte längre.
    type(input(root, "fran"), "2026-03-01");
    await settle();
    expect(errorAt(root, "till")).toBeNull();
    expect(till.hasAttribute("aria-invalid")).toBe(false);

    next(root);
    await settle();
    expect(root.querySelector('[data-node-type="result"]')).toBeTruthy();
  });

  test("från i ett tidigare steg gäller ändå — värdet finns", async () => {
    const root = await mount("earlier-step");

    type(root.querySelector<HTMLInputElement>('input[type="date"]')!, "2026-03-10");
    next(root);
    await settle();

    type(input(root, "till"), "2026-03-09");
    next(root);
    await settle();
    expect(errorAt(root, "till")).toBe("Datumet måste vara samma som eller efter Från.");

    type(input(root, "till"), "2026-03-10");
    next(root);
    await settle();
    expect(root.querySelector('[data-node-type="result"]')).toBeTruthy();
  });

  test("ett tomt från är ingen gräns", async () => {
    const root = await mount("same-page");

    type(input(root, "till"), "2020-01-01");
    next(root);
    await settle();

    expect(root.querySelector('[data-node-type="result"]')).toBeTruthy();
  });
});
