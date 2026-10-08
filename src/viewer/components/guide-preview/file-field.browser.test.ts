import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * The attachment field: chosen here, held here, collected at the end.
 *
 * ## The model this is built on
 *
 * A `File` from a picker is a handle to something on disk, not the bytes in
 * memory, so carrying one through ten steps costs nothing. Most forms are sent
 * in a single go — a job application attaches a CV, the guide reaches its
 * result, the file travels once — and then nothing needs to leave the browser
 * before the end.
 *
 * That removes the whole chain the other model needs: durable storage, an
 * identifier that still resolves tomorrow, orphaned files, retention. None of it
 * is a question here.
 *
 * ## What is deliberately absent
 *
 * Uploading when the file is picked. It is a real model, it is written up in
 * `docs/FIL-KONTRAKT.md`, and it is **not built** — the `uploadFile` seam and
 * the `file-released` event were taken out rather than left half-connected,
 * because a seam that exists is a seam somebody wires up.
 *
 * So there is one variable, not two. The reference belonged to the model that
 * has one.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 140));

const guide = (data: Record<string, unknown> = {}): GraphData =>
  ({
    startNodeId: "p",
    settings: { sourceLocale: "sv" },
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Bilagor" } } },
      {
        id: "f",
        type: "file-question",
        parentPageId: "p",
        order: 0,
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Bifoga ritning" },
          variableName: "bilaga",
          ...data,
        },
      },
      { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  }) as unknown as GraphData;

async function mount(data: Record<string, unknown> = {}): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "sv");
  document.body.append(preview);

  preview.graph = guide(data);
  await settle();
  await settle();

  return preview;
}

const input = (preview: GuidePreview): HTMLInputElement | null =>
  preview.shadowRoot!.querySelector<HTMLInputElement>('input[type="file"]');

const said = (preview: GuidePreview): string =>
  preview.shadowRoot?.textContent?.replace(/\s+/g, " ") ?? "";

const names = (preview: GuidePreview): string[] =>
  preview.getFiles().map((held) => held.file.name);

const go = async (preview: GuidePreview, action: string): Promise<void> => {
  preview.shadowRoot?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)?.click();
  await settle();
  await settle();
};

/** Puts a file on the input the way a person's choice would. */
async function choose(preview: GuidePreview, name: string, bytes = 10): Promise<void> {
  const element = input(preview)!;
  const file = new File([new Uint8Array(bytes)], name, { type: "application/pdf" });
  const transfer = new DataTransfer();

  transfer.items.add(file);
  element.files = transfer.files;
  element.dispatchEvent(new Event("change", { bubbles: true }));
  await settle();
  await settle();
}

describe("the field", () => {
  test("is a file input", async () => {
    expect(input(await mount())).toBeTruthy();
  });

  test("passes the allowed types on to the platform's own picker", async () => {
    const preview = await mount({ accept: ".pdf,.jpg" });

    expect(input(preview)?.getAttribute("accept")).toBe(".pdf,.jpg");
  });

  test("says nothing about a host, because there is nothing to say", async () => {
    /*
     * There used to be a note here reading "uploading is the host system's job
     * and is not connected here". It was true of a design where a field without
     * an upload really did drop the file. This field is no less connected than
     * the text field beside it, and the sentence would send somebody looking for
     * a fault that does not exist.
     */
    expect(said(await mount())).not.toMatch(/värdsystemet/i);
  });
});

describe("choosing a file", () => {
  test("keeps it, and the host can ask for it", async () => {
    const preview = await mount();

    await choose(preview, "cv.pdf");

    expect(names(preview)).toEqual(["cv.pdf"]);
  });

  test("says which variable it belongs to, because the page is gone by then", async () => {
    // `getFiles()` is called once the guide has reached its result, and the
    // field's markup no longer exists to be asked.
    const preview = await mount();

    await choose(preview, "cv.pdf");

    expect(preview.getFiles()[0]?.variableName).toBe("bilaga");
  });

  test("answers with the name straight away", async () => {
    const preview = await mount();

    await choose(preview, "cv.pdf");
    await go(preview, "next");

    // No round trip to wait for, so no window where the field is filled and the
    // answer is not.
    expect(preview.getAnswers().bilaga).toBe("cv.pdf");
  });

  test("keeps only the latest when another file replaces it", async () => {
    const preview = await mount();

    await choose(preview, "första.pdf");
    await choose(preview, "andra.pdf");

    expect(names(preview)).toEqual(["andra.pdf"]);
  });

  test("lets go when the field is emptied", async () => {
    const preview = await mount();

    await choose(preview, "cv.pdf");

    const element = input(preview)!;

    element.value = "";
    element.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();

    expect(names(preview)).toEqual([]);
  });

  test("tells nobody a file was released, because none ever left", async () => {
    /*
     * `file-released` told a host to clean up something it was storing. Nothing
     * is stored anywhere but this tab, so the event would send them hunting for
     * a file that never existed on their side.
     */
    const preview = await mount();
    const seen: string[] = [];

    preview.addEventListener("file-released", () => seen.push("släppt"));

    await choose(preview, "första.pdf");
    await choose(preview, "andra.pdf");

    expect(seen).toEqual([]);
  });
});

describe("going back to the page", () => {
  test("the file is still there", async () => {
    /*
     * The fault this is written from, found by walking the guide rather than by
     * reading it. Going back rebuilds the page, and a fresh file input is empty
     * — so the name said *cv.pdf* above a picker that said no file was chosen,
     * and the file itself was still only on the discarded element.
     */
    const preview = await mount();

    await choose(preview, "cv.pdf");
    await go(preview, "next");
    await go(preview, "previous");

    expect(names(preview)).toEqual(["cv.pdf"]);
  });

  test("and the picker still shows it", async () => {
    // Otherwise the page reads as though the attachment was lost, and the
    // obvious response is to pick it again.
    const preview = await mount();

    await choose(preview, "cv.pdf");
    await go(preview, "next");
    await go(preview, "previous");

    expect(input(preview)?.files?.[0]?.name).toBe("cv.pdf");
  });
});

describe("what is refused", () => {
  test("a file of the wrong type", async () => {
    const preview = await mount({ accept: ".jpg" });

    await choose(preview, "ritning.pdf");

    // Cheap, and ours to word in both languages.
    expect(said(preview)).toMatch(/måste vara av typen|must be of type/i);
  });

  test("a file that is too large", async () => {
    const preview = await mount({ maxSize: 1 });

    // Two megabytes against a one-megabyte limit.
    await choose(preview, "stor.pdf", 2 * 1024 * 1024);

    expect(said(preview)).toMatch(/högst 1 MB|at most 1 MB/i);
  });

  test("and a refused file is not kept", async () => {
    /*
     * The checks run before the file is held, not after — otherwise `getFiles()`
     * would hand the host something the field had already rejected on screen,
     * and the refusal would be theatre.
     */
    const preview = await mount({ accept: ".jpg" });

    await choose(preview, "ritning.pdf");

    expect(names(preview)).toEqual([]);
  });
});
