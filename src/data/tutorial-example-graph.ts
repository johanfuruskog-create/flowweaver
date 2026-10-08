import type { GraphData } from "../viewer/types/graph";

/**
 * The getting-started tutorial: a simple walkthrough showing how to build a
 * question guide in the editor — from an empty canvas to a testable guide. Built
 * on the `annotated-image` node (screenshots with comment callouts you click
 * through). The images live in `public/tutorial/` (served at the site root).
 */
export const tutorialExampleGraph: GraphData = {
  startNodeId: "t-empty",
  nodes: [
    {
      id: "t-empty",
      type: "annotated-image",
      position: { x: -420, y: 0 },
      data: {
        title: { sv: "1. Börja med en tom arbetsyta", en: "1. Start with an empty workspace" },
        imageUrl: `${import.meta.env.BASE_URL}tutorial/t1-empty.png`,
        alt: { sv: "FlowWeaver-editorn med en tom arbetsyta, palett till vänster och egenskapspanel till höger.", en: "The FlowWeaver editor with an empty workspace, the palette on the left and the properties panel on the right." },
        comments: [
          { id: "p1", text: { sv: "Dra en Fråga-nod från paletten hit för att skapa din första fråga.", en: "Drag a Question node from the palette here to create your first question." }, x: 8, y: 18, arrow: "left" },
        ],
      },
    },
    {
      id: "t-edit",
      type: "annotated-image",
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "2. Redigera frågan", en: "2. Edit the question" },
        imageUrl: `${import.meta.env.BASE_URL}tutorial/t2-edit.png`,
        alt: { sv: "En markerad fråga på arbetsytan och egenskapspanelen med fälten Rubrik och Alternativ.", en: "A selected question on the workspace, and the properties panel with the Title and Options fields." },
        comments: [
          { id: "e1", text: { sv: "Skriv frågans text under Rubrik.", en: "Write the question's text under Title." }, x: 85, y: 25, arrow: "right" },
          { id: "e2", text: { sv: "Under Alternativ lägger du till svaren – varje alternativ blir en egen utgång.", en: "Under Options you add the answers – each option becomes an output of its own." }, x: 80, y: 84, arrow: "right" },
        ],
      },
    },
    {
      id: "t-connect",
      type: "annotated-image",
      position: { x: 420, y: 0 },
      data: {
        title: { sv: "3. Koppla svaren", en: "3. Connect the answers" },
        imageUrl: `${import.meta.env.BASE_URL}tutorial/t3-connect.png`,
        alt: { sv: "Frågan Vill du fortsätta med utgångarna Ja och Nej kopplade till var sitt Resultat.", en: "The question \"Do you want to continue\" with the Yes and No outputs each connected to a Result." },
        comments: [
          { id: "c1", text: { sv: "Varje svar (Ja/Nej) är en utgång – dra en linje därifrån…", en: "Every answer (Yes/No) is an output – drag a line from there…" }, x: 36, y: 53, arrow: "up" },
          { id: "c2", text: { sv: "…till ett Resultat som avslutar den vägen.", en: "…to a Result that ends that path." }, x: 60, y: 25, arrow: "down" },
        ],
      },
    },
    {
      id: "t-test",
      type: "annotated-image",
      position: { x: 840, y: 0 },
      data: {
        title: { sv: "4. Testa guiden", en: "4. Try the guide" },
        imageUrl: `${import.meta.env.BASE_URL}tutorial/t4-preview.png`,
        alt: { sv: "Fliken Förhandsgranskning med guiden som körs bredvid arbetsytan.", en: "The Preview tab with the guide running beside the workspace." },
        comments: [
          { id: "t1", text: { sv: "Byt till fliken Förhandsgranskning och klicka Prova guiden.", en: "Switch to the Preview tab and click Try the guide." }, x: 79, y: 13, arrow: "up" },
          { id: "t2", text: { sv: "Här kör du guiden precis som en besökare gör.", en: "Here you run the guide exactly as a visitor does." }, x: 86, y: 26, arrow: "right" },
        ],
      },
    },
    {
      id: "t-done",
      type: "result",
      position: { x: 1240, y: 0 },
      data: {
        title: { sv: "Klart!", en: "Done!" },
        description: { sv: "Nu kan du grunderna: lägg till en fråga, redigera den, koppla svaren till resultat och testa guiden i förhandsgranskningen.", en: "You now know the basics: add a question, edit it, connect the answers to results and try the guide in the preview." },
      },
    },
  ],
  connections: [
    { id: "tc1", from: { nodeId: "t-empty", portId: "continue" }, to: { nodeId: "t-edit", portId: "input" } },
    { id: "tc2", from: { nodeId: "t-edit", portId: "continue" }, to: { nodeId: "t-connect", portId: "input" } },
    { id: "tc3", from: { nodeId: "t-connect", portId: "continue" }, to: { nodeId: "t-test", portId: "input" } },
    { id: "tc4", from: { nodeId: "t-test", portId: "continue" }, to: { nodeId: "t-done", portId: "input" } },
  ],
  settings: { sourceLocale: "sv", locales: ["sv", "en"] },
};
