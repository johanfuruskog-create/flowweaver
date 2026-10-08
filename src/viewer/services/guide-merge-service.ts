import { GuideDiffService } from "./guide-diff-service";

import type { GuideChange, GuideChangeKind } from "./guide-diff-service";
import type { Connection, FlowNodeData, GraphData } from "../types/graph";

/**
 * Två har ändrat guiden, och nästan ingenting överlappar (berättelse 131).
 *
 * ## Varför den finns
 *
 * Berättelse 129 gav den vars sparning krockade ett val mellan två sorters
 * förlust: kasta mitt, eller skriva över hennes. Johan 19/9: *"kan vi inte
 * spara det och att man godkänner grej för grej"*. Och när frågan ställdes en
 * gång till — *"Kan vi helt undvika bortfall?"* — blev svaret att bortfallet
 * bara finns kvar där två rört **samma** sak, och att det är sällsynt.
 *
 * Så: räkna vad var och en ändrat sedan den gemensamma utgångspunkten, behåll
 * båda där de rört olika saker, och fråga bara om det som verkligen krockar.
 *
 * ## Tre grafer, och utgångspunkten är den som brukar saknas
 *
 * `base` är arbetskopian som min sida **läste** — den vi båda utgick från.
 * Utan den går det inte att skilja *hon lade till* från *jag tog bort*: två
 * grafer räcker för att se att de skiljer sig, aldrig för att veta vem som
 * gjorde vad. Sidan håller den i minnet vid varje lyckad läsning och sparning
 * (`guide-storage.ts`).
 *
 * ## Vad som jämförs, och vad som aldrig blir en rad
 *
 * Listan kommer ur `GuideDiffService.compare`, som tillämpar `visitorContent`
 * själv: en nod någon dragit över arbetsytan är ingen ändring att välja
 * mellan, och en lista som frågar om koordinater är en lista ingen läser klart.
 * `apply` jämför samma sak — `contentOf` lyfter bort positionen, och `color`
 * på en koppling är enda fältet som skiljer de två utsnitten åt; en färg som
 * följer med är ingen fråga någon behöver få.
 *
 * Positionerna följer ändå med i resultatet — se `withPosition` — de är bara
 * aldrig en fråga.
 *
 * ## Radens korn: en diff-rad, inte ett fält
 *
 * Raderna är `GuideDiffService`s, en per *slag och nod* (`content:n-1`,
 * `route:n-1`). Två personer som ändrat olika **fält** i samma nod får därför
 * en markerad rad även om fälten inte rör varandra. Det är med flit
 * konservativt: rutan frågar hellre en gång för mycket än slår ihop två texter
 * till en mening ingen skrev. Motsatt håll är exakt — olika **slag** på samma
 * nod (hon skrev om frågan, jag flyttade fältet) är två rader utan överlapp,
 * och båda följer med.
 *
 * ## Var den bor
 *
 * `src/viewer/services/`, bredvid diff-tjänsten och ovanpå samma
 * `visitorContent`. Ingen besökare slår ihop något — men **formen** den
 * resonerar om är grafens, och grafens mening bor här. Den importerar
 * ingenting ur editorn; `entries.test.ts` följer importgrafen och skulle säga
 * ifrån.
 */

/** Vems ändring som ska gälla på en rad som krockar. */
export type MergeSide = "theirs" | "mine";

/**
 * En sida av en rad: vad som hände, och vad det blev.
 *
 * `message` är granskningens mening, och den räcker för allt utom det som
 * avgör ett val: **vad var och en skrev**. Johan mätte det 20/9 — båda
 * meningarna sa *rubriken har ändrats* och skillnaden var ett enda ord inbakat
 * i en lång mening, så valet *Annas* / *Min* gjordes i blindo.
 *
 * `after` är därför det nya värdet, där ändringen har ett: en rubrik, ett
 * alternativs namn, en väg som leder någon annanstans. Saknas det — *något
 * annat har ändrats*, *steget har tagits bort* — finns ingen text att ställa
 * mot en annan, och raden säger det den vet.
 */
