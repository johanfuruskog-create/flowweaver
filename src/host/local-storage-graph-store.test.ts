import { describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";

import { LocalStorageGraphStore } from "./local-storage-graph-store";

import type { GraphData } from "../viewer/types/graph";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const graph = (): GraphData => ({
  startNodeId: "question",
  nodes: [
    {
      id: "question",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: "Fråga",
        options: [
          { id: "yes", label: "Ja", value: "yes" },
          { id: "no", label: "Nej", value: "no" },
        ],
      },
    },
  ],
  connections: [],
});

describe("LocalStorageGraphStore", () => {
  test("returns empty when no guide has been saved", async () => {
    const store = new LocalStorageGraphStore(new MemoryStorage());

    expect(await store.load("")).toEqual({ status: "empty" });
  });

  test("saves and restores a version-stamped document", async () => {
    const storage = new MemoryStorage();
    const store = new LocalStorageGraphStore(storage);
    const saveResult = await store.saveDraft("", graph());

    expect(saveResult.success).toBe(true);
    expect(JSON.parse(storage.getItem("flowweaver:guide")!)).toMatchObject({
      version: 1,
      graph: graph(),
    });
    expect(await store.load("")).toEqual({
      status: "success",
      graph: graph(),
      savedAt: saveResult.success ? saveResult.savedAt : "",
      // What came back is the working copy and not a version's graph — the
      // distinction story 124 added, and the one the unsaved mark reads.
      draft: true,
    });
  });

  test("rejects broken JSON and unsupported format versions", async () => {
    const storage = new MemoryStorage();
    const store = new LocalStorageGraphStore(storage);

    storage.setItem("flowweaver:guide", "{ trasig");
    expect(await store.load("")).toMatchObject({ status: "error" });

    storage.setItem(
      "flowweaver:guide",
      JSON.stringify({ version: 2, savedAt: "nu", graph: graph() })
    );
    expect(await store.load("")).toEqual({
      status: "error",
      message: "Den lokalt sparade guiden har ett format som inte stöds.",
    });
  });

  test("rejects a saved graph that is no longer valid", async () => {
    const storage = new MemoryStorage();
    const store = new LocalStorageGraphStore(storage);
    const invalidGraph = graph();
    invalidGraph.startNodeId = "missing";

    storage.setItem(
      "flowweaver:guide",
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        graph: invalidGraph,
      })
    );

    expect(await store.load("")).toMatchObject({ status: "error" });
  });

  test("restores a local draft temporarily without a start node", async () => {
    const storage = new MemoryStorage();
    const store = new LocalStorageGraphStore(storage);
    const draft = graph();
    draft.startNodeId = null;

    const saveResult = await store.saveDraft("", draft);

    expect(saveResult.success).toBe(true);
    expect(await store.load("")).toMatchObject({
      status: "success",
      graph: draft,
    });
  });
});

/**
 * The six the storage contract asks for (story 124).
 *
 * `docs/LAGRING-KONTRAKT.md` describes what a host answers; this is the
 * implementation every page already has, given the same shape. The two models
 * it has to keep apart are the whole point: **one working copy per guide,
 * overwritten**, and **versions that never change once frozen**.
 */
