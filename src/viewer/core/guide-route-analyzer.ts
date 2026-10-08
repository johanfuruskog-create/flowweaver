import { QuestionOptionsService } from "../services/question-options-service";
import { getPossibleRulePortIds } from "./rule-evaluator";
import { RuleCasesService } from "../services/rule-cases-service";
import { isEndingNodeType, isGuideStepNode, isQuestionNode } from "../node-types/node-type-registry";

import { resolveText } from "./localized-text";

import type { FlowNodeData, GraphData } from "../types/graph";
import type { LocalizedText } from "./localized-text";

function getFlowBranches(
  graph: GraphData,
  node: FlowNodeData,
  answers: Record<string, string> = {}
): Array<{
  id: string;
  label: string;
  value?: string;
  connectionId: string;
  target: FlowNodeData;
}> {
  const possibleRulePorts =
    node.type === "rule" ? getPossibleRulePortIds(node, answers) : null;
  const ports =
    node.type === "question"
      ? QuestionOptionsService.getOptions(node).map((option) => ({
          id: option.id,
          label: resolveText(option.label),
          value: option.value,
        }))
      : isGuideStepNode(node)
        ? [{ id: "continue", label: "Fortsätt" }]
      : node.type === "rule"
        ? ([
            ...RuleCasesService.getCases(node).map((item) => ({
              id: item.id,
              label: item.label,
            })),
            {
              id: "default",
              label:
                typeof node.data.fallbackLabel === "string"
                  ? node.data.fallbackLabel
                  : "Annars",
            },
          ] as Array<{ id: string; label: string; value?: string }>).filter(
            (port) =>
              possibleRulePorts === null || possibleRulePorts.includes(port.id)
          )
        : [];

  return ports.flatMap((port) => {
    const connection = graph.connections.find(
      (candidate) =>
        candidate.from.nodeId === node.id &&
        candidate.from.portId === port.id
    );
    const target = connection
      ? graph.nodes.find((candidate) => candidate.id === connection.to.nodeId)
      : undefined;

    return connection && target
      ? [{ ...port, connectionId: connection.id, target }]
      : [];
  });
}

export interface GuideRouteAnalysis {
  directTarget: FlowNodeData | null;
  results: FlowNodeData[];
  issue: "missing-connection" | "missing-target" | null;
  hasCycle: boolean;
  hasDeadEnd: boolean;
}

export interface GuideResultPathStep {
  connectionId: string;
  questionId: string;
  questionTitle: string;
  optionId: string;
  optionLabel: string;
}

export interface GuideResultPaths {
  paths: GuideResultPathStep[][];
  hasCycle: boolean;
  truncated: boolean;
}

export function findGuidePathsToResult(
  graph: GraphData,
  resultNodeId: string,
  maxPaths = 20
): GuideResultPaths {
  const startNode = graph.nodes.find((node) => node.id === graph.startNodeId);
  const paths: GuideResultPathStep[][] = [];
  let hasCycle = false;
  let truncated = false;

  const visit = (
    node: FlowNodeData,
    steps: GuideResultPathStep[],
    visited: Set<string>,
    answers: Record<string, string>
  ): void => {
    if (paths.length >= maxPaths) {
      truncated = true;
      return;
    }

    if (node.id === resultNodeId) {
      paths.push(steps);
      return;
    }

    if (visited.has(node.id)) {
      hasCycle = true;
      return;
    }

    if (!isGuideStepNode(node) && node.type !== "rule") {
      return;
    }

    const nextVisited = new Set(visited).add(node.id);

    getFlowBranches(graph, node, answers).forEach((branch) => {
      const variableName = node.data.variableName;
      const nextAnswers =
        node.type === "question" &&
        typeof variableName === "string" &&
        variableName.length > 0 &&
        branch.value !== undefined
          ? { ...answers, [variableName]: branch.value }
          : answers;

      visit(
        branch.target,
        [
          ...steps,
          {
            connectionId: branch.connectionId,
            questionId: node.id,
            questionTitle: resolveText(node.data.title, undefined, "Namnlös fråga"),
            optionId: branch.id,
            optionLabel: branch.label,
          },
        ],
        nextVisited,
        nextAnswers
      );
    });
  };

  if (startNode) {
    visit(startNode, [], new Set(), {});
  }

  return { paths, hasCycle, truncated };
}

