import { describe, expect, test } from "vitest";

import { AnnotationCommentsService } from "./annotation-comments-service";

describe("AnnotationCommentsService", () => {
  test("parse: reads valid fields, clamps x/y, defaults the arrow, skips junk", () => {
    const parsed = AnnotationCommentsService.parse([
      { id: "a", text: "Hej", x: 20, y: 80, arrow: "left" },
      { text: "Utan id", x: 150, y: -5, arrow: "diagonal" },
      "skräp",
      null,
    ]);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({ id: "a", text: "Hej", x: 20, y: 80, arrow: "left" });
    expect(parsed[1].x).toBe(100); // klampat uppåt
    expect(parsed[1].y).toBe(0); // klampat nedåt
    expect(parsed[1].arrow).toBe("up"); // ogiltig pil → default
    expect(typeof parsed[1].id).toBe("string");
  });

  test("parse: icke-array ger tom lista", () => {
    expect(AnnotationCommentsService.parse(undefined)).toEqual([]);
    expect(AnnotationCommentsService.parse("x")).toEqual([]);
  });

  test("add puts a comment in the middle of the image", () => {
    const list = AnnotationCommentsService.add([]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ text: "", x: 50, y: 50, arrow: "up" });
  });

  test("remove deletes by id", () => {
    const list = [
      { id: "a", text: "", x: 0, y: 0, arrow: "up" as const },
      { id: "b", text: "", x: 0, y: 0, arrow: "up" as const },
    ];
    expect(AnnotationCommentsService.remove(list, "a")).toEqual([list[1]]);
  });

  test("update changes the right field and clamps numbers", () => {
    const list = [{ id: "a", text: "", x: 0, y: 0, arrow: "up" as const }];
    // Text lands in the source language's slot — see the localised suite below.
    expect(AnnotationCommentsService.update(list, "a", "text", "Ny")[0].text).toEqual({ sv: "Ny" });
    expect(AnnotationCommentsService.update(list, "a", "x", "999")[0].x).toBe(100);
    expect(AnnotationCommentsService.update(list, "a", "arrow", "right")[0].arrow).toBe("right");
    expect(AnnotationCommentsService.update(list, "a", "arrow", "nonsens")[0].arrow).toBe("up");
  });
});

describe("en kommentar på flera språk", () => {
  /*
   * Found on the tutorial page: the graph carried { sv, en } maps — like every
   * other authored text — and parse flattened them to "", so the bubbles and
   * the caption rendered "Kommentar 1/2" with nothing after it. The comment
   * text is authored content and holds languages; only rendering resolves.
   */
  test("parse behåller en språkkarta i stället för att tömma den", () => {
    const parsed = AnnotationCommentsService.parse([
      { id: "a", text: { sv: "Dra hit", en: "Drag here" }, x: 8, y: 18, arrow: "left" },
    ]);

    expect(parsed[0]?.text).toEqual({ sv: "Dra hit", en: "Drag here" });
  });

  test("update skriver in det aktiva språket utan att röra de andra", () => {
    const list = AnnotationCommentsService.parse([
      { id: "a", text: { sv: "Dra hit", en: "Drag here" }, x: 8, y: 18, arrow: "left" },
    ]);
    const next = AnnotationCommentsService.update(list, "a", "text", "Drag it here", "en");

    expect(next[0]?.text).toEqual({ sv: "Dra hit", en: "Drag it here" });
  });

  test("en ren sträng är fortsatt giltig och blir källspråkets text vid redigering", () => {
    const list = AnnotationCommentsService.parse([
      { id: "a", text: "Gammal", x: 0, y: 0, arrow: "up" },
    ]);

    expect(list[0]?.text).toBe("Gammal");
    expect(AnnotationCommentsService.update(list, "a", "text", "Ny")[0]?.text).toEqual({ sv: "Ny" });
  });
});
