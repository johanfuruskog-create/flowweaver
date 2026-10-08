import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./properties-panel";
import "../guide-versions/guide-versions";

import type { PropertiesPanel } from "./properties-panel";
import type { GuideVersion, GuideVersions } from "../guide-versions/guide-versions";

/**
 * One grip mark, not two — mätt mot artiklarna 22/9 (docs/IDEAS.md): en ikon
 * för alla grepp i editorn. Versionslistan och nodhuvudet bar redan ⠿
 * (U+283F); svarsalternativens handtag bar ☰ (U+2630), det enda avvikande
 * tecknet.
 *
 * ## Varför storleken mäts, inte bara tecknet
 *
 * Samma tecken i olika storlek är fortfarande två grepp för ögat. Panelens
 * handtag satte glyfen till `--fw-font-size-2xl` (18px) medan versionslistans
 * `.grip` inte satte något alls och därför ärvde omgivningens 16px — mätt med
 * `getBoundingClientRect` i en 900 px ruta, inte antaget av att läsa
 * stilmallen. Skillnaden gjorde att en ⠿ på 18px inte ens är samma glyf som en
 * ⠿ på 16px att titta på. Fixet var att sätta panelens handtag till
 * `--fw-font-size-xl` (16px) — samma skalsteg som webbläsarens standard och
 * det som versionslistan redan ärver.
 */

afterEach(() => document.body.replaceChildren());

function ruta(width: string): HTMLDivElement {
  const box = document.createElement("div");

  box.style.width = width;
  document.body.append(box);

  return box;
}

function mountOptions(): PropertiesPanel {
  const panel = document.createElement("properties-panel") as PropertiesPanel;

  panel.editorMode = "administrator";
  ruta("900px").append(panel);
  panel.nodeData = {
    id: "q",
    type: "question",
    position: { x: 0, y: 0 },
    data: {
      title: "Vad gäller ärendet?",
      variableName: "amne",
      options: [
        { id: "a", label: "Bygglov", value: "bygglov" },
        { id: "b", label: "Avlopp", value: "avlopp" },
      ],
    },
  } as never;

  return panel;
}

const VERSIONS: GuideVersion[] = [
  { id: "v1", number: 1, savedAt: 1754400000000 },
  { id: "v2", number: 2, savedAt: 1753700000000 },
];

function mountVersions(): GuideVersions {
  const element = document.createElement("guide-versions") as GuideVersions;

  element.setAttribute("editor-locale", "sv");
  // The grip only renders in the custom (dragged-by-hand) order.
  element.setAttribute("order", "custom");
  ruta("900px").append(element);
  element.versions = VERSIONS;

  return element;
}

const optionHandleGlyph = (panel: PropertiesPanel): HTMLElement =>
  panel.shadowRoot!.querySelector<HTMLElement>(
    '[data-action="drag-option"] span[aria-hidden="true"]',
  )!;

const versionGrip = (element: GuideVersions): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>("[data-grip]")!;

/**
 * The character's own box, not the handle around it.
 *
 * `getBoundingClientRect` on the elements themselves compares two different
 * things dressed the same: the panel's glyph sits in a bare, unpadded span
 * (the 30×30 touch target is its button parent, sized for K6, not for the
 * glyph); the list's grip is a single element carrying both the glyph *and*
 * `padding: 4px 2px` as its own touch target. Measuring the elements would
 * compare a target's padding against another target's padding-free reading —
 * a mismatch neither rule caused. A `Range` around just the text node reads
 * the glyph itself, the way the article means "one icon for every grip".
 */
function glyphBox(element: HTMLElement): DOMRect {
  const range = document.createRange();

  range.selectNodeContents(element.firstChild!);

  return range.getBoundingClientRect();
}

describe("greppteckent på svarsalternativen", () => {
  test("bär samma glyf som versionslistan och nodhuvudet, ⠿", () => {
    const glyph = optionHandleGlyph(mountOptions());

    expect(glyph.textContent).toBe("⠿");
    expect(glyph.textContent).not.toBe("☰");
  });

  test("renderas lika stort som versionslistans grepp vid 900 px", () => {
    const option = glyphBox(optionHandleGlyph(mountOptions()));
    const version = glyphBox(versionGrip(mountVersions()));

    /*
     * Mätt 22/9: `.properties-panel__field span` (en fångstregel för fältens
     * egna bildtexter) satte glyfen till 12px trots att handtaget bad om
     * 18px — samma specificitet, olika element, ingen av dem vann det andra.
     * Efter rättningen (spannet ärver knappens font-size uttryckligen, och
     * knappen bad om --fw-font-size-xl i stället för -2xl) läser båda 17px
     * höga, mätt med `getBoundingClientRect` på själva tecknet.
     */
    expect(
      Math.abs(option.height - version.height),
      `panelens glyf är ${option.height}px hög, versionslistans ${version.height}px`,
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(option.width - version.width),
      `panelens glyf är ${option.width}px bred, versionslistans ${version.width}px`,
    ).toBeLessThanOrEqual(2);
  });
});
