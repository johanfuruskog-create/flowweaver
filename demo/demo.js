/*
 * What the demo pages share: where the guide lives and how it is kept.
 *
 * The editor and the viewer store nothing themselves — keeping a guide is the
 * host's business (docs/LAGRING-KONTRAKT.md). This demo is the simplest host
 * there is: one guide in localStorage, saved on every change the editor
 * reports, and the example guide when nothing is saved yet.
 */
export const STORAGE_KEY = "flowweaver-demo-guide";

/** The saved guide, or the example one the first time. */
export async function loadGuide() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // A private window or blocked storage: start from the example.
  }
  return (await fetch("./guide.json")).json();
}

/** Keeps the guide whenever the editor says it changed. */
export function keepGuide(editor) {
  editor.addEventListener("graph-changed", (event) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(event.detail.graph));
    } catch {
      // Nowhere to keep it: the page still works, it just forgets.
    }
  });
}

/** Back to the example guide. */
export function forgetGuide() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was kept.
  }
}
