import { page } from "vitest/browser";
import { afterEach, describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";
import "../viewer/components/guide-preview/guide-preview";

import { uniqueAcrossRepeatsGraph } from "./unique-across-repeats-graph";

import type { GuidePreview } from "../viewer/components/guide-preview/guide-preview";
import type { GraphData } from "../viewer/types/graph";

/**
 * Berättelse 138 — *Varje upprepning ska välja olika*, hos besökaren.
 *
 * Tiden (envalsfråga) och namnet (fritext) har inställningen på, lunchen har
 * den inte. Varje prov läser vad som står i DOM:en, inte vad tjänsten säger.
 */

afterEach(async () => {
  document.body.replaceChildren();
  await page.viewport(1280, 800);
});

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount(graph: GraphData = uniqueAcrossRepeatsGraph): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "sv");
  document.body.append(preview);
  preview.graph = structuredClone(graph) as never;
  await settle();

  return preview;
}

const root = (preview: GuidePreview): ShadowRoot => preview.shadowRoot!;
const group = (preview: GuidePreview, index: number): HTMLElement =>
  root(preview).querySelector<HTMLElement>(`[data-repeat-group="${index}"]`)!;

async function pick(preview: GuidePreview, index: number, variable: string, value: string): Promise<void> {
  const radio = group(preview, index).querySelector<HTMLInputElement>(
    `input[data-page-variable="${variable}"][value="${value}"]`,
  );

  expect(radio, `bokning ${index + 1} erbjuder inte ${variable} = ${value}`).toBeTruthy();
  radio!.checked = true;
  radio!.dispatchEvent(new Event("change", { bubbles: true }));
  await settle();
}

async function type(preview: GuidePreview, index: number, variable: string, text: string): Promise<void> {
  const input = group(preview, index).querySelector<HTMLInputElement>(`input[data-page-variable="${variable}"]`)!;

  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();
}

const offered = (preview: GuidePreview, index: number, variable: string): string[] =>
  [...group(preview, index).querySelectorAll<HTMLInputElement>(`input[data-page-variable="${variable}"]`)].map(
    (radio) => radio.value,
  );

async function press(preview: GuidePreview, action: string): Promise<void> {
  root(preview).querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
  await settle();
}

/** Två bokningar, den första ifylld. */
async function twoBookings(): Promise<GuidePreview> {
  const preview = await mount();

  await pick(preview, 0, "tid", "0930");
  await type(preview, 0, "namn", "Alva");
  await pick(preview, 0, "lunch", "ja");
  await press(preview, "repeat-add");

  return preview;
}

