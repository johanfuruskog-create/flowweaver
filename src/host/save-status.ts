import "./save-status.scss";

/**
 * Where the example pages say that the guide is saved (uppdrag 28/9, Del 6).
 *
 * They said it in a toast, *"Sparad lokalt 13:05."*, after every autosave —
 * half a second after each pause in typing, over the properties panel, where
 * the redaktör was working (the inventory's pictures 75–78). Saving that
 * happens by itself is not news; it is a state, and a state belongs in a place
 * that stays put.
 *
 * The place is the one the storage page already uses for the same thing: the
 * host's line in the editor's own top row (`slot="context"`). The editor knows
 * nothing about saving — the host does, so the host says it, as the storage
 * page's *Opublicerade ändringar · sparad 13:05* does. This is the example
 * pages' version of that line: a small surface of its own, not woven into any
 * other text, so it can move if Johan wants it elsewhere.
 *
 * Three things it must get right:
 *
 * - **An error stays** until the next save succeeds or the redaktör closes it.
 *   A failure that fades away is a failure nobody knows about, and they go on
 *   writing into a page that no longer saves.
 * - **A screen reader is not told at every pause in typing.** What is shown
 *   changes at once; what is announced waits until saving has been quiet for a
 *   moment, and says nothing when the message has not changed — two saves in
 *   the same minute are one *Sparad lokalt 13:05*.
 * - **Local is said as local.** *Sparad lokalt*, never just *Sparad*: the
 *   storage page's *sparad* means saved with the host, and the two must not be
 *   mistaken for each other.
 */

export interface SaveStatusWords {
  saved: (time: string) => string;
  failed: (reason: string) => string;
  nothingToSave: string;
  dismiss: string;
}

export interface SaveStatus {
  element: HTMLElement;
  saved(time: string): void;
  failed(reason: string): void;
  nothingToSave(): void;
}

export function createSaveStatus(words: SaveStatusWords, { announceDelay = 1000 } = {}): SaveStatus {
  const element = document.createElement("div");
  const text = document.createElement("span");
  const live = document.createElement("span");
  const dismiss = document.createElement("button");
  let lastSaved = "";
  let failing = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  element.slot = "context";
  element.className = "save-status";
  element.setAttribute("data-save-status", "");
  text.className = "save-status__text";
  text.setAttribute("data-save-text", "");
  live.className = "save-status__live";
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");
  live.setAttribute("data-save-live", "");
  dismiss.type = "button";
  dismiss.className = "save-status__dismiss";
  dismiss.textContent = words.dismiss;
  dismiss.hidden = true;
  element.append(text, dismiss, live);

  const announce = (message: string): void => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (live.textContent !== message) live.textContent = message;
    }, announceDelay);
  };

  const show = (message: string, failed: boolean): void => {
    failing = failed;
    text.textContent = message;
    element.toggleAttribute("data-failed", failed);
    dismiss.hidden = !failed;
    announce(message);
  };

  dismiss.addEventListener("click", () => {
    failing = false;
    text.textContent = lastSaved;
    element.removeAttribute("data-failed");
    dismiss.hidden = true;
  });

  return {
    element,
    saved(time) {
      lastSaved = words.saved(time);
      show(lastSaved, false);
    },
    failed(reason) {
      show(words.failed(reason), true);
    },
    nothingToSave() {
      // An error still standing is the truer thing to say.
      if (!failing) show(words.nothingToSave, false);
    },
  };
}
