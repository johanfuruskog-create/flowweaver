import { afterEach, describe, expect, test } from "vitest";

import "../components/confirmation-dialog/confirmation-dialog";
import "../components/prompt-dialog/prompt-dialog";
import "../components/publish-dialog/publish-dialog";
import "../components/node-type-editor/node-type-editor";

import type { ConfirmationDialog } from "../components/confirmation-dialog/confirmation-dialog";
import type { PromptDialog } from "../components/prompt-dialog/prompt-dialog";
import type { PublishDialog } from "../components/publish-dialog/publish-dialog";
import type { NodeTypeEditor } from "../components/node-type-editor/node-type-editor";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { withPro } from "../../testing/optional-pro";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EmailOutputDialog = any;
await withPro("editor/components/email-output-dialog/email-output-dialog.ts");
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * Del 5 (UPPDRAG-2026-09-28-ENHETLIGHET): de fem dialogerna delar yta, ram,
 * skugga och radie. Mätt före ändringen: tre av fem satte inget
 * `background` alls och fick webbläsarens egen `Canvas`-systemfärg i
 * stället för `--fw-surface` (mest synligt i mörkt läge, där knapparna
 * ändå använde `--fw-surface` — två olika mörka toner i samma dialog).
 * Nodmallarna hade en egen radie (`--fw-radius-xl`, 12px) och en lättare
 * skugga (`--fw-shadow-md`) i stället för skalets `--fw-shadow-floating`
 * ("det enda ovanför sidan", tokenfilens egen kommentar — Johans
 * instruktion: behåll floating för dialoger). E-postutdata hade en literal
 * skugga som råkade matcha floating i LJUST läge men aldrig bytte i mörkt.
 *
 * Facit: `--fw-surface` (inte `-raised` — tre av fem satte redan den
 * explicit innan den här ändringen), `--fw-shadow-floating`,
 * `--fw-radius-dialog` (16px). Jämfört mot varandra via en probe-`div`
 * som läser samma `var(...)`, robust mot hur temat råkar rendera dem.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function confirmationDialog(): Promise<HTMLDialogElement> {
  const el = document.createElement("confirmation-dialog") as ConfirmationDialog;

  document.body.append(el);
  void el.confirm({ title: "T", message: "M", confirmLabel: "OK", cancelLabel: "Avbryt", tone: "normal" });
  await settle();
  return el.shadowRoot!.querySelector("dialog")!;
}

async function promptDialog(): Promise<HTMLDialogElement> {
  const el = document.createElement("prompt-dialog") as PromptDialog;

  document.body.append(el);
  void el.ask({ title: "Länk", label: "Adress", confirmLabel: "Lägg till länk" });
  await settle();
  return el.shadowRoot!.querySelector("dialog")!;
}

async function publishDialog(): Promise<HTMLDialogElement> {
  const el = document.createElement("publish-dialog") as PublishDialog;

  document.body.append(el);
  void el.ask({ version: 1, previous: null, changes: [], outline: true, issues: [], note: "" });
  await settle();
  return el.shadowRoot!.querySelector("dialog")!;
}

async function nodeTypeEditor(): Promise<HTMLDialogElement> {
  const el = document.createElement("node-type-editor") as NodeTypeEditor;

  document.body.append(el);
  el.open({ specs: [], onCreate: () => {} });
  await settle();
  return el.shadowRoot!.querySelector("dialog")!;
}

async function emailOutputDialog(): Promise<HTMLDialogElement> {
  const el = document.createElement("email-output-dialog") as EmailOutputDialog;

  document.body.append(el);
  el.open(
    {
      type: "email",
      format: "markdown",
      nodeId: "n1",
      template: { to: "a", subject: "S", body: "B" },
      resolved: { to: "a@example.com", subject: "S", body: "B" },
      missingVariables: [],
    },
    {},
    { startNodeId: "n1", nodes: [], connections: [] },
    "sv",
  );
  await settle();
  return el.shadowRoot!.querySelector("dialog")!;
}

