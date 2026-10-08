import { describe, expect, test } from "vitest";

import "./default-node-types";
import {
  getNodeTemplateBases,
  newNodeTemplate,
  nodeFromTemplate,
  nodeToTemplate,
  childrenFromTemplate,
  templateCapability,
  templateValuesFromNodes,
  toNodeTemplate,
  withNodeValues,
} from "./node-templates";
import { getNodeType, registerNodeType } from "./node-type-registry";

import type { FlowNodeData, NodeTemplate } from "../types/graph";

/**
 * Story 007, second half: a template is a base type plus saved values. The
 * shape is owned by the base type and inherited live — that is the difference
 * from the frozen copy the template used to carry.
 */

const jaNej: NodeTemplate = {
  type: "mall-ja-nej",
  label: "Ja/Nej-fråga",
  icon: "☑",
  base: "question",
  values: {
    options: [
      { id: "ja", label: { sv: "Ja" }, value: "ja" },
      { id: "nej", label: { sv: "Nej" }, value: "nej" },
    ],
  },
};

describe("a template is a base type plus values", () => {
  test("the saved values land in a new node", () => {
    expect(nodeFromTemplate(jaNej)?.data.options).toEqual(jaNej.values.options);
  });

  test("the rest comes from the base type, not from the template", () => {
    const data = nodeFromTemplate(jaNej)?.data;

    // None of them is in the template. They come from the base type every time.
    expect(data?.presentation).toBe("radio");
    expect(data?.cssClasses).toBe("");
  });

  test("the template carries only name, icon, base type and values", () => {
    expect(Object.keys(jaNej).sort()).toEqual([
      "base",
      "icon",
      "label",
      "type",
      "values",
    ]);
  });

  // Utan grundtyp finns ingen nod att skapa.
  test("en mall utan grundtyp ger ingen nod", () => {
    expect(nodeFromTemplate({ ...jaNej, base: "finns-inte" })).toBeNull();
  });
});

describe("the template is provenance, not identity", () => {
  test("the node gets the base type as its type, never the template's key", () => {
    const skapad = nodeFromTemplate(jaNej);

    expect(skapad?.type).toBe("question");
    expect(skapad?.template).toBe("mall-ja-nej");
  });

  // That was what made the link load-bearing: a removed template made every
  // node using it unknown, in every guide.
  test("mallen registreras aldrig som nodtyp", () => {
    expect(getNodeType(jaNej.type)).toBeUndefined();
  });

  test("the node works unchanged when the template is gone", () => {
    const skapad = nodeFromTemplate(jaNej);
    const nod: FlowNodeData = {
      id: "n1",
      position: { x: 0, y: 0 },
      type: skapad!.type,
      data: skapad!.data,
      template: skapad!.template,
    };

    // The template is in no library here — the node still knows what it is.
    expect(getNodeType(nod.type)?.label).toBe("Fråga");
    expect(nod.data.options).toEqual(jaNej.values.options);
  });

  // Without the key the template cannot be reconstructed from the nodes.
  test("the provenance names the template even when it is missing", () => {
    expect(nodeFromTemplate(jaNej)?.template).toBe(jaNej.type);
  });
});

describe("the template shares improvements to its base type", () => {
  test("a new field on the base type reaches every new node from the template", () => {
    const grund = getNodeType("question");
    registerNodeType("question", {
      ...grund!,
      createData: undefined,
      properties: [
        ...grund!.properties,
        { id: "hjälptext", label: "Hjälptext", control: "text", defaultValue: "" },
      ],
    });

    try {
      // The template was saved before the field existed and knows nothing of it.
      expect(nodeFromTemplate(jaNej)?.data).toHaveProperty("hjälptext", "");
    } finally {
      registerNodeType("question", grund!);
    }
  });
});