export interface MergeLine {
  message: string;
  after?: string;
}

export interface MergeRow {
  /**
   * Radens nyckel, och valets: `content:n-1`. Stabil mellan `plan` och
   * `apply`, så ett val gjort i rutan betyder samma sak när grafen byggs.
   */
  id: string;
  kind: GuideChangeKind;
  nodeId: string;
  /** Nodens rubrik, i guidens eget språk. */
  title: string;
  /** Deras rader, som granskningen skriver dem. Tom när de inte rört det. */
  theirs: MergeLine[];
  /** Mina. Tom när jag inte rört det. */
  mine: MergeLine[];
  /**
   * Båda har rört samma sak, olika. Kräver ett val innan grafen går att bygga.
   */
  overlap: boolean;
  /**
   * Båda har gjort **samma** ändring. Ingen fråga att ställa — raden står
   * dämpad, för att den som läser listan ska se att den är genomläst och inte
   * undra vart posten tog vägen.
   */
  resolved: boolean;
}

export interface MergePlan {
  rows: MergeRow[];
  /** Raderna som kräver ett val, i den ordning rutan ställer dem. */
  overlaps: MergeRow[];
  /** Graferna, burna med planen så `apply` inte kan få andra tre. */
  base: GraphData;
  theirs: GraphData;
  mine: GraphData;
}

export interface MergeResult {
  graph: GraphData;
  /**
   * Kopplingar som togs bort för att de hängde i luften efter valen — en väg
   * till en nod som den ena tog bort och den andra inte ändrade.
   *
   * Aldrig tyst: en graf med en väg till ingenting går sönder för en besökare,
   * och en sammanslagning som städar utan att säga det har kastat något.
   */
  droppedConnections: string[];
  /** Överlapp som saknade val. Tom lista betyder att grafen är hel. */
  unanswered: string[];
}

const KIND_ORDER: GuideChangeKind[] = ["start", "node", "route", "option", "content", "page"];

