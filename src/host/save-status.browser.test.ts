import { afterEach, describe, expect, test } from "vitest";

import { createSaveStatus } from "./save-status";

/**
 * Uppdrag 28/9, Del 6: sparstatus på exempelsidorna i en fast yta i
 * editorns övre rad i stället för en toast vid varje autosparning.
 */

afterEach(() => document.body.replaceChildren());

const WORDS = {
  saved: (time: string) => `Sparad lokalt ${time}.`,
  failed: (reason: string) => `Kunde inte spara lokalt: ${reason}`,
  nothingToSave: "Allt är redan sparat lokalt.",
  dismiss: "Stäng",
};
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function mount(announceDelay = 60) {
  const status = createSaveStatus(WORDS, { announceDelay });

  document.body.append(status.element);
  const text = () => status.element.querySelector<HTMLElement>("[data-save-text]")!.textContent;
  const live = status.element.querySelector<HTMLElement>("[data-save-live]")!;
  const dismiss = status.element.querySelector<HTMLButtonElement>(".save-status__dismiss")!;

  return { status, text, live, dismiss };
}

describe("sparstatusen", () => {
  test("står i värdens plats i editorns rad och säger lokalt", () => {
    const { status, text } = mount();

    status.saved("13:05");

    expect(status.element.slot).toBe("context");
    expect(text()).toBe("Sparad lokalt 13:05.");
  });

  test("ett fel står kvar tills nästa lyckade sparning", async () => {
    const { status, text, dismiss } = mount();

    status.saved("13:05");
    status.failed("lagringen är full");
    await wait(200);
    status.nothingToSave();

    expect(text()).toBe("Kunde inte spara lokalt: lagringen är full");
    expect(status.element.hasAttribute("data-failed")).toBe(true);
    expect(dismiss.hidden).toBe(false);

    status.saved("13:07");
    expect(text()).toBe("Sparad lokalt 13:07.");
    expect(dismiss.hidden).toBe(true);
  });

  test("ett fel kan stängas, och då står den senaste lyckade sparningen", () => {
    const { status, text, dismiss } = mount();

    status.saved("13:05");
    status.failed("lagringen är full");
    dismiss.click();

    expect(text()).toBe("Sparad lokalt 13:05.");
    expect(status.element.hasAttribute("data-failed")).toBe(false);
  });

  test("skärmläsaren får ett besked när sparandet varit tyst en stund, inte ett per sparning", async () => {
    const { status, live } = mount(80);
    let announcements = 0;

    new MutationObserver(() => (announcements += 1)).observe(live, { childList: true, characterData: true, subtree: true });

    for (let save = 0; save < 5; save += 1) {
      status.saved("13:05");
      await wait(20);
    }
    await wait(200);
    // Samma besked igen: inget nytt att säga.
    status.saved("13:05");
    await wait(200);

    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toBe("Sparad lokalt 13:05.");
    expect(announcements).toBe(1);
  });

  /*
   * Mutationskontroll 28/9 (Per): den föregående provet sparar samma
   * klockslag fem gånger, så dedupen (`if (live.textContent !== message)`)
   * ensam gör jobbet — det fälls inte om debouncen stryks. Det här provet
   * varierar beskedet under tystnadsfönstret, det enda som skiljer en
   * fördröjd skrivning från en direkt: bara SISTA beskedet ska nå
   * skärmläsaren, i en enda skrivning.
   */
  test("flera olika besked tätt efter varandra ger en skrivning, med det sista", async () => {
    const { status, live } = mount(80);
    let announcements = 0;

    new MutationObserver(() => (announcements += 1)).observe(live, { childList: true, characterData: true, subtree: true });

    status.saved("13:05");
    await wait(20);
    status.failed("lagringen är full");
    await wait(20);
    status.saved("13:06");
    await wait(200);

    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toBe("Sparad lokalt 13:06.");
    expect(announcements).toBe(1);
  });
});
