import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * The file field's own button (Astra 1/10, bilaga 10 punkt 11): *Välj fil* in
 * the viewer's language as a neutral outline button, the browser's picker
 * kept behind it, the chosen name shown, and on a step of its own the
 * question not repeated as a visible label under the heading.
 *
 * Measured 30/9 (genomgången, V14): the browser's button said *Choose File*
 * on a Swedish guide, and *Har du bilder på skadan?* stood twice.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 120));

const fileNode = (extra: Record<string, unknown> = {}) => ({
  id: "photo", type: "file-question", position: { x: 0, y: 0 },
  data: { title: { sv: "Har du bilder på skadan?", en: "Do you have photos?" }, variableName: "bild", accept: ".jpg,.png", ...extra },
});

async function mount(nodes: unknown[], startNodeId: string, locale = "sv"): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.style.cssText = "display:block;width:640px;";
  preview.setAttribute("active-locale", locale);
  document.body.append(preview);
  preview.graph = { startNodeId, settings: { sourceLocale: "sv", locales: ["sv", "en"] }, nodes, connections: [] } as unknown as GraphData;
  await settle();
  return preview;
}

const visible = (element: Element | null): boolean => {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 2 && rect.height > 2;
};

describe("filfältets knapp", () => {
  test("Välj fil på visarens språk, och webbläsarens väljare står kvar bakom den", async () => {
    const preview = await mount([fileNode()], "photo");
    const root = preview.shadowRoot!;
    const button = root.querySelector<HTMLButtonElement>("[data-file-pick]")!;
    const input = root.querySelector<HTMLInputElement>("input[type='file'][data-file-field]")!;

    expect(button.textContent?.trim()).toBe("Välj fil");
    expect(getComputedStyle(button).borderTopColor, "neutral kontur, --fw-border-control").toBe("rgb(102, 112, 133)");
    // Half a hundredth, as the K6 gate: a 44 px box measures 43.99999… at times.
    expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44 - 0.01);
    expect(visible(input), "väljaren syns inte själv").toBe(false);
    expect(input.tabIndex).toBe(-1);

    let opened = false;
    input.addEventListener("click", (event) => {
      opened = true;
      event.preventDefault();
    });
    button.click();
    expect(opened, "knappen öppnar webbläsarens väljare").toBe(true);
  });

  test("ett eget steg: knappen står 24 px under beskrivningen, som varje annat stegs kontroll", async () => {
    // Fia 1/10 (B4 review): with the label hidden, *Välj fil* stood 0 px
    // under the description.
    const preview = await mount([fileNode({ description: { sv: "Frivilligt — en bild gör bedömningen snabbare." } })], "photo");
    const root = preview.shadowRoot!;
    const description = root.querySelector("h2")!.nextElementSibling!;
    const button = root.querySelector<HTMLButtonElement>("[data-file-pick]")!;

    expect(description.textContent).toContain("Frivilligt");
    expect(Math.round(button.getBoundingClientRect().top - description.getBoundingClientRect().bottom)).toBe(24);
  });

  test("på engelska säger knappen det på engelska", async () => {
    const preview = await mount([fileNode()], "photo", "en");

    expect(preview.shadowRoot!.querySelector("[data-file-pick]")!.textContent?.trim()).toBe("Choose a file");
  });

  test("ett valt namn syns bredvid knappen", async () => {
    const preview = await mount([fileNode()], "photo");
    const root = preview.shadowRoot!;
    const input = root.querySelector<HTMLInputElement>("input[type='file'][data-file-field]")!;
    const transfer = new DataTransfer();
    transfer.items.add(new File(["x"], "skadan.jpg", { type: "image/jpeg" }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change"));
    await settle();

    const chosen = root.querySelector<HTMLElement>("[data-file-chosen]")!;
    expect(chosen.textContent?.trim()).toBe("skadan.jpg");
    expect(visible(chosen)).toBe(true);
  });

  test("ett eget steg upprepar inte frågan som synlig etikett, men knappen beskrivs av den", async () => {
    const preview = await mount([fileNode()], "photo");
    const root = preview.shadowRoot!;
    const label = root.querySelector<HTMLElement>("#page-file-label-photo")!;
    const button = root.querySelector<HTMLButtonElement>("[data-file-pick]")!;

    expect(root.querySelector("h2")!.textContent).toContain("Har du bilder på skadan?");
    expect(visible(label), "ingen andra synlig rubrik").toBe(false);
    expect(button.getAttribute("aria-describedby")).toContain(label.id);
  });

  test("på en sida är etiketten fältets enda och syns", async () => {
    const preview = await mount(
      [
        { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Om skadan" } } },
        { ...fileNode(), parentPageId: "p", order: 0 },
      ],
      "p",
    );

    expect(visible(preview.shadowRoot!.querySelector("#page-file-label-photo"))).toBe(true);
  });
});
