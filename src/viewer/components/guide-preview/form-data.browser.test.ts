import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * `getFormData()` — the browser's encoding, used for the part we can reuse.
 *
 * ## Why it exists when the host could compose it
 *
 * `getAnswers()` and `getFiles()` already hold everything, so a host can build
 * this themselves in a few lines. PRAXIS rule 15 says a third mechanism is a
 * warning sign, and it is one here.
 *
 * The reason it wins anyway is the mistake it removes. Multipart written by hand
 * loses the `filename`; a body that is urlencoded instead of multipart carries
 * the file's *name* and none of its bytes, and nothing anywhere says so. Measured
 * on a plain form: `input.value` is `"C:\fakepath\cv.pdf"` — a name with an
 * invented path in front of it, never the content — while `FormData` carries the
 * real `File`, 2048 bytes and all. `fetch` with a `FormData` body always writes
 * multipart with a boundary, so the trap cannot be walked into.
 *
 * ## The case worth testing hardest
 *
 * That a file variable appears **once**. The answer for `cv` is already the
 * string `cv.pdf`; appending that *and* the file under the same key would make
 * `data.get("cv")` return the string with the file hidden behind it. That is a
 * fault that passes every casual check and loses an attachment in production —
 * and it is what a real form does not do: one part, the file, carrying its name.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 140));

const guide = (fileData: Record<string, unknown> = {}): GraphData =>
  ({
    startNodeId: "p",
    settings: { sourceLocale: "sv" },
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Ansökan" } } },
      {
        id: "n",
        type: "text-question",
        parentPageId: "p",
        order: 0,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Namn" }, variableName: "namn" },
      },
      {
        id: "f",
        type: "file-question",
        parentPageId: "p",
        order: 1,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Bifoga ditt CV" }, variableName: "cv", ...fileData },
      },
      { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  }) as unknown as GraphData;

async function fill(fileData: Record<string, unknown> = {}): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "sv");
  document.body.append(preview);
  preview.graph = guide(fileData);
  await settle();
  await settle();

  const root = preview.shadowRoot!;
  const text = root.querySelector<HTMLInputElement>('[data-page-variable="namn"]')!;
  const file = root.querySelector<HTMLInputElement>('input[type="file"]')!;

  text.value = "Anna Andersson";
  text.dispatchEvent(new Event("input", { bubbles: true }));

  const transfer = new DataTransfer();

  transfer.items.add(new File([new Uint8Array(2048)], "cv.pdf", { type: "application/pdf" }));
  file.files = transfer.files;
  file.dispatchEvent(new Event("change", { bubbles: true }));
  await settle();

  root.querySelector<HTMLButtonElement>('[data-action="next"]')?.click();
  await settle();
  await settle();

  return preview;
}

describe("what it carries", () => {
  test("a text answer, under its variable name", async () => {
    const preview = await fill();

    expect(preview.getFormData().get("namn")).toBe("Anna Andersson");
  });

  test("the file itself, not a description of it", async () => {
    const preview = await fill();
    const part = preview.getFormData().get("cv");

    expect(part).toBeInstanceOf(File);
    expect((part as File).size).toBe(2048);
  });

  test("with the filename a server reads off the part", async () => {
    /*
     * Documented rather than defended: the filename rides on the `File`, so this
     * holds because `FormData.append` reads it, not because of a line of ours. A
     * mutation removing our explicit `file.name` argument broke nothing — which
     * is how that argument was found to be dead, and why it is gone.
     */
    const preview = await fill();

    expect((preview.getFormData().get("cv") as File).name).toBe("cv.pdf");
  });
});

describe("the mistake it must not make", () => {
  test("a file variable appears once, and it is the file", async () => {
    /*
     * The answer for `cv` is already the string "cv.pdf". Appending that as well
     * would put a text part first, so `data.get("cv")` would hand back the name
     * and bury the file behind it — a fault that survives every casual look.
     */
    const preview = await fill();
    const parts = preview.getFormData().getAll("cv");

    expect(parts).toHaveLength(1);
    expect(parts[0]).toBeInstanceOf(File);
  });

  test("no stray text part repeating the name", async () => {
    const preview = await fill();
    const texts = Array.from(preview.getFormData().entries()).filter(
      ([, value]) => typeof value === "string",
    );

    // Only `namn`. A second string would mean the file's name went in twice, in
    // two shapes, and a server would have to guess which one to trust.
    expect(texts.map(([key]) => key)).toEqual(["namn"]);
  });
});

describe("a file field with no variable name", () => {
  test("goes under the field's id rather than being dropped", async () => {
    /*
     * The guide cannot refer to it, so it has no name to be keyed on — but the
     * file is real, and losing it silently is worse than an awkward key.
     */
    const preview = await fill({ variableName: "" });
    const keys = Array.from(preview.getFormData().keys());

    expect(keys).toContain("file-f");
  });

  test("and it is still the file", async () => {
    const preview = await fill({ variableName: "" });

    expect(preview.getFormData().get("file-f")).toBeInstanceOf(File);
  });
});

describe("before anything is answered", () => {
  test("it is empty rather than absent", async () => {
    // A host may call it unconditionally. An empty body is a fine answer; a
    // thrown error at the end of a guide is not.
    const preview = document.createElement("guide-preview") as GuidePreview;

    document.body.append(preview);
    preview.graph = guide();
    await settle();

    expect(Array.from(preview.getFormData().keys())).toEqual([]);
  });
});
