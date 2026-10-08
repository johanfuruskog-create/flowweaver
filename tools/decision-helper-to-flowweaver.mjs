#!/usr/bin/env node
/*
 * Sitevision "Beslutsträd" (Limepark `app-decision-helper`) → FlowWeaver guide.
 *
 * ## Why this exists
 *
 * migrationsverket.se has three guides built with Limepark's Beslutsträd
 * module, and its whole definition sits in the page as JSON:
 * `AppRegistry.registerInitialState('<portlet>', {...questions...})`. The
 * shape is FlowWeaver's own — a question with options, each option pointing
 * at the next question or ending the guide with a result — so a guide an
 * agency already has can be opened in the FlowWeaver editor rather than
 * retyped. That is the demo: *your guide, in our tool, with the health check
 * on.* Johan, 7/9 2026.
 *
 * ## What the module's model looks like
 *
 * - `questions[]`, in editor order. `type_single` (radio/select),
 *   `type_multiple`, `type_text` (text/textarea/number).
 * - `options[]` per question. `option.action` is `{type, q}`:
 *   `action_question` → jump to question `q`; `action_end` → show the result;
 *   `none` → the next question in list order (the module's default).
 * - `option.result` is what the option adds to the result:
 *   `result_text` carries `text`; `result_content` points at a Sitevision
 *   page, whose HTML is rendered server-side per path (`/appresource/…`) and
 *   is `null` in the state. Pass `--results` with a map from option id to that
 *   HTML if you fetched it; otherwise the result gets a placeholder the
 *   health check will flag.
 * - Scenarios (`actionScenarios`, `resultScenarios`, `mustbe`/`morethan`/
 *   `lessthan` conditions on other questions) are the module's rules. They
 *   are not converted yet — the tool reports them so nobody believes a
 *   converted guide is complete when it is not.
 *
 * ## Results are per option
 *
 * Measured on *Vem får du anställa?*: 69 end paths, 36 end options, and the
 * result of every path equals the result of its last option. Without
 * scenarios the module accumulates nothing, so one result node per end
 * option is the faithful conversion — and options that end with identical
 * text share a node, which is how the hand-made version was drawn too.
 *
 * Usage:
 *   node tools/decision-helper-to-flowweaver.mjs <page.html|state.json>
 *        [--results map.json] [--locale sv] > guide.json
 *
 * Reads a saved page (finds the guide in it) or the state JSON itself. Never
 * fetches anything — one page at a time, by hand, is the rule for other
 * people's sites. The result HTML for one path comes from
 * `/appresource/<pageId>/<portletId>/?q_<qid>=<optId>&…&active=q_<last qid>
 * &svAjaxReqParam=ajax` (the page id is `pageId:` in the page's scripts); keep
 * it to one request at a time with a pause. The three guides converted this
 * way lived in `examples/imported/` until 2026-10-07, when they were removed
 * (decision 8: an agency's text does not ship with the open FlowWeaver).
 */
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith("--"));
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
if (!input) {
  console.error("usage: decision-helper-to-flowweaver.mjs <page.html|state.json> [--results map.json] [--locale sv]");
  process.exit(2);
}
const locale = flag("--locale") ?? "sv";
const resultsMap = flag("--results") ? JSON.parse(readFileSync(flag("--results"), "utf8")) : {};

/* ---------- reading the definition ---------- */

