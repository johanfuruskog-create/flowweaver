import { describe, expect, test } from "vitest";

import { RowColumnsService } from "./row-columns";

describe("RowColumnsService — kolumnerna i editorn", () => {
  const columns = [
    { id: "t", label: "Titel", cell: "{{namn}}" },
    { id: "b", label: "Blanketter", cell: "{{blankett}}" },
    { id: "a", label: "Adress", cell: "{{adress}}" },
  ];

  test("första kolumnen är titeln och flyttas inte, ingen flyttas ovanför den (AC 4)", () => {
    expect(RowColumnsService.moveColumn(columns, "t", "down")).toBe(columns);
    expect(RowColumnsService.moveColumn(columns, "b", "up")).toBe(columns);
    expect(RowColumnsService.moveColumn(columns, "a", "up").map((column) => column.id)).toEqual(["t", "a", "b"]);
    expect(RowColumnsService.moveColumn(columns, "a", "down")).toBe(columns);
  });

  test("uppdatering byter en egenskap på en kolumn och lämnar de andra", () => {
    const updated = RowColumnsService.updateColumn(columns, "b", "label", { sv: "Blanketter", en: "Forms" });
    expect(updated[1]).toEqual({ id: "b", label: { sv: "Blanketter", en: "Forms" }, cell: "{{blankett}}" });
    expect(updated[0]).toBe(columns[0]);
  });

  test("en ny kolumn har ett id och tomma fält", () => {
    const created = RowColumnsService.createColumn();
    expect(created.id).not.toBe("");
    expect(created).toMatchObject({ label: "", cell: "" });
  });
});
