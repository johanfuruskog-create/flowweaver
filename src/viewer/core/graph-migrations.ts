/**
 * The graph format's content version and the migration chain that lifts old
 * graphs to it. The point: a breaking change to a node type raises CURRENT and
 * adds a migration here — and the chain invariant below (a test) makes a raise
 * *without* a migration fail. A migration cannot be forgotten; red CI forces it.
 */
import { SOURCE_LOCALE } from "./localized-text";
import { readIdList } from "./id-list";
import { toNodeTemplate } from "../node-types/node-templates";

export const CURRENT_GRAPH_VERSION = 10;

export interface GraphMigration {
  /** The version this migration produces (at least 2). */
  readonly to: number;
  readonly description: string;
  /** Transforms a loose graph representation one step forward. */
  migrate(graph: Record<string, unknown>): Record<string, unknown>;
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** v1→v2: makes node titles translatable by tagging the source language. */
function localizeTitles(graph: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(graph.nodes)) {
    return graph;
  }
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (!isRecordValue(node) || !isRecordValue(node.data)) {
        return node;
      }
      if (typeof node.data.title !== "string") {
        return node;
      }
      return {
        ...node,
        data: { ...node.data, title: { [SOURCE_LOCALE]: node.data.title } },
      };
    }),
  };
}

/** A bare string with content → { sv: text }; everything else is left alone. */
function tagSource(value: unknown): unknown {
  return typeof value === "string" && value !== ""
    ? { [SOURCE_LOCALE]: value }
    : value;
}

/**
 * v2→v3: tags the source language on the rest of the translatable content
 * (symmetry with title). The field list is deliberately fixed — a migration
 * should be a stable moment, not depend on the registry at runtime.
 */
const LOCALIZED_DATA_FIELDS = [
  "description",
  "unit",
  "placeholder",
  "continueLabel",
  "subject",
  "body",
  "firstLabel",
  "secondLabel",
  "firstPlaceholder",
  "secondPlaceholder",
];

function localizeContent(graph: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(graph.nodes)) {
    return graph;
  }
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (!isRecordValue(node) || !isRecordValue(node.data)) {
        return node;
      }
      const data: Record<string, unknown> = { ...node.data };
      for (const field of LOCALIZED_DATA_FIELDS) {
        if (field in data) {
          data[field] = tagSource(data[field]);
        }
      }
      if (Array.isArray(data.options)) {
        data.options = data.options.map((option) =>
          isRecordValue(option)
            ? { ...option, label: tagSource(option.label) }
            : option
        );
      }
      return { ...node, data };
    }),
  };
}

/** The prefixes of the Page's two built-in fields, in the order they showed. */
const LEGACY_PAGE_PREFIXES = ["first", "second"];

const LEGACY_PAGE_KEYS = LEGACY_PAGE_PREFIXES.flatMap((prefix) => [
  `${prefix}Label`,
  `${prefix}VariableName`,
  `${prefix}Placeholder`,
  `${prefix}Required`,
]);

/** Does the prefix hold any content worth preserving? */
function hasLegacyContent(data: Record<string, unknown>, prefix: string): boolean {
  const text = (value: unknown): boolean =>
    (typeof value === "string" && value.trim() !== "") ||
    (isRecordValue(value) &&
      Object.values(value).some(
        (entry) => typeof entry === "string" && entry.trim() !== ""
      ));

  return (
    text(data[`${prefix}Label`]) ||
    text(data[`${prefix}VariableName`]) ||
    text(data[`${prefix}Placeholder`]) ||
    data[`${prefix}Required`] === true
  );
}

/**
 * v3→v4: the Page's two built-in text fields become real child nodes.
 *
 * The fields lived in the page's own data (`firstLabel`, `secondVariableName`
 * and so on) and could therefore not be moved, removed or given a width of
 * their own. They also vanished silently as soon as the editor dragged in a
 * field of their own, because children won at render time.
 *
 * The migration preserves label, variable name, placeholder and requiredness
 * exactly. **Variable names do not change** — a rule or result text pointing at
 * `firstAnswer` works afterwards.
 *
 * A page that already has children of its own is not migrated: the old fields
 * were invisible there, and surfacing them would have added fields nobody asked
 * for. The keys are removed regardless, since they can never render again.
 */
