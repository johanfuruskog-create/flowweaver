import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";

import { getNodeType } from "../node-types/node-type-registry";
import { PageFieldsService } from "./page-fields-service";
import { PageFieldValidationService } from "./page-field-validation-service";

import type { FlowNodeData, GraphData } from "../types/graph";

/**
 * A file field: the rules, the two variables, and what we refuse to own.
 *
 * ## What the library does and does not do
 *
 * It does not upload and it does not store. K9 puts calls to third parties in
 * the BFF, and K6e keeps persistence with the host. So the field holds the file
 * and hands it over once, when the host submits.
 *
 * ## Why one variable
 *
 * A guide is JSON, so the answer can only be text: the file's name. The file
 * itself waits in the viewer and the host collects it with `getFiles()` when the
 * guide reaches its result.
 *
 * There was a second variable for a reference a host hands back when it stores
 * the file the moment it is picked. That model is documented and not built, and
 * a setting nothing reads is worse than no setting — an editor would fill it in
 * and believe it did something.
 *
 * ## What is checked here and what is not
 *
 * `accept` and `maxSize` are ours: they are cheap, they happen before the file
 * goes anywhere, and the message is ours to write in both languages. Virus
 * scanning, quota and permission are the host's — we cannot do them and should
 * not appear to.
 */

const page = (fieldData: Record<string, unknown>): GraphData =>
  ({
    startNodeId: "p",
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
      {
        id: "f",
        type: "file-question",
        parentPageId: "p",
        order: 0,
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Bifoga ritning" },
          variableName: "bilaga",
          ...fieldData,
        },
      } as unknown as FlowNodeData,
    ],
    connections: [],
  }) as unknown as GraphData;

const fieldOf = (data: Record<string, unknown>) => {
  const graph = page(data);
  const sida = graph.nodes.find((node) => node.type === "page")!;

  return PageFieldsService.getFields(graph, sida)[0];
};

describe("the node type", () => {
  test("is registered and takes a file", () => {
    const type = getNodeType("file-question");

    expect(type).toBeTruthy();
    expect(type?.behavior?.answer?.input).toBe("file");
  });

  test("stores text, because a name is all that fits", () => {
    // A guide is JSON. Nothing binary can live in an answer, which is the whole
    // reason the answer is the name and the file is fetched separately.
    expect(getNodeType("file-question")?.variableType).toBe("text");
  });

  test("belongs on a page, which is where an attachment is asked for", () => {
    expect(getNodeType("file-question")?.canBeInPage).toBe(true);
  });

  test("offers the variable and the two limits", () => {
    const ids = (getNodeType("file-question")?.properties ?? []).map(
      (property) => property.id,
    );

    expect(ids).toContain("variableName");
    expect(ids).toContain("accept");
    expect(ids).toContain("maxSize");
    expect(ids).toContain("required");
  });
});

describe("as a field on a page", () => {
  test("is a file", () => {
    expect(fieldOf({})?.type).toBe("file");
  });

  test("carries what may be attached and how large", () => {
    const field = fieldOf({ accept: ".pdf,.jpg", maxSize: 5 });

    expect(field?.accept).toBe(".pdf,.jpg");
    expect(field?.maxSize).toBe(5);
  });

  test("offers no reference variable, because nothing would fill it", () => {
    // A setting that reads as a promise and does nothing is the fault this
    // codebase keeps finding. See `docs/FIL-KONTRAKT.md`.
    const ids = (getNodeType("file-question")?.properties ?? []).map(
      (property) => property.id,
    );

    expect(ids).not.toContain("referenceVariableName");
  });
});

describe("validating an attachment", () => {
  const message = (data: Record<string, unknown>, value: string) =>
    PageFieldValidationService.getMessage(fieldOf(data)!, value);

  test("a required attachment must be there", () => {
    expect(message({ required: true }, "")).toBeTruthy();
  });

  test("and passes once it is", () => {
    // The value is the file's name by then, which is the whole answer.
    expect(message({ required: true }, "ritning.pdf")).toBeNull();
  });

  test("an optional one passes empty", () => {
    expect(message({}, "")).toBeNull();
  });

  test("says what to attach rather than that a field is compulsory", () => {
    /*
     * "Fältet är obligatoriskt" in front of a file button names a state. The
     * same reasoning as the consent tick: say the action.
     */
    const said = message({ required: true }, "") ?? "";

    expect(said).toMatch(/bifoga|attach/i);
  });
});
