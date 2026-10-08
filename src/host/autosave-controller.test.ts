import { afterEach, describe, expect, test, vi } from "vitest";

// The store reads what it stored back through the editor's own door, and that
// door asks the node-type registry. Without this the guide comes back as
// "cannot be used as a start node" — a fault in the test's setup that reads
// exactly like a fault in the code.
import "../viewer/node-types/default-node-types";

import { AutosaveController } from "./autosave-controller";
import { LocalStorageGraphStore } from "./local-storage-graph-store";

import type { GraphChangedDetail } from "../editor/types/events";
import type { GraphData } from "../viewer/types/graph";
import type { GraphStore } from "./local-storage-graph-store";

const graph = (title: string): GraphData => ({
  startNodeId: "question",
  nodes: [
    {
      id: "question",
      type: "question",
      position: { x: 0, y: 0 },
      data: { title },
    },
  ],
  connections: [],
});

const dispatchChange = (source: EventTarget, value: GraphData): void => {
  source.dispatchEvent(
    new CustomEvent<GraphChangedDetail>("graph-changed", {
      detail: { graph: value, reason: "node-updated" },
    })
  );
};

afterEach(() => {
  vi.useRealTimers();
});

describe("AutosaveController", () => {
  test("saves only the last change after the delay", async () => {
    vi.useFakeTimers();

    const source = new EventTarget();
    const save = vi.fn<GraphStore["saveDraft"]>(async () => ({
      success: true,
      savedAt: "2026-07-19T18:00:00.000Z",
    }));
    const onSave = vi.fn();
    const controller = new AutosaveController({
      source,
      store: { saveDraft: save },
      delay: 500,
      onSave,
    });

    controller.connect();
    dispatchChange(source, graph("Första"));
    dispatchChange(source, graph("Senaste"));

    vi.advanceTimersByTime(499);
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith("", graph("Senaste"));

    // The result reaches `onSave` a microtask later: the write is started and
    // not awaited, so that `flush()` can answer a `pagehide` at once.
    await Promise.resolve();
    expect(onSave).toHaveBeenCalledOnce();

    controller.disconnect();
  });

  test("stops listening and cancels a pending save", () => {
    vi.useFakeTimers();

    const source = new EventTarget();
    const save = vi.fn<GraphStore["saveDraft"]>(async () => ({
      success: true,
      savedAt: "2026-07-19T18:00:00.000Z",
    }));
    const controller = new AutosaveController({
      source,
      store: { saveDraft: save },
      delay: 500,
    });

    controller.connect();
    dispatchChange(source, graph("Ändrad"));
    controller.disconnect();
    vi.advanceTimersByTime(500);

    expect(save).not.toHaveBeenCalled();
  });

  /*
   * Story 083: Ctrl+S asks the host to save now. A host that autosaves answers
   * by writing what is pending at once, and says so — then the timer has
   * nothing left to write.
   */
  test("flush saves what is pending now, and the timer then has nothing", async () => {
    vi.useFakeTimers();

    const source = new EventTarget();
    const save = vi.fn<GraphStore["saveDraft"]>(async () => ({
      success: true,
      savedAt: "2026-07-19T18:00:00.000Z",
    }));
    const onSave = vi.fn();
    const controller = new AutosaveController({ source, store: { saveDraft: save }, delay: 500, onSave });

    controller.connect();
    dispatchChange(source, graph("Väntar"));

    expect(controller.flush()).toBe(true);
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith("", graph("Väntar"));

    await Promise.resolve();
    expect(onSave).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(500);
    expect(save).toHaveBeenCalledOnce();

    // Nothing pending: nothing written, and the caller is told so.
    expect(controller.flush()).toBe(false);
    expect(save).toHaveBeenCalledOnce();

    controller.disconnect();
  });
});

/**
 * Story 124, criterion 2: **autosave writes the working copy and nothing
 * else.**
 *
 * A version is a deliberate act — *Spara* on a row — and a guide whose list
 * grows by one every few seconds of typing has no versions, only noise. The
 * count after ten changes is the measurement, and it is taken against the real
 * store rather than a spy, because what matters is what ends up stored.
 *
 * The type says the same thing a second way: the controller is given
 * `Pick<GraphStore, "saveDraft">`, so there is no `saveVersion` on the object
 * it holds. The test is what catches a future call; the type is what stops one
 * being written.
 */
describe("autosparningen och versionerna", () => {
  class Memory implements Storage {
    private readonly values = new Map<string, string>();
    get length(): number { return this.values.size; }
    clear(): void { this.values.clear(); }
    getItem(key: string): string | null { return this.values.get(key) ?? null; }
    key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
    removeItem(key: string): void { this.values.delete(key); }
    setItem(key: string, value: string): void { this.values.set(key, value); }
  }

  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 5));

  /*
   * A guide the importer accepts. The file's own `graph()` builds a question
   * with no options, which cannot be a start node — the store reads what it
   * stored back through the same door the editor uses, so a fixture that
   * cannot come back out measures the door and not the controller.
   */
  const whole = (title: string): GraphData => ({
    startNodeId: "question",
    nodes: [
      {
        id: "question",
        type: "question",
        position: { x: 0, y: 0 },
        data: { title, options: [{ id: "ja", label: "Ja", value: "ja" }] },
      },
    ],
    connections: [],
  });

  test("tio ändringar ger ETT utkast och noll versioner", async () => {
    const store = new LocalStorageGraphStore(new Memory(), "test:guide");
    const source = new EventTarget();
    const controller = new AutosaveController({ source, store, guideId: "g1", delay: 0 });

    controller.connect();

    for (let change = 0; change < 10; change += 1) {
      dispatchChange(source, whole(`Ändring ${change}`));
      await settle();
    }

    controller.disconnect();

    expect(await store.listVersions("g1"), "ingen version av att någon skrev").toEqual([]);

    const back = await store.load("g1");

    expect(back.status === "success" && back.graph.nodes[0]!.data.title, "och arbetskopian är den sista").toBe("Ändring 9");
    expect(back.status === "success" && back.draft).toBe(true);
  });
});