export class GuideMergeService {
  /**
   * Vad var och en ändrat sedan utgångspunkten, sida vid sida.
   *
   * Oförändrat finns inte i listan — det är hela poängen med att jämföra mot
   * `base` i stället för att ställa två grafer mot varandra. Två guider som är
   * lika sånär som på en fråga skiljer sig i den frågan; två **ändringslistor**
   * mot en gemensam utgångspunkt skiljer sig i det någon faktiskt gjort.
   */
  static plan(base: GraphData, theirs: GraphData, mine: GraphData): MergePlan {
    const theirChanges = GuideDiffService.compare(base, theirs);
    const myChanges = GuideDiffService.compare(base, mine);
    const rows = new Map<string, MergeRow>();

    const rowFor = (change: GuideChange): MergeRow => {
      const id = `${change.kind}:${change.nodeId}`;
      const held = rows.get(id);

      if (held) {
        return held;
      }

      const fresh: MergeRow = {
        id,
        kind: change.kind,
        nodeId: change.nodeId,
        title: change.title,
        theirs: [],
        mine: [],
        overlap: false,
        resolved: false,
      };

      rows.set(id, fresh);

      return fresh;
    };

    const lineOf = (change: GuideChange): MergeLine =>
      change.after === undefined
        ? { message: change.message }
        : { message: change.message, after: change.after };

    for (const change of theirChanges) {
      rowFor(change).theirs.push(lineOf(change));
    }

    for (const change of myChanges) {
      rowFor(change).mine.push(lineOf(change));
    }

    /*
     * **Borttagen mot ändrad**, som annars blir två rader som inte vet om
     * varandra.
     *
     * Tar Anna bort noden och jag skriver om dess fråga säger diff-tjänsten
     * *steget togs bort* på hennes sida och *frågans text ändrades* på min —
     * två skilda nycklar (`node:n-1` och `content:n-1`), ingen med båda
     * spalterna fyllda, alltså ingen krock. Och det ÄR en krock: *Annas* tar
     * bort noden, *Min* behåller den med min text (berättelsen, punkt 4).
     *
     * Så en nod som en av oss tagit bort samlar allt som sagts om den i **en**
     * rad. Slaget blir `node`, för det är det som står på spel — resten av
     * raderna handlar om innehållet i något som kanske inte ska finnas.
     */
    const removed = removedBySide(base, theirs, mine);

    for (const [nodeId, side] of removed) {
      const gathered: MergeRow = {
        id: `node:${nodeId}`,
        kind: "node",
        nodeId,
        title: rows.get(`node:${nodeId}`)?.title ?? "",
        theirs: [],
        mine: [],
        overlap: false,
        resolved: false,
      };

      for (const [id, row] of [...rows]) {
        if (row.nodeId !== nodeId) {
          continue;
        }

        gathered.title = gathered.title === "" ? row.title : gathered.title;
        gathered.theirs.push(...row.theirs);
        gathered.mine.push(...row.mine);
        rows.delete(id);
      }

      /*
       * Bara när den andra sidan faktiskt sa något om noden. En nod som Anna
       * tog bort och jag aldrig rörde är ingen fråga — den är borta, och det
       * står som en vanlig rad.
       */
      const other = side === "theirs" ? gathered.mine : gathered.theirs;

      gathered.overlap = other.length > 0;
      rows.set(gathered.id, gathered);
    }

    for (const row of rows.values()) {
      if (row.overlap) {
        continue;
      }

      const both = row.theirs.length > 0 && row.mine.length > 0;

      /*
       * *Samma ändring av båda* mäts på **meningarna**, och det är avsiktligt.
       *
       * Meningen är vad diff-tjänsten säger att ändringen är, ur
       * `visitorContent` — alltså exakt den upplösning listan visar. Två
       * personer som skrivit samma nya text i samma fält får samma mening, och
       * en rad som då frågar *Annas eller min?* om två identiska svar är en
       * fråga utan innehåll.
       *
       * Mätt mot alternativet att jämföra noderna djupt: det hade svarat *inte
       * lika* på två noder som skiljer sig i en position, och positioner är
       * inte en fråga (se toppkommentaren).
       */
      row.resolved = both && same(row.theirs, row.mine);
      row.overlap = both && !row.resolved;
    }

    const ordered = [...rows.values()].sort(byKind);

    return {
      rows: ordered,
      overlaps: ordered.filter((row) => row.overlap),
      base,
      theirs,
      mine,
    };
  }

  /**
   * Grafen som blir kvar — båda ändringarna där de inte krockar, det valda där
   * de gör det.
   *
   * ## Vad valet gäller
   *
   * Ett val på `content:n-1` gäller **noden**, inte fältet: raden är radens
   * korn (se toppkommentaren), och en ruta som frågar om en rad och sedan
   * slår ihop halva den har svarat på en annan fråga än den ställde. Ett val
   * på `route:n-1` gäller vägarna **ut ur** den noden; `start` gäller var
   * guiden börjar.
   *
   * ## Och varför grafen byggs ur `base` och inte ur någonderas
   *
   * Att börja i deras och lägga på mina ändringar hade krävt en lista över
   * *vad en ändring är* — alltså en andra definition bredvid diff-tjänstens,
   * och det är den här kodbasens vanligaste fel. Här jämförs i stället tre
   * värden per sak: oförändrat hos den ena betyder att den andras gäller, och
   * lika hos båda betyder att ingen frågar.
   */
  static apply(plan: MergePlan, choices: Record<string, MergeSide>): MergeResult {
    const unanswered = plan.overlaps
      .filter((row) => choices[row.id] !== "theirs" && choices[row.id] !== "mine")
      .map((row) => row.id);

    const base = plan.base;
    const theirs = plan.theirs;
    const mine = plan.mine;
    const chosen = (id: string): MergeSide | null => {
      const side = choices[id];

      return side === "theirs" || side === "mine" ? side : null;
    };

    /* ── Var guiden börjar ───────────────────────────────────────────────── */

    const startRow = plan.rows.find((row) => row.kind === "start");
    const startNodeId = pick(
      base.startNodeId,
      theirs.startNodeId,
      mine.startNodeId,
      startRow ? chosen(startRow.id) : null,
    );

    /* ── Noderna ─────────────────────────────────────────────────────────── */

    const { nodes, kept } = mergeNodes(base, theirs, mine, (nodeId) =>
      sideForNode(plan, chosen, nodeId),
    );

    /* ── Vägarna ─────────────────────────────────────────────────────────── */

    const connections = mergeConnections(base, theirs, mine, (fromNodeId) =>
      chosen(`route:${fromNodeId}`),
    );

    /*
     * Och valideringen: inga hängande vägar.
     *
     * En koppling till en nod som inte finns i resultatet är inte ett
     * skönhetsfel — visaren följer den och hamnar ingenstans. Den tas bort och
     * **räknas**, så rutan kan säga det i stället för att städa i tysthet.
     */
    const dropped: string[] = [];
    const whole = connections.filter((link) => {
      const ok = kept.has(link.from.nodeId) && kept.has(link.to.nodeId);

      if (!ok) {
        dropped.push(link.id);
      }

      return ok;
    });

    /*
     * Resten av guiden tas ur **min** kopia: inställningarna, mallarna,
     * `extra`. De är inte en rad i listan (diff-tjänsten läser dem inte), och
     * den som sitter med rutan öppen är den som senast såg dem. En
     * inställningsändring hos den andre som går förlorad här är den enda kända
     * luckan, och den står i berättelsens *Utanför* som ordval per guide.
     */
    return {
      graph: {
        ...mine,
        startNodeId,
        nodes,
        connections: whole,
      },
      droppedConnections: dropped,
      unanswered,
    };
  }
}

