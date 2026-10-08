import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

afterEach(() => {
  document.body.replaceChildren();
});

function mount(data: Record<string, unknown>): GuidePreview {
  const preview = document.createElement("guide-preview") as GuidePreview;
  document.body.append(preview);
  preview.graph = {
    startNodeId: "q",
    nodes: [
      { id: "q", type: "text-question", position: { x: 0, y: 0 }, data },
      { id: "done", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart" } },
    ],
    connections: [
      { id: "c", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "done", portId: "input" } },
    ],
  } as GraphData;
  return preview;
}

describe("guide-preview: the text field's presentation styles", () => {
  test("text area: renders a textarea and collects the answer", () => {
    const preview = mount({ title: "Berätta", variableName: "v", presentation: "textarea" });

    const textarea = preview.shadowRoot?.querySelector<HTMLTextAreaElement>(
      "textarea[data-text-answer]"
    );
    expect(textarea).not.toBeNull();
    expect(preview.shadowRoot?.querySelector("input[data-text-answer]")).toBeNull();

    textarea!.value = "Ett långt svar";
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));
    preview.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-action="next"]')
      ?.click();

    expect(preview.shadowRoot?.textContent).toContain("Klart");
  });

  test("a text field is the default when no presentation is set", () => {
    const preview = mount({ title: "Kort svar", variableName: "v" });
    expect(preview.shadowRoot?.querySelector("input[data-text-answer]")).not.toBeNull();
    expect(preview.shadowRoot?.querySelector("textarea[data-text-answer]")).toBeNull();
  });

  test("the character counter counts down to the maximum and updates live", () => {
    const preview = mount({
      title: "Berätta",
      variableName: "v",
      presentation: "textarea",
      maxLength: 10,
    });

    const counter = preview.shadowRoot?.querySelector<HTMLElement>("[data-char-counter]");
    const textarea = preview.shadowRoot?.querySelector<HTMLTextAreaElement>(
      "textarea[data-text-answer]"
    );
    expect(counter?.textContent?.trim()).toBe("10 tecken kvar");

    textarea!.value = "abcd";
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(counter?.textContent?.trim()).toBe("6 tecken kvar");
  });

  test("the counter turns amber as the limit approaches", () => {
    const preview = mount({
      title: "Berätta",
      variableName: "v",
      presentation: "textarea",
      maxLength: 10,
    });
    const counter = preview.shadowRoot?.querySelector<HTMLElement>("[data-char-counter]");
    const textarea = preview.shadowRoot?.querySelector<HTMLTextAreaElement>(
      "textarea[data-text-answer]"
    );

    textarea!.value = "123456789"; // 9 av 10
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));

    expect(counter?.textContent?.trim()).toBe("1 tecken kvar");
    expect(counter?.classList.contains("guide-preview__char-counter--near")).toBe(true);
  });

  test("the counter shows the excess in red", () => {
    const preview = mount({
      title: "Berätta",
      variableName: "v",
      presentation: "textarea",
      maxLength: 10,
    });
    const counter = preview.shadowRoot?.querySelector<HTMLElement>("[data-char-counter]");
    const textarea = preview.shadowRoot?.querySelector<HTMLTextAreaElement>(
      "textarea[data-text-answer]"
    );
    // Inget hårt maxlength-tak: man ska kunna skriva över.
    expect(textarea?.hasAttribute("maxlength")).toBe(false);

    textarea!.value = "0123456789ABC"; // 13 av 10 => 3 för mycket
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));

    expect(counter?.textContent?.trim()).toBe("3 tecken för mycket");
    expect(counter?.classList.contains("guide-preview__char-counter--over")).toBe(true);

    const nextButton = preview.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="next"]'
    );
    // 069: knappen är aldrig död — beskedet kommer vid klick i stället.
    expect(nextButton?.disabled).toBe(false);
  });

  test("without a maximum the counter shows characters typed", () => {
    const preview = mount({ title: "Berätta", variableName: "v", presentation: "textarea" });
    const counter = preview.shadowRoot?.querySelector<HTMLElement>("[data-char-counter]");
    const textarea = preview.shadowRoot?.querySelector<HTMLTextAreaElement>(
      "textarea[data-text-answer]"
    );
    expect(counter?.textContent?.trim()).toBe("0 tecken");

    textarea!.value = "hej";
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(counter?.textContent?.trim()).toBe("3 tecken");
  });

  test("validation text shows on blur, not while typing", () => {
    const preview = mount({
      title: "Berätta",
      variableName: "v",
      presentation: "textarea",
      maxLength: 10,
    });
    const textarea = preview.shadowRoot?.querySelector<HTMLTextAreaElement>(
      "textarea[data-text-answer]"
    );
    const validation = preview.shadowRoot?.querySelector<HTMLElement>(
      "[data-text-validation]"
    );

    textarea!.value = "0123456789ABC"; // 13 av 10
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));
    // Medan man skriver: inget tjat.
    expect(validation?.hidden).toBe(true);

    textarea!.dispatchEvent(new Event("blur", { bubbles: true }));
    expect(validation?.hidden).toBe(false);
    expect(validation?.textContent).toBe("Texten får innehålla högst 10 tecken.");
  });

  test("blur on a valid field leaves the validation hidden", () => {
    const preview = mount({
      title: "Berätta",
      variableName: "v",
      presentation: "textarea",
      maxLength: 10,
    });
    const textarea = preview.shadowRoot?.querySelector<HTMLTextAreaElement>(
      "textarea[data-text-answer]"
    );
    const validation = preview.shadowRoot?.querySelector<HTMLElement>(
      "[data-text-validation]"
    );

    textarea!.value = "kort";
    textarea!.dispatchEvent(new Event("blur", { bubbles: true }));
    expect(validation?.hidden).toBe(true);
    expect(validation?.textContent).toBe("");
  });

  test("blur validerar format (e-post) likt motorn", () => {
    const preview = mount({
      title: "E-post",
      variableName: "v",
      format: "email",
    });
    const input = preview.shadowRoot?.querySelector<HTMLInputElement>(
      "input[data-text-answer]"
    );
    const validation = preview.shadowRoot?.querySelector<HTMLElement>(
      "[data-text-validation]"
    );

    input!.value = "inte-en-epost";
    input!.dispatchEvent(new Event("blur", { bubbles: true }));
    expect(validation?.hidden).toBe(false);
    expect(validation?.textContent?.length).toBeGreaterThan(0);
  });

  test("validation text and counter are localised (not hardcoded Swedish)", () => {
    const preview = mount({
      title: "Tell me",
      variableName: "v",
      presentation: "textarea",
      maxLength: 10,
    });
    preview.activeLocale = "en";

    const counter = preview.shadowRoot?.querySelector<HTMLElement>("[data-char-counter]");
    expect(counter?.textContent?.trim()).toBe("10 characters left");

    const textarea = preview.shadowRoot?.querySelector<HTMLTextAreaElement>(
      "textarea[data-text-answer]"
    );
    const validation = preview.shadowRoot?.querySelector<HTMLElement>(
      "[data-text-validation]"
    );
    textarea!.value = "0123456789ABC";
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(counter?.textContent?.trim()).toBe("3 characters too many");
    textarea!.dispatchEvent(new Event("blur", { bubbles: true }));
    expect(validation?.textContent).toBe("Enter at most 10 characters.");
  });

  test("a submit error from the engine shows in the chosen language (English)", () => {
    // Personnummer format => an ordinary text field (not natively blocked), so
    // the submit reaches the engine and its localised error message.
    const preview = mount({ title: "Pnr", variableName: "v", format: "personnummer" });
    preview.activeLocale = "en";

    const input = preview.shadowRoot?.querySelector<HTMLInputElement>(
      "input[data-text-answer]"
    );
    input!.value = "811218-9875"; // fel kontrollsiffra
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    preview.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-action="next"]')
      ?.click();

    expect(preview.shadowRoot?.textContent).toContain(
      "Enter a valid personal identity number."
    );
  });

  test("CSS classes are applied to the node's card", () => {
    const preview = mount({
      title: "Stylad",
      variableName: "v",
      cssClasses: "highlight  compact",
    });
    const card = preview.shadowRoot?.querySelector(".guide-preview__card");
    expect(card?.classList.contains("highlight")).toBe(true);
    expect(card?.classList.contains("compact")).toBe(true);
  });
});