export function analyzeGuideRoute(
  graph: GraphData,
  questionId: string,
  optionId: string
): GuideRouteAnalysis {
  const connection = graph.connections.find(
    (candidate) =>
      candidate.from.nodeId === questionId &&
      candidate.from.portId === optionId
  );

  if (!connection) {
    return {
      directTarget: null,
      results: [],
      issue: "missing-connection",
      hasCycle: false,
      hasDeadEnd: true,
    };
  }

  const directTarget = graph.nodes.find(
    (node) => node.id === connection.to.nodeId
  );

  if (!directTarget) {
    return {
      directTarget: null,
      results: [],
      issue: "missing-target",
      hasCycle: false,
      hasDeadEnd: true,
    };
  }

  const results = new Map<string, FlowNodeData>();
  let hasCycle = false;
  let hasDeadEnd = false;

  const sourceQuestion = graph.nodes.find((node) => node.id === questionId);
  const sourceOption = sourceQuestion
    ? QuestionOptionsService.getOptions(sourceQuestion).find(
        (option) => option.id === optionId
      )
    : undefined;
  const sourceVariableName = sourceQuestion?.data.variableName;
  const initialAnswers =
    sourceOption &&
    typeof sourceVariableName === "string" &&
    sourceVariableName.length > 0
      ? { [sourceVariableName]: sourceOption.value }
      : {};

  const visit = (
    node: FlowNodeData,
    path: Set<string>,
    answers: Record<string, string>
  ): void => {
    if (path.has(node.id)) {
      hasCycle = true;
      return;
    }

    if (isEndingNodeType(node.type)) {
      results.set(node.id, node);
      return;
    }

    if (!isGuideStepNode(node) && node.type !== "rule") {
      hasDeadEnd = true;
      return;
    }

    const nextPath = new Set(path).add(node.id);
    const branches = getFlowBranches(graph, node, answers);
    const expectedBranchCount =
      node.type === "rule"
        ? RuleCasesService.getCases(node).length + 1
        : isGuideStepNode(node)
          ? node.type === "question"
            ? QuestionOptionsService.getOptions(node).length
            : 1
        : QuestionOptionsService.getOptions(node).length;

    if (branches.length < expectedBranchCount) {
      hasDeadEnd = true;
    }

    if (branches.length === 0) {
      hasDeadEnd = true;
    }

    branches.forEach((branch) => {
      const variableName = node.data.variableName;
      const nextAnswers =
        node.type === "question" &&
        typeof variableName === "string" &&
        variableName.length > 0 &&
        branch.value !== undefined
          ? { ...answers, [variableName]: branch.value }
          : answers;

      visit(branch.target, nextPath, nextAnswers);
    });
  };

  visit(directTarget, new Set([questionId]), initialAnswers);

  return {
    directTarget: structuredClone(directTarget),
    results: Array.from(results.values(), (node) => structuredClone(node)),
    issue: null,
    hasCycle,
    hasDeadEnd,
  };
}

/**
 * The node types the engine passes without stopping.
 *
 * `resolveRules` in the engine advances straight through a rule, a calculation
 * and a service call, so a visitor never meets one as a step. Named here rather
 * than beside its reader (the canvas's trail) because it is a fact about the
 * engine, and a copy written down next to whoever needs it is how two of them
 * start to disagree.
 *
 * The progress meter needs no such list: a rule, a calculation and a service
 * call are neither questions nor pages, so `isCountedStep` leaves them at zero
 * on its own. Same fact, arrived at from the other side.
 */
export const PASSED_THROUGH_TYPES: ReadonlySet<string> = new Set([
  "rule",
  "calculation",
  "service-call",
]);