function pageFieldsToChildren(
  graph: Record<string, unknown>
): Record<string, unknown> {
  if (!Array.isArray(graph.nodes)) {
    return graph;
  }

  const nodes = graph.nodes;
  const pagesWithChildren = new Set(
    nodes
      .filter(
        (node): node is Record<string, unknown> =>
          isRecordValue(node) && typeof node.parentPageId === "string"
      )
      .map((node) => node.parentPageId as string)
  );

  const usedIds = new Set(
    nodes
      .filter(isRecordValue)
      .map((node) => node.id)
      .filter((id): id is string => typeof id === "string")
  );

  const created: Record<string, unknown>[] = [];

  const cleaned = nodes.map((node) => {
    if (!isRecordValue(node) || node.type !== "page" || !isRecordValue(node.data)) {
      return node;
    }

    const data: Record<string, unknown> = { ...node.data };
    const pageId = typeof node.id === "string" ? node.id : "";
    const shouldMigrate = pageId !== "" && !pagesWithChildren.has(pageId);

    if (shouldMigrate) {
      LEGACY_PAGE_PREFIXES.forEach((prefix, index) => {
        if (!hasLegacyContent(data, prefix)) {
          return;
        }

        let id = `${pageId}-falt-${index + 1}`;
        let suffix = 2;

        while (usedIds.has(id)) {
          id = `${pageId}-falt-${index + 1}-${suffix}`;
          suffix += 1;
        }

        usedIds.add(id);

        created.push({
          id,
          type: "text-question",
          position: { x: 0, y: 0 },
          parentPageId: pageId,
          order: created.filter((child) => child.parentPageId === pageId).length,
          layout: { columnSpan: 12 },
          data: {
            title: data[`${prefix}Label`] ?? "",
            variableName: data[`${prefix}VariableName`] ?? "",
            placeholder: data[`${prefix}Placeholder`] ?? "",
            required: data[`${prefix}Required`] === true,
          },
        });
      });
    }

    LEGACY_PAGE_KEYS.forEach((key) => {
      delete data[key];
    });

    return { ...node, data };
  });

  return { ...graph, nodes: [...cleaned, ...created] };
}

/**
 * v4→v5: the guide's carried node templates become a base type plus values.
 *
 * Each template used to carry a frozen copy of the base type's fields and
 * behaviour, and so kept that copy when the base type was fixed. The base type
 * is read from the copied behaviour — every base type has its own way of
 * answering and its own way onward, so it is an identity and not a guess.
 *
 * The migration is structural and shape-guarded: it touches only `settings`, and
 * only entries that actually carry the old shape.
 */
function nodeTemplatesToBaseAndValues(
  graph: Record<string, unknown>
): Record<string, unknown> {
  if (!isRecordValue(graph.settings)) {
    return graph;
  }

  const settings = graph.settings;
  if (!Array.isArray(settings.customNodeTypes)) {
    return graph;
  }

  const nodeTemplates = settings.customNodeTypes
    .map(toNodeTemplate)
    .filter((template) => template !== null);

  const created: Record<string, unknown> = { ...settings };
  delete created.customNodeTypes;

  if (nodeTemplates.length > 0) {
    created.nodeTemplates = nodeTemplates;
  }

  return { ...graph, settings: created };
}

/**
 * v5→v6: a node created from a node template becomes a node of the **base
 * type**, with the template's key as provenance in `template`.
 *
 * The template's key used to be the node's `type`. The link was therefore
 * load-bearing: if a colleague deleted a shared template, every node using it
 * became unknown, in every guide. Nothing hangs from it now.
 *
 * The data is not touched. A node lacking a key the base type has gets its
 * answer from the field's declared default — see `node-fields.ts`. Filling the
 * node in here would have added content nobody authored.
 *
 * The base types are read from the guide's own `settings.nodeTemplates`. When a
 * template cannot be looked up the node stays as it is: no worse than before the
 * migration, and it can be resolved later when the template exists again.
 */
