import { afterEach, describe, expect, test } from "vitest";

import "./chip-picker";

/**
 * The confirmation after a choice is read, not shown (Astra 1/10, bilaga 10
 * punkt 14): *"den extra bekräftelsemeningen blir bara uppläst. Själva valet
 * ligger synligt kvar i fältet. Fel och nödvändiga instruktioner ska
 * fortfarande synas."*
 *
 * Measured 30/9 (genomgången, V23) and 1/10: *"NF-100 245 · Nordbo Hem Stor
 * tillagt. 1 vald."* stood 16 px tall under the box and pushed the next
 * label 19 px down.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 40) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Picker = HTMLElement & { options: Array<{ label: string; value: string; exclusive?: boolean }> };

async function mount(options: Picker["options"]): Promise<Picker> {
  const element = document.createElement("chip-picker") as Picker;
  document.body.append(element);
  element.options = options;
  await settle();
  return element;
}

async function choose(element: Picker, value: string): Promise<void> {
  element.shadowRoot!
    .querySelector<HTMLElement>(".chip-picker__box")!
    .dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
  await settle();
  element.shadowRoot!.querySelector<HTMLButtonElement>(`[data-add][data-value="${value}"]`)!.click();
  await settle();
}

const row = (element: Picker) => element.shadowRoot!.querySelector<HTMLElement>("[data-status]")!;

/** What the eye gets: the row's own height, which a visually hidden span does not add to. */
const seen = (element: Picker): number => row(element).getBoundingClientRect().height;

describe("bekräftelsen efter ett val", () => {
  test("läses upp men syns inte, och valet står kvar i rutan", async () => {
    const picker = await mount([{ label: "Danmark", value: "DK" }, { label: "Tyskland", value: "DE" }]);
    await choose(picker, "DK");

    expect(row(picker).getAttribute("aria-live")).toBe("polite");
    expect(row(picker).textContent).toContain("Danmark tillagt");
    expect(seen(picker), "ingen synlig rad under rutan").toBe(0);
    expect(picker.shadowRoot!.querySelector(".chip-picker__chip-label")?.textContent?.trim()).toBe("Danmark");
  });

  test("varför ett annat val försvann står kvar synligt", async () => {
    const picker = await mount([
      { label: "Danmark", value: "DK" },
      { label: "Statslös", value: "XS", exclusive: true },
    ]);
    await choose(picker, "DK");
    await choose(picker, "XS");

    expect(row(picker).textContent).toContain("Statslös tillagt");
    expect(row(picker).textContent).toContain("Danmark");
    expect(seen(picker), "skälet syns").toBeGreaterThan(10);
  });

  /*
   * Mätt åt Siv (K4, chip-picker-status-heard): den levande regionen är EN
   * `aria-live="polite"`-rad (`[data-status]`), och en skärmläsare läser upp
   * en samlad ändring per batch av DOM-mutationer den ser. Ett val som
   * skriver `heard`/`status` och sedan målar dem i TVÅ separata
   * `replaceChildren`-anrop — en tömning, sedan den riktiga texten — hade
   * gett besökaren "tomt" och sen den riktiga meningen: två annonseringar
   * för en handling, den andra tystare än den borde märkas.
   *
   * `MutationObserver` batchar mutationer som händer i samma microtask till
   * ETT callback-anrop, vilket är den bästa mekaniska proxyn utan en riktig
   * skärmläsare (K3: VoiceOver-verifiering är en öppen, namngiven punkt).
   */
  test("annonseras i EN sammanhållen ändring, inte två", async () => {
    const picker = await mount([{ label: "Danmark", value: "DK" }, { label: "Tyskland", value: "DE" }]);
    const target = row(picker);

    // Open the box first — a focusin's own repaint is a separate event from
    // the choice, and not what this measures.
    picker.shadowRoot!
      .querySelector<HTMLElement>(".chip-picker__box")!
      .dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
    await settle();

    let batches = 0;
    const observer = new MutationObserver(() => { batches += 1; });
    observer.observe(target, { childList: true, subtree: true, characterData: true });

    picker.shadowRoot!.querySelector<HTMLButtonElement>('[data-add][data-value="DK"]')!.click();
    await settle();
    observer.disconnect();

    expect(target.textContent).toContain("Danmark tillagt");
    expect(batches, "ett val ska ge en sammanhållen DOM-ändring, inte flera").toBe(1);
  });
});
