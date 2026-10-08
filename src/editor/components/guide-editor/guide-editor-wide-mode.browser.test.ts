import { afterEach, describe, expect, test, vi } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";

/**
 * Filling the page with the canvas, without the platform's fullscreen.
 *
 * ## Why not `requestFullscreen`
 *
 * It was here, and on an iPad it closed itself. A downward swipe leaves the
 * platform's fullscreen — Apple's own exit gesture, which no listener sees and no
 * CSS declines, so pushing the canvas the wrong way threw you out of it.
 * `overscroll-behavior: contain` was tried first and changed nothing, and that
 * is what settled it as a system gesture rather than a scroll chain.
 *
 * A mode of our own is fixed to the viewport with CSS. There is no gesture to
 * collide with, and Escape and the button belong to us. The browser's own bar
 * stays visible — near enough to fullscreen, and it never closes behind your
 * back.
 *
 * ## What is checked here
 *
 * The parts that are ours to get wrong: the attribute that drives the CSS, the
 * page behind not scrolling underneath it, that the value handed back to the host
 * is the one they had, and that Escape leaves without stealing the key from the
 * canvas, which uses it for its own backing-out.
 */

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
  document.body.style.overflow = "";
});

/*
 * Every test here is about the fallback, so the platform's fullscreen is
 * declared unavailable — which is exactly what an iframe without
 * `allow="fullscreen"` reports, and the case the fallback exists for.
 */
const withoutPlatformFullscreen = (): void => {
  vi.spyOn(document, "fullscreenEnabled", "get").mockReturnValue(false);
};

/*
 * A frame is the one thing our own mode cannot escape, so it is the one place
 * the platform's is worth its cost.
 *
 * Both directions are stated outright, because **the test runner is itself an
 * iframe**: left alone, every test here looks framed and the ordinary-page case
 * would silently test the other branch. That is exactly the trap this file has
 * fallen into twice already with `fullscreenEnabled`.
 */


const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 80));

/** Mounts without touching the fullscreen story, for the route tests. */
async function editorWith(): Promise<GuideEditor> {
  const element = document.createElement("guide-editor") as GuideEditor;

  element.setAttribute("mode", "administrator");
  element.style.cssText = "display: block; width: 900px; height: 600px;";
  document.body.append(element);
  element.graph = { startNodeId: "q1", nodes: [], connections: [] } as never;

  await settle();

  return element;
}

async function editor(): Promise<GuideEditor> {
  withoutPlatformFullscreen();

  const element = document.createElement("guide-editor") as GuideEditor;

  element.setAttribute("mode", "administrator");
  element.style.cssText = "display: block; width: 900px; height: 600px;";
  document.body.append(element);
  element.graph = {
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "text-question", position: { x: 40, y: 40 }, data: { title: "Ett", variableName: "a" } },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  return element;
}

/*
 * Asked for the way the toolbar asks: the request is raised inside the shadow
 * root, where the editor listens. Dispatching on the host went nowhere — events
 * travel up, and the listener is below.
 */
const toggle = (element: GuideEditor): void => {
  element.shadowRoot!
    .querySelector("editor-toolbar")!
    .dispatchEvent(
      new CustomEvent("fullscreen-toggle-request", { bubbles: true, composed: true }),
    );
};

const escape = (element: GuideEditor, cancelled = false): void => {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    composed: true,
    cancelable: true,
  });

  if (cancelled) event.preventDefault();

  element.dispatchEvent(event);
};

describe("turning it on", () => {
  test("the element is marked, which is what the stylesheet reads", async () => {
    const element = await editor();

    toggle(element);
    await settle();

    expect(element.hasAttribute("wide")).toBe(true);
  });

  test("and it covers the viewport rather than its slot in the page", async () => {
    const element = await editor();

    toggle(element);
    await settle();

    expect(getComputedStyle(element).position).toBe("fixed");
  });

  test("all the way down, even when the host page sized the slot inline", async () => {
    /*
     * Johans iPad och iPhone, 1/9 natt: helskärmen slutade tre fjärdedelar
     * ned. Varje exempelsida sätter `style="height: 70vh"` inline på
     * elementet för det INBÄDDADE läget — och en inline-stil slår ett
     * `:host([wide])`-block i skuggans stilark, så helskärmen ärvde
     * sidans höjd. Testet ovan var grönt hela tiden: det mätte `position`,
     * aldrig storleken, och monterar dessutom med en inline-höjd (600px)
     * precis som sidorna. Det som ska gälla: i helskärm är elementet
     * fönstret, oavsett vad värden skrev för det lilla läget.
     */
    const element = await editor();

    toggle(element);
    await settle();

    const rect = element.getBoundingClientRect();

    expect(Math.round(rect.height), "höjden är värdsidans, inte fönstrets").toBe(window.innerHeight);
    expect(Math.round(rect.width), "bredden är värdsidans, inte fönstrets").toBe(window.innerWidth);
  });

  test("the page behind stops scrolling", async () => {
    const element = await editor();

    toggle(element);
    await settle();

    expect(document.body.style.overflow).toBe("hidden");
  });
});