describe("capturing a node as a template", () => {
  const nod: FlowNodeData = {
    id: "n1",
    type: "question",
    position: { x: 0, y: 0 },
    data: { title: { sv: "Bor du i kommunen?" }, variableName: "bor" },
  };

  test("the node's data becomes the template's values", () => {
    expect(nodeToTemplate(nod)?.values).toEqual(nod.data);
    expect(nodeToTemplate(nod)?.base).toBe("question");
  });

  /*
   * The line is whose the values are. A rule's cases are written against this
   * flow's variables and mean nothing in another guide; a service call's
   * endpoint and mappings describe an integration the whole organisation
   * shares, and reconfiguring it per guide is how one of them ends up pointing
   * at last year's address.
   */
  test("a guide's own reasoning cannot become a template", () => {
    expect(nodeToTemplate({ ...nod, type: "rule" })).toBeNull();
    expect(nodeToTemplate({ ...nod, type: "calculation" })).toBeNull();
  });

  test("but an integration can, values and all", () => {
    const call: FlowNodeData = {
      ...nod,
      type: "service-call",
      data: {
        endpoint: "/api/maxbelopp",
        method: "POST",
        requestVariables: ["income"],
        responseMappings: [{ id: "m1", path: "maxLoan", variable: "maxLoan" }],
      },
    };

    expect(nodeToTemplate(call)).toMatchObject({
      base: "service-call",
      values: call.data,
    });
  });

  test("re-saving a template swaps the values but keeps key and name", () => {
    const omsparad = withNodeValues(jaNej, nod);

    expect(omsparad.type).toBe(jaNej.type);
    expect(omsparad.label).toBe(jaNej.label);
    expect(omsparad.values).toEqual(nod.data);
  });

  test("a new template from a base type has no values at all", () => {
    expect(newNodeTemplate("question")?.values).toEqual({});
  });

  test("en grundtyp som inte finns ger ingen mall", () => {
    expect(newNodeTemplate("finns-inte")).toBeNull();
  });
});

describe("the feature gate is inherited", () => {
  test("a multi-choice template is gated like the multi-choice question", () => {
    expect(templateCapability({ ...jaNej, base: "multi-choice" })).toBe(
      "multiChoice"
    );
  });

  test("a text template is gated like the text question", () => {
    expect(templateCapability({ ...jaNej, base: "text-question" })).toBe(
      "inputQuestions"
    );
  });

  test("the single-choice question has no gate, so neither does the template", () => {
    expect(templateCapability(jaNej)).toBeUndefined();
  });

  test("the base types you may build on carry their gate along", () => {
    expect(getNodeTemplateBases()).toEqual([
      { id: "question", requiredCapability: undefined },
      { id: "multi-choice", requiredCapability: "multiChoice" },
      { id: "text-question", requiredCapability: "inputQuestions" },
      { id: "number-question", requiredCapability: "inputQuestions" },
    ]);
  });
});

