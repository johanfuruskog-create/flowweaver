import { afterEach, describe, expect, test } from "vitest";

import "./confirmation-dialog";

import type { ConfirmationDialog } from "./confirmation-dialog";

/**
 * Asking again while a question is still on screen.
 *
 * ## The fault
 *
 * A CI run failed with **every one of 2262 tests passing** and one unhandled
 * error: `showModal()` throwing out of `ConfirmationDialog.confirm`, through
 * `handleGraphImportRequest`, out of the file input's `change` handler, where
 * nothing catches. `showModal` refuses a dialog that is already open, and the
 * message names the case exactly — "already open as a non-modal dialog".
 *
 * What puts it in that state in CI is not known; the run is slower there and the
 * import flow opens this dialog from an event handler. But a question that
 * cannot be asked because the previous one was not cleared away is wrong
 * whatever put it there, and an error escaping an event handler takes a whole
 * test run with it.
 *
 * ## Why the pending answer is resolved rather than dropped
 *
 * Closing alone would leave a promise nobody ever settles — a caller waiting for
 * ever for an answer that is not coming. `false` is the honest one: the question
 * was taken off the screen without being answered, which is what cancelling is.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mounted(): Promise<ConfirmationDialog> {
  const dialog = document.createElement("confirmation-dialog") as ConfirmationDialog;

  document.body.append(dialog);
  await settle();

  return dialog;
}

const ask = (dialog: ConfirmationDialog, n: number): Promise<boolean> =>
  dialog.confirm({ title: `Fråga ${n}`, message: `Text ${n}`, confirmLabel: "Ja" });

describe("när dialogen redan står öppen", () => {
  test("kastar den inte, utan ställer den nya frågan", async () => {
    const dialog = await mounted();
    const inner = dialog.shadowRoot!.querySelector("dialog")!;

    // Öppen men inte modal: exakt det tillstånd showModal vägrar.
    inner.setAttribute("open", "");

    let threw = "";

    try {
      void ask(dialog, 2);
    } catch (error) {
      threw = (error as Error).message;
    }

    await settle();

    expect(threw, "confirm kastade").toBe("");
    expect(inner.open, "dialogen öppnades inte").toBe(true);
    expect(
      dialog.shadowRoot!.querySelector("dialog h2, dialog [data-title]")?.textContent?.trim(),
    ).toContain("Fråga 2");
  });

  test("och den förra frågan får ett svar i stället för att hänga", async () => {
    /*
     * The leak this is written against: without settling the first promise, the
     * caller waits for ever — and in the import flow that caller is holding a
     * file and a half-finished decision.
     *
     * Said plainly: this assertion does **not** discriminate the `finish(false)`
     * above it. Removing that line leaves the test green, so something else
     * settles the promise on close and I have not found what. The line stays
     * because a question taken off the screen must be answered, not because a
     * test is holding it — and this comment is here so nobody later reads a
     * green run as proof that it is.
     */
    const dialog = await mounted();
    const first = ask(dialog, 1);
    let answered: boolean | "väntar" = "väntar";

    void first.then((value) => {
      answered = value;
    });

    await settle();
    void ask(dialog, 2);
    await settle();

    expect(answered, "den första frågan hänger").toBe(false);
  });
});

describe("när dialogen inte längre står i dokumentet", () => {
  test("svarar den nej i stället för att kasta", async () => {
    /*
     * The second half of the same CI failure, and the one that actually fell
     * over: a test tears the DOM down in its `afterEach`, an import flow resumes
     * afterwards and opens a dialog that is nowhere. `showModal` throws — "The
     * element is not in a Document" — the error escapes the file input's change
     * handler, and a run where every test passes still exits 1.
     *
     * `false` rather than a throw, because it is the truth: the question could
     * not be put, so it was not answered yes.
     */
    const dialog = await mounted();

    dialog.remove();

    let threw = "";
    let answer: boolean | "väntar" = "väntar";

    try {
      answer = await ask(dialog, 1);
    } catch (error) {
      threw = (error as Error).message;
    }

    expect(threw, "confirm kastade").toBe("");
    expect(answer, "frågan besvarades inte").toBe(false);
  });
});
