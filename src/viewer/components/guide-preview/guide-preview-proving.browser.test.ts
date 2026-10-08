import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import { pageBuilderExampleGraph } from "../../../data/page-builder-example-graph";

import type { GuidePreview } from "./guide-preview";

/**
 * Two ways of looking, one renderer (stories 064 point 4 and 065 point 7).
 *
 * The eye shows an author *everything*, including a field whose rule does not
 * hold — framed, with the condition spelled out above it, because an author has
 * to be able to see and reach a field a visitor may never meet. A run is the
 * opposite question: what does the visitor actually get? So the same preview,
 * told it is part of a run, hides the field again.
 *
 * Held here rather than through the canvas because this is the sentence: two
 * attributes on one element, and one line deciding between them.
 */

afterEach(() => document.body.replaceChildren());

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

async function page(...attributes: string[]): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  attributes.forEach((name) => preview.setAttribute(name, ""));
  preview.style.cssText = "display: block; width: 660px;";
  document.body.append(preview);
  preview.graph = structuredClone(pageBuilderExampleGraph);
  preview.showNode("service-contact-page");
  await settle();
  return preview;
}

/** The page fields a reader can actually see. */
function shownFields(preview: GuidePreview): string[] {
  return [
    ...(preview.shadowRoot?.querySelectorAll<HTMLElement>("[data-page-field-id]") ??
      []),
  ]
    .filter((field) => field.getBoundingClientRect().height > 0)
    .map((field) => field.dataset.pageFieldId ?? "");
}

describe("villkorade fält i provet", () => {
  test("ögat visar alla tre fälten, även de vars villkor inte slår in", async () => {
    const preview = await page("editor-view");

    expect(shownFields(preview)).toEqual([
      "service-contact-method",
      "service-email-address",
      "service-phone-number",
    ]);
  });

  test("provet visar bara det fält besökaren får", async () => {
    const preview = await page("editor-view", "proving");

    expect(shownFields(preview)).toEqual(["service-contact-method"]);
  });

  test("visaren utanför editorn är oförändrad", async () => {
    const preview = await page();

    expect(shownFields(preview)).toEqual(["service-contact-method"]);
  });
});
