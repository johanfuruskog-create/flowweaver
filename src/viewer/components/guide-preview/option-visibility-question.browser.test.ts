import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import { optionVisibilityGraph } from "../../../data/option-visibility-graph";
import { exportGraphJson, importGraphJson } from "../../../editor/core/graph-io";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Konceptbild 3 (29/9): att alternativets synlighet hos besökaren följer
 * villkoret — på och uppfyllt visas det, på och inte uppfyllt är det borta,
 * av visas det alltid. Och likadant efter att guiden sparats och lästs in
 * igen genom filformatet, som en värd gör.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Guiden som den ser ut efter export och import — sparad och omladdad. */
function saved(graph: GraphData): GraphData {
  const written = exportGraphJson(graph);
  if (!written.success) throw new Error(written.errors.join("; "));
  const read = importGraphJson(written.json);
  if (!read.success) throw new Error(read.errors.join("; "));
  return read.graph;
}

/** Svarar på organisationsfrågan och säger vilka alternativ nästa fråga visar. */
async function offeredAfter(graph: GraphData, orgOption: "org-yes" | "org-no"): Promise<string[]> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "sv");
  document.body.append(preview);
  preview.graph = graph;
  await settle();

  const root = preview.shadowRoot!;
  const radio = root.querySelector<HTMLInputElement>(`input[type="radio"][value="${orgOption}"]`)!;
  radio.checked = true;
  radio.dispatchEvent(new Event("change", { bubbles: true }));
  await settle();
  [...root.querySelectorAll<HTMLButtonElement>("button")].find((button) => /Nästa|Fortsätt/i.test(button.textContent ?? ""))!.click();
  await settle();

  expect(root.textContent, "på frågan efter").toContain("Vem ansöker?");
  const offered = [...root.querySelectorAll<HTMLInputElement>('input[type="radio"]')].map((one) => one.value);
  preview.remove();
  return offered;
}

const ON = optionVisibilityGraph(true);
const OFF = optionVisibilityGraph(false);

describe("konceptbild 3: alternativets villkor hos besökaren", () => {
  for (const [when, prepare] of [
    ["som byggd", (graph: GraphData) => graph],
    ["efter sparning och omladdning", saved],
  ] as const) {
    test(`${when}: på och uppfyllt visas, på och inte uppfyllt döljs, av visas alltid`, async () => {
      expect(await offeredAfter(prepare(ON), "org-yes"), "på, uppfyllt").toEqual(["applicant-private", "applicant-company"]);
      expect(await offeredAfter(prepare(ON), "org-no"), "på, inte uppfyllt").toEqual(["applicant-private"]);
      expect(await offeredAfter(prepare(OFF), "org-yes"), "av").toEqual(["applicant-private", "applicant-company"]);
      expect(await offeredAfter(prepare(OFF), "org-no"), "av").toEqual(["applicant-private", "applicant-company"]);
    });
  }

  test("villkoret överlever sparningen oförändrat", () => {
    const company = (graph: GraphData) =>
      (graph.nodes.find((node) => node.id === "applicant")!.data.options as Array<{ id: string; visibility?: unknown }>).find(
        (option) => option.id === "applicant-company",
      );

    expect(company(saved(ON))!.visibility).toEqual(company(ON)!.visibility);
    expect(company(saved(OFF))).not.toHaveProperty("visibility");
  });
});
