import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import "./confirmation-dialog";
import type { ConfirmationDialog } from "./confirmation-dialog";

/**
 * The filled red button (B3, Astra 30/9; GRAFISK-PROFIL, *Destruktiv
 * huvudhandling*).
 *
 * Measured before (Fia 30/9, IDEAS): its words were `--fw-surface`, which is
 * dark in the dark theme — 3.57 : 1 on `--fw-danger`, under K3's 4.5. White
 * gives 4.83 in both. And red was the default: a caller that said nothing
 * got the dangerous form, so *Gör till startnod* was dressed as a loss.
 */

afterEach(() => {
  document.body.replaceChildren();
  document.body.removeAttribute("data-fw-theme");
});

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function luminance(rgb: string): number {
  const [r, g, b] = rgb.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

async function open(tone?: "danger" | "normal"): Promise<ShadowRoot> {
  const el = document.createElement("confirmation-dialog") as ConfirmationDialog;
  document.body.append(el);
  void el.confirm({ title: "Kasta utkastet?", message: "Det går inte att ångra.", confirmLabel: "Kasta", cancelLabel: "Behåll", ...(tone ? { tone } : {}) });
  await settle();
  return el.shadowRoot!;
}

const confirmButton = (root: ShadowRoot) => root.querySelector<HTMLButtonElement>('[data-action="confirm"]')!;

describe("den destruktiva huvudhandlingen", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`${theme}: texten är --fw-on-danger och når 4,5 : 1 i vila, hovring och fokus`, async () => {
      if (theme === "dark") document.body.setAttribute("data-fw-theme", "dark");
      const root = await open("danger");
      const button = confirmButton(root);
      const probe = document.createElement("span");
      probe.style.cssText = "color: var(--fw-on-danger); background: var(--fw-danger);";
      button.parentElement!.append(probe);

      const rest = getComputedStyle(button);
      expect(rest.color, "--fw-on-danger").toBe(getComputedStyle(probe).color);
      expect(rest.backgroundColor, "--fw-danger").toBe(getComputedStyle(probe).backgroundColor);
      expect(contrast(rest.color, rest.backgroundColor), "vila").toBeGreaterThanOrEqual(4.5);

      await userEvent.hover(button);
      const hover = getComputedStyle(button);
      expect(contrast(hover.color, hover.backgroundColor), "hovring").toBeGreaterThanOrEqual(4.5);

      // Keyboard focus: Tab from Behåll, where the dialog puts it.
      await userEvent.keyboard("{Tab}");
      expect(root.activeElement).toBe(button);
      const focus = getComputedStyle(button);
      expect(contrast(focus.color, focus.backgroundColor), "fokus, texten").toBeGreaterThanOrEqual(4.5);
      const surface = getComputedStyle(root.querySelector("dialog")!).backgroundColor;
      expect(contrast(focus.outlineColor, surface), "fokus, strecket mot dialogen (1.4.11)").toBeGreaterThanOrEqual(3);
    });
  }

  test("initialt fokus står på Avbryt vid den riskfyllda", async () => {
    const root = await open("danger");
    expect(root.activeElement?.getAttribute("data-action")).toBe("cancel");
  });

  test("vanlig accent är standard: en bekräftelse som inte säger något blir inte röd", async () => {
    const root = await open();
    expect(confirmButton(root).dataset.tone).toBe("normal");
  });
});
