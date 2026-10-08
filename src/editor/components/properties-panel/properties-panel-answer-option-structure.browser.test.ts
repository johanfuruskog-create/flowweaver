import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./properties-panel";

import type { PropertiesPanel } from "./properties-panel";

/**
 * Etapp 2 (UPPDRAG-2026-09-28-SVARSALTERNATIV, 28/9): formen är min, Teds
 * beteende bygger ovanpå den. Det här provet äger bara hookarna Ted föreslog
 * och bad mig bygga mot i `renderAnswerOptionRow` — inte utfällning, inte
 * fokus-efter-flytt, som är hans logik och hans egna prov.
 *
 * Sett falla: körde samma provfil mot commit 01c67c50 (grenens läge innan
 * den här formen fanns) i en temporär `git worktree` (PRAXIS 37, ingen
 * stash) — fem av sex fall föll där (mockItems-isolationen klarade sig,
 * väntat, för den grenen rör inte mockItems). Grönt här, mot den nya formen.
 */

afterEach(() => {
  document.body.replaceChildren();
});

/**
 * The heading's visible name: its text without the hidden position ("Alternativ
 * N, "), which Ted fills in for screen readers (konceptbild 2, 29/9).
 */
function nameIn(title: Element): string {
  return [...title.childNodes]
    .filter((node) => !(node instanceof HTMLElement && node.hasAttribute("data-option-position")))
    .map((node) => node.textContent)
    .join("")
    .trim();
}

function mountQuestion(options: Array<{ id: string; label: string; value: string }>): PropertiesPanel {
  const panel = document.createElement("properties-panel") as PropertiesPanel;

  panel.editorMode = "administrator";
  document.body.append(panel);
  panel.nodeData = {
    id: "q",
    type: "question",
    position: { x: 0, y: 0 },
    data: {
      title: "Vad gäller ärendet?",
      variableName: "amne",
      options,
    },
  };

  return panel;
}

function mountMockItems(): PropertiesPanel {
  const panel = document.createElement("properties-panel") as PropertiesPanel;

  panel.editorMode = "administrator";
  document.body.append(panel);
  panel.nodeData = {
    id: "m",
    type: "multi-autocomplete-question",
    position: { x: 0, y: 0 },
    data: {
      title: "Välj kommuner",
      variableName: "kommuner",
      source: "mock",
      mockItems: [
        { id: "x", label: "Falun", value: "falun" },
        { id: "y", label: "Borlänge", value: "borlange" },
      ],
    },
  };

  return panel;
}

const row = (panel: PropertiesPanel, id: string) =>
  panel.shadowRoot?.querySelector<HTMLElement>(
    `.properties-panel__option[data-option-id="${id}"]`
  ) ?? null;