function nodeTemplatesToProvenance(
  graph: Record<string, unknown>
): Record<string, unknown> {
  if (!Array.isArray(graph.nodes) || !isRecordValue(graph.settings)) {
    return graph;
  }

  const templates = graph.settings.nodeTemplates;
  if (!Array.isArray(templates)) {
    return graph;
  }

  const grundtyp = new Map<string, string>();
  for (const template of templates) {
    if (
      isRecordValue(template) &&
      typeof template.type === "string" &&
      typeof template.base === "string" &&
      template.base !== ""
    ) {
      grundtyp.set(template.type, template.base);
    }
  }

  if (grundtyp.size === 0) {
    return graph;
  }

  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (!isRecordValue(node) || typeof node.type !== "string") {
        return node;
      }

      const bas = grundtyp.get(node.type);
      return bas ? { ...node, type: bas, template: node.type } : node;
    }),
  };
}

/** Exactly one `{{variable}}` and nothing else — the visitor's-own-address form. */
const PURE_VARIABLE = /^\s*{{\s*([^{}]+?)\s*}}\s*$/;

/**
 * v6→v7: the email result's free-text recipient becomes an id. A recipient
 * that was one bare variable is the visitor's own address and maps cleanly;
 * a literal address has no client-side translation to an id, so it is left
 * in place for the guide to keep working — the health check flags it for
 * repointing. The catalog model itself lives in `submission-registry.ts`.
 */
function emailRecipientToId(graph: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(graph.nodes)) {
    return graph;
  }
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (
        !isRecordValue(node) ||
        node.type !== "email-result" ||
        !isRecordValue(node.data) ||
        typeof node.data.to !== "string"
      ) {
        return node;
      }

      const { to, ...rest } = node.data;
      const variable = PURE_VARIABLE.exec(to)?.[1];

      if (variable) {
        return { ...node, data: { ...rest, recipientId: "@visitor", visitorVariable: variable } };
      }
      return to.trim() === "" ? { ...node, data: rest } : node;
    }),
  };
}

/**
 * v7→v8: mottagaren blir en lista, och kopiemottagarna föds som en tom sådan.
 *
 * Ett ärende har inte alltid en mottagare. En felanmälan om en lampa vid en
 * lekplats gäller gatukontoret OCH parkförvaltningen, och en handläggare vill
 * ofta ha kopia utan att äga ärendet (story 056). Det singulära `recipientId`
 * var ett antagande som verkligheten inte delade — se praxis 25.
 *
 * Det gamla fältet står kvar med flit. `docs/INLAMNING-KONTRAKT.md` lovar
 * `recipientId` i utdatat, och referensmottagaren läser det redan; att ta bort
 * det vore att bryta ett löfte tyst. Det bär numera FÖRSTA mottagaren och
 * försvinner först med en versionshöjning i kontraktet.
 *
 * Tomt id ger en TOM lista, inte `[""]`: en lista med ett tomt värde ser ut som
 * ett val och skulle dölja "ingen mottagare vald" för hälsokontrollen.
 */
/**
 * A part of an answer stops being a variable beside it.
 *
 * ## What was wrong
 *
 * A lookup wrote the label into `land` and the code into `landskod`. A map
 * wrote the name into `plats` and the geometry into `platsGeo`. A file put its
 * markings into `fotoMarkeringar`. Three times the same thing: **a part of one
 * answer was given a variable of its own**, and the two were kept in step by
 * the order they happened to be written in.
 *
 * They existed for exactly one reason — a condition could only name a whole
 * variable, so there was no way to say *the code part of land*. A condition can
 * name a part now, and the reason is gone.
 *
 * Two variables can drift apart. One value with parts cannot, and the day a
 * single entry goes missing on one side is the day a rule reads the wrong
 * country's code while both variables still look fine on their own.
 *
 * ## What this rewrites, and what it deliberately leaves
 *
 * Every condition and every template placeholder that named a side variable now
 * names the part: `landskod` → `land.code`, `platsGeo` → `plats.geo`,
 * `fotoMarkeringar` → `foto.markings`. `codeVariableName` is removed from the
 * nodes that carried it, because nothing reads it any more.
 *
 * A condition naming something no node produced is **left alone**. It was
 * already broken, and rewriting it would hide that from the health check, which
 * is the thing that tells an editor about it.
 */