/**
 * Vilken sida som valts för en nod — oavsett vilket slag raden hade.
 *
 * En nod kan ha flera rader (`content:n-1` och `page:n-1`), och en enda av dem
 * kan vara en krock. Valet på den raden gäller då hela noden: se `apply`.
 * Finns flera krockande rader för samma nod och de valts olika vinner den
 * **första i läsordningen** — vilket är den rad som står överst i rutan, och
 * alltså den den som valde läste först.
 */
function sideForNode(
  plan: MergePlan,
  chosen: (id: string) => MergeSide | null,
  nodeId: string,
): MergeSide | null {
  for (const row of plan.overlaps) {
    if (row.nodeId === nodeId && row.kind !== "route" && row.kind !== "start") {
      const side = chosen(row.id);

      if (side) {
        return side;
      }
    }
  }

  return null;
}

/**
 * Noderna, en identitet i taget.
 *
 * `id` bär identiteten genom allt (berättelse 124 fryser versioner ordagrant
 * och *Återställ* skriver inte om något), så *ändrad* går att skilja från
 * *borttagen och tillagd*. Utan det hade varje sammanslagning varit en fråga
 * om allt.
 *
 * **Positionen är aldrig en fråga.** Den jämförs för sig, efter innehållet:
 * har jag flyttat noden är den min, annars deras. Besökaren ser den inte, och
 * en ruta som ber någon välja mellan två koordinatpar har slutat handla om
 * guiden.
 */