describe("svarsalternativens utfällbara rad — struktur (Ted bygger beteendet ovanpå)", () => {
  test("raden bär --answer och renderas stängd som viloläge", () => {
    const panel = mountQuestion([
      { id: "a", label: "Bygglov", value: "bygglov" },
      { id: "b", label: "Avlopp", value: "avlopp" },
    ]);
    const optionRow = row(panel, "a")!;

    expect(optionRow.classList.contains("properties-panel__option--answer")).toBe(true);
    expect(optionRow.hasAttribute("data-option-open")).toBe(false);

    const toggle = optionRow.querySelector<HTMLButtonElement>('[data-action="toggle-option"]')!;
    const body = optionRow.querySelector<HTMLElement>("[data-option-body]")!;

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe(body.id);
    expect(body.id).toBe("option-body-a");
    expect(body.hasAttribute("hidden")).toBe(true);
    // `display: grid` i den egna regeln vann tidigare över webbläsarens
    // `[hidden] { display: none }` (UA-arket förlorar alltid mot
    // författarstilar, oavsett specificitet) — kroppen såg stängd ut i
    // markupet men visades ändå. Mätt med en riktig skärmdump 29/9.
    expect(getComputedStyle(body).display).toBe("none");
  });

  test("rubriken visar etiketten, och \"Nytt alternativ\" när den är tom", () => {
    const panel = mountQuestion([
      { id: "a", label: "Bygglov", value: "bygglov" },
      { id: "b", label: "", value: "option-2" },
    ]);

    // `.trim()`: konceptbild 2 (29/9) lade ett tomt, dolt data-option-
    // position-span FÖRE etikettexten i rubriken (Ted/Siv fyller det) —
    // textContent bär då också mallens egen radbrytning/indrag runt det.
    expect(nameIn(row(panel, "a")!.querySelector("[data-option-title]")!)).toBe("Bygglov");
    expect(nameIn(row(panel, "b")!.querySelector("[data-option-title]")!)).toBe("Nytt alternativ");
  });

  /*
   * Vända 5 (Siv, 29/9): `data-option-title` bar ett `title`-attribut kvar
   * från en tidigare vända — webbläsarens egen hovertooltip dubblerade då
   * den byggda tooltipen (`role="tooltip"`, kopplad via chevronens
   * aria-describedby) vid hover, med olika timing och utan Escape.
   */
  test("rubriken har inget eget title-attribut — bara den byggda tooltipen visar hela namnet", () => {
    const panel = mountQuestion([{ id: "a", label: "En mycket lång etikett som beskriver ett fel i stor detalj", value: "bygglov" }]);

    expect(row(panel, "a")!.querySelector("[data-option-title]")!.getAttribute("title")).toBeNull();
  });

  /*
   * K3 (UPPDRAG-2026-09-28-SVARSALTERNATIV, etapp 2 K-numren, Siv 28/9):
   * mätt mot renderad DOM med flera rader — grepp, flytta upp/ned och
   * chevron hade alla samma namn på varje rad ("Flytta alternativet
   * uppåt", identiskt på sex rader), och grepp gav bara "Flytta " (inget
   * efter) för en genuint tom etikett.
   */
  test("grepp, flytta upp/ned och chevron bär alternativets egen titel — olika namn per rad", () => {
    const panel = mountQuestion([
      { id: "a", label: "Bygglov", value: "bygglov" },
      { id: "b", label: "Avlopp", value: "avlopp" },
      { id: "c", label: "", value: "" },
    ]);
    const names = (id: string) => {
      const optionRow = row(panel, id)!;
      return {
        grip: optionRow.querySelector('[data-action="drag-option"]')!.getAttribute("aria-label"),
        up: optionRow.querySelector('[data-action="move-option-up"]')!.getAttribute("aria-label"),
        down: optionRow.querySelector('[data-action="move-option-down"]')!.getAttribute("aria-label"),
        chevron: optionRow.querySelector('[data-action="toggle-option"]')!.getAttribute("aria-label"),
      };
    };
    const a = names("a");
    const b = names("b");
    const c = names("c");

    expect(a).toEqual({ grip: "Flytta Bygglov", up: "Flytta Bygglov uppåt", down: "Flytta Bygglov nedåt", chevron: "Visa Bygglov" });
    expect(b.grip).not.toBe(a.grip);
    expect(b.up).not.toBe(a.up);
    expect(b.down).not.toBe(a.down);
    expect(b.chevron).not.toBe(a.chevron);
    // En genuint tom etikett: samma platshållare som den synliga rubriken,
    // aldrig ett namn utan ord efter "Flytta ".
    expect(c).toEqual({ grip: "Flytta Nytt alternativ", up: "Flytta Nytt alternativ uppåt", down: "Flytta Nytt alternativ nedåt", chevron: "Visa Nytt alternativ" });
  });

  test("chevronens namn byter till Dölj + titeln när raden fälls ut", () => {
    const panel = mountQuestion([{ id: "a", label: "Bygglov", value: "bygglov" }]);
    const toggle = row(panel, "a")!.querySelector<HTMLButtonElement>('[data-action="toggle-option"]')!;

    toggle.click();
    expect(toggle.getAttribute("aria-label")).toBe("Dölj Bygglov");
    toggle.click();
    expect(toggle.getAttribute("aria-label")).toBe("Visa Bygglov");
  });

  /*
   * "Nytt alternativ" är bara synlig text i rubriken (`data-option-title`)
   * tills nu — fokus går rakt in i etikettfältet (Teds "Lägg till"-flöde),
   * så en skärmläsare som inte bläddrar visuellt hör den aldrig. Fältet
   * beskrivs nu av rubriken.
   */
  test("etikettfältet är kopplat till alternativets rubrik (aria-describedby)", () => {
    const panel = mountQuestion([{ id: "a", label: "", value: "" }]);
    const optionRow = row(panel, "a")!;
    const input = optionRow.querySelector<HTMLInputElement>('[data-option-property="label"]')!;
    const title = optionRow.querySelector<HTMLElement>("[data-option-title]")!;

    expect(title.id, "rubriken har ett id att peka på").not.toBe("");
    expect(input.getAttribute("aria-describedby")).toBe(title.id);
    expect(nameIn(title)).toBe("Nytt alternativ");
  });

  /*
   * Johans förenkling, Astras vända 5 (28/9): ersätter allt tidigare om
   * chip och utfällbar inställning. Ett stängt kort visar bara namn,
   * position och kontroller. Ett öppet kort visar lagringsvärdet EXAKT en
   * gång, som ett vanligt fält — ingen chip, ingen utfällning, ingen ikon.
   */
  test("stängt kort visar inget lagringsvärde — namn, position och kontroller bara", () => {
    const panel = mountQuestion([{ id: "a", label: "Bygglov", value: "bygglov" }]);
    const optionRow = row(panel, "a")!;

    expect(optionRow.hasAttribute("data-option-open")).toBe(false);
    expect(optionRow.querySelector("[data-option-value]")).toBeNull();
    expect(optionRow.querySelector('[data-action="toggle-option-value"]')).toBeNull();
    expect(nameIn(optionRow.querySelector("[data-option-title]")!)).toBe("Bygglov");
    expect(optionRow.querySelector('[data-action="toggle-option"]')).not.toBeNull();
    expect(optionRow.querySelector('[data-action="move-option-up"]')).not.toBeNull();
  });

  test("öppet kort visar lagringsvärdet exakt en gång, som ett vanligt fält", () => {
    const panel = mountQuestion([{ id: "a", label: "Bygglov", value: "bygglov" }]);
    const optionRow = row(panel, "a")!;

    optionRow.querySelector<HTMLElement>('[data-action="toggle-option"]')!.click();

    const valueInputs = [...optionRow.querySelectorAll<HTMLInputElement>('[data-option-property="value"]')];

    expect(valueInputs, "värdet finns exakt en gång").toHaveLength(1);
    expect(valueInputs[0]!.value).toBe("bygglov");
    expect(valueInputs[0]!.tagName).toBe("INPUT");
    // Inga rester av utfällningen eller chipen (papperskorgs-SVG:n på "Ta
    // bort alternativ" är en annan, legitim ikon — inte taggikonen).
    expect(optionRow.querySelector('[data-action="toggle-option-value"]')).toBeNull();
    expect(optionRow.querySelector("[data-option-value-body]")).toBeNull();
    expect(optionRow.querySelector("code")).toBeNull();
  });

  test("befintliga hookar för flytt, borttag och drag finns kvar", () => {
    const panel = mountQuestion([
      { id: "a", label: "Bygglov", value: "bygglov" },
      { id: "b", label: "Avlopp", value: "avlopp" },
    ]);
    const optionRow = row(panel, "a")!;

    expect(optionRow.querySelector('[data-action="drag-option"]')).not.toBeNull();
    expect(optionRow.querySelector('[data-action="move-option-up"]')).not.toBeNull();
    expect(optionRow.querySelector('[data-action="move-option-down"]')).not.toBeNull();
    expect(optionRow.querySelector('[data-option-property="label"]')).not.toBeNull();
    expect(optionRow.querySelector('[data-option-property="value"]')).not.toBeNull();
    expect(optionRow.querySelector('[data-action="remove-option"]')).not.toBeNull();
  });

  test("Ta bort alternativ är inaktiverad vid minimigränsen, inte dold", () => {
    const panel = mountQuestion([
      { id: "a", label: "Bygglov", value: "bygglov" },
      { id: "b", label: "Avlopp", value: "avlopp" },
    ]);
    const remove = row(panel, "a")!.querySelector<HTMLButtonElement>('[data-action="remove-option"]')!;

    expect(remove).not.toBeNull();
    expect(remove.disabled).toBe(true);
  });

  test("Egen lista (mockItems) delar renderaren men får inte den nya formen", () => {
    const panel = mountMockItems();
    const optionRow = row(panel, "x")!;

    expect(optionRow).not.toBeNull();
    expect(optionRow.classList.contains("properties-panel__option--answer")).toBe(false);
    expect(optionRow.querySelector("[data-option-title]")).toBeNull();
    expect(optionRow.querySelector("[data-option-body]")).toBeNull();
    expect(optionRow.querySelector('[data-action="toggle-option"]')).toBeNull();
  });
});