describe("lagringens sex metoder", () => {
  const store = (): LocalStorageGraphStore =>
    new LocalStorageGraphStore(new MemoryStorage(), "test:guide");

  const named = (title: string): GraphData => ({ ...graph(), nodes: [{ ...graph().nodes[0]!, data: { ...graph().nodes[0]!.data, title } }] });

  test("en guide som inte finns säger det", async () => {
    expect(await store().load("g1")).toEqual({ status: "empty" });
  });

  test("utkastet är ETT och skrivs över", async () => {
    const it = store();

    await it.saveDraft("g1", named("Första"));
    await it.saveDraft("g1", named("Andra"));

    const back = await it.load("g1");

    expect(back.status).toBe("success");
    expect(back.status === "success" && back.graph.nodes[0]!.data.title).toBe("Andra");
    expect(back.status === "success" && back.draft, "det är arbetskopian som kommer tillbaka").toBe(true);
  });

  test("en fryst version listas och går att öppna som den var", async () => {
    const it = store();
    const frozen = await it.saveVersion("g1", named("Version ett"), "Före regeländringen");

    expect(frozen.success).toBe(true);

    const id = frozen.success ? frozen.version.id : "";
    const list = await it.listVersions("g1");

    expect(list.map((one) => one.note)).toEqual(["Före regeländringen"]);
    expect((await it.openVersion("g1", id))?.nodes[0]!.data.title).toBe("Version ett");
    expect(await it.openVersion("g1", "finns-inte"), "en version som inte finns är null").toBeNull();
  });

  /*
   * Oföränderligheten är kontraktets löfte och det som gör en version värd
   * namnet: att gå tillbaka betyder ingenting om det man går tillbaka till kan
   * ha ändrats under tiden.
   */
  test("en andra version rör inte den första", async () => {
    const it = store();
    const first = await it.saveVersion("g1", named("Ett"));

    await it.saveVersion("g1", named("Två"));

    const id = first.success ? first.version.id : "";

    expect((await it.listVersions("g1")).length).toBe(2);
    expect((await it.openVersion("g1", id))?.nodes[0]!.data.title).toBe("Ett");
  });

  /*
   * Stämpeln sätts när något fryses, aldrig av ett utkast — ett märke som
   * ändrar sig vid varje tangenttryck gör varje jämförelse mellan två
   * versioner falskt positiv (K6c, och kommentaren i `graph.ts`).
   */
  test("en version stämplas, ett utkast stämplas inte", async () => {
    const it = store();

    await it.saveDraft("g1", named("Utkast"));

    const draft = await it.load("g1");

    expect(draft.status === "success" && draft.graph.meta?.updatedAt).toBeUndefined();

    const frozen = await it.saveVersion("g1", named("Version"));
    const id = frozen.success ? frozen.version.id : "";
    const stamp = (await it.openVersion("g1", id))?.meta?.updatedAt;

    expect(typeof stamp).toBe("string");
    expect(new Date(String(stamp)).toISOString()).toBe(stamp);
  });

  test("publish flyttar pekaren, och det är den som gäller utan utkast", async () => {
    const it = store();
    const first = await it.saveVersion("g1", named("Ett"));
    const second = await it.saveVersion("g1", named("Två"));
    const firstId = first.success ? first.version.id : "";
    const secondId = second.success ? second.version.id : "";

    expect((await it.publish("g1", secondId)).success).toBe(true);

    const back = await it.load("g1");

    expect(back.status === "success" && back.graph.nodes[0]!.data.title, "utan utkast är det den publicerade").toBe("Två");
    expect(back.status === "success" && back.current).toBe(secondId);
    expect((await it.listVersions("g1")).find((one) => one.current)?.id).toBe(secondId);

    expect((await it.publish("g1", firstId)).success, "och tillbaka igen").toBe(true);
    expect((await it.listVersions("g1")).find((one) => one.current)?.id).toBe(firstId);
    expect((await it.publish("g1", "finns-inte")).success, "en version som inte finns publiceras inte").toBe(false);
  });

  test("två guider i samma lagring stör inte varandra", async () => {
    const it = store();

    await it.saveDraft("g1", named("Min"));
    await it.saveDraft("g2", named("Din"));
    await it.saveVersion("g1", named("Min version"));

    const mine = await it.load("g1");
    const yours = await it.load("g2");

    expect(mine.status === "success" && mine.graph.nodes[0]!.data.title).toBe("Min");
    expect(yours.status === "success" && yours.graph.nodes[0]!.data.title).toBe("Din");
    expect((await it.listVersions("g2")).length, "g2 har inga versioner").toBe(0);
  });

  /*
   * En sida med EN guide har ingen id att skicka, och har haft sin nyckel
   * sedan länge. Tomma strängen är den guiden, och nyckeln är oförändrad —
   * annars hade alla som byggt något på exempelsidorna förlorat det.
   */
  test("sidans egen guide behåller nyckeln den alltid haft", async () => {
    const memory = new MemoryStorage();
    const it = new LocalStorageGraphStore(memory, "flowweaver:guide");

    await it.saveDraft("", named("Sidans egen"));

    expect(memory.getItem("flowweaver:guide"), "samma nyckel som förut").toBeTruthy();
    expect((await it.load("")).status).toBe("success");
  });
});
