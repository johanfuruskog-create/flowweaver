/*
 * Översikten (story 072): guiden som lista — läsbar uppifrån och ned,
 * nåbar utan pekare, och på liten skärm bättre än canvasen någonsin blir.
 *
 * Trädet byggs djupet-först från startnoden. En förgrening blir indragna
 * grupper under SVARETS etikett — svaret är porten, även här. Ett
 * sammanflöde visas i varje gren som når det (varje gren läsbar för sig)
 * med märket ⇄; en cykel blir en hänvisningsrad i stället för en evighet.
 * Listan är en vy, inte ett hem: redigeringen sker alltid på noden.
 *
 * Hälsan räknas här, ur samma tjänst som hälsolisten — en markör per rad
 * som har fynd, aldrig en egen sanning.
 */
import { escapeHtml } from "../../../viewer/core/escape-html";
import { resolveText } from "../../../viewer/core/localized-text";
import { interpolate, t } from "../../localization/editor-ui-strings";
import styles from "./guide-outline.scss?inline";
import { GuideHealthService, type GuideHealthContext } from "../../services/guide-health-service";
import { ProvingTrailService } from "../../services/proving-trail-service";
import { QuestionOptionsService } from "../../../viewer/services/question-options-service";
import { RuleCasesService } from "../../../viewer/services/rule-cases-service";
import { displayNodeTypeLabel } from "../../services/template-library";
import { NODE_ICONS } from "../../../viewer/node-types/node-icons";
import { getNodeType, isEndingNodeType } from "../../../viewer/node-types/node-type-registry";

import type { ProvingState } from "../../services/proving-trail-service";
import type { FlowNodeData, GraphData } from "../../../viewer/types/graph";

interface OutlineRow {
  kind: "node" | "branch" | "back";
  nodeId?: string;
  nodeType?: string;
  label: string;
  depth: number;
  again?: boolean;
  branchKey?: string;
  /** A required field: the card's asterisk (story 077), here too. */
  required?: boolean;
}

export class GuideOutline extends HTMLElement {
  private root: ShadowRoot;
  private graphValue: GraphData | null = null;
  private selectedValue: string | null = null;
  private provingValue: ProvingState | null = null;
  private collapsed = new Set<string>();
  private collapsedInitialized = false;