/**
 * A step the progress meter counts: something the visitor is asked to answer.
 *
 * *Frågor och sidor*, word for word (story 116, Johans beslut 13/9). A question
 * is any type declaring a `variableType`; a Page is the other thing a visitor
 * fills in. Deliberately narrower than `isGuideStepNode`: a picture, a code
 * block, the review and the results are all shown to the visitor, and none of
 * them is a question — counting them made the survey jump 86 percentage points
 * in one step (`docs/LOGG.md` 13/9).
 *
 * A field inside a Page is never a step of its own. It is answered as part of
 * the Page, and the Page is what the visitor is standing on.
 */
export function isCountedStep(node: FlowNodeData): boolean {
  if (node.parentPageId !== undefined) return false;

  return isQuestionNode(node) || node.type === "page";
}

const asCountedStep = (node: FlowNodeData): number =>
  isCountedStep(node) ? 1 : 0;

/**
 * The counted steps on the longest route out of a node, that node included.
 *
 * Walks the connections, not the ports: the count needs no idea of what an
 * exit means, only where it goes, and it takes the **longest** branch rather
 * than the first one written down or the rule's default. A node already on the
 * way down is worth 0 rather than being followed again, so a loop ends the
 * walk instead of running forever; the result is memoised, so the cost is one
 * visit per node.
 *
 * This used to take the weight as a parameter, because `longestGuideRoute`
 * asked the same walk a different question — how many steps a run can be
 * *shown*. That function was deleted 13/9 (its caller, *steg N av M*, went on
 * 2/9), and a parameter with one possible value is speculative generality: the
 * same cost PRAXIS regel 15 names, pointing the other way. The weight is
 * therefore written in. A second question about the same walk brings the
 * parameter back rather than a second copy of the walk.
 */
function countedStepsFrom(graph: GraphData, startNodeId: string): number {
  const known = new Map<string, number>();
  const onTheWayDown = new Set<string>();

  const from = (nodeId: string): number => {
    const cached = known.get(nodeId);

    if (cached !== undefined) return cached;
    if (onTheWayDown.has(nodeId)) return 0;

    const node = graph.nodes.find((candidate) => candidate.id === nodeId);

    if (!node) return 0;

    onTheWayDown.add(nodeId);

    const ahead = graph.connections
      .filter((connection) => connection.from.nodeId === nodeId)
      .map((connection) => from(connection.to.nodeId));

    onTheWayDown.delete(nodeId);

    const total =
      asCountedStep(node) + (ahead.length > 0 ? Math.max(...ahead) : 0);

    known.set(nodeId, total);
    return total;
  };

  return from(startNodeId);
}

/**
 * The most counted steps still ahead of a node — the node itself excluded.
 *
 * The denominator's moving half. `countedStepsFrom` returns the node plus the
 * best route out of it, so subtracting the node's own weight leaves exactly
 * what comes after it.
 */
export function countedStepsAhead(graph: GraphData, nodeId: string): number {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);

  if (!node) return 0;

  return countedStepsFrom(graph, nodeId) - asCountedStep(node);
}

/**
 * The counted steps on the guide's longest route, the start step included.
 *
 * What the meter is asked before it is drawn at all: a guide whose longest
 * route holds fewer than two counted steps has nothing to measure, and a meter
 * stuck at 100 % is worse than no meter (story 116, criterion 7).
 */
export function longestCountedRoute(graph: GraphData): number {
  return graph.startNodeId ? countedStepsFrom(graph, graph.startNodeId) : 0;
}

/**
 * The node ids on the way to `currentNodeId`, oldest first, the node itself
 * last — `null` when there is nothing to measure (a still picture with
 * nothing behind it that is not the guide's first step). One walk from
 * `traversedConnectionIds` to a node list, shared by `guideProgress` (which
 * counts the steps in it) and `passedStepsAlongWay` (which names the steps
 * among them): the same fact asked two questions, not two copies of the walk.
 */
function nodesAlongWay(
  graph: GraphData,
  traversedConnectionIds: readonly string[],
  currentNodeId: string
): string[] | null {
  const traversed = traversedConnectionIds.flatMap((id) => {
    const connection = graph.connections.find(
      (candidate) => candidate.id === id
    );
    return connection ? [connection] : [];
  });

  if (traversed.length === 0 && currentNodeId !== graph.startNodeId) return null;

  return traversed.length > 0
    ? [traversed[0].from.nodeId, ...traversed.map((step) => step.to.nodeId)]
    : [currentNodeId];
}

