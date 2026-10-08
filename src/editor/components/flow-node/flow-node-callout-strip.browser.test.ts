import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./flow-node";

import { CALLOUT_ICONS, NODE_ICONS } from "../../../viewer/node-types/node-icons";

import type { FlowNode } from "./flow-node";
import type { FlowNodeData } from "../../../viewer/types/graph";

/*
 * Story 096: a Text shown as a box says so on its card. The strip that reads
 * *Text* reads *Viktigt* instead, with the box's icon in place of the Text's —
 * the same move as a text field whose strip reads its format (*E-post*).
 * Without it, *Viktigt* and plain text are the same card on the canvas and
 * the panel has to be opened to tell them apart.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 40) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount(data: Record<string, unknown>): Promise<FlowNode> {
  const element = document.createElement("flow-node") as FlowNode;

  document.body.append(element);
  element.nodeData = {
    id: "text",
    type: "page-heading",
    parentPageId: "page",
    position: { x: 0, y: 0 },
    data: { title: "Att låna kostar pengar", ...data },
  } as FlowNodeData;

  await settle();

  return element;
}

const strip = (element: FlowNode) => element.shadowRoot!.querySelector(".flow-node__header-text")!;
const iconOf = (element: FlowNode) => strip(element).querySelector(".flow-node__type-icon")!.innerHTML;
// The source string, serialised the way the DOM serialises it (`<path></path>`, not `<path/>`).
const drawn = (svg: string): string => {
  const holder = document.createElement("template");
  holder.innerHTML = svg;
  return holder.innerHTML;
};

describe("typremsan på en text som visas som ruta", () => {
  test("Viktigt: ordet och rutans ikon i stället för Text och Textens", async () => {
    const element = await mount({ presentation: "warning" });

    expect(strip(element).textContent?.trim()).toBe("Viktigt");
    expect(iconOf(element)).toBe(drawn(CALLOUT_ICONS.warning));
  });

  test("Inforuta och Tips", async () => {
    expect(strip(await mount({ presentation: "info" })).textContent?.trim()).toBe("Inforuta");
    expect(strip(await mount({ presentation: "tip" })).textContent?.trim()).toBe("Tips");
  });

  test("en vanlig text heter Text och bär Textens ikon — som förut", async () => {
    const element = await mount({});

    expect(strip(element).textContent?.trim()).toBe("Text");
    expect(iconOf(element)).toBe(drawn(NODE_ICONS["page-heading"]));
  });
});