  activeLocale = "sv";
  uiLocale = "sv";
  /** Set by the editor before `graph`, so the list and the check row judge alike. */
  healthContext: GuideHealthContext = {};

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }

  set graph(value: GraphData | null) {
    this.graphValue = value;
    this.collapsedInitialized = false;
    this.render();
  }

  set selectedNodeId(value: string | null) {
    this.selectedValue = value;
    this.render();
  }

  /**
   * Provet (story 076): samma tillstånd som canvasen får, ur samma
   * härledning — listan är en tredje spegel av den enda motorn. Ett byte
   * av steg rullar in raden, som canvasen panorerar dit.
   */
  set proving(value: ProvingState | null) {
    const moved = value?.currentNodeId !== this.provingValue?.currentNodeId;

    this.provingValue = value;
    this.render();

    if (moved && value && !value.stale) {
      this.root
        .querySelector("[data-outline-row][data-current]")
        ?.scrollIntoView({ block: "nearest" });
    }
  }

  get proving(): ProvingState | null {
    return this.provingValue;
  }

  private text(key: string, params?: Record<string, string | number>): string {
    const resolved = t(key, this.uiLocale);

    return params ? interpolate(resolved, params) : resolved;
  }

  connectedCallback(): void {
    this.render();
  }

  private rowTitle(node: FlowNodeData): string {
    const text = resolveText(node.data.title, this.activeLocale, "").trim();

    return (
      text || displayNodeTypeLabel(node.type, getNodeType(node.type)?.label, this.uiLocale)
    );
  }

  /**
   * The type's icon, the same silhouette the node header and the palette
   * draw, out of the same register (Johan 3/9: the list should mirror the
   * structure view's icons). aria-hidden — the type is in the word beside
   * it. A custom type keeps its typed icon; a type with neither shows none.
   */
  private typeIcon(type: string): string {
    const drawn = NODE_ICONS[type];
    const typed = getNodeType(type)?.icon;
    const glyph = drawn ?? (typed ? escapeHtml(typed) : "");

    return glyph
      ? `<span class="guide-outline__icon" data-outline-icon aria-hidden="true">${glyph}</span>`
      : "";
  }

  /** Portens svarsetikett — alternativ eller regelutfall; continue är namnlös. */
  private branchLabel(node: FlowNodeData, portId: string): string | null {
    if (portId === "continue") return null;
    const option = QuestionOptionsService.getOptions(node).find(
      (candidate) => candidate.id === portId,
    );

    if (option) return resolveText(option.label, this.activeLocale, option.id);
    const fall = RuleCasesService.getCases(node).find(
      (candidate) => candidate.id === portId,
    );

    return fall ? fall.label : portId;
  }

  private rows(): OutlineRow[] {
    const graph = this.graphValue;

    if (!graph || !graph.startNodeId) return [];
    const byId = new Map(graph.nodes.map((node) => [node.id, node]));
    const childrenOf = (pageId: string) =>
      graph.nodes
        .filter((node) => node.parentPageId === pageId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const out: OutlineRow[] = [];
    const seen = new Set<string>();

    const walk = (nodeId: string, depth: number, path: Set<string>, branchKey: string): void => {
      const node = byId.get(nodeId);

      if (!node) return;

      if (path.has(nodeId)) {
        out.push({ kind: "back", label: this.rowTitle(node), depth, branchKey });
        return;
      }

      out.push({
        kind: "node",
        nodeId,
        nodeType: node.type,
        label: this.rowTitle(node),
        depth,
        again: seen.has(nodeId),
        branchKey,
        required: node.data.required === true,
      });
      seen.add(nodeId);

      for (const child of childrenOf(nodeId)) {
        out.push({
          kind: "node",
          nodeId: child.id,
          nodeType: child.type,
          label: this.rowTitle(child),
          depth: depth + 1,
          again: seen.has(child.id),
          branchKey,
          required: child.data.required === true,
        });
        seen.add(child.id);
      }

      const nextPath = new Set(path);

      nextPath.add(nodeId);
      const exits = graph.connections.filter(
        (connection) => connection.from.nodeId === nodeId,
      );

      for (const connection of exits) {
        const label = this.branchLabel(node, connection.from.portId);

        if (label !== null && exits.length > 1) {
          const key = `${nodeId}:${connection.from.portId}`;

          out.push({ kind: "branch", label, depth: depth + 1, branchKey: key });
          walk(connection.to.nodeId, depth + 2, nextPath, key);
        } else {
          walk(connection.to.nodeId, depth, nextPath, branchKey);
        }
      }
    };

    walk(graph.startNodeId, 0, new Set(), "");
    return out;
  }

  private render(): void {
    const graph = this.graphValue;
    const rows = this.rows();

    /* Stora guider öppnar hopfällda — grenrubrikerna bär "N steg". */
    if (!this.collapsedInitialized && graph) {
      this.collapsed = new Set(
        graph.nodes.length > 15
          ? rows.filter((row) => row.kind === "branch").map((row) => row.branchKey!)
          : [],
      );
      this.collapsedInitialized = true;
    }

    const issues = graph ? GuideHealthService.analyze(graph, this.healthContext) : [];
    const sjuka = new Map<string, string>();

    for (const issue of issues) {
      const id = (issue as { nodeId?: string }).nodeId;

      if (id && !sjuka.has(id)) sjuka.set(id, issue.message);
    }

    const inHidden = (row: OutlineRow): boolean => {
      // En rad är dold om dess gren (eller någon förälders gren) är hopfälld —
      // grenrubriken själv visas alltid.
      if (row.kind === "branch") return false;
      return row.branchKey !== "" && this.collapsed.has(row.branchKey!);
    };

    const stepsIn = (key: string): number =>
      rows.filter((row) => row.kind === "node" && row.branchKey === key).length;

    /* Provet: tänt där det varit och står, dämpat därutöver — som canvasen. */
    const proving = this.provingValue;
    const running = graph !== null && proving !== null && !proving.stale;
    const trail = running ? ProvingTrailService.trailPorts(graph, proving) : new Map();
    const answered = running ? ProvingTrailService.answeredNodes(graph, proving) : new Set<string>();
    const steps = running ? ProvingTrailService.stepNumbers(graph, proving, answered) : new Map();
    const provingMark = (id: string): string => {
      const current = running && id === proving.currentNodeId;

      if (!current && !answered.has(id)) return "";
      const label = this.text(current ? "editor.node.here" : "editor.node.answered");

      return `<span class="guide-outline__proving-mark" data-proving-mark role="img" aria-label="${escapeHtml(label)}">${
        current ? '<i class="guide-outline__proving-dot"></i>' : "✓"
      }</span>`;
    };
    const stepBadge = (id: string): string => {
      const step = steps.get(id);

      return step === undefined
        ? ""
        : `<span class="guide-outline__step">${escapeHtml(this.text("editor.node.stepBadge", { step }))}</span>`;
    };

    this.root.innerHTML = `
      <style>${styles}</style>
      <div class="guide-outline" role="tree" ${running ? "data-proving" : ""}>
        ${rows
          .map((row) => {
            if (row.kind === "branch") {
              const closed = this.collapsed.has(row.branchKey!);
              // The branch is the port: lit when the run left through it,
              // like the connection on the canvas.
              const [fromId, portId] = (row.branchKey ?? "").split(":");
              const taken = running && (trail.get(fromId) ?? []).includes(portId);

              return `
                <button type="button" class="guide-outline__branch" data-branch="${escapeHtml(row.branchKey ?? "")}"
                  ${taken ? "data-trail" : ""}
                  aria-expanded="${!closed}" style="--depth: ${row.depth};">
                  <span class="guide-outline__om">↳ om</span> ${escapeHtml(row.label)}
                  ${closed ? `<span class="guide-outline__count">${stepsIn(row.branchKey!)} steg</span>` : ""}
                </button>`;
            }
            if (inHidden(row)) return "";
            if (row.kind === "back") {
              return `<p class="guide-outline__back" style="--depth: ${row.depth};">↩ ${escapeHtml(row.label)}</p>`;
            }
            const sjuk = sjuka.get(row.nodeId ?? "");
            const id = row.nodeId ?? "";
            const runState = !running
              ? ""
              : id === proving.currentNodeId
                ? "data-current"
                : answered.has(id)
                  ? "data-answered"
                  : trail.has(id)
                    ? "data-trail"
                    : "";

            return `
              <div class="guide-outline__row" data-outline-row data-node-id="${escapeHtml(id)}"
                data-node-type="${escapeHtml(row.nodeType ?? "")}"${isEndingNodeType(row.nodeType ?? "") ? " data-ending" : ""} ${runState}
                role="treeitem" tabindex="0" aria-selected="${row.nodeId === this.selectedValue}"
                ${row.required ? `aria-label="${escapeHtml(`${row.label} (${this.text("editor.node.required")})`)}"` : ""}
                style="--depth: ${row.depth};">
                ${stepBadge(id)}
                ${this.typeIcon(row.nodeType ?? "")}
                <span class="guide-outline__label">${escapeHtml(row.label)}${
                  row.required ? ' <span class="guide-outline__required" aria-hidden="true">*</span>' : ""
                }</span>
                ${provingMark(id)}
                ${row.again ? `<button type="button" class="guide-outline__again" data-outline-routes aria-label="${this.text("editor.toolbar.routesHere")}" title="${this.text("editor.toolbar.routesHere")}">⇄</button>` : ""}
                ${sjuk ? `<span class="guide-outline__health" data-outline-health role="img" aria-label="${escapeHtml(sjuk)}">⚠</span>` : ""}
              </div>`;
          })
          .join("")}
      </div>
    `;

    this.bind();
  }

  private bind(): void {
    this.root.querySelectorAll<HTMLElement>("[data-outline-row]").forEach((row) => {
      const pick = () =>
        this.dispatchEvent(
          new CustomEvent("outline-select", {
            detail: { nodeId: row.dataset.nodeId },
            bubbles: true,
            composed: true,
          }),
        );

      row.addEventListener("click", pick);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          pick();
        }
      });
    });
    this.root.querySelectorAll<HTMLElement>("[data-branch]").forEach((knapp) => {
      knapp.addEventListener("click", () => {
        const key = knapp.dataset.branch ?? "";

        if (this.collapsed.has(key)) this.collapsed.delete(key);
        else this.collapsed.add(key);
        this.render();
      });
    });
    this.root.querySelectorAll<HTMLElement>("[data-outline-routes]").forEach((knapp) => {
      knapp.addEventListener("click", (event) => {
        event.stopPropagation();
        const row = knapp.closest<HTMLElement>("[data-outline-row]");

        this.dispatchEvent(
          new CustomEvent("outline-routes", {
            detail: { nodeId: row?.dataset.nodeId },
            bubbles: true,
            composed: true,
          }),
        );
      });
    });
  }
}

if (!customElements.get("guide-outline")) {
  customElements.define("guide-outline", GuideOutline);
}