/** How far into the guide the visitor has come. */
export interface GuideProgress {
  /** Counted steps taken, the one being shown included. */
  taken: number;
  /** Counted steps on the longest route still ahead. */
  ahead: number;
  /** `taken / (taken + ahead)` as whole percent. */
  percent: number;
}

/**
 * How far the run has come, as *tagna / (tagna + kvar)* (story 116).
 *
 * The numerator counts the step being shown: standing on the first of five is
 * 20 %, and standing on the last is 100 %. The denominator is the longest
 * route still ahead, measured from where the run actually is — which is why it
 * can never go backwards. Every step taken spends one step out of the longest
 * remaining route, so the denominator can only shrink while the numerator
 * grows; that is structure, not luck, and it was measured over all 26 bundled
 * guides before anything was built (`docs/LOGG.md` 13/9).
 *
 * The way here is read out of the connections the run has traversed, so two
 * runs standing on the same node are told apart by what they answered to get
 * there.
 *
 * Returns `null` when there is nothing to measure — and that includes a step
 * with nothing behind it that is not the guide's first. The editor draws a
 * still picture of a single step that way (`goToNode`, story 065), and a
 * picture has no run behind it: saying *20 %* about the eleventh question
 * because it happens to be the one selected would be a number about nothing.
 */
export function guideProgress(
  graph: GraphData,
  traversedConnectionIds: readonly string[],
  currentNodeId: string
): GuideProgress | null {
  const wayHere = nodesAlongWay(graph, traversedConnectionIds, currentNodeId);

  if (!wayHere) return null;

  const taken = wayHere.filter((nodeId) => {
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    return node !== undefined && isCountedStep(node);
  }).length;

  const ahead = countedStepsAhead(graph, currentNodeId);

  if (taken + ahead === 0) return null;

  const share = taken / (taken + ahead);

  return {
    taken,
    ahead,
    /*
     * Rounded, but never rounded up to a promise it cannot keep: a guide long
     * enough for 199/200 to round to 100 would say "done" with a question
     * still to come. Full is reserved for actually full.
     */
    percent: ahead > 0 ? Math.min(99, Math.round(share * 100)) : Math.round(share * 100),
  };
}

/** One counted step the visitor has passed, named by its own title. */
export interface NamedStep {
  id: string;
  title: LocalizedText;
}

/**
 * The counted steps the visitor has **passed** on the way here, oldest first:
 * pages and standalone questions alike, the step showing now left out.
 *
 * Astra 1/10 (bilaga 10, punkt 8): *"en gemensam form för besökta, besvarade
 * steg, även fristående frågor. Visa bara den väg besökaren faktiskt gått.
 * Upprepa inte den aktuella rubriken."* The row used to name only Pages, the
 * current one included — on a page that put *Om dig* over the heading *Om
 * dig* — and fell back to *Steg N* in a guide of loose questions, so three
 * forms said where you were (genomgången 30/9, V7). A question's title was
 * left out because it is the card's heading while it is asked; once it is
 * answered it is ground crossed like any page, and the heading below has
 * moved on.
 *
 * Read from the connections the run traversed, so it is the way actually
 * taken, never the guide's longest or first. A node met twice (a loop back)
 * is named once, where it was first passed.
 *
 * Empty when nothing has been passed: the first step, a still picture of one
 * node in the editor (`nodesAlongWay` has no run behind it).
 */
export function passedStepsAlongWay(
  graph: GraphData,
  traversedConnectionIds: readonly string[],
  currentNodeId: string
): NamedStep[] {
  const wayHere = nodesAlongWay(graph, traversedConnectionIds, currentNodeId) ?? [];
  const seen = new Set<string>([currentNodeId]);

  return wayHere.flatMap((nodeId) => {
    if (seen.has(nodeId)) return [];
    seen.add(nodeId);
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    return node && isCountedStep(node) ? [{ id: node.id, title: node.data.title as LocalizedText }] : [];
  });
}