function partsInsteadOfSideVariables(
  graph: Record<string, unknown>,
): Record<string, unknown> {
  /*
   * En migrering lagar inte trasig indata.
   *
   * Första versionen skrev `Array.isArray(graph.nodes) ? graph.nodes : []` och
   * returnerade alltid en lista — vilket gjorde en graf vars `nodes` var något
   * annat till en tom, giltig graf. Formatkontrollen slutade säga "Fältet nodes
   * måste vara en lista", för när den fick se grafen var den redan lagad.
   *
   * Detsamma för en nod vars `data` inte är ett objekt: den lämnas orörd i
   * stället för att bli `{}`. Att tysta ett besked är värre än att inte
   * migrera — det första upptäcks aldrig.
   */
  if (!Array.isArray(graph.nodes)) return graph;

  const nodes = graph.nodes;
  /** Side variable → the path that replaces it. */
  const renames = new Map<string, string>();

  for (const node of nodes) {
    if (!isRecord(node)) continue;

    const data = isRecord(node.data) ? node.data : {};
    const own = typeof data.variableName === "string" ? data.variableName.trim() : "";

    if (own === "") continue;

    const code = typeof data.codeVariableName === "string" ? data.codeVariableName.trim() : "";

    if (code !== "") renames.set(code, `${own}.code`);
    if (node.type === "map-question") renames.set(`${own}Geo`, `${own}.geo`);
    if (node.type === "file-question") renames.set(`${own}Markeringar`, `${own}.markings`);
  }

  const renamed = (name: unknown): unknown =>
    typeof name === "string" && renames.has(name) ? renames.get(name) : name;

  /**
   * `{{landskod}}` and `{{ landskod }}` alike, and nothing that merely contains
   * it — `{{landskoden}}` is a different name. The `\s*` around the lazy group
   * eats the spaces, so the captured name needs no trimming; trimming it here
   * was dead code a mutation could not tell apart.
   */
  const inText = (text: string): string =>
    text.replace(/{{\s*([^{}]+?)\s*}}/g, (whole, name: string) => {
      const path = renames.get(name);

      return path ? `{{${path}}}` : whole;
    });

  const walkText = (value: unknown): unknown => {
    if (typeof value === "string") return inText(value);
    if (Array.isArray(value)) return value.map(walkText);
    if (isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, one]) => [key, walkText(one)]),
      );
    }
    return value;
  };

  return {
    ...graph,
    nodes: nodes.map((node) => {
      if (!isRecord(node) || !isRecord(node.data)) return node;

      const data = { ...node.data };

      delete data.codeVariableName;

      /*
       * Vart och ett av villkorens `variableName`, oavsett hur djupt.
       *
       * Två ställen, för villkor bor på två: reglernas fall i `data.cases`, och
       * ett sidfälts synlighet på **noden** (`node.visibility`), inte i dess
       * data. Migreringen letade bara i `data` först — och testet la
       * synligheten där också, så båda var överens om samma felaktiga
       * antagande och verkliga guiders villkor skrevs aldrig om.
       */
      const skrivOm = (block: unknown): unknown =>
        block === undefined
          ? undefined
          : JSON.parse(
              JSON.stringify(block),
              (name: string, value: unknown) => (name === "variableName" ? renamed(value) : value),
            );

      if (data.cases !== undefined) data.cases = skrivOm(data.cases);

      const visibility = skrivOm(node.visibility);

      return {
        ...node,
        ...(visibility === undefined ? {} : { visibility }),
        data: walkText(data) as Record<string, unknown>,
      };
    }),
  };
}