describe("the old, frozen shape is read", () => {
  /** How a template looked when it carried a copy of the base type's whole contract. */
  const gammal = {
    type: "custom-1a2b",
    label: "Ja/Nej-fråga",
    icon: "☑",
    requiredCapability: "multiChoice",
    fields: [
      { id: "title", label: "Rubrik", control: "text", localized: true, defaultValue: "" },
      { id: "variableName", label: "Spara svaret som", control: "text", defaultValue: "" },
      {
        id: "options",
        label: "Alternativ",
        control: "options",
        defaultValue: [{ id: "ja", label: { sv: "Ja" }, value: "ja" }],
      },
      { id: "minSelected", label: "Minsta antal val", control: "number" },
    ],
    behavior: {
      answer: {
        variableField: "variableName",
        cardinality: "multi",
        optionsField: "options",
      },
      flow: { kind: "linear" },
    },
  };

  test("the base type is read from the behaviour", () => {
    expect(toNodeTemplate(gammal)?.base).toBe("multi-choice");
  });

  test("the fields' defaults become the template's values", () => {
    expect(toNodeTemplate(gammal)?.values).toEqual({
      title: "",
      variableName: "",
      options: [{ id: "ja", label: { sv: "Ja" }, value: "ja" }],
    });
  });

  test("a field without a value becomes no key", () => {
    expect(toNodeTemplate(gammal)?.values).not.toHaveProperty("minSelected");
  });

  test("key, name and icon remain", () => {
    const mall = toNodeTemplate(gammal);

    expect(mall?.type).toBe("custom-1a2b");
    expect(mall?.label).toBe("Ja/Nej-fråga");
    expect(mall?.icon).toBe("☑");
  });

  // It was the copy of the base type's shape that kept the template from
  // sharing improvements. It must not come along.
  test("the copied-along shape does not come with it", () => {
    const mall = toNodeTemplate(gammal) as unknown as Record<string, unknown>;

    expect(mall).not.toHaveProperty("fields");
    expect(mall).not.toHaveProperty("behavior");
    expect(mall).not.toHaveProperty("requiredCapability");
  });

  test.each([
    ["enkelval", { answer: { cardinality: "single", optionsField: "options" }, flow: { kind: "branch" } }, "question"],
    ["text", { answer: { cardinality: "single", input: "text" }, flow: { kind: "linear" } }, "text-question"],
    ["siffra", { answer: { cardinality: "single", input: "number" }, flow: { kind: "linear" } }, "number-question"],
    ["uppslag", { answer: { cardinality: "single", input: "lookup" }, flow: { kind: "linear" } }, "autocomplete-question"],
    ["resultat", { answer: { cardinality: "none" }, flow: { kind: "end" } }, "result"],
  ])("%s känns igen på sitt beteende", (_namn, behavior, base) => {
    expect(toNodeTemplate({ ...gammal, behavior })?.base).toBe(base);
  });

  // K6b: better an unusable template than data that silently disappears.
  test("a template whose base type cannot be read is kept anyway", () => {
    const mall = toNodeTemplate({ ...gammal, behavior: { flow: { kind: "linear" } } });

    expect(mall?.base).toBe("");
    expect(mall?.label).toBe("Ja/Nej-fråga");
  });

  test("the current shape passes through untouched", () => {
    expect(toNodeTemplate(jaNej)).toEqual(jaNej);
  });

  test("junk is not a template", () => {
    expect(toNodeTemplate(null)).toBeNull();
    expect(toNodeTemplate({ label: "utan nyckel" })).toBeNull();
    expect(toNodeTemplate({ type: "x", label: "utan både form och grundtyp" })).toBeNull();
  });
});

describe("reconstructing a vanished template's values", () => {
  function nod(id: string, data: Record<string, unknown>): FlowNodeData {
    return {
      id,
      type: "text-question",
      template: "mall-epost",
      position: { x: 0, y: 0 },
      data,
    };
  }

  /** Tre noder ur samma mall. Format och obligatoriskt kom ur mallen. */
  const noder = [
    nod("n1", { title: { sv: "Din e-post" }, variableName: "epost", format: "email", required: true }),
    nod("n2", { title: { sv: "Kontaktadress" }, variableName: "kontakt", format: "email", required: true }),
    nod("n3", { title: { sv: "Faktura-adress" }, variableName: "faktura", format: "email", required: true }),
  ];

  test("det noderna har gemensamt kom ur mallen", () => {
    expect(templateValuesFromNodes(noder)).toEqual({
      format: "email",
      required: true,
    });
  });

  // Otherwise whichever node you happened to be on would have made its title
  // the template's, and every new node from it would have been born with it.
  test("what sets the nodes apart is authored per node and does not come along", () => {
    const values = templateValuesFromNodes(noder);

    expect(values).not.toHaveProperty("title");
    expect(values).not.toHaveProperty("variableName");
  });

  test("a key missing from any node does not count as shared", () => {
    const values = templateValuesFromNodes([
      ...noder,
      nod("n4", { title: { sv: "Ny" }, variableName: "ny", required: true }),
    ]);

    expect(values).not.toHaveProperty("format");
    expect(values).toHaveProperty("required", true);
  });

  // With a single node the template's values cannot be told from the node's own.
  test("en ensam nod ger allt den har", () => {
    expect(templateValuesFromNodes([noder[0]])).toEqual(noder[0].data);
  });

  test("no nodes give no values", () => {
    expect(templateValuesFromNodes([])).toEqual({});
  });

  test("the values are copies, not the same objects as the node's", () => {
    const values = templateValuesFromNodes(noder);
    (values.format as unknown) = "phone";

    expect(noder[0].data.format).toBe("email");
  });
});

