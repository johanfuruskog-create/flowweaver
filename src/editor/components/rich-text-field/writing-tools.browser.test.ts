import { DOC_END } from "../../../testing/caret-keys";
import { userEvent } from "@vitest/browser/context";
import { afterEach, describe, expect, it } from "vitest";

import "./rich-text-field";
import type { RichTextField } from "./rich-text-field";
import type { FormattingFeature } from "../../../viewer/types/node-types";

/*
 * Apple's Writing Tools against the field — Johan's measurement 9/10 on
 * macOS 27 with `dev/writing-tools.html`, and his decision A: a rewrite that
 * would take away an answer chip or a link is refused, with a word to the
 * redaktör. The two ways the tool came in are copied here as the engines
 * sent them, because no automation drives the real tool:
 *
 *   Chrome 155 — one cancelable `beforeinput` `insertText` carrying the
 *   whole rewritten text (the chip's label and its word joiner in it).
 *   Safari 27.0.1 — nothing reached the shadow root at all (second
 *   measurement, listeners on the root): no `beforeinput`, `input` or
 *   composition. In WebKit a `paste` of the rewrite as text gives Johan's
 *   value to the letter, and a DOM rewritten without events changes no
 *   value — so the `paste` is the copy of Safari's way. The first guess, a
 *   DOM rewrite followed by a bare `input`, is kept as path (b)'s test.
 *
 * And the other half of the rule, which matters as much: a person who takes
 * a chip away — a letter typed over it, Backspace, an input method, a
 * browser write that announced itself — is never stopped.
 */

const ALL: FormattingFeature[] = ["variable", "bold", "italic", "link", "bullet-list", "numbered-list"];

const START =
  "Hej **{{fornamn}}**, tack för din anmälan om gatubelysningen på " +
  "[Storgatan](https://exempel.se/storgatan). Vi har tagit emot den.";

/* Chrome's data, measured: the chip's joiner and its label, on lines of their own. */
const CHROME_REWRITE = "Hej **\u2060\nFörnamn\n**, tack för att du anmälde gatubelysningen på Storgatan. Vi har fått den.";

const REFUSED = "Skrivverktyg kan inte användas på text med svar eller länkar — markera bara texten runt dem.";

function mount(value: string): RichTextField {
  const field = document.createElement("rich-text-field");

  field.setAttribute("multiline", "");
  field.setAttribute("label", "Beskrivning");
  field.features = ALL;
  field.variables = [{ value: "fornamn", label: "Förnamn" }];
  field.value = value;
  document.body.append(field);
  return field;
}

function text(field: RichTextField): HTMLElement {
  return field.shadowRoot!.querySelector<HTMLElement>("[data-text]")!;
}

function notice(field: RichTextField): string {
  return field.shadowRoot!.querySelector<HTMLElement>("[data-notice]")?.textContent ?? "";
}

/*
 * The whole text selected, the way a redaktör does before opening the tool:
 * Cmd/Ctrl+A. A selection set from script did not reach the field in WebKit,
 * whose document selection stops at the host (rich-text-field.ts, *Selection
 * in a shadow tree*); the key does, in both engines.
 */
async function selectAll(field: RichTextField): Promise<void> {
  text(field).focus();
  await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}");
  // `selectionchange` is a task of its own.
  await new Promise((resolve) => setTimeout(resolve, 20));
}

/* A paste with this text, set on the event itself (Firefox drops a constructed DataTransfer — the field's own test). */
function paste(field: RichTextField, plain: string): void {
  const data = new DataTransfer();
  const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true, composed: true });

  data.setData("text/plain", plain);
  Object.defineProperty(event, "clipboardData", { value: data });
  text(field).dispatchEvent(event);
}

