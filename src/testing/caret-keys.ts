/*
 * Caret movement for `userEvent.keyboard`, per platform.
 *
 * Playwright gives a Mac Chromium the Mac editing commands (measured 9/10 on
 * the Mac, Playwright's own table in `playwright-core`): plain Home and End
 * become `scrollToBeginningOfDocument:` / `scrollToEndOfDocument:` and do not
 * reliably move the caret, Ctrl+End moves nothing, and Shift+Home selects to
 * the start of the *document*. The Mac's own keys are Cmd+arrow — Cmd+Left
 * and Cmd+Right for the line, Cmd+Up and Cmd+Down for the document.
 *
 * Everywhere else every string here is exactly the keys the tests sent before
 * this file existed, so a run on Linux or Windows presses the same keys.
 *
 * Only for moving the caret. A shortcut the app handles itself (Ctrl+B, Ctrl+Z)
 * takes `ControlOrMeta`, which Playwright already resolves per platform; a
 * test that means Ctrl on purpose keeps `Control`.
 */
const mac = navigator.platform.startsWith("Mac");

/** Caret to the end of the whole text: Ctrl+End, on a Mac Cmd+Down. */
export const DOC_END = mac ? "{Meta>}{ArrowDown}{/Meta}" : "{Control>}{End}{/Control}";
/** Caret to the start of the whole text: Ctrl+Home, on a Mac Cmd+Up. */
export const DOC_START = mac ? "{Meta>}{ArrowUp}{/Meta}" : "{Control>}{Home}{/Control}";
/** Caret to the end of the line: End, on a Mac Cmd+Right. */
export const LINE_END = mac ? "{Meta>}{ArrowRight}{/Meta}" : "{End}";
/** Caret to the start of the line: Home, on a Mac Cmd+Left. */
export const LINE_START = mac ? "{Meta>}{ArrowLeft}{/Meta}" : "{Home}";
/** Select back to the start of the line: Shift+Home, on a Mac Shift+Cmd+Left. */
export const SELECT_TO_LINE_START = mac
  ? "{Shift>}{Meta>}{ArrowLeft}{/Meta}{/Shift}"
  : "{Shift>}{Home}{/Shift}";
