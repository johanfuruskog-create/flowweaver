import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * A consent tick, in the viewer where somebody meets it.
 *
 * ## The one that has to be a browser test
 *
 * `PageFieldValidationService` can be asked whether an empty answer passes, and
 * it says no. What it cannot see is how the *answer is read off the page* — and
 * that is where a checkbox is different from every other control: it reports its
 * `value` whether or not it is ticked. An unticked consent therefore arrives as
 * "true" unless something says otherwise, and every required consent passes.
 *
 * Checked by mutation: with that line removed, an unticked required consent
 * walked straight past the page. The service was right throughout and the guide
 * was wrong, which is exactly the kind of fault a service test cannot reach.
 *
 * ## Why the label sits on the checkbox
 *
 * A `multi-choice` with one option would render a fieldset with a legend and one
 * box inside it — a group of one, announced as a group. A consent is one thing
 * to agree to.
 */

afterEach(() => document.body.replaceChildren());

const guide = (required: boolean): GraphData =>
  ({
    startNodeId: "p",
    settings: { sourceLocale: "sv" },
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Villkor" } } },
      {
        id: "c",
        type: "consent-question",
        parentPageId: "p",
        order: 0,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Jag godkänner villkoren" }, variableName: "samtycke", required },
      },
      { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [
      { id: "x", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  }) as unknown as GraphData;

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 120));

async function mount(required = true): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "sv");
  document.body.append(preview);
  preview.graph = guide(required);
  await settle();
  await settle();

  return preview;
}

const box = (preview: GuidePreview): HTMLInputElement =>
  preview.shadowRoot!.querySelector<HTMLInputElement>('input[type="checkbox"][data-consent]')!;

const forward = async (preview: GuidePreview) => {
  const button = [...preview.shadowRoot!.querySelectorAll("button")].find((one) =>
    /nästa/i.test(one.textContent ?? ""),
  );

  button?.click();
  await settle();
  await settle();
};

const said = (preview: GuidePreview): string =>
  preview.shadowRoot?.textContent?.replace(/\s+/g, " ") ?? "";

describe("a required consent", () => {
  test("is one checkbox with its own label, not a group of one", async () => {
    const preview = await mount();

    expect(box(preview)).toBeTruthy();
    expect(preview.shadowRoot?.querySelector("fieldset [data-consent]")).toBeNull();
  });

  test("stops the page when it is not ticked", async () => {
    const preview = await mount();

    await forward(preview);

    // The mutation this guards: a checkbox reports its value whether ticked or
    // not, so without reading `checked` this walks straight through.
    expect(said(preview)).not.toContain("Tack");
  });

  test("says what to do rather than that a field is compulsory", async () => {
    const preview = await mount();

    await forward(preview);

    expect(said(preview)).toContain("kryssa i rutan");
  });

  test("lets the page through once it is ticked", async () => {
    const preview = await mount();
    const input = box(preview);

    input.checked = true;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    await forward(preview);

    expect(said(preview)).toContain("Tack");
  });
});

describe("an optional consent", () => {
  test("does not stop anybody", async () => {
    // A newsletter opt-in is the ordinary case of a consent nobody has to give.
    const preview = await mount(false);

    await forward(preview);

    expect(said(preview)).toContain("Tack");
  });
});

describe("bockens färg", () => {
  /*
   * Astra 1/10 (bilaga 10, punkt 13): samtycket bär accentfamiljen och dess
   * kontrasterande bock, så rutan följer temat och värdens färgval. Det
   * bekräftades i grönt (`--fw-success`, Johans regel 31/8) och var den enda
   * rutan som stod still när skalan byttes (genomgången 30/9, V12).
   */
  test("ett givet samtycke bär accentfamiljen och följer värdens färg", async () => {
    const preview = await mount(true);
    const box = preview.shadowRoot!.querySelector<HTMLInputElement>("input[data-consent]")!;

    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();

    const style = getComputedStyle(box);
    const hex = (name: string): string => {
      const n = parseInt(style.getPropertyValue(name).trim().slice(1), 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    };

    expect(style.backgroundColor, "accenten").toBe(hex("--fw-primary"));
    expect(style.backgroundColor).not.toBe(hex("--fw-success"));
    expect(getComputedStyle(box, "::before").backgroundColor, "bocken i accentens kontrast").toBe(hex("--fw-on-primary"));

    // A host's own accent, set as a host sets it: a token on the element.
    preview.style.setProperty("--fw-primary", "#047857");
    await settle();
    expect(getComputedStyle(box).backgroundColor, "värdens färg").toBe("rgb(4, 120, 87)");
  });
});

describe("rutans plats", () => {
  test("texten står BREDVID rutan, inte under den", async () => {
    /*
     * Johans beställning från telefonen 31/8: rutan låg på sin egen rad med
     * hela intyget under sig — läsordningen sa "här är en ruta, och förresten,
     * det här lovar du". En kryssruta och dess avtalstext är EN sak och står
     * på EN rad (texten får radbrytas, men den BÖRJAR bredvid rutan).
     */
    const preview = await mount(true);
    const box = preview.shadowRoot!.querySelector<HTMLInputElement>("input[data-consent]")!;
    const text = box.nextElementSibling as HTMLElement;

    const b = box.getBoundingClientRect();
    const t = text.getBoundingClientRect();

    expect(t.left, "texten börjar inte till höger om rutan").toBeGreaterThan(b.right);
    expect(Math.abs(t.top - b.top), "textens första rad ligger inte i rutans höjd").toBeLessThan(b.height);
  });
});

describe("rutans storlek under ett finger", () => {
  test("växer till 24px där pekdonet är grovt", async () => {
    /*
     * Läst ur stilarket, som högkontrastregeln i panelens test: ingen
     * webbläsare sviten kör i kan byta pekdon, och ett löfte ingen
     * kontrollerar är inget löfte. Johans beställning 31/8: "lite större på
     * mobil".
     */
    const sheet = (await import("./guide-preview.scss?inline")).default as string;
    const coarse = sheet.slice(sheet.indexOf("@media (pointer: coarse)"));

    expect(sheet, "ingen grov-pekdonsregel alls").toContain("@media (pointer: coarse)");
    expect(coarse.slice(0, 400)).toContain("24px");
  });
});
