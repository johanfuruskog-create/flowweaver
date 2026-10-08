import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../../viewer/node-types/default-node-types";
import "../node-editor/node-editor";

import { exampleGraph } from "../../../data/example-graph";
import { pageBuilderExampleGraph } from "../../../data/page-builder-example-graph";

import type { NodeEditor } from "../node-editor/node-editor";
import type { FlowNode } from "./flow-node";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * What a lit eye actually draws, in the node's own box.
 *
 * Story 064 point 2: the node the way a visitor sees it, in the same box and in
 * the same place — the page with its fields, the question as radio rows, and no
 * second renderer anywhere. The viewer draws it; the canvas only decides which
 * of the two views is the visible one.
 *
 * Three things here are the ones that were hard, and each has its own case:
 *
 * - **The conditional field.** A visitor sees it only when the rule holds; an
 *   author has to see it always. So the editor's copy of the viewer is asked to
 *   reveal it, with the rule spelled out above it — the same sentence the node's
 *   own visibility badge carries, so there is one wording and not two.
 * - **The answer is the port.** Each option's exit ring moves to its own row, so
 *   a line leaves from the answer it belongs to. Measured against the row's
 *   middle rather than asserted from the markup.
 * - **The click.** The preview is `inert` — measured 2026-09-01 as the only one
 *   of three ways that takes the whole thing out of the tab order — and an inert
 *   subtree receives no clicks at all, so which field was hit is decided from
 *   the rectangles the node measures anyway for the ports.
 */

afterEach(() => document.body.replaceChildren());

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

function mount(graph: GraphData): NodeEditor {
  const editor = document.createElement("node-editor") as NodeEditor;

  editor.editorMode = "administrator";
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = structuredClone(graph);
  return editor;
}

function nodeElement(editor: NodeEditor, id: string): FlowNode {
  const found = [
    ...(editor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []),
  ].find((element) => element.nodeId === id);

  if (!found) throw new Error(`ingen nod med id ${id}`);
  return found;
}

const toggle = (node: FlowNode): HTMLButtonElement | null =>
  node.shadowRoot?.querySelector<HTMLButtonElement>("[data-visitor-toggle]") ??
  null;

const preview = (node: FlowNode): HTMLElement | null =>
  node.shadowRoot?.querySelector<HTMLElement>("[data-visitor-preview]") ?? null;

async function light(node: FlowNode): Promise<void> {
  toggle(node)?.click();
  await settle();
  await settle();
}