function mergeNodes(
  base: GraphData,
  theirs: GraphData,
  mine: GraphData,
  sideFor: (nodeId: string) => MergeSide | null,
): { nodes: FlowNodeData[]; kept: Set<string> } {
  const wasNodes = byId(base.nodes ?? []);
  const theirNodes = byId(theirs.nodes ?? []);
  const myNodes = byId(mine.nodes ?? []);
  const order = [...new Set([...(mine.nodes ?? []), ...(theirs.nodes ?? [])].map((one) => one.id))];
  const nodes: FlowNodeData[] = [];
  const kept = new Set<string>();

  for (const id of order) {
    const was = wasNodes.get(id);
    const their = theirNodes.get(id);
    const my = myNodes.get(id);
    const side = sideFor(id);

    /*
     * Ett val gäller hela noden, också när valet är *borta*: *Annas* på en rad
     * där hon tog bort noden och jag ändrade dess text tar bort den. Det är
     * vad raden sa, och en sammanslagning som behåller något den lovat ta bort
     * är värre än en som frågar.
     */
    if (side) {
      const won = side === "theirs" ? their : my;

      if (won) {
        nodes.push(withPosition(won, was, my, their));
        kept.add(id);
      }

      continue;
    }

    /*
     * Ingen krock på noden. Fyra fall, och tre av dem är svar utan fråga:
     * bara en av oss rörde den, eller ingen gjorde det.
     */
    const theyChanged = !sameValue(contentOf(was), contentOf(their));
    const iChanged = !sameValue(contentOf(was), contentOf(my));

    if (!theyChanged && !iChanged) {
      // Orörd av båda — eller borttagen av båda, vilket är samma svar.
      if (my ?? their) {
        nodes.push(withPosition((my ?? their)!, was, my, their));
        kept.add(id);
      }

      continue;
    }

    const won = theyChanged && !iChanged ? their : !theyChanged && iChanged ? my : (my ?? their);

    /*
     * Båda ändrade, ingen krockrad: olika **slag** på samma nod — hon skrev om
     * frågan, jag flyttade fältet. Fältvis, mot utgångspunkten: det värde som
     * skiljer sig från `base` vinner, och lika värden är inget att välja
     * mellan.
     */
    const merged =
      theyChanged && iChanged && their && my ? mergeValue(was, their, my) : (won ?? null);

    if (merged) {
      nodes.push(withPosition(merged as FlowNodeData, was, my, their));
      kept.add(id);
    }
  }

  return { nodes, kept };
}

/**
 * Kopplingarna, med `id` som identitet — samma regel som noderna.
 *
 * Valet ligger på den nod vägen går **ut ur**, för det är så raden är
 * formulerad: *Ja leder nu till Besked* handlar om frågan, inte om linjen.
 */
function mergeConnections(
  base: GraphData,
  theirs: GraphData,
  mine: GraphData,
  sideFor: (fromNodeId: string) => MergeSide | null,
): Connection[] {
  const wasLinks = byId(base.connections ?? []);
  const theirLinks = byId(theirs.connections ?? []);
  const myLinks = byId(mine.connections ?? []);
  const order = [
    ...new Set([...(mine.connections ?? []), ...(theirs.connections ?? [])].map((one) => one.id)),
  ];
  const links: Connection[] = [];

  for (const id of order) {
    const was = wasLinks.get(id);
    const their = theirLinks.get(id);
    const my = myLinks.get(id);
    const from = (their ?? my)?.from.nodeId ?? "";
    const side = sideFor(from);

    if (side) {
      const won = side === "theirs" ? their : my;

      if (won) {
        links.push(won);
      }

      continue;
    }

    const theyChanged = !sameValue(was, their);
    const iChanged = !sameValue(was, my);

    if (!theyChanged && !iChanged) {
      if (my ?? their) {
        links.push((my ?? their)!);
      }

      continue;
    }

    const won = theyChanged && !iChanged ? their : my;

    if (won) {
      links.push(won);
    }
  }

  return links;
}

/**
 * Positionen, som aldrig är en fråga: min när jag flyttat noden, annars deras.
 *
 * Den tas ur de **hela** noderna och inte ur den sammanslagna, för den
 * sammanslagna är byggd ur `visitorContent`-jämförelser där positionen inte
 * finns. En nod utan position ritas i hörnet, och det är inte en sammanslagning
 * — det är en förlust ingen bad om.
 */
function withPosition(
  node: FlowNodeData,
  was: FlowNodeData | undefined,
  my: FlowNodeData | undefined,
  their: FlowNodeData | undefined,
): FlowNodeData {
  const moved = my && was && !sameValue(my.position, was.position);
  const position = moved ? my.position : (their?.position ?? my?.position ?? node.position);

  return position ? { ...node, position } : node;
}

/** Noden som besökaren möter den — utan arbetsytan, som listan jämför den. */
function contentOf(node: FlowNodeData | undefined): unknown {
  if (!node) {
    return undefined;
  }

  const { position, ...rest } = node;

  void position;

  return rest;
}

