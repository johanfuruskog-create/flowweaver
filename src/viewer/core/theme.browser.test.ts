import { afterEach, describe, expect, test } from "vitest";

import { announceThemeChange, applyTheme, isDarkActive, toggleTheme } from "./theme";

/**
 * *Applying* a theme is rendering, and the library owns that. *Remembering* a
 * choice is storage, and the host owns that — the same contract as for the guide
 * and the node templates (K6d). The toggle applies and announces; the host
 * decides the rest.
 */

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe("theme", () => {
  test("toggle switches mode and sets data-theme", () => {
    document.documentElement.dataset.theme = "light";
    expect(isDarkActive()).toBe(false);

    expect(toggleTheme()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(isDarkActive()).toBe(true);

    expect(toggleTheme()).toBe("light");
    expect(isDarkActive()).toBe(false);
  });

  // The library used to write the choice to localStorage. That took space in
  // the host's storage without asking, and a host with a theme setting of its
  // own ended up with two truths pulling in different directions.
  //
  // The key is cleared first: localStorage outlives a test file, and on 7/10 a
  // full browser run failed here once on a value some other file had left —
  // the run after it was green. The test owns its starting point.
  test("och lagrar ingenting", () => {
    localStorage.removeItem("flowweaver:theme");
    document.documentElement.dataset.theme = "light";

    toggleTheme();

    expect(localStorage.getItem("flowweaver:theme")).toBeNull();
  });

  test("applyTheme(null) hands the decision back to the OS setting", () => {
    document.documentElement.dataset.theme = "dark";

    applyTheme(null);

    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  test("the change is announced so the host can act on it", () => {
    const sedda: string[] = [];
    const lyssnare = (event: Event): void => {
      sedda.push((event as CustomEvent<{ theme: string }>).detail.theme);
    };
    document.addEventListener("theme-change", lyssnare);

    const knapp = document.createElement("button");
    document.body.append(knapp);
    announceThemeChange(knapp, "dark");

    expect(sedda).toEqual(["dark"]);

    document.removeEventListener("theme-change", lyssnare);
    knapp.remove();
  });
});