function beforeInput(field: RichTextField, init: InputEventInit): InputEvent {
  const event = new InputEvent("beforeinput", { bubbles: true, composed: true, ...init });

  text(field).dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("<rich-text-field> — Skrivverktyg (Johans beslut A, 9/10)", () => {
  it("Chrome-vägen: en omskrivning som skulle ta brickan och länken stoppas innan den skrivs", async () => {
    const field = mount(START);

    await selectAll(field);
    const event = beforeInput(field, { inputType: "insertText", data: CHROME_REWRITE, cancelable: true });

    expect(event.defaultPrevented).toBe(true);
    expect(field.value).toBe(START);
    expect(text(field).querySelector("[data-chip]")).not.toBeNull();
    expect(text(field).querySelector("a")?.getAttribute("href")).toBe("https://exempel.se/storgatan");
    expect(notice(field)).toBe(REFUSED);
  });

  it("Safari-vägen: en inklistring av omskrivningen, utan klistra-in-tangent, avvisas", async () => {
    const field = mount(START);

    await selectAll(field);
    // What Safari's value says it was handed: the chip's label on a line of its own, the link's text without the link.
    paste(field, "Hej **\nFörnamn\n**, tack för att du anmälde gatubelysningen på Storgatan. Vi har fått den.");

    expect(field.value).toBe(START);
    expect(text(field).querySelector("[data-chip]")).not.toBeNull();
    expect(text(field).querySelector("a")?.getAttribute("href")).toBe("https://exempel.se/storgatan");
    expect(notice(field)).toBe(REFUSED);
  });

  it("väg b: DOM:en omskriven och en input utan beforeinput backas till modellen före ändringen", async () => {
    const field = mount(START);

    await selectAll(field);
    const editable = text(field);

    // What Safari left, measured: the chip's label as text in paragraphs of its own, the link gone.
    editable.innerHTML = "<p>Hej **</p><p>Förnamn</p><p>**, tack för att du anmälde gatubelysningen på Storgatan. Vi har fått den.</p>";
    editable.dispatchEvent(new InputEvent("input", { inputType: "insertText", bubbles: true, composed: true }));

    expect(field.value).toBe(START);
    expect(editable.querySelector("[data-chip]")).not.toBeNull();
    expect(editable.querySelector("a")?.getAttribute("href")).toBe("https://exempel.se/storgatan");
    expect(notice(field)).toBe(REFUSED);
  });

  it("beskedet går när redaktören skriver nästa gång", async () => {
    const field = mount(START);

    await selectAll(field);
    beforeInput(field, { inputType: "insertText", data: CHROME_REWRITE, cancelable: true });
    expect(notice(field)).toBe(REFUSED);

    text(field).focus();
    await userEvent.keyboard(`${DOC_END}!`);
    expect(notice(field)).toBe("");
  });

  it("en omskrivning av text utan brickor och länkar går igenom", async () => {
    const field = mount("Hej där, tack för din anmälan.");

    await selectAll(field);
    const event = beforeInput(field, { inputType: "insertText", data: "Hej, tack för att du anmälde.", cancelable: true });

    expect(event.defaultPrevented).toBe(true);
    expect(field.value).toBe("Hej, tack för att du anmälde.");
    expect(notice(field)).toBe("");
  });

  it("ordfogaren och andra osynliga tecken i inkommande text lagras inte", async () => {
    const field = mount("ab");

    await selectAll(field);
    beforeInput(field, { inputType: "insertText", data: "c\u2060d\u200Be", cancelable: true });

    expect(field.value).toBe("cde");
  });
});

describe("<rich-text-field> — vanlig redigering över en bricka stoppas aldrig", () => {
  it("en bokstav skriven över en markerad bricka ersätter den", async () => {
    const field = mount("Hej {{fornamn}}!");

    text(field).focus();
    field.selectChip("fornamn");
    await userEvent.keyboard("x");

    expect(field.value).toBe("Hej x!");
    expect(notice(field)).toBe("");
  });

  it("Backspace på en markerad bricka tar den", async () => {
    const field = mount("Hej {{fornamn}}!");

    text(field).focus();
    field.selectChip("fornamn");
    await userEvent.keyboard("{Backspace}");

    expect(field.value).toBe("Hej !");
    expect(notice(field)).toBe("");
  });

  it("Delete över hela texten med bricka och länk tömmer fältet", async () => {
    const field = mount(START);

    await selectAll(field);
    await userEvent.keyboard("{Delete}");

    expect(field.value).toBe("");
    expect(notice(field)).toBe("");
  });

  it("en bokstav över hela texten med bricka och länk ersätter den", async () => {
    const field = mount(START);

    await selectAll(field);
    await userEvent.keyboard("x");

    expect(field.value).toBe("x");
    expect(notice(field)).toBe("");
  });

  it("en inmatningsmetod (komposition) över brickan läses tillbaka, inte spärrad", async () => {
    const field = mount("Hej {{fornamn}}!");
    const editable = text(field);

    editable.focus();
    editable.dispatchEvent(new CompositionEvent("compositionstart", { data: "" }));
    editable.querySelector("p")!.replaceChildren(document.createTextNode("Hej か!"));
    editable.dispatchEvent(new InputEvent("input", { inputType: "insertCompositionText", data: "か", isComposing: true, bubbles: true, composed: true }));
    editable.dispatchEvent(new CompositionEvent("compositionend", { data: "か" }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(field.value).toBe("Hej か!");
    expect(notice(field)).toBe("");
  });

  it("en komposition vars sista input kommer efter compositionend, utan beforeinput, spärras inte heller", async () => {
    const field = mount("Hej {{fornamn}}!");
    const editable = text(field);

    editable.focus();
    editable.dispatchEvent(new CompositionEvent("compositionstart", { data: "" }));
    editable.querySelector("p")!.replaceChildren(document.createTextNode("Hej か!"));
    editable.dispatchEvent(new CompositionEvent("compositionend", { data: "か" }));
    editable.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: "か", bubbles: true, composed: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(field.value).toBe("Hej か!");
    expect(notice(field)).toBe("");
  });

  it("Cmd/Ctrl+V med samma text över brickan klistrar in — tangenten är en människas", async () => {
    const field = mount("Hej {{fornamn}}!");
    const editable = text(field);

    editable.focus();
    field.selectChip("fornamn");
    // The key and the paste it causes come in one task, as in a browser.
    editable.dispatchEvent(new KeyboardEvent("keydown", { key: "v", ctrlKey: true, metaKey: true, bubbles: true, composed: true, cancelable: true }));
    paste(field, "Förnamn");

    expect(field.value).toBe("Hej Förnamn!");
    expect(notice(field)).toBe("");
  });

  it("en inklistring ur menyn med egna ord över brickan går igenom", async () => {
    const field = mount("Hej {{fornamn}}!");

    text(field).focus();
    field.selectChip("fornamn");
    paste(field, "Anna");

    expect(field.value).toBe("Hej Anna!");
    expect(notice(field)).toBe("");
  });

  it("en ändring webbläsaren skriver själv efter en egen beforeinput (diktering) läses tillbaka, inte spärrad", async () => {
    const field = mount("Hej {{fornamn}}!");
    const editable = text(field);

    editable.focus();
    // Not cancelable: the field lets the browser write (path b).
    beforeInput(field, { inputType: "insertText", data: "Anna", cancelable: false });
    editable.querySelector("p")!.replaceChildren(document.createTextNode("Hej Anna!"));
    editable.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: "Anna", bubbles: true, composed: true }));

    expect(field.value).toBe("Hej Anna!");
    expect(notice(field)).toBe("");
  });
});