/**
 * Fältvis mot utgångspunkten — den enda regeln som inte behöver veta vad ett
 * fält betyder.
 *
 * Fyra fall per värde, i ordning: lika hos båda (inget att välja), orört av
 * dem (mitt gäller), orört av mig (deras gäller), och annars — två objekt
 * fortsätter fält för fält, allt annat faller tillbaka på **mitt**, för den
 * som sitter med rutan öppen är den som får se resultatet.
 *
 * Den sista grenen nås bara när de två ändrat samma fält utan att raden
 * markerats som krock, alltså när diff-tjänsten inte ser skillnaden. Det är en
 * återvändsgränd som ska vara tom, och den väljer det minst överraskande.
 */
function mergeValue(was: unknown, their: unknown, my: unknown): unknown {
  if (sameValue(their, my)) {
    return their;
  }

  if (sameValue(was, their)) {
    return my;
  }

  if (sameValue(was, my)) {
    return their;
  }

  if (isPlainObject(was) && isPlainObject(their) && isPlainObject(my)) {
    const out: Record<string, unknown> = {};

    for (const key of new Set([...Object.keys(their), ...Object.keys(my)])) {
      const inTheirs = key in their;
      const inMine = key in my;

      if (inTheirs && inMine) {
        out[key] = mergeValue(was[key], their[key], my[key]);
        continue;
      }

      /*
       * Ett fält som bara den ena har: borttaget av den andra, eller tillagt av
       * den här. `base` svarar på vilket — fanns det där är det borttaget.
       */
      if (key in was) {
        continue;
      }

      out[key] = inTheirs ? their[key] : my[key];
    }

    return out;
  }

  return my;
}

/** `start`, `node`, … — där ett värde kan komma från tre håll. */
function pick<T>(was: T, their: T, my: T, side: MergeSide | null): T {
  if (side === "theirs") {
    return their;
  }

  if (side === "mine") {
    return my;
  }

  if (sameValue(was, their)) {
    return my;
  }

  return their;
}

/**
 * Noder som den ena tog bort och den andra inte — och vem det var.
 *
 * Tagen bort av **båda** är inget att fråga om: det är samma ändring, och
 * resultatet är detsamma vilket svar man än ger.
 */
function removedBySide(
  base: GraphData,
  theirs: GraphData,
  mine: GraphData,
): Array<[string, MergeSide]> {
  const theirNodes = new Set((theirs.nodes ?? []).map((one) => one.id));
  const myNodes = new Set((mine.nodes ?? []).map((one) => one.id));
  const out: Array<[string, MergeSide]> = [];

  for (const node of base.nodes ?? []) {
    const goneFromTheirs = !theirNodes.has(node.id);
    const goneFromMine = !myNodes.has(node.id);

    if (goneFromTheirs !== goneFromMine) {
      out.push([node.id, goneFromTheirs ? "theirs" : "mine"]);
    }
  }

  return out;
}

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Lika, som listan menar lika.
 *
 * `JSON.stringify` med sorterade nycklar: två objekt med samma innehåll i
 * olika ordning är samma innehåll, och en jämförelse som säger något annat
 * hade gjort varje nyckelordning till en krock.
 */
function sameValue(left: unknown, right: unknown): boolean {
  return stable(left) === stable(right);
}

function stable(value: unknown): string {
  return JSON.stringify(value, (_key, held) =>
    isPlainObject(held)
      ? Object.fromEntries(Object.keys(held).sort().map((key) => [key, held[key]]))
      : held,
  ) ?? "undefined";
}

function same(left: MergeLine[], right: MergeLine[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (one, index) =>
        one.message === right[index]?.message && one.after === right[index]?.after,
    )
  );
}

function byKind(left: MergeRow, right: MergeRow): number {
  /*
   * Krockarna överst, sedan granskningens egen ordning. Den som öppnar rutan
   * ska se det som kräver ett svar utan att leta; resten är läsning.
   */
  if (left.overlap !== right.overlap) {
    return left.overlap ? -1 : 1;
  }

  return KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind);
}