describe("besökarvyn i rutan", () => {
  test("lång lista får ett tak — anslutna rader göms aldrig bakom fler", async () => {
    // Kartläggningens princip 2: taket (fyra rader + "N fler") gäller bara
    // oanslutna alternativ. En rad som en linje utgår från måste synas,
    // annars finns inget att härleda linjen ur. Fler-raden bär inga portar.
    const graph = structuredClone(exampleGraph);
    const question = graph.nodes.find((node) => node.id === "question-gender")!;
    (question.data as Record<string, unknown>).presentation = "select";
    const options = (question.data as { options: { id: string; label: unknown; value: string }[] }).options;
    options.push(
      { id: "extra-1", label: { sv: "Ovanlig A" }, value: "a" },
      { id: "extra-2", label: { sv: "Ovanlig B" }, value: "b" },
      { id: "extra-3", label: { sv: "Ovanlig C" }, value: "c" },
    );

    const editor = mount(graph);
    await settle();
    const node = nodeElement(editor, "question-gender");
    await light(node);
    await settle();

    const rows = [
      ...(preview(node)?.shadowRoot?.querySelectorAll<HTMLElement>(
        ".guide-preview__open-list-row",
      ) ?? []),
    ];
    const optionRows = rows.filter((row) => row.dataset.optionId);
    const moreRow = rows.find((row) => row.hasAttribute("data-open-list-more"));

    // 6 alternativ: 3 anslutna + 1 oansluten ryms; 2 göms bakom fler-raden.
    expect(optionRows.length, "radantal under taket").toBe(4);
    for (const id of ["gender-male", "gender-female", "gender-other"]) {
      expect(
        optionRows.some((row) => row.dataset.optionId === id),
        `ansluten rad ${id} syns`,
      ).toBe(true);
    }
    expect(moreRow, "fler-raden finns").toBeTruthy();
    expect(moreRow!.textContent).toContain("2 fler");
    expect(moreRow!.dataset.optionId, "fler-raden är portlös").toBeUndefined();

    // Samlingsporten (Johans idé 2/9): fler-raden bär EN grå port med en
    // räknarbricka — som Mail-ikonens olästa-siffra — och de gömda
    // alternativens ringar staplas på den, så en linje därifrån går till
    // fler-raden i stället för att sväva i ett lagerspår.
    const moreBox = moreRow!.getBoundingClientRect();
    const badgeRows: HTMLElement[] = [];
    for (const hiddenId of ["extra-2", "extra-3"]) {
      const hiddenRow = node.shadowRoot!.querySelector<HTMLElement>(
        `.flow-node__port-row--output:has([data-port-id="${hiddenId}"])`,
      )!;
      badgeRows.push(hiddenRow);
      expect(
        hiddenRow.hasAttribute("data-more-port"),
        `${hiddenId} står på fler-raden`,
      ).toBe(true);
      const ring = hiddenRow.querySelector<HTMLElement>("[data-port-id]")!;
      const ringBox = ring.getBoundingClientRect();
      expect(
        Math.abs(ringBox.top + ringBox.height / 2 - (moreBox.top + moreBox.height / 2)),
        `${hiddenId}: ringen på fler-radens mitt`,
      ).toBeLessThanOrEqual(4);
      expect(
        Math.abs(ringBox.left + ringBox.width / 2 - moreBox.right),
        `${hiddenId}: ringen på listkanten`,
      ).toBeLessThanOrEqual(3);
    }
    // Räknarbrickan sitter på exakt en av de staplade raderna.
    expect(
      badgeRows.filter((row) => row.dataset.moreCount === "2").length,
      "en rad bär brickan med antalet",
    ).toBe(1);
  });

  test("fler anslutna än taket — översvämmande linjer samlas på fler-porten", async () => {
    // Johans fråga 2/9: "testa hur det ser ut om det går två linjer från den
    // porten". Med samlingsporten på plats gäller taket strikt: fyra rader,
    // anslutna först i ursprungsordning, och de anslutna som inte ryms får
    // sina linjer till disken — de blir "2 fler" med två linjer ut.
    const graph = structuredClone(exampleGraph);
    const question = graph.nodes.find((node) => node.id === "question-gender")!;
    (question.data as Record<string, unknown>).presentation = "select";
    const options = (question.data as { options: { id: string; label: unknown; value: string }[] }).options;
    options.push(
      { id: "extra-1", label: { sv: "Ovanlig A" }, value: "a" },
      { id: "extra-2", label: { sv: "Ovanlig B" }, value: "b" },
      { id: "extra-3", label: { sv: "Ovanlig C" }, value: "c" },
    );
    const targets = graph.connections
      .filter((connection) => connection.from.nodeId === "question-gender")
      .map((connection) => connection.to);
    graph.connections.push(
      { id: "extra-line-2", from: { nodeId: "question-gender", portId: "extra-2" }, to: targets[0]! },
      { id: "extra-line-3", from: { nodeId: "question-gender", portId: "extra-3" }, to: targets[1]! },
    );

    const editor = mount(graph);
    await settle();
    const node = nodeElement(editor, "question-gender");
    await light(node);
    await settle();

    const rows = [
      ...(preview(node)?.shadowRoot?.querySelectorAll<HTMLElement>(
        ".guide-preview__open-list-row",
      ) ?? []),
    ];
    const optionRows = rows.filter((row) => row.dataset.optionId);
    expect(optionRows.length, "strikt tak").toBe(4);
    // Anslutna först i ursprungsordning: de tre ursprungliga + extra-2.
    expect(optionRows.map((row) => row.dataset.optionId)).toEqual([
      "gender-male", "gender-female", "gender-other", "extra-2",
    ]);

    // extra-3 (ansluten, ryms inte) och extra-1 (oansluten) står på porten.
    for (const hiddenId of ["extra-3", "extra-1"]) {
      const hiddenRow = node.shadowRoot!.querySelector<HTMLElement>(
        `.flow-node__port-row--output:has([data-port-id="${hiddenId}"])`,
      )!;
      expect(hiddenRow.hasAttribute("data-more-port"), hiddenId).toBe(true);
    }

    // Linjen från extra-3 ritas från samlingsportens läge.
    const morePort = node.shadowRoot!.querySelector<HTMLElement>(
      '[data-port-id="extra-3"]',
    )!;
    const portBox = morePort.getBoundingClientRect();
    const svg = editor.shadowRoot!.querySelector<SVGElement>(".node-editor__connections")
      ?? editor.shadowRoot!.querySelector("svg")!;
    const path = [
      ...editor.shadowRoot!.querySelectorAll<SVGPathElement>(".node-editor__connection"),
    ].find((candidate) => candidate.getAttribute("data-connection-id") === "extra-line-3")!;
    const m = /M ([\d.-]+) ([\d.-]+)/.exec(path.getAttribute("d")!)!;
    const svgBox = svg.getBoundingClientRect();
    expect(
      Math.abs(Number(m[2]) + svgBox.top - (portBox.top + portBox.height / 2)),
      "linjen utgår från fler-portens höjd",
    ).toBeLessThanOrEqual(4);
  });

  test("rullgardin och sökväljare ritas utfällda i tittläget — portarna får rader", async () => {
    // Johans bild 2/9: "Inget valt än · 2 alternativ" och två stumma portar.
    // Kartläggningens princip 1: en kontroll som döljer sina alternativ ritas
    // utfälld i miniatyren, så att portarna har rader att lägga sig på.
    for (const presentation of ["select", "search"]) {
      const graph = structuredClone(exampleGraph);
      const question = graph.nodes.find((node) => node.id === "question-gender")!;
      (question.data as Record<string, unknown>).presentation = presentation;

      const editor = mount(graph);
      await settle();

      const node = nodeElement(editor, "question-gender");
      await light(node);
      await settle();

      const rows = [
        ...(preview(node)?.shadowRoot?.querySelectorAll<HTMLElement>(
          "[data-option-id]",
        ) ?? []),
      ].filter((row) => row.getBoundingClientRect().height > 0);
      expect(rows.length, presentation).toBe(3);

      // Listan linjerar med den stängda kontrollen ovanför, som kontrollens
      // egen meny — och ringen flyttar in till listkanten (Johan 2/9).
      const control = preview(node)!.shadowRoot!.querySelector(
        "select[data-choice-single], chip-picker",
      )!;
      const firstRow = rows[0].closest("label") ?? rows[0];
      expect(
        Math.abs(
          firstRow.getBoundingClientRect().right -
            control.getBoundingClientRect().right,
        ),
        `${presentation}: listkant mot kontrollkant`,
      ).toBeLessThanOrEqual(2);

      const ports = [
        ...(node.shadowRoot?.querySelectorAll<HTMLElement>(
          '.flow-node__port-row--output [data-port-id]',
        ) ?? []),
      ];
      for (const port of ports) {
        const row = rows.find(
          (candidate) =>
            candidate.dataset.optionId ===
            port.dataset.portId,
        );
        if (!row) continue;
        const rowBox = (row.closest("label") ?? row).getBoundingClientRect();
        const portBox = port.getBoundingClientRect();
        expect(
          Math.abs(portBox.top + portBox.height / 2 - (rowBox.top + rowBox.height / 2)),
          `${presentation}:${port.dataset.portId}`,
        ).toBeLessThanOrEqual(4);
        // Ringen sitter PÅ listkanten, inte på kortkanten (Johan 2/9).
        expect(
          Math.abs(portBox.left + portBox.width / 2 - rowBox.right),
          `${presentation}:${port.dataset.portId}: ring på listkanten`,
        ).toBeLessThanOrEqual(3);
        // "Linjerna ska gå ända fram" (Johans idé 2/9): den riktiga linjen
        // ritas ÖVER det här kortet — kortet sänks under linjelagret — och
        // ankras vid ringens kant så den inte korsar ringens vita mellanrum.
        expect(
          node.hasAttribute("data-ports-on-list"),
          `${presentation}: kortet vet att ringarna står på listan`,
        ).toBe(true);
        expect(
          getComputedStyle(node).zIndex,
          `${presentation}: kortet under linjelagret`,
        ).toBe("0");
        const svg = editor.shadowRoot!.querySelector<SVGElement>(
          ".node-editor__connections",
        )!;
        expect(
          Number(getComputedStyle(svg).zIndex),
          `${presentation}: linjelagret över kortet`,
        ).toBeGreaterThanOrEqual(1);
        const ownPath = [
          ...editor.shadowRoot!.querySelectorAll<SVGPathElement>(
            ".node-editor__connection",
          ),
        ].find(
          (candidate) =>
            editor.graph.connections.find(
              (connection) =>
                connection.id === candidate.getAttribute("data-connection-id"),
            )?.from.portId === port.dataset.portId,
        );
        if (ownPath) {
          const match = /M\s*([\d.-]+)[ ,]/.exec(
            ownPath.getAttribute("d") ?? "",
          );
          const svgBox = svg.getBoundingClientRect();
          expect(
            Math.abs(Number(match![1]) + svgBox.left - portBox.right),
            `${presentation}:${port.dataset.portId}: linjen ankrar vid ringens kant`,
          ).toBeLessThanOrEqual(4);
        }
      }

      document.body.replaceChildren();
    }
  });

  test("linjerna följer portarna genom ögat OCH pennan, utan att något dras", async () => {
    // Johan 2/9: efter pennan låg linjerna kvar vid besökarvyns rader tills
    // man drog i något. Skiftet på portraderna sätts/rensas en bildruta
    // efter canvasens enda omritning, och en transform väcker ingen
    // ResizeObserver — så noden måste själv säga till när portarna flyttat.
    const editor = mount(exampleGraph);
    await settle();

    const node = nodeElement(editor, "question-gender");

    const misaligned = () => {
      const paths = [
        ...(editor.shadowRoot?.querySelectorAll<SVGPathElement>(
          ".node-editor__connection",
        ) ?? []),
      ];
      let worst = 0;

      for (const path of paths) {
        const match = /M\s*([\d.]+)[ ,]([\d.]+)/.exec(path.getAttribute("d") ?? "");
        if (!match) continue;
        const start = { x: Number(match[1]), y: Number(match[2]) };
        const connectionId = path.getAttribute("data-connection-id") ?? "";
        const from = editor
          .getData()
          .connections.find((candidate) => candidate.id === connectionId)?.from;
        if (!from || from.nodeId !== "question-gender") continue;
        const port = nodeElement(editor, from.nodeId)
          .shadowRoot?.querySelector<HTMLElement>(
            `[data-port-direction="output"][data-port-id="${from.portId}"]`,
          );
        if (!port) continue;
        const box = port.getBoundingClientRect();
        const host = editor.shadowRoot!
          .querySelector<HTMLElement>(".node-editor__canvas, .node-editor__surface, svg")!
          .getBoundingClientRect();
        const portCenterY = box.top + box.height / 2 - host.top;
        worst = Math.max(worst, Math.abs(start.y - portCenterY));
      }

      return worst;
    };

    await light(node);
    await settle();
    expect(misaligned()).toBeLessThanOrEqual(3);

    toggle(node)?.click();
    await settle();
    await settle();
    expect(misaligned()).toBeLessThanOrEqual(3);
  });

  test("ögat på sida två ritar sidan med guide-preview", async () => {
    const editor = mount(pageBuilderExampleGraph);
    await settle();

    const page = nodeElement(editor, "service-contact-page");

    await light(page);

    const inside = preview(page);

    expect(inside?.tagName).toBe("GUIDE-PREVIEW");
    expect(
      inside?.shadowRoot?.querySelector("h2")?.textContent?.trim(),
    ).toBe("Hur vill du bli kontaktad?");
  });

  test("tre fält, varav två med sin villkorsrad", async () => {
    const editor = mount(pageBuilderExampleGraph);
    await settle();

    const page = nodeElement(editor, "service-contact-page");

    await light(page);

    const inside = preview(page);
    const fields = [
      ...(inside?.shadowRoot?.querySelectorAll<HTMLElement>("[data-page-field-id]") ?? []),
    ];

    expect(fields.map((field) => field.dataset.pageFieldId)).toEqual([
      "service-contact-method",
      "service-email-address",
      "service-phone-number",
    ]);
    expect(fields.every((field) => field.getBoundingClientRect().height > 0)).toBe(
      true,
    );
    expect(
      [
        ...(inside?.shadowRoot?.querySelectorAll(".guide-preview__conditional-rule") ??
          []),
      ].map((row) => row.textContent?.trim()),
    ).toEqual([
      // Redaktörens ord, inte variabelns (story 077): frågans rubrik och
      // svarets text ur samma graf.
      "Visas bara om Kontaktväg är E-post",
      "Visas bara om Kontaktväg är Telefon",
    ]);
  });

  test("sidans fältkort försvinner från arbetsytan, och kommer tillbaka med pennan", async () => {
    const editor = mount(pageBuilderExampleGraph);
    await settle();

    const page = nodeElement(editor, "service-contact-page");
    const card = nodeElement(editor, "service-email-address");

    /*
     * Measured with `getComputedStyle` and not with the attribute. `hidden` on
     * a custom element that sets its own `display` does nothing — the UA rule
     * loses on specificity — and the attribute was set while the card sat there
     * catching clicks. Reading the attribute would have called that a pass.
     */
    await light(page);
    expect(getComputedStyle(card).display).toBe("none");

    await light(page);
    expect(getComputedStyle(card).display).not.toBe("none");
  });

  test("förhandsvyn är inert, så ingenting i den går att nå med tangentbordet", async () => {
    const editor = mount(pageBuilderExampleGraph);
    await settle();

    const page = nodeElement(editor, "service-contact-page");

    await light(page);

    const inside = preview(page);
    const controls = [
      ...(inside?.shadowRoot?.querySelectorAll<HTMLElement>(
        "input, button, select, textarea, a[href]",
      ) ?? []),
    ];
    const focused = controls.filter((control) => {
      control.focus();
      return inside?.shadowRoot?.activeElement === control;
    });

    expect(controls.length).toBeGreaterThan(3);
    expect(focused).toEqual([]);
  });

  test("portar och linjer står kvar, utan NaN", async () => {
    const editor = mount(pageBuilderExampleGraph);
    await settle();

    const page = nodeElement(editor, "service-contact-page");

    await light(page);

    expect(
      page.shadowRoot?.querySelectorAll(".flow-node__port").length,
    ).toBeGreaterThan(0);
    expect(
      [...(editor.shadowRoot?.querySelectorAll("path, line") ?? [])]
        .map((line) => line.getAttribute("d") ?? line.getAttribute("x1") ?? "")
        .filter((value) => value.includes("NaN")),
    ).toEqual([]);
  });

  test("rutan följer vyn: besökarvyn med ögat, strukturen med pennan", async () => {
    // Johan 1/9: the box is the view's own size, and the distance between
    // nodes is the editor's to set. The miniature of this question is shorter
    // than its structure, so the eye shrinks the box; the pencil brings the
    // laid-out size back. Width never changes.
    const editor = mount(exampleGraph);
    await settle();

    const node = nodeElement(editor, "question-gender");
    const before = node.getBoundingClientRect();

    await light(node);

    const lit = node.getBoundingClientRect();
    const inside = preview(node)?.getBoundingClientRect();

    // The box is the shown view's size — whichever of the two is taller.
    expect(Math.round(lit.width)).toBe(Math.round(before.width));
    expect(inside).toBeDefined();
    expect(Math.round(lit.bottom - inside!.bottom)).toBeLessThanOrEqual(24);
    expect(Math.round(lit.height)).not.toBe(Math.round(before.height));

    node.shadowRoot?.querySelector<HTMLButtonElement>("[data-visitor-toggle]")?.click();
    await settle();

    expect(Math.round(node.getBoundingClientRect().height)).toBe(Math.round(before.height));
  });

  test("envalsfrågan: en utgångsport per alternativ, i sin rads höjd", async () => {
    const editor = mount(exampleGraph);
    await settle();

    const node = nodeElement(editor, "question-gender");

    await light(node);

    const inside = preview(node);
    const rows = [
      ...(inside?.shadowRoot?.querySelectorAll<HTMLElement>("[data-option-id]") ?? []),
    ];
    const ports = [
      ...(node.shadowRoot?.querySelectorAll<HTMLElement>(
        '.flow-node__port[data-port-direction="output"]',
      ) ?? []),
    ];

    expect(ports.length).toBe(rows.length);

    const off = rows.map((row) => {
      const label = row.closest("label") ?? row;
      const rowBox = label.getBoundingClientRect();
      const port = ports.find(
        (candidate) => candidate.dataset.portId === row.dataset.optionId,
      );
      const portBox = port!.getBoundingClientRect();

      return Math.abs(
        portBox.top + portBox.height / 2 - (rowBox.top + rowBox.height / 2),
      );
    });

    expect(off.every((distance) => distance <= 4)).toBe(true);
  });

  test("klick på ett fält i besökarvyn markerar sidbarnet", async () => {
    const editor = mount(pageBuilderExampleGraph);
    await settle();

    const page = nodeElement(editor, "service-contact-page");

    await light(page);

    const field = preview(page)?.shadowRoot?.querySelector<HTMLElement>(
      '[data-page-field-id="service-email-address"]',
    );
    const nodeBox = page.getBoundingClientRect();
    const fieldBox = field!.getBoundingClientRect();

    let selected: string | null = null;

    // `selection-changed` is the one hop between the canvas and the panel: the
    // editor listens for it and shows whatever it names.
    editor.addEventListener("selection-changed", (event) => {
      selected = (event as CustomEvent<{ nodeId: string | null }>).detail.nodeId;
    });

    await userEvent.click(page, {
      position: {
        x: Math.round(fieldBox.left + fieldBox.width / 2 - nodeBox.left),
        y: Math.round(fieldBox.top + fieldBox.height / 2 - nodeBox.top),
      },
    });
    await settle();

    expect(selected).toBe("service-email-address");
  });

  /*
   * On a page that repeats (story 084) the preview keys every field by
   * record — `kids-year#0` — so the click has to hand the panel the node,
   * not the key. Found on the film Ett barn till (7/9): the panel said
   * "Noden kids-year#1 finns inte i guiden" when the second child was typed.
   */
  test("klick på ett fält i en upprepad sida markerar noden, inte posten", async () => {
    const editor = mount({
      version: 10,
      startNodeId: "kids",
      settings: { sourceLocale: "sv", locales: ["sv"] },
      nodes: [
        { id: "kids", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Dina barn" }, repeats: true, repeatWord: { sv: "barn" }, repeatVariable: "barn" } },
        { id: "kids-year", type: "text-question", position: { x: 20, y: 112 }, parentPageId: "kids", order: 0, layout: { columnSpan: 12 }, data: { title: { sv: "Födelseår" }, variableName: "fodelsear" } },
      ],
      connections: [],
    } as unknown as GraphData);
    await settle();

    const page = nodeElement(editor, "kids");

    await light(page);

    const field = preview(page)?.shadowRoot?.querySelector<HTMLElement>(
      '[data-page-field-id="kids-year#0"]',
    );
    expect(field, "fältet i första posten").not.toBeNull();
    const nodeBox = page.getBoundingClientRect();
    const fieldBox = field!.getBoundingClientRect();

    let selected: string | null = null;

    editor.addEventListener("selection-changed", (event) => {
      selected = (event as CustomEvent<{ nodeId: string | null }>).detail.nodeId;
    });

    await userEvent.click(page, {
      position: {
        x: Math.round(fieldBox.left + fieldBox.width / 2 - nodeBox.left),
        y: Math.round(fieldBox.top + fieldBox.height / 2 - nodeBox.top),
      },
    });
    await settle();

    expect(selected).toBe("kids-year");
  });

  test("resultatets osvarade variabler blir luckor med variabelns etikett", async () => {
    const graph = structuredClone(exampleGraph);
    const result = graph.nodes.find((node) => node.id === "result-ready")!;

    result.data.description = { sv: "Tack {{age}}!", en: "Thanks {{age}}!" };

    const editor = mount(graph);
    await settle();

    const node = nodeElement(editor, "result-ready");

    await light(node);

    const gaps = [
      ...(preview(node)?.shadowRoot?.querySelectorAll(
        ".guide-preview__variable-gap",
      ) ?? []),
    ];

    // The variable's label, which is what the variable chooser calls it — not
    // the question's heading and not `{{age}}`.
    expect(gaps.map((gap) => gap.textContent?.trim())).toEqual(["Ålder"]);
  });
});
