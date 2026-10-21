import { userEvent } from "@vitest/browser/context";

/*
 * Tab for `userEvent.keyboard`, per engine.
 *
 * Safari's default is that Tab moves only between text fields, selects and
 * elements with a `tabindex`; buttons, links and checkboxes are reached with
 * Option+Tab, or with Tab once the visitor turns on *Press Tab to highlight
 * each item* (Safari's settings, or the Mac's Keyboard navigation). Playwright's
 * WebKit keeps that default. Measured 9/10 on the Mac, from a text field
 * through input, button, link, div[tabindex=0], select, checkbox, input:
 *
 *   WebKit   Tab        div  select  input           (button, link, checkbox skipped)
 *   WebKit   Alt+Tab    button  link  div  select  checkbox  input
 *   Chromium Tab        button  link  div  select  checkbox  input
 *
 * The suite tests what a keyboard user reaches, so in WebKit it presses
 * Option+Tab — the key a Safari user who navigates by keyboard uses, or the
 * Tab they get after turning the setting on. Everywhere else every string
 * here is exactly the Tab the tests pressed before this file existed.
 *
 * Chromium's user agent also says AppleWebKit, so WebKit is the engine that
 * says AppleWebKit and is neither Chrome nor Chromium.
 */
const ua = navigator.userAgent;
const webkit = /AppleWebKit/.test(ua) && !/Chrome|Chromium/.test(ua);

/** One step forward through everything a keyboard user reaches. */
export const TAB = webkit ? "{Alt>}{Tab}{/Alt}" : "{Tab}";
/** One step back. */
export const SHIFT_TAB = webkit ? "{Alt>}{Shift>}{Tab}{/Shift}{/Alt}" : "{Shift>}{Tab}{/Shift}";

/** `userEvent.tab()` that reaches buttons and links in WebKit too. */
export async function tab(options: { shift?: boolean } = {}): Promise<void> {
  if (webkit) await userEvent.keyboard(options.shift ? SHIFT_TAB : TAB);
  else await userEvent.tab(options);
}
