// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { withPro } from "../../../testing/optional-pro";
const PRO = await withPro("index.ts");
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Granskningsvarv 2 (2/9): mottagaren är formulärets viktigaste val — 052
 * kallade den "exakt rätt första handling" — men låg under en stor tom
 * tacktextyta, under vecket i Sitevisions 520-dialog. Först i panelen.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 250) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("inlämningspanelens ordning", () => {
  test.runIf(PRO)("Mottagare står först", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;

    editor.setAttribute("mode", "administrator");
    editor.style.cssText = "display: block; width: 1300px; height: 700px;";
    document.body.append(editor);
    editor.graph = {
      version: 8,
      startNodeId: "slut",
      nodes: [{ id: "slut", type: "submit-result", position: { x: 0, y: 0 }, data: { title: "Tack" } }],
      connections: [],
    } as never;
    await settle();

    editor.shadowRoot!
      .querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!
      .selectNodeById("slut");
    await settle();

    const form = editor.shadowRoot!
      .querySelector("properties-panel")!
      .shadowRoot!.querySelector(".properties-panel__form")!;
    // The fields, not the form's children: since B7 (Astra 1/10 2026,
    // bilaga 11) the form is a column of groups and the fields stand inside
    // them — the form's first child is the whole content group.
    const ordning = [...form.querySelectorAll(":scope > [data-panel-group] > *")].map((child) =>
      (child.textContent ?? "").trim().split(/\s/)[0],
    );

    // Mottagarblocket före kvittensens rubrik och tacktext.
    expect(ordning[0], ordning.join(" · ")).toBe("Mottagare");
    expect(
      ordning.indexOf("Rubrik"),
      "rubriken efter mottagarblocket",
    ).toBeGreaterThan(ordning.indexOf("Mottagare"));
  });
});
