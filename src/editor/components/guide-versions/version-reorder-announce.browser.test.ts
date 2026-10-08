import { afterEach, describe, expect, test } from "vitest";

import "./guide-versions";

import type { GuideVersion, GuideVersions } from "./guide-versions";

/**
 * Says where a moved row landed — for a pointer as well as a keyboard.
 *
 * ## The fault this is written from
 *
 * A node moved with the arrow keys was already announced
 * (`editor.announce.nodeMoved`, in `node-editor`). A version row moved by
 * dragging its grip, or by Alt+arrow, said nothing at all — mätt mot
 * artiklarna 22/9 (docs/IDEAS.md): the row visibly changed place and nobody
 * listening rather than looking heard it happen.
 *
 * ## Why two moves, not one
 *
 * A live region that keeps the same words does not get re-read — that is the
 * whole contract a screen reader makes with `aria-live`. A test that only
 * checked "the text appeared once" would pass for a region that got stuck
 * on the first sentence forever. Moving the same row twice, to two different
 * places, is what proves the second announcement is not the first one left
 * over.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const VERSIONS: GuideVersion[] = [
  { id: "v1", number: 1, savedAt: 3 },
  { id: "v2", number: 2, savedAt: 2 },
  { id: "v3", number: 3, savedAt: 1 },
];

function mount(): GuideVersions {
  const element = document.createElement("guide-versions") as GuideVersions;

  element.setAttribute("editor-locale", "sv");
  element.setAttribute("order", "custom");
  document.body.append(element);
  element.versions = VERSIONS;

  return element;
}

const announceOf = (element: GuideVersions): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>("[data-announce]")!;

const rowOf = (element: GuideVersions, id: string): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>(`tr[data-id="${id}"]`)!;

const gripOf = (element: GuideVersions, id: string): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>(`tr[data-id="${id}"] [data-grip]`)!;

describe("uppläsning efter en dragen version", () => {
  test("säger var raden landade", async () => {
    const element = mount();
    const grip = gripOf(element, "v1");
    const top = grip.getBoundingClientRect().top;

    grip.dispatchEvent(
      new PointerEvent("pointerdown", { clientY: top, bubbles: true, composed: true }),
    );
    // Past the row height and the 10px threshold: v1 trades with v2, then v3.
    window.dispatchEvent(new PointerEvent("pointermove", { clientY: top + 90 }));
    window.dispatchEvent(new PointerEvent("pointerup"));
    await settle();
    // announce() sets the text 30ms after render() clears it.
    await settle();

    expect(announceOf(element).textContent).toBe("Version 1, nu på plats 2 av 3");
  });

  test("och nollställs mellan två drag, så samma text inte tystnar", async () => {
    const element = mount();
    const first = gripOf(element, "v1");
    const firstTop = first.getBoundingClientRect().top;

    first.dispatchEvent(
      new PointerEvent("pointerdown", { clientY: firstTop, bubbles: true, composed: true }),
    );
    window.dispatchEvent(new PointerEvent("pointermove", { clientY: firstTop + 90 }));
    window.dispatchEvent(new PointerEvent("pointerup"));
    await settle();
    await settle();

    // `render()` bygger om hela skuggroten, så regionen efter draget är ett
    // nytt element — precis som varje rad, knapp och rubrik i listan. En
    // skärmläsare frågar tillgänglighetsträdet, inte ett sparat referens, så
    // frågan hämtas om här av samma skäl.
    const afterFirst = announceOf(element).textContent;

    expect(afterFirst).toBe("Version 1, nu på plats 2 av 3");

    // Moved again, from its new spot back towards the top — a live region
    // stuck on the first sentence would still read afterFirst here.
    const second = gripOf(element, "v1");
    const secondTop = second.getBoundingClientRect().top;

    second.dispatchEvent(
      new PointerEvent("pointerdown", { clientY: secondTop, bubbles: true, composed: true }),
    );
    window.dispatchEvent(new PointerEvent("pointermove", { clientY: secondTop - 90 }));
    window.dispatchEvent(new PointerEvent("pointerup"));
    await settle();
    await settle();

    const afterSecond = announceOf(element).textContent;

    expect(afterSecond).not.toBe(afterFirst);
    expect(afterSecond).toBe("Version 1, nu på plats 1 av 3");
  });

  test("och med tangentbordet: Alt+piltangent säger samma sak", async () => {
    const element = mount();
    const row = rowOf(element, "v1");

    row.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true, bubbles: true }),
    );
    await settle();
    await settle();

    expect(announceOf(element).textContent).toBe("Version 1, nu på plats 2 av 3");
  });
});
