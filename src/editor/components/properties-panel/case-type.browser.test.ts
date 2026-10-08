// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { withPro } from "../../../testing/optional-pro";
const PRO = await withPro("index.ts");
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../../viewer/node-types/default-node-types";
import "./properties-panel";

import {
  registerCodeList,
  unregisterCodeList,
} from "../../../viewer/code-lists/code-list-registry";

import type { PropertiesPanel } from "./properties-panel";

/**
 * Story 123 — the errand says what KIND of errand it is, and it says it as a
 * code.
 *
 * ## Why a code list and not a text field
 *
 * `caseType` is read by a receiver that sorts: *Bygglov* in one pile,
 * *Rivningslov* in another. A text field would give that receiver "Bygglov",
 * "bygglov ", "Bygglov " and "BYGGLOV" from four guides written by four
 * people, and the sorting would quietly be wrong rather than loudly broken. A
 * code list is the mechanism the lookup fields already use for exactly this
 * reason, and this is the same mechanism on the submission node.
 *
 * ## Why two fields and not one
 *
 * Which list, and which entry from it. The list is the host's — nothing is
 * registered by default — so the entries cannot be known when the node type is
 * declared, and the second field's choices depend on the first. That is the
 * one thing this test is really about: the panel offers the entries of the
 * list chosen beside them, and stores the code.
 */

const LIST = {
  id: "test-arendetyper",
  standard: "custom",
  label: { sv: "Ärendetyper — test", en: "Case types — test" },
  version: "1",
  published: "2026-09-17",
  source: "Testlista",
  items: [
    { value: "BYGG", label: { sv: "Bygglov", en: "Building permit" } },
    { value: "RIV", label: { sv: "Rivningslov", en: "Demolition permit" } },
  ],
};

beforeEach(() => registerCodeList(LIST as never));
afterEach(() => {
  unregisterCodeList(LIST.id);
  document.body.replaceChildren();
});

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function panelWith(data: Record<string, unknown>): {
  panel: PropertiesPanel;
  changes: Array<{ property: string; value: unknown }>;
} {
  const panel = document.createElement("properties-panel") as PropertiesPanel;
  const changes: Array<{ property: string; value: unknown }> = [];

  panel.editorMode = "administrator";
  document.body.append(panel);
  panel.nodeData = {
    id: "n",
    type: "submit-result",
    position: { x: 0, y: 0 },
    data: { title: "Tack", ...data },
  } as never;
  panel.addEventListener("node-data-changed", (event) => {
    const detail = (event as CustomEvent<{ property: string; value: unknown }>).detail;
    changes.push({ property: detail.property, value: detail.value });
  });

  return { panel, changes };
}

const select = (panel: PropertiesPanel, property: string) =>
  panel.shadowRoot!.querySelector<HTMLSelectElement>(`[data-property="${property}"]`);

describe.runIf(PRO)("ärendetypen på Inlämning", () => {
  test("kodlistan erbjuds, och ärendetypen syns inte förrän en lista är vald", async () => {
    const { panel } = panelWith({});

    const lists = select(panel, "caseTypeListId");

    expect(lists, "listväljaren finns").not.toBeNull();
    expect([...lists!.options].map((option) => option.value)).toContain(LIST.id);
    /*
     * A field asking which entry of no list would be a box that cannot be
     * answered — the same gate a repeating page's settings sit behind.
     */
    expect(select(panel, "caseType"), "ingen lista, ingen typ att välja").toBeNull();
  });

  test("typen väljs ur den valda listans poster, och koden når noden", async () => {
    const { panel, changes } = panelWith({ caseTypeListId: LIST.id });

    const types = select(panel, "caseType");

    expect(types, "typväljaren finns när listan är vald").not.toBeNull();
    expect([...types!.options].map((option) => option.value)).toEqual(["", "BYGG", "RIV"]);
    // The label is the list's, in the editor's own words; the code is what is
    // stored and what the errand carries.
    expect([...types!.options].map((option) => option.textContent?.trim())).toEqual([
      "—",
      "Bygglov",
      "Rivningslov",
    ]);

    await userEvent.selectOptions(types!, "BYGG");
    await settle();

    expect(changes.filter((change) => change.property === "caseType").at(-1)?.value).toBe("BYGG");
  });

  test("en lista som inte är registrerad ger inga påhittade val", async () => {
    const { panel } = panelWith({ caseTypeListId: "finns-inte" });

    const types = select(panel, "caseType");

    // The field is drawn — a list was chosen — but it offers nothing to pick,
    // which is the honest answer. Offering another list's entries would store
    // a code the receiver cannot place.
    expect([...(types?.options ?? [])].map((option) => option.value)).toEqual([""]);
  });
});
