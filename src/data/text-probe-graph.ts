import type { GraphData } from "../viewer/types/graph";

/**
 * Mätguiden för textfältet — `dev/text-probe.html`.
 *
 * Built 25/9 2026 for Johan's measurement protocol
 * (`docs/PROTOKOLL-2026-09-26-IPAD.md`): every node exists to put one item of
 * the protocol within reach in one tap, not to demonstrate anything to a
 * visitor. So it is a dev page and not an example — it sits outside
 * `BUNDLED_GRAPHS`, the translation gate and the examples index, and it may be
 * as odd as the measurement needs.
 *
 * What each node is for:
 *
 * - **Namn** and **Ort**: two answers set *early*, so every later field has
 *   chips to offer (Infoga svar) and the swap menu has something to list.
 * - **Rubrik som bryts**: a page whose title is long and *ends* in a chip. In
 *   the 360 px panel the chip lands first on line two, which is protocol
 *   item 1 (fynd f). Add or remove a word to move the break. Its description
 *   carries bold, italic, a link, a list and a chip for items 6 and 7.
 * - **Bricka sist på raden**: a page whose title has a chip mid-sentence; the
 *   words after it are there to push the chip to the end of line one —
 *   protocol item 2 (fynd h). Its own question sets **mer**, an answer set
 *   *after* the first page, so the swap menu on the first page must not
 *   offer it — item 4.
 * - **Tack**: a result whose title and text are chips only, for the receipt
 *   end of item 4.
 *
 * The nodes are spread wide so the guide is larger than a tablet's view at
 * 100 % and fits at about 50 %: that is what protocol item 8 (the minimap
 * following the view) needs.
 */
export const textProbeGraph: GraphData = {
  startNodeId: "probe-name",
  nodes: [
    {
      id: "probe-name",
      type: "text-question",
      position: { x: 40, y: 40 },
      data: {
        title: { sv: "Vad heter du?", en: "What is your name?" },
        variableName: "namn",
        variableLabel: { sv: "Namn", en: "Name" },
        required: true,
        maxLength: 80,
      },
    },
    {
      id: "probe-town",
      type: "text-question",
      position: { x: 520, y: 40 },
      data: {
        title: { sv: "Var bor du?", en: "Where do you live?" },
        variableName: "ort",
        variableLabel: { sv: "Ort", en: "Town" },
        required: true,
        maxLength: 80,
      },
    },
    {
      id: "probe-page-wrap",
      type: "page",
      position: { x: 1000, y: 40 },
      data: {
        title: {
          sv: "Hej {{namn}}, det här är en rubrik som är lång nog att brytas i panelen och som slutar med {{ort}}",
          en: "Hello {{namn}}, this is a title long enough to wrap in the panel and it ends with {{ort}}",
        },
        description: {
          sv: "Här finns **fet text**, *kursiv text*, en [länk till flowweaver.se](https://flowweaver.se) och en bricka: {{namn}}.\n\n- En punkt i en lista\n- En punkt till, med {{ort}} i sig\n\nSkriv gärna vidare här och klistra in från Anteckningar.",
          en: "Here is **bold text**, *italic text*, a [link to flowweaver.se](https://flowweaver.se) and a chip: {{namn}}.\n\n- A list item\n- Another one, with {{ort}} in it\n\nType on here and paste from Notes.",
        },
      },
    },
    {
      id: "probe-continue",
      type: "question",
      position: { x: 20, y: 112 },
      parentPageId: "probe-page-wrap",
      order: 0,
      layout: { columnSpan: 12 },
      data: {
        title: { sv: "Vill du fortsätta?", en: "Do you want to continue?" },
        variableName: "fortsatt",
        variableLabel: { sv: "Fortsätta", en: "Continue" },
        options: [
          { id: "probe-continue-yes", label: { sv: "Ja", en: "Yes" }, value: "ja" },
          { id: "probe-continue-no", label: { sv: "Nej", en: "No" }, value: "nej" },
        ],
      },
    },
    {
      id: "probe-page-mid",
      type: "page",
      position: { x: 1700, y: 40 },
      data: {
        title: {
          sv: "Om {{ort}} och orden efter brickan som ska knuffa den sist på första raden i panelen",
          en: "About {{ort}} and the words after the chip that push it to the end of the first line",
        },
        description: {
          sv: "Brickan i rubriken ska hamna sist på rad ett. Ta bort eller lägg till ord tills den gör det, ställ markören efter den, och skriv.",
          en: "The chip in the title should land last on line one. Remove or add words until it does, put the caret after it, and type.",
        },
      },
    },
    {
      id: "probe-more",
      type: "text-question",
      position: { x: 20, y: 112 },
      parentPageId: "probe-page-mid",
      order: 0,
      layout: { columnSpan: 12 },
      data: {
        title: { sv: "Något mer?", en: "Anything else?" },
        variableName: "mer",
        variableLabel: { sv: "Något mer", en: "Anything else" },
        maxLength: 200,
      },
    },
    {
      id: "probe-result",
      type: "result",
      position: { x: 2400, y: 520 },
      data: {
        title: { sv: "Tack {{namn}} i {{ort}}", en: "Thank you {{namn}} in {{ort}}" },
        description: {
          sv: "Du svarade {{fortsatt}} och skrev: {{mer}}. Här ska byt-menyn erbjuda **alla** svar, för alla är satta före den här noden.",
          en: "You answered {{fortsatt}} and wrote: {{mer}}. Here the swap menu should offer **every** answer, since all are set before this node.",
        },
      },
    },
  ],
  connections: [
    { id: "probe-c1", from: { nodeId: "probe-name", portId: "continue" }, to: { nodeId: "probe-town", portId: "input" } },
    { id: "probe-c2", from: { nodeId: "probe-town", portId: "continue" }, to: { nodeId: "probe-page-wrap", portId: "input" } },
    { id: "probe-c3", from: { nodeId: "probe-page-wrap", portId: "continue" }, to: { nodeId: "probe-page-mid", portId: "input" } },
    { id: "probe-c4", from: { nodeId: "probe-page-mid", portId: "continue" }, to: { nodeId: "probe-result", portId: "input" } },
  ],
} as never;
