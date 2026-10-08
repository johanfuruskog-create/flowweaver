/*
 * What a run (story 065) has done to the guide, derived from the engine's
 * trail — for every mirror that draws it. The canvas and the list view
 * (story 076) both read the run out of here, so "is this step answered"
 * has one answer: two derivations that could disagree would be worse
 * than one. Nothing here touches the DOM.
 */
import { PASSED_THROUGH_TYPES } from "../../viewer/core/guide-route-analyzer";

import type { Answers } from "../../viewer/core/answer-values";
import type { GraphData } from "../../viewer/types/graph";

export interface ProvingState {
  /** The step the run is standing on, drawn as "Du är här". */
  currentNodeId: string | null;
  /**
   * `getTraversedConnectionIds()` — the trail, straight from the engine.
   *
   * The answered steps are not listed beside it: a step the run has left is the
   * `from` end of a trail connection, so the list would be a second way of
   * saying the same thing and could disagree with the first.
   */
  trailConnectionIds: string[];
  /** The run's answers, so a step it has left still shows what was said. */
  answers: Answers;
  /** The engine's own step number for the bar: "Provar guiden · steg 3". */
  step: number;
  /**
   * The guide was edited under the run, so the trail is a lie and the run is
   * over. The line stays until it is started again or ended (story 065 point 8).
   */
  stale: boolean;
}

export class ProvingTrailService {
  /**
   * The trail's nodes and ports, derived from its connections.
   *
   * The same derivation `applyRouteToNodes` makes for a shown route, and for
   * the same reason: two answers to "is this on the trail" that could disagree
   * would be worse than one. A rule's chosen exit needs no separate report —
   * the connection the engine listed names it in `from.portId`.
   */
  static trailPorts(graph: GraphData, state: ProvingState | null): Map<string, string[]> {
    const ports = new Map<string, string[]>();

    if (!state || state.stale) {
      return ports;
    }

    const add = (nodeId: string, portId: string): void => {
      const list = ports.get(nodeId) ?? [];

      if (!list.includes(portId)) list.push(portId);
      ports.set(nodeId, list);
    };

    const trail = new Set(state.trailConnectionIds);

    graph.connections
      .filter((connection) => trail.has(connection.id))
      .forEach((connection) => {
        add(connection.from.nodeId, connection.from.portId);
        add(connection.to.nodeId, connection.to.portId);
      });

    return ports;
  }

  /**
   * The steps the run has been through, out of the trail it left.
   *
   * A step the run left is the `from` end of a connection it traversed — with
   * two subtractions. A rule, a calculation and a service call are passed
   * without stopping, so they were never answered; and the step the run stands
   * on now is not, even where the guide loops back into it.
   */
  static answeredNodes(graph: GraphData, state: ProvingState | null): Set<string> {
    const answered = new Set<string>();

    if (!state || state.stale) {
      return answered;
    }

    const trail = new Set(state.trailConnectionIds);

    graph.connections
      .filter((connection) => trail.has(connection.id))
      .forEach((connection) => {
        const node = graph.nodes.find(
          (candidate) => candidate.id === connection.from.nodeId,
        );

        if (!node || PASSED_THROUGH_TYPES.has(node.type)) return;
        if (node.id === state.currentNodeId) return;

        answered.add(node.id);
      });

    return answered;
  }

  /**
   * The step each visited node was, for the badge on its edge: "Steg 1",
   * "Steg 2"… (Johan 1/9: the run's own numbering where START usually is).
   *
   * Derived from the trail in the order the engine listed it — the answered
   * steps in the order they were answered, then the step the run stands on
   * with the engine's own number. Not stored anywhere else.
   */
  static stepNumbers(
    graph: GraphData,
    state: ProvingState | null,
    answered: Set<string>,
  ): Map<string, number> {
    const steps = new Map<string, number>();

    if (!state || state.stale) return steps;

    const byId = new Map(graph.connections.map((c) => [c.id, c]));

    state.trailConnectionIds.forEach((connectionId) => {
      const from = byId.get(connectionId)?.from.nodeId;

      if (from && answered.has(from) && !steps.has(from)) {
        steps.set(from, steps.size + 1);
      }
    });

    if (state.currentNodeId) {
      steps.set(state.currentNodeId, state.step);
    }

    return steps;
  }
}