describe("turning it off", () => {
  test("hands the page back the overflow it had, not an empty one", async () => {
    /*
     * A host may well have its own value there. Handing back "" would be a bug
     * nobody reports, because it only shows up on their page, later.
     */
    document.body.style.overflow = "clip";

    const element = await editor();

    toggle(element);
    await settle();
    toggle(element);
    await settle();

    expect(document.body.style.overflow).toBe("clip");
  });

  test("Escape leaves the mode", async () => {
    const element = await editor();

    toggle(element);
    await settle();
    escape(element);
    await settle();

    expect(element.hasAttribute("wide")).toBe(false);
  });

  test("but not when something nearer has already used the key", async () => {
    // The canvas uses Escape to clear a selection and to back out of a
    // half-drawn connection. Taking it from them would trade one trap for
    // another.
    const element = await editor();

    toggle(element);
    await settle();
    escape(element, true);
    await settle();

    expect(element.hasAttribute("wide")).toBe(true);
  });

  test("and Escape does nothing when the mode is off", async () => {
    const element = await editor();

    escape(element);
    await settle();

    expect(element.hasAttribute("wide")).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });
});

describe("when the editor is removed while covering the page", () => {
  test("the page can still scroll", async () => {
    /*
     * Otherwise a host that swaps the editor out mid-mode leaves a page nobody
     * can scroll, with nothing left on screen to explain it.
     */
    const element = await editor();

    toggle(element);
    await settle();
    element.remove();
    await settle();

    expect(document.body.style.overflow).toBe("");
  });
});

describe("which route it takes", () => {
  /*
   * Only the framed cases can be staged here: `window.top` is not configurable
   * and the runner is itself an iframe. The rule that decides is tested on its
   * own in `fullscreen-route.test.ts`, where all four combinations can be asked.
   */
  test("the platform's inside a frame, which ours cannot escape", async () => {
    vi.spyOn(document, "fullscreenEnabled", "get").mockReturnValue(true);

    const element = await editorWith();
    const request = vi
      .spyOn(element, "requestFullscreen")
      .mockImplementation(async () => undefined);

    toggle(element);
    await settle();

    expect(request).toHaveBeenCalledOnce();
    expect(element.hasAttribute("wide")).toBe(false);
  });

  test("ours inside a frame that was never given permission", async () => {
    withoutPlatformFullscreen();

    const element = await editorWith();

    toggle(element);
    await settle();

    expect(element.hasAttribute("wide")).toBe(true);
  });

  test("and ours takes over if the platform says yes and then refuses", async () => {
    vi.spyOn(document, "fullscreenEnabled", "get").mockReturnValue(true);

    const element = await editorWith();

    vi.spyOn(element, "requestFullscreen").mockRejectedValue(new Error("nej"));

    toggle(element);
    await settle();
    await settle();

    expect(element.hasAttribute("wide")).toBe(true);
  });
});

describe("when the platform drops us out of fullscreen", () => {
  test("ours takes over rather than snapping back", async () => {
    /*
     * The iPad case, and why this is worth the code. A downward swipe still
     * leaves the platform's fullscreen — on release now rather than during the
     * drag — and a downward swipe is how somebody pans. Collapsing to a
     * six-hundred-pixel editor mid-work is a poor answer to a gesture nobody
     * meant as "close this".
     */
    vi.spyOn(document, "fullscreenEnabled", "get").mockReturnValue(true);

    const element = await editorWith();

    vi.spyOn(element, "requestFullscreen").mockImplementation(async () => undefined);

    toggle(element);
    await settle();

    // The platform lets go without being asked.
    document.dispatchEvent(new Event("fullscreenchange"));
    await settle();

    expect(element.hasAttribute("wide")).toBe(true);
  });

  test("but pressing the button still means leaving", async () => {
    /*
     * Otherwise the button would be useless: press to close, and the canvas
     * comes straight back full-size by another route.
     */
    vi.spyOn(document, "fullscreenEnabled", "get").mockReturnValue(true);

    const element = await editorWith();
    let current: Element | null = null;

    vi.spyOn(document, "fullscreenElement", "get").mockImplementation(() => current);
    vi.spyOn(element, "requestFullscreen").mockImplementation(async () => {
      current = element;
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    vi.spyOn(document, "exitFullscreen").mockImplementation(async () => {
      current = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    toggle(element);
    await settle();
    toggle(element);
    await settle();

    expect(element.hasAttribute("wide")).toBe(false);
  });
});

describe("after the fallback has caught us", () => {
  test("the button leaves our mode rather than asking for the platform's", async () => {
    /*
     * Reported from the iPad, and it is the fault that decided the whole design.
     * Once the fallback had put the canvas in our mode, pressing the button asked
     * for the platform's fullscreen instead of leaving — the check only asked
     * what the platform permits, and we were plainly not in it. Two modes, one
     * button, and no way out.
     */
    vi.spyOn(document, "fullscreenEnabled", "get").mockReturnValue(true);

    const element = await editorWith();
    const request = vi
      .spyOn(element, "requestFullscreen")
      .mockImplementation(async () => undefined);

    toggle(element);
    await settle();

    // The platform lets go on its own, so ours takes over.
    document.dispatchEvent(new Event("fullscreenchange"));
    await settle();

    expect(element.hasAttribute("wide")).toBe(true);

    request.mockClear();
    toggle(element);
    await settle();

    expect(element.hasAttribute("wide")).toBe(false);
    expect(request, "knappen bad om systemets helskärm i stället för att avsluta").not.toHaveBeenCalled();
  });
});