describe("varje upprepning ska välja olika, hos besökaren (berättelse 138)", () => {
  test("kriterium 2: tiden som bokats i post 1 finns inte i post 2, och raden sägs", async () => {
    const preview = await twoBookings();

    expect(offered(preview, 0, "tid")).toEqual(["0930", "1100", "1400"]);
    expect(offered(preview, 1, "tid")).toEqual(["1100", "1400"]);
    const row = group(preview, 1).querySelector<HTMLElement>(
      '[data-page-field-id="unique-time#1"] [data-options-taken]',
    );
    expect(row?.textContent).toBe("Alternativ som du valt i andra upprepningar visas inte här.");
    // Inget villkor dolde något, så villkorens rad sägs inte.
    expect(group(preview, 1).querySelector("[data-options-hidden]")).toBeNull();
    // Post 1 har inte fått något dolt av inställningen: ingen rad där.
    expect(group(preview, 0).querySelector("[data-options-taken]")).toBeNull();
    // Lunchen har inte inställningen: Ja går att välja igen.
    expect(offered(preview, 1, "lunch")).toEqual(["ja", "nej"]);
  });

  test("K3: raden om dolda alternativ är kopplad till fältet, inte bara en lös rad", async () => {
    const preview = await twoBookings();

    const field = group(preview, 1).querySelector<HTMLElement>('[data-page-field-id="unique-time#1"]')!;
    const row = field.querySelector<HTMLElement>("[data-options-taken]")!;
    const radio = field.querySelector<HTMLInputElement>('input[data-page-variable="tid"]')!;

    expect(row.id, "raden saknar id att peka på").not.toBe("");
    expect(radio.getAttribute("aria-describedby")?.split(/\s+/)).toContain(row.id);
  });

  test("hjälpraden: döljer också ett villkor sägs båda orsakerna, var för sig och båda kopplade", async () => {
    const both = structuredClone(uniqueAcrossRepeatsGraph);
    const afternoon = (both.nodes.find((node) => node.id === "unique-time")!.data.options as { value: string; visibility?: unknown }[])
      .find((option) => option.value === "1400")!;
    afternoon.visibility = {
      match: "all",
      conditions: [{ id: "unique-afternoon-lunch", variableName: "lunch", operator: "equals", value: "ja" }],
    };
    const preview = await mount(both);
    await pick(preview, 0, "tid", "0930");
    await press(preview, "repeat-add");

    expect(offered(preview, 1, "tid")).toEqual(["1100"]);
    const field = group(preview, 1).querySelector<HTMLElement>('[data-page-field-id="unique-time#1"]')!;
    const rows = [field.querySelector<HTMLElement>("[data-options-hidden]"), field.querySelector<HTMLElement>("[data-options-taken]")];
    expect(rows.map((row) => row?.textContent)).toEqual([
      "Några alternativ visas inte utifrån dina tidigare svar.",
      "Alternativ som du valt i andra upprepningar visas inte här.",
    ]);
    const described = field.querySelector("input")!.getAttribute("aria-describedby")?.split(/\s+/) ?? [];
    expect(rows.every((row) => row !== null && row.id !== "" && described.includes(row.id))).toBe(true);
  });

  test("kriterium 2: kvittot har varje tid en gång", async () => {
    const preview = await twoBookings();

    // Det första post 2 erbjuder — utan döljningen vore det 09.30 igen.
    await pick(preview, 1, "tid", offered(preview, 1, "tid")[0]!);
    await type(preview, 1, "namn", "Nils");
    await pick(preview, 1, "lunch", "ja");
    await press(preview, "next");

    const text = root(preview).textContent ?? "";
    expect(text).toContain("Tack");
    const times = ["09.30", "11.00", "14.00"].map((time) => text.split(time).length - 1);
    expect(times.filter((count) => count > 1), "samma tid två gånger i kvittot").toEqual([]);
    expect(times.reduce((sum, count) => sum + count, 0)).toBe(2);
  });

  test("kriterium 3: samma namn i två poster fälls på den andra — skiftläge och mellanslag räknas inte", async () => {
    const preview = await mount();

    await pick(preview, 0, "tid", "0930");
    await type(preview, 0, "namn", " Alva ");
    await pick(preview, 0, "lunch", "ja");
    await press(preview, "repeat-add");
    await pick(preview, 1, "tid", "1100");
    await type(preview, 1, "namn", "alva");
    await pick(preview, 1, "lunch", "nej");
    await press(preview, "next");

    const second = group(preview, 1).querySelector<HTMLElement>('[data-page-field-id="unique-name#1"]')!;
    expect(second.querySelector(".guide-preview__field-error")?.textContent).toBe(
      "Det här svaret finns redan i en annan upprepning. Ange ett annat.",
    );
    // Svaret står kvar, så att besökaren kan rätta det.
    expect(second.querySelector("input")?.value).toBe("alva");
    expect(second.querySelector("input")?.getAttribute("aria-invalid")).toBe("true");
    expect(
      group(preview, 0).querySelector('[data-page-field-id="unique-name#0"] .guide-preview__field-error'),
      "den första posten fälls inte",
    ).toBeNull();
    expect(root(preview).textContent).not.toContain("Tack");
  });

  test("kriterium 4: en borttagen post ger tillbaka sin tid", async () => {
    const preview = await twoBookings();

    await pick(preview, 1, "tid", "1100");
    group(preview, 0).querySelector<HTMLButtonElement>('[data-action="repeat-remove"]')!.click();
    await settle();

    // Bokning 2 är nu bokning 1: den ser allt igen, 09.30 med, och har kvar sin tid.
    expect(offered(preview, 0, "tid")).toEqual(["0930", "1100", "1400"]);
    expect(group(preview, 0).querySelector<HTMLInputElement>('input[data-page-variable="tid"]:checked')?.value).toBe("1100");
  });

  test("kriterium 4: symmetriskt — post 2:s tid finns inte i post 1, och det egna valet står kvar", async () => {
    const preview = await twoBookings();

    await pick(preview, 1, "tid", "1100");

    expect(offered(preview, 0, "tid")).toEqual(["0930", "1400"]);
    expect(group(preview, 0).querySelector<HTMLInputElement>('input[data-page-variable="tid"]:checked')?.value).toBe("0930");
    expect(offered(preview, 1, "tid")).toEqual(["1100", "1400"]);
    expect(group(preview, 1).querySelector<HTMLInputElement>('input[data-page-variable="tid"]:checked')?.value).toBe("1100");
    expect(root(preview).querySelector("[data-choice-redo]"), "ingenting töms").toBeNull();
  });

  test("kriterium 4: två poster med samma tid (en sparad körning) — valideras på den senare, töms inte", async () => {
    const preview = document.createElement("guide-preview") as GuidePreview;
    preview.setAttribute("active-locale", "sv");
    document.body.append(preview);
    preview.graph = structuredClone(uniqueAcrossRepeatsGraph) as never;
    preview.given = {
      answers: {
        bokningar: [
          { tid: "0930", namn: "Alva", lunch: "ja" },
          { tid: "0930", namn: "Nils", lunch: "nej" },
        ],
      },
    };
    await settle();

    const checked = (index: number) =>
      group(preview, index).querySelector<HTMLInputElement>('input[data-page-variable="tid"]:checked')?.value;
    expect([checked(0), checked(1)], "båda står kvar när sidan ritas").toEqual(["0930", "0930"]);
    expect(root(preview).querySelector("[data-choice-redo]"), "ingenting töms").toBeNull();

    await press(preview, "next");

    const second = group(preview, 1).querySelector<HTMLElement>('[data-page-field-id="unique-time#1"]')!;
    expect(second.querySelector(".guide-preview__field-error")?.textContent).toBe(
      "Det här alternativet är redan valt i en annan upprepning. Välj ett annat.",
    );
    expect(second.querySelector("input:checked")?.getAttribute("aria-invalid")).toBe("true");
    expect(checked(1), "svaret står kvar").toBe("0930");
    expect(
      group(preview, 0).querySelector('[data-page-field-id="unique-time#0"] .guide-preview__field-error'),
      "den första posten fälls inte",
    ).toBeNull();
    expect(root(preview).textContent).not.toContain("Tack");

    // Rättat: kvittot återger den validerade anmälan, en tid per post.
    await pick(preview, 1, "tid", "1100");
    await press(preview, "next");
    const text = root(preview).textContent ?? "";
    expect(text).toContain("Tack");
    expect(["09.30", "11.00"].map((time) => text.split(time).length - 1)).toEqual([1, 1]);
  });

  test("tomläget: inget kvar att välja i en tom upprepning sägs, och upprepningen går att ta bort", async () => {
    const two = structuredClone(uniqueAcrossRepeatsGraph);
    const time = two.nodes.find((node) => node.id === "unique-time")!;
    time.data.options = (time.data.options as { value: string }[]).filter((option) => option.value !== "1400");
    const preview = await mount(two);
    await pick(preview, 0, "tid", "0930");
    await press(preview, "repeat-add");
    await pick(preview, 1, "tid", "1100");
    await press(preview, "repeat-add");

    const third = group(preview, 2).querySelector<HTMLElement>('[data-page-field-id="unique-time#2"]')!;
    expect(offered(preview, 2, "tid")).toEqual([]);
    expect(third.querySelector("[data-options-none]")?.textContent).toBe("Inga alternativ finns att välja just nu.");
    expect(third.querySelector(".guide-preview__page-choices"), "ingen tom lista").toBeNull();
    // Skälet står kvar under, som i en lista som bara krympt.
    expect(third.querySelector("[data-options-taken]")).not.toBeNull();
    // Posterna som har ett val visar det inte.
    expect(group(preview, 1).querySelector("[data-options-none]")).toBeNull();

    group(preview, 2).querySelector<HTMLButtonElement>('[data-action="repeat-remove"]')!.click();
    await settle();
    expect(root(preview).querySelector('[data-repeat-group="2"]')).toBeNull();
    expect(root(preview).querySelector("[data-options-none]")).toBeNull();
  });

  test("formen (Fia 29/9): hjälpraderna har vanlig vikt, inte frågans rubrikvikt", async () => {
    const both = structuredClone(uniqueAcrossRepeatsGraph);
    const afternoon = (both.nodes.find((node) => node.id === "unique-time")!.data.options as { value: string; visibility?: unknown }[])
      .find((option) => option.value === "1400")!;
    afternoon.visibility = {
      match: "all",
      conditions: [{ id: "unique-afternoon-lunch", variableName: "lunch", operator: "equals", value: "ja" }],
    };
    const preview = await mount(both);
    await pick(preview, 0, "tid", "0930");
    await press(preview, "repeat-add");

    const field = group(preview, 1).querySelector<HTMLElement>('[data-page-field-id="unique-time#1"]')!;
    const weights = ["[data-options-hidden]", "[data-options-taken]"].map(
      (selector) => getComputedStyle(field.querySelector(selector)!).fontWeight,
    );
    expect(weights).toEqual(["400", "400"]);
  });

  test("formen (Fia 29/9): tomlägets rad sitter som listan, i textfärg och vanlig vikt", async () => {
    const two = structuredClone(uniqueAcrossRepeatsGraph);
    const time = two.nodes.find((node) => node.id === "unique-time")!;
    time.data.options = (time.data.options as { value: string }[]).filter((option) => option.value !== "1400");
    const preview = await mount(two);
    await pick(preview, 0, "tid", "0930");
    await press(preview, "repeat-add");
    await pick(preview, 1, "tid", "1100");
    await press(preview, "repeat-add");

    const gapUnder = (cell: HTMLElement, below: Element) =>
      below.getBoundingClientRect().top - cell.querySelector("legend")!.getBoundingClientRect().bottom;
    const listCell = group(preview, 1).querySelector<HTMLElement>('[data-page-field-id="unique-time#1"]')!;
    const emptyCell = group(preview, 2).querySelector<HTMLElement>('[data-page-field-id="unique-time#2"]')!;
    const none = emptyCell.querySelector<HTMLElement>("[data-options-none]")!;

    expect(gapUnder(emptyCell, none)).toBeCloseTo(gapUnder(listCell, listCell.querySelector(".guide-preview__page-choices")!), 0);
    const style = getComputedStyle(none);
    expect(style.fontWeight).toBe("400");
    const probe = document.createElement("span");
    probe.style.color = "var(--fw-text)";
    emptyCell.append(probe);
    expect(style.color, "fältets textfärg, inte den sekundära").toBe(getComputedStyle(probe).color);
    probe.remove();
  });

  test("tomläget stoppar Nästa med felet under fältet, fokus dit, och kvittot får aldrig en tom tid", async () => {
    const two = structuredClone(uniqueAcrossRepeatsGraph);
    const time = two.nodes.find((node) => node.id === "unique-time")!;
    time.data.options = (time.data.options as { value: string }[]).filter((option) => option.value !== "1400");
    const preview = await mount(two);
    await pick(preview, 0, "tid", "0930");
    await type(preview, 0, "namn", "Alva");
    await pick(preview, 0, "lunch", "ja");
    await press(preview, "repeat-add");
    await pick(preview, 1, "tid", "1100");
    await type(preview, 1, "namn", "Nils");
    await pick(preview, 1, "lunch", "ja");
    await press(preview, "repeat-add");
    await type(preview, 2, "namn", "Bo");
    await pick(preview, 2, "lunch", "nej");
    await press(preview, "next");

    expect(root(preview).textContent, "sidan gick vidare").not.toContain("Tack");
    const cell = group(preview, 2).querySelector<HTMLElement>('[data-page-field-id="unique-time#2"]')!;
    const error = cell.querySelector<HTMLElement>(".guide-preview__field-error");
    expect(error?.textContent).toBe("Inga alternativ finns att välja. Ta bort den här upprepningen eller ändra ett tidigare val.");
    expect(cell.hasAttribute("data-invalid")).toBe(true);
    // Felet säger det tomlägets rad sa, och mer — det sägs en gång, inte två.
    expect(cell.querySelector("[data-options-none]")).toBeNull();
    expect(cell.contains(root(preview).activeElement), "fokus till fältet").toBe(true);
    expect(cell.getAttribute("aria-describedby")?.split(/\s+/)).toContain(error!.id);

    group(preview, 2).querySelector<HTMLButtonElement>('[data-action="repeat-remove"]')!.click();
    await settle();
    await press(preview, "next");
    const text = root(preview).textContent ?? "";
    expect(text).toContain("Tack");
    expect(text).not.toMatch(/Vilken tid\?:\s*(\n|$|Namn|Inget svar)/);
  });

  test.each([390, 900])("formen (Astra 29/9): tomlägets fokusring har luft och klipps inte, %i px", async (width) => {
    await page.viewport(width, 1400);
    const two = structuredClone(uniqueAcrossRepeatsGraph);
    const time = two.nodes.find((node) => node.id === "unique-time")!;
    time.data.options = (time.data.options as { value: string }[]).filter((option) => option.value !== "1400");
    const preview = await mount(two);
    await pick(preview, 0, "tid", "0930");
    await type(preview, 0, "namn", "Alva");
    await pick(preview, 0, "lunch", "ja");
    await press(preview, "repeat-add");
    await pick(preview, 1, "tid", "1100");
    await type(preview, 1, "namn", "Nils");
    await pick(preview, 1, "lunch", "ja");
    await press(preview, "repeat-add");
    await type(preview, 2, "namn", "Bo");
    await pick(preview, 2, "lunch", "nej");
    await press(preview, "next");

    const cell = group(preview, 2).querySelector<HTMLElement>('[data-page-field-id="unique-time#2"]')!;
    expect(root(preview).activeElement).toBe(cell);
    const style = getComputedStyle(cell);
    const offset = parseFloat(style.outlineOffset);
    const reach = offset + parseFloat(style.outlineWidth);
    expect(style.outlineStyle, "en ring syns").not.toBe("none");
    expect(offset, "luft mellan ringen och texten").toBeGreaterThanOrEqual(2);

    // Ringen, utvidgad med sin förskjutning och bredd, inom varje förälder som klipper.
    const ring = cell.getBoundingClientRect();
    let node: Element | null = cell.parentElement ?? (cell.getRootNode() as ShadowRoot).host;
    while (node) {
      const clip = getComputedStyle(node);
      if (/(hidden|clip|auto|scroll)/.test(clip.overflowX + clip.overflowY)) {
        const box = node.getBoundingClientRect();
        expect(
          [ring.left - reach >= box.left, ring.right + reach <= box.right, ring.top - reach >= box.top],
          `klipps av ${node.tagName}.${(node as HTMLElement).className}`,
        ).toEqual([true, true, true]);
      }
      node = node.parentElement ?? ((node.getRootNode() as ShadowRoot).host ?? null);
    }
  });

  /*
   * Astra 29/9: the setting must never make a voluntary question required.
   * The choice has no voluntary form — it is required by construction while
   * it has options — so the voluntary question that can carry the setting is
   * the text field. Left empty in both records it passes, like any voluntary
   * field; an empty answer is never "the same" as another empty answer.
   */
  test("avgränsningen (Astra 29/9): en frivillig fråga med inställningen stoppar inte Nästa när den lämnas tom", async () => {
    const voluntary = structuredClone(uniqueAcrossRepeatsGraph);
    voluntary.nodes.find((node) => node.id === "unique-name")!.data.required = false;
    const preview = await mount(voluntary);

    await pick(preview, 0, "tid", "0930");
    await pick(preview, 0, "lunch", "ja");
    await press(preview, "repeat-add");
    await pick(preview, 1, "tid", "1100");
    await pick(preview, 1, "lunch", "nej");
    await press(preview, "next");

    expect(root(preview).querySelector(".guide-preview__field-error"), "inget fel på den frivilliga frågan").toBeNull();
    expect(root(preview).textContent).toContain("Tack");
  });

  test("kriterium 5: av är dagens beteende — alla tider i varje post, ingen rad", async () => {
    const off = structuredClone(uniqueAcrossRepeatsGraph);
    off.nodes.forEach((node) => delete node.data.uniqueAcrossRepeats);
    const preview = await mount(off);

    await pick(preview, 0, "tid", "0930");
    await press(preview, "repeat-add");

    expect(offered(preview, 1, "tid")).toEqual(["0930", "1100", "1400"]);
    expect(group(preview, 1).querySelector("[data-options-hidden]")).toBeNull();
    expect(group(preview, 1).querySelector("[data-options-taken]")).toBeNull();
  });
});