function readState(source) {
  const text = readFileSync(source, "utf8");
  if (text.trimStart().startsWith("{")) return JSON.parse(text);
  // A saved page: the guide is the registerInitialState call whose state has questions.
  const marker = /registerInitialState\('(12\.[a-z0-9]+)',/g;
  let m;
  while ((m = marker.exec(text))) {
    const state = firstJsonObject(text, m.index + m[0].length);
    if (state && Array.isArray(state.questions)) return state;
  }
  throw new Error("no decision-helper state with questions in " + source);
}

// JSON.parse on the object that starts at `from`, found by brace matching outside strings.
function firstJsonObject(text, from) {
  let depth = 0, inString = false, escaped = false;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(from, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

/* ---------- HTML → the editor's formatted text ---------- */

const decodeEntities = (s) =>
  s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

/**
 * The result markup is a Sitevision text portlet: `<p>`, `<br>`, `<a>`,
 * `<strong>`, lists. The editor's description field is a small markdown —
 * paragraphs, `- ` bullets, `**bold**`, `[label](url)` — so that is what
 * comes out, and anything else is flattened to its text.
 */
function htmlToFormatted(html) {
  let s = html;
  s = s.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => `[${label.replace(/<[^>]+>/g, "").trim()}](${decodeEntities(href)})`);
  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
  s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");
  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, item) => "\n- " + item.trim());
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|ul|ol|h[1-6]|div)>/gi, "\n\n");
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  return s.split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function plain(text) {
  return decodeEntities(String(text ?? "")).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/* ---------- the conversion ---------- */

const state = readState(input);
const questions = state.questions;
const byId = new Map(questions.map((q) => [q.id, q]));
const notes = [];
const L = (text) => ({ [locale]: text });

function nextOf(question, action) {
  if (action?.type === "action_question" && byId.has(action.q)) return { kind: "question", id: action.q };
  if (action?.type === "action_end") return { kind: "end" };
  const following = questions[questions.indexOf(question) + 1];
  return following ? { kind: "question", id: following.id } : { kind: "end" };
}

function resultTextOf(option) {
  const r = option.result ?? {};
  const fetched = resultsMap[option.id];
  if (fetched) return htmlToFormatted(fetched);
  if (r.type === "result_text" && r.text) return plain(r.text);
  if (r.type === "result_content" && r.text) return plain(r.text);
  return "";
}

const nodes = [];
const connections = [];
const resultByText = new Map();
let connectionCount = 0;
const connect = (fromNode, portId, toNode) =>
  connections.push({ id: `c${++connectionCount}`, from: { nodeId: fromNode, portId }, to: { nodeId: toNode, portId: "input" } });

// Depth per question for a left-to-right layout: the longest path from the start.
const depth = new Map();
(function walk(id, d) {
  if ((depth.get(id) ?? -1) >= d) return;
  depth.set(id, d);
  const q = byId.get(id);
  for (const o of q.options ?? []) {
    const next = nextOf(q, o.action);
    if (next.kind === "question") walk(next.id, d + 1);
  }
  if (q.type === "type_text") {
    const next = nextOf(q, q.action);
    if (next.kind === "question") walk(next.id, d + 1);
  }
})(questions[0].id, 0);

// Each column stacks its nodes by their rendered height, estimated from the
// text: a result card is ~240 px wide, ~38 characters a line, 20 px a line.
// A fixed row made long answers overlap their neighbour (seen on the canvas).
const COLUMN = 520, GAP = 40;
const yAtDepth = new Map();
const place = (d, lines) => {
  const y = yAtDepth.get(d) ?? 0;
  yAtDepth.set(d, y + 110 + lines * 20 + GAP);
  return { x: d * COLUMN, y };
};
const linesOf = (text) => text.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 38)), 0);

for (const q of questions) {
  const d = depth.get(q.id);
  if (d === undefined) {
    notes.push(`fråga utan väg in: "${plain(q.text)}" (${q.id})`);
    continue;
  }
  const scenarioCount = (q.actionScenarios?.length ?? 0) + (q.resultScenarios?.length ?? 0)
    + (q.options ?? []).reduce((n, o) => n + (o.action?.scenarios?.length ?? 0) + (o.result?.scenarios?.length ?? 0), 0);
  if (scenarioCount) notes.push(`${scenarioCount} scenarier på "${plain(q.text)}" är inte konverterade`);

  let description = plain(q.description);
  if (q.useDescLink && q.descLink?.url) description += ` [${plain(q.descLink.text || q.descLink.url)}](${q.descLink.url})`;
  const many = (q.options?.length ?? 0) > 8;

  if (q.type === "type_text") {
    const numeric = q.textType === "number";
    nodes.push({
      id: q.id, type: numeric ? "number-question" : "text-question", position: place(d, 2),
      data: { title: L(plain(q.text)), description: L(description), variableName: `f_${q.id}`, required: Boolean(q.mustBeAnswered) },
    });
    const next = nextOf(q, q.action);
    if (next.kind === "question") connect(q.id, "continue", next.id);
    else connect(q.id, "continue", resultNode(q, q, d + 1));
    continue;
  }

  nodes.push({
    id: q.id, type: q.type === "type_multiple" ? "multi-choice" : "question", position: place(d, 2 + (q.options?.length ?? 0) * 2),
    data: {
      title: L(plain(q.text)),
      description: L(description),
      presentation: q.presentation === "presentation_select" ? "select" : many ? "search" : "radio",
      variableName: "",
      variableLabel: "",
      options: (q.options ?? []).map((o) => ({ id: o.id, label: L(plain(o.text)), value: o.id })),
    },
  });
  if (!q.mustBeAnswered && q.type === "type_single") {
    notes.push(`"${plain(q.text)}" är inte obligatorisk i modulen — Nästa utan svar hoppar till nästa fråga i ordningen`);
  }
  for (const o of q.options ?? []) {
    const next = nextOf(q, o.action);
    if (next.kind === "question") connect(q.id, o.id, next.id);
    else connect(q.id, o.id, resultNode(q, o, d + 1));
  }
}

function resultNode(question, option, d) {
  const text = resultTextOf(option);
  const key = text || `tom:${option.id}`;
  if (resultByText.has(key)) return resultByText.get(key);
  const id = `r_${option.id}`;
  if (!text) notes.push(`resultatet efter "${plain(option.text ?? question.text)}" saknar text (${option.id})`);
  nodes.push({
    id, type: "result", position: place(d, linesOf(text)),
    data: { title: L(state.heading || "Svar"), description: L(text) },
  });
  resultByText.set(key, id);
  return id;
}

const graph = {
  version: 10,
  startNodeId: questions[0].id,
  settings: { sourceLocale: locale },
  nodes,
  connections,
};

process.stdout.write(JSON.stringify(graph, null, 2) + "\n");
console.error(`${questions.length} frågor → ${nodes.length} noder, ${connections.length} kopplingar`);
for (const note of notes) console.error("  ! " + note);
