import { describe, expect, test } from "vitest";

import { GraphHistory } from "./graph-history";

import type { GraphData } from "../../viewer/types/graph";

const graph = (title: string): GraphData => ({
  startNodeId: "n",
  nodes: [{ id: "n", type: "text-question", position: { x: 0, y: 0 }, data: { title } }],
  connections: [],
});

describe("GraphHistory", () => {
  test("undoes and redoes a state", () => {
    const history = new GraphHistory();
    history.reset(graph("A"));
    history.record(graph("B"), "node-updated");
    history.record(graph("C"), "node-moved");

    expect(history.canUndo()).toBe(true);
    expect(history.undo()).toEqual(graph("B"));
    expect(history.undo()).toEqual(graph("A"));
    expect(history.undo()).toBeNull();

    expect(history.canRedo()).toBe(true);
    expect(history.redo()).toEqual(graph("B"));
    expect(history.redo()).toEqual(graph("C"));
    expect(history.redo()).toBeNull();
  });

  test("merges a run of text edits into one step", () => {
    const history = new GraphHistory();
    history.reset(graph("A"));
    history.record(graph("Ab"), "node-updated");
    history.record(graph("Abc"), "node-updated");
    history.record(graph("Abcd"), "node-updated");

    // A single undo removes the whole edit.
    expect(history.undo()).toEqual(graph("A"));
    expect(history.canUndo()).toBe(false);
  });

  const at = (x: number): GraphData => ({
    startNodeId: "n",
    nodes: [{ id: "n", type: "text-question", position: { x, y: 0 }, data: {} }],
    connections: [],
  });

  test("merges a run of arrow-key moves into one step", () => {
    const history = new GraphHistory();
    history.reset(at(0));
    history.record(at(10), "node-nudged");
    history.record(at(20), "node-nudged");
    history.record(at(30), "node-nudged");

    expect(history.undo()).toEqual(at(0));
    expect(history.canUndo()).toBe(false);
  });

  test("does not merge an arrow-key move with a mouse drag", () => {
    const history = new GraphHistory();
    history.reset(at(0));
    history.record(at(10), "node-moved");
    history.record(at(20), "node-nudged");

    // Two distinct gestures → two undo steps.
    expect(history.undo()).toEqual(at(10));
    expect(history.undo()).toEqual(at(0));
    expect(history.canUndo()).toBe(false);
  });

  test("ignores identical states", () => {
    const history = new GraphHistory();
    history.reset(graph("A"));
    history.record(graph("A"), "node-moved");

    expect(history.canUndo()).toBe(false);
  });

  test("a new change clears the redo stack", () => {
    const history = new GraphHistory();
    history.reset(graph("A"));
    history.record(graph("B"), "node-moved");
    history.undo();

    expect(history.canRedo()).toBe(true);
    history.record(graph("C"), "node-moved");
    expect(history.canRedo()).toBe(false);
  });

  test("caps the history depth", () => {
    const history = new GraphHistory(2);
    history.reset(graph("A"));
    history.record(graph("B"), "node-moved");
    history.record(graph("C"), "node-moved");
    history.record(graph("D"), "node-moved");

    // Only two steps back should remain (B and C), not all the way to A.
    expect(history.undo()).toEqual(graph("C"));
    expect(history.undo()).toEqual(graph("B"));
    expect(history.undo()).toBeNull();
  });
});