/*
 * Story 088, the copy: a page is saved as a template *with its fields*. The
 * fields ride along as type + data, never as ids — a template is a recipe
 * and the ids are minted the moment it is dragged in. The variable names are
 * part of the recipe (AC 4): two guides built from the same page template
 * ask for `kontakt.epost` under the same name.
 */
describe("a page template carries its fields", () => {
  const page: FlowNodeData = {
    id: "p1",
    type: "page",
    position: { x: 0, y: 0 },
    data: { title: { sv: "Kontaktuppgifter" } },
  };
  const epost: FlowNodeData = {
    id: "f2",
    type: "text-question",
    position: { x: 0, y: 0 },
    parentPageId: "p1",
    order: 1,
    data: { title: { sv: "E-post" }, variableName: "kontakt.epost" },
  };
  const namn: FlowNodeData = {
    id: "f1",
    type: "text-question",
    position: { x: 0, y: 0 },
    parentPageId: "p1",
    order: 0,
    data: { title: { sv: "Namn" }, variableName: "kontakt.namn" },
  };

  test("the fields are captured in the page's order, without their ids", () => {
    const template = nodeToTemplate(page, [epost, namn]);

    expect(template?.base).toBe("page");
    expect(template?.children).toEqual([
      { type: "text-question", data: namn.data },
      { type: "text-question", data: epost.data },
    ]);
  });

  test("a node that is not a page carries no fields", () => {
    const fråga: FlowNodeData = { ...namn, id: "q", parentPageId: undefined };

    expect(nodeToTemplate(fråga, [epost])).not.toHaveProperty("children");
  });

  test("the fields come back as the page's own, with fresh ids and the same variable names", () => {
    const template = nodeToTemplate(page, [namn, epost])!;
    let count = 0;
    const fields = childrenFromTemplate(template, "sida-ny", () => `id-${(count += 1)}`);

    expect(fields.map((field) => field.id)).toEqual(["id-1", "id-2"]);
    expect(fields.map((field) => field.parentPageId)).toEqual(["sida-ny", "sida-ny"]);
    expect(fields.map((field) => field.order)).toEqual([0, 1]);
    expect(fields.map((field) => field.data.variableName)).toEqual([
      "kontakt.namn",
      "kontakt.epost",
    ]);
    // The rest of a field comes from its base type, as for any template.
    expect(fields[0]?.data).toHaveProperty("cssClasses", "");
  });

  test("a field whose type is unknown is left out rather than breaking the page", () => {
    const template: NodeTemplate = {
      ...nodeToTemplate(page, [namn])!,
      children: [{ type: "finns-inte", data: {} }, { type: "text-question", data: namn.data }],
    };

    expect(childrenFromTemplate(template, "p", () => "x").map((f) => f.type)).toEqual([
      "text-question",
    ]);
  });

  test("re-saving the template from the page takes the fields as they are now", () => {
    const template = nodeToTemplate(page, [namn])!;
    const updated = withNodeValues(template, page, [namn, epost]);

    expect(updated.children?.map((child) => child.data.variableName)).toEqual([
      "kontakt.namn",
      "kontakt.epost",
    ]);
  });

  test("the fields survive a round trip through the host", () => {
    const template = nodeToTemplate(page, [namn, epost])!;
    const read = toNodeTemplate(JSON.parse(JSON.stringify(template)));

    expect(read?.children).toEqual(template.children);
  });

  test("a host's field without a type is dropped, the rest kept (K6b)", () => {
    const read = toNodeTemplate({
      type: "mall-sida",
      label: "Kontakt",
      base: "page",
      values: {},
      children: [{ data: {} }, { type: "text-question", data: namn.data }, "nonsens"],
    });

    expect(read?.children).toEqual([{ type: "text-question", data: namn.data }]);
  });
});