const DIALOGS: Array<[string, () => Promise<HTMLDialogElement>]> = [
  ["bekräftelsedialogen", confirmationDialog],
  ["länkdialogen", promptDialog],
  ["publiceringsdialogen", publishDialog],
  ["nodmallarna", nodeTypeEditor],
  // FlowWeaver PRO's dialog, where PRO is.
  ...(PRO ? ([["e-postutdata-dialogen", emailOutputDialog]] as Array<[string, () => Promise<HTMLDialogElement>]>) : []),
];

describe("dialogernas gemensamma yta", () => {
  test.each(DIALOGS)("%s: bakgrund, skugga och radie matchar facit", async (_name, open) => {
    const dialog = await open();
    const style = getComputedStyle(dialog);
    const probe = document.createElement("div");

    probe.style.cssText = "background: var(--fw-surface); box-shadow: var(--fw-shadow-floating);";
    dialog.append(probe);
    const probeStyle = getComputedStyle(probe);

    expect(style.backgroundColor, "bakgrund, --fw-surface").toBe(probeStyle.backgroundColor);
    expect(style.boxShadow, "skugga, --fw-shadow-floating").toBe(probeStyle.boxShadow);
    expect(style.borderRadius, "radie, --fw-radius-dialog (16px)").toBe("16px");
    probe.remove();
  });

  /*
   * Mutationskontroll 28/9 (Per): `--fw-surface` är `#ffffff` i ljust läge —
   * exakt webbläsarens egen `Canvas`-standardfärg för en `<dialog>` där — så
   * ett skal utan egen `background` klarar sig obemärkt genom provet ovan.
   * Bara mörkt läge (`--fw-surface` `#161b26`, som INTE råkar matcha
   * `Canvas`s mörka ton) avslöjar det, samma mönster som
   * `editor-toolbar-menu-tokens.browser.test.ts` redan använder för samma
   * anledning.
   */
  test.each(DIALOGS)("%s: bakgrunden är --fw-surface i mörkt läge, inte webbläsarens Canvas", async (_name, open) => {
    document.body.setAttribute("data-fw-theme", "dark");

    try {
      const dialog = await open();
      const style = getComputedStyle(dialog);
      const probe = document.createElement("div");

      probe.style.cssText = "background: var(--fw-surface);";
      dialog.append(probe);
      const probeStyle = getComputedStyle(probe);

      expect(style.backgroundColor, "bakgrund, --fw-surface, mörkt läge").toBe(probeStyle.backgroundColor);
      probe.remove();
    } finally {
      document.body.removeAttribute("data-fw-theme");
    }
  });
});

describe.runIf(PRO)("e-postutdata-dialogen, Fias fynd rättade", () => {
  test.runIf(PRO)("har bara en stängningsknapp, ingen X bredvid rubriken", async () => {
    const dialog = await emailOutputDialog();
    const closeButtons = dialog.querySelectorAll('[data-action="close"]');

    expect(closeButtons.length, "exakt en stängningsknapp").toBe(1);
  });

  test.runIf(PRO)("Stäng är neutral, inte en fylld primärknapp", async () => {
    const dialog = await emailOutputDialog();
    const close = dialog.querySelector<HTMLButtonElement>('[data-action="close"]')!;
    const style = getComputedStyle(close);
    const probe = document.createElement("div");

    probe.style.cssText = "background: var(--fw-surface); border-color: var(--fw-border);";
    dialog.append(probe);
    const probeStyle = getComputedStyle(probe);

    expect(style.backgroundColor, "neutral bakgrund, --fw-surface").toBe(probeStyle.backgroundColor);
    probe.remove();
  });

  test.runIf(PRO)("kicker-raden är dämpad text, inte en nodfärg", async () => {
    const dialog = await emailOutputDialog();
    const eyebrow = dialog.querySelector<HTMLElement>("header p")!;
    const style = getComputedStyle(eyebrow);
    const probe = document.createElement("div");

    probe.style.cssText = "color: var(--fw-text-secondary);";
    dialog.append(probe);
    const probeStyle = getComputedStyle(probe);

    expect(style.color, "--fw-text-secondary, inte --fw-node-rule").toBe(probeStyle.color);
    probe.remove();
  });
});
