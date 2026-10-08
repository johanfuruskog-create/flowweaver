import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";

/**
 * Editorn tar sitt typsnitt ur tokenet, inte ur värdsidan.
 *
 * Johan, 31/8: *"Ser ut som det är seriffer det hade vi inte förut."* Mätt mot
 * den byggda sajten var allt rätt — `--fw-font` definierad, `body` satt — och
 * det var just därför felet var osynligt: vår egen sajt sätter typsnittet på
 * `body` i `src/site/style.scss`, så editorn ärvde det och ingen märkte att den
 * aldrig läste tokenet själv.
 *
 * En värd utan egen typografi fick webbläsarens standard i hela verktyget.
 * `guide-preview` hade redan raden; editorn saknade den.
 */

afterEach(() => {
  document.body.replaceChildren();
  document.body.style.fontFamily = "";
});

const settle = (ms = 240): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("i en värd med eget typsnitt", () => {
  test("editorn följer sitt token och inte sidans serif", async () => {
    document.body.style.fontFamily = '"Times New Roman", serif';

    const editor = document.createElement("guide-editor") as GuideEditor;

    editor.setAttribute("mode", "administrator");
    editor.style.cssText = "display: block; width: 900px; height: 600px;";
    document.body.append(editor);
    editor.graph = { startNodeId: null, nodes: [], connections: [] } as never;

    await settle();

    const family = getComputedStyle(editor).fontFamily;

    expect(family).not.toContain("Times");
    expect(family, "tokenets stack").toContain("system-ui");
  });

  test("och visaren gör detsamma, som den alltid gjort", async () => {
    document.body.style.fontFamily = '"Times New Roman", serif';

    const preview = document.createElement("guide-preview");

    document.body.append(preview);
    await settle();

    expect(getComputedStyle(preview).fontFamily).toContain("system-ui");
  });
});