/**
 * The code part is renamed: `land.code` becomes `land.value`.
 *
 * One thing had two names. A lookup service answers `{ value, label }` — that
 * is `docs/UPPSLAG-KONTRAKT.md`, and it is what a host writes against — and
 * the field then stored the same string under `code`, so a rule read
 * `land.code` while the service that produced it called it `value`. The swap
 * happened silently inside `lookup-field`, which is the worst place for a
 * rename: nobody reading either end can see it.
 *
 * Only the lookup types are rewritten, and only the path that v9 itself
 * created. A blanket "any name ending in .code" would also catch a variable
 * somebody named that on purpose, and a migration that guesses is a migration
 * that eventually guesses wrong.
 *
 * A guide arriving as v8 passes through v9 first — which mints `land.code` —
 * and then through here. That is one rewrite too many on paper and exactly
 * right in practice: v9 is what shipped, so it is what a stored graph looks
 * like, and a migration that skipped a released step would leave those graphs
 * behind.
 */
function valueInsteadOfCode(
  graph: Record<string, unknown>,
): Record<string, unknown> {
  // Samma försiktighet som v9: en migrering lagar inte trasig indata.
  if (!Array.isArray(graph.nodes)) return graph;

  const nodes = graph.nodes;
  const renames = new Map<string, string>();

  for (const node of nodes) {
    if (!isRecord(node)) continue;
    if (node.type !== "autocomplete-question" && node.type !== "multi-autocomplete-question") {
      continue;
    }

    const data = isRecord(node.data) ? node.data : {};
    const own = typeof data.variableName === "string" ? data.variableName.trim() : "";

    if (own !== "") renames.set(`${own}.code`, `${own}.value`);
  }

  if (renames.size === 0) return graph;

  const renamed = (name: unknown): unknown =>
    typeof name === "string" && renames.has(name) ? renames.get(name) : name;

  const inText = (text: string): string =>
    text.replace(/{{\s*([^{}]+?)\s*}}/g, (whole, name: string) => {
      const path = renames.get(name);

      return path ? `{{${path}}}` : whole;
    });

  const walkText = (value: unknown): unknown => {
    if (typeof value === "string") return inText(value);
    if (Array.isArray(value)) return value.map(walkText);
    if (isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, one]) => [key, walkText(one)]),
      );
    }
    return value;
  };

  return {
    ...graph,
    nodes: nodes.map((node) => {
      if (!isRecord(node) || !isRecord(node.data)) return node;

      const data = { ...node.data };
      // Villkor bor på två ställen: reglernas fall i `data.cases` och ett
      // sidfälts synlighet på NODEN. v9 lärde sig det den hårda vägen.
      const skrivOm = (block: unknown): unknown =>
        block === undefined
          ? undefined
          : JSON.parse(
              JSON.stringify(block),
              (name: string, value: unknown) => (name === "variableName" ? renamed(value) : value),
            );

      if (data.cases !== undefined) data.cases = skrivOm(data.cases);

      const visibility = skrivOm(node.visibility);

      return {
        ...node,
        ...(visibility === undefined ? {} : { visibility }),
        data: walkText(data) as Record<string, unknown>,
      };
    }),
  };
}

function recipientsBecomeLists(
  graph: Record<string, unknown>,
): Record<string, unknown> {
  if (!Array.isArray(graph.nodes)) {
    return graph;
  }

  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (!isRecordValue(node) || !isRecordValue(node.data)) {
        return node;
      }
      if (node.type !== "submit-result" && node.type !== "email-result") {
        return node;
      }

      /*
       * A list already there wins over the singular field. The in-code
       * example guides carry no version stamp and are written in today's
       * form; building the list from `recipientId` alone wiped theirs to
       * `[]`, and Beställ blanketter arrived with no recipient (2026-09-05).
       */
      return {
        ...node,
        data: {
          ...node.data,
          recipientIds: readIdList(node.data.recipientIds, node.data.recipientId),
          copyRecipientIds: readIdList(node.data.copyRecipientIds, undefined),
        },
      };
    }),
  };
}

/**
 * An ordered chain. Every breaking or normalising shape change adds an entry
 * with `to = the new version` and raises CURRENT_GRAPH_VERSION by as much.
 */
export const graphMigrations: GraphMigration[] = [
  {
    to: 2,
    description: "Make node titles (title) translatable: \"text\" → { sv: \"text\" }.",
    migrate: localizeTitles,
  },
  {
    to: 3,
    description: "Tag the source language on the rest of the translatable content.",
    migrate: localizeContent,
  },
  {
    to: 4,
    description: "The Page's two built-in text fields become real child nodes.",
    migrate: pageFieldsToChildren,
  },
  {
    to: 5,
    description: "Node templates become base type plus values instead of a frozen copy.",
    migrate: nodeTemplatesToBaseAndValues,
  },
  {
    to: 6,
    description:
      "A node from a template gets the base type as type and the template key as provenance.",
    migrate: nodeTemplatesToProvenance,
  },
  {
    to: 7,
    description:
      "The email result's free-text recipient becomes an id: a bare variable maps to the visitor choice, a literal address is left for the health check.",
    migrate: emailRecipientToId,
  },
  {
    to: 8,
    description: "The recipient becomes a list, and copy recipients are born as an empty one.",
    migrate: recipientsBecomeLists,
  },
  {
    to: 9,
    description:
      "A part of an answer stops being a variable of its own: conditions and templates address land.code, and codeVariableName retires.",
    migrate: partsInsteadOfSideVariables,
  },
  {
    to: 10,
    description:
      "The code part takes the name the lookup contract already used: land.code becomes land.value.",
    migrate: valueInsteadOfCode,
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads the content version from a serialised graph. Missing = legacy v1. */
export function readGraphVersion(graph: unknown): number {
  if (isRecord(graph)) {
    const version = graph.version;
    if (typeof version === "number" && Number.isInteger(version) && version >= 1) {
      return version;
    }
  }
  return 1;
}

/** Stamps the current content version on a graph before serialisation. */
export function stampGraphVersion<T extends object>(
  graph: T
): T & { version: number } {
  return { version: CURRENT_GRAPH_VERSION, ...graph };
}

export interface MigrationChainIssue {
  message: string;
}

/**
 * Checks that the migrations form an unbroken, unique chain 2..current. If
 * anyone raises CURRENT without adding a migration, it is caught here.
 */
export function validateMigrationChain(
  migrations: readonly GraphMigration[] = graphMigrations,
  current: number = CURRENT_GRAPH_VERSION
): MigrationChainIssue[] {
  const issues: MigrationChainIssue[] = [];
  const seen = new Set<number>();

  for (const migration of migrations) {
    if (migration.to < 2) {
      issues.push({ message: `Migration with to=${migration.to} is invalid (at least 2).` });
    }
    if (migration.to > current) {
      issues.push({
        message: `Migration to=${migration.to} exceeds CURRENT_GRAPH_VERSION (${current}).`,
      });
    }
    if (seen.has(migration.to)) {
      issues.push({ message: `Duplicate migration for version ${migration.to}.` });
    }
    seen.add(migration.to);
  }

  for (let version = 2; version <= current; version++) {
    if (!seen.has(version)) {
      issues.push({
        message: `No migration for version ${version}. Did you raise CURRENT_GRAPH_VERSION without adding one?`,
      });
    }
  }

  return issues;
}

export interface MigrationResult {
  graph: Record<string, unknown>;
  fromVersion: number;
  toVersion: number;
  applied: number[];
}

/**
 * Runs every migration with `to` between fromVersion (exclusive) and current
 * (inclusive), in ascending order. The result is stamped with current.
 */
export function migrateGraph(
  graph: Record<string, unknown>,
  fromVersion: number,
  migrations: readonly GraphMigration[] = graphMigrations,
  current: number = CURRENT_GRAPH_VERSION
): MigrationResult {
  const chain = [...migrations].sort((left, right) => left.to - right.to);
  const applied: number[] = [];
  let result = graph;

  for (const migration of chain) {
    if (migration.to > fromVersion && migration.to <= current) {
      result = migration.migrate(result);
      applied.push(migration.to);
    }
  }

  return {
    graph: { ...result, version: current },
    fromVersion,
    toVersion: current,
    applied,
  };
}
