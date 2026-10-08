import type { LocalizedTextMap } from "../../viewer/core/localized-text";

/**
 * Texts the **editor** meets in the tool: the toolbar, the palette, the panel,
 * the node types and their fields.
 *
 * Never reachable from a guide. `settings.strings` may carry only viewer keys,
 * so no guide can rename "Fråga" in the palette — and that now holds by
 * construction rather than because the call paths happen to differ. Story 017.
 *
 * Swedish and English are what we maintain ourselves. A third editor language
 * is registered by the host; it does not belong in this file, because putting
 * it here would quietly make it ours. See story 014.
 */
export const EDITOR_STRINGS: Record<string, LocalizedTextMap> = {
  "port.continue": { sv: "Fortsätt", en: "Continue" },

  // Editorns chrome (pilot: nodmall-editorn). Styrs av <guide-editor
  // editor-locale="…">, en egen axel från innehålls-språket.
  "editor.close": { sv: "Stäng", en: "Close" },
  "editor.nodeTemplates.title": { sv: "Nodmallar", en: "Node templates" },
  "editor.nodeTemplates.intro": {
    sv: 'För att <strong>återanvända en fråga eller ett resultat</strong> – konfigurera en nod och välj <em>Spara som mall</em> i nodens meny. Placera den sedan flera gånger; dina mallar ligger i palettens "Mallar"-grupp.',
    en: 'To <strong>reuse a question or a result</strong> – configure a node and choose <em>Save as template</em> in the node menu. Then place it several times; your templates live in the palette\'s "Templates" group.',
  },
  "editor.nodeTemplates.saveHeading": {
    sv: "Spara noden som mall",
    en: "Save node as template",
  },
  "editor.nodeTemplates.editHeading": {
    sv: "Redigera mall",
    en: "Edit template",
  },
  "editor.nodeTemplates.captureNote": {
    sv: "Mallen får nodens nuvarande innehåll som utgångsläge.",
    en: "The template starts from the node's current content.",
  },
  "editor.nodeTemplates.editNote": {
    sv: "Ändrar namn och ikon. Innehållet ändrar du genom att spara om från en nod.",
    en: "Changes the name and icon. Edit the content by re-saving from a node.",
  },
  "editor.nodeTemplates.nameLabel": { sv: "Namn", en: "Name" },
  "editor.nodeTemplates.namePlaceholder": {
    sv: "T.ex. Kommunval",
    en: "E.g. Municipality choice",
  },
  "editor.nodeTemplates.iconLabel": {
    sv: "Ikon (valfritt)",
    en: "Icon (optional)",
  },
  "editor.nodeTemplates.iconPlaceholder": { sv: "t.ex. ★", en: "e.g. ★" },
  "editor.nodeTemplates.iconPick": {
    sv: "Välj ikon {glyph}",
    en: "Choose icon {glyph}",
  },
  "editor.nodeTemplates.create": { sv: "Skapa mall", en: "Create template" },
  "editor.nodeTemplates.saveChanges": {
    sv: "Spara ändringar",
    en: "Save changes",
  },
  "editor.nodeTemplates.empty": {
    sv: 'Inga mallar ännu. Skapa en genom att välja "Spara som mall" i en nods meny.',
    en: 'No templates yet. Create one by choosing "Save as template" in a node menu.',
  },
  "editor.nodeTemplates.edit": { sv: "Redigera", en: "Edit" },
  "editor.nodeTemplates.editAria": {
    sv: "Redigera mallen {label}",
    en: "Edit the template {label}",
  },
  "editor.nodeTemplates.delete": { sv: "Ta bort", en: "Delete" },
  // Removing a template reaches every guide on the site, not just the open one.
  // The warning says what we know (this guide) and what we cannot know (the
  // others) — without pretending to a number we do not have.
  "editor.nodeTemplates.confirmDelete": {
    sv: "Ta bort {label}?",
    en: "Delete {label}?",
  },
  "editor.nodeTemplates.confirmDeleteShared": {
    sv: "Mallen är gemensam och kan användas i andra guider här. Den försvinner för alla.",
    en: "The template is shared and may be used in other guides here. It disappears for everyone.",
  },
  "editor.nodeTemplates.confirmDeleteUsedHere": {
    sv: "{count} nod i den här guiden kommer ur den. Noderna blir kvar och fungerar, men heter {base} igen.",
    en: "{count} node in this guide came from it. The nodes remain and keep working, but are named {base} again.",
  },
  "editor.nodeTemplates.confirmDeleteUsedHerePlural": {
    sv: "{count} noder i den här guiden kommer ur den. Noderna blir kvar och fungerar, men heter {base} igen.",
    en: "{count} nodes in this guide came from it. The nodes remain and keep working, but are named {base} again.",
  },
  "editor.nodeTemplates.confirmDeleteUnusedHere": {
    sv: "Ingen nod i den här guiden kommer ur den.",
    en: "No node in this guide came from it.",
  },
  "editor.nodeTemplates.confirmDeleteRecover": {
    sv: "En borttagen mall går att återskapa från en nod som kommer ur den.",
    en: "A deleted template can be recreated from a node that came from it.",
  },
  "editor.nodeTemplates.recreateHeading": { sv: "Återskapa mallen", en: "Recreate the template" },
  // The rescue reconstructs from what the nodes have in common. With a single
  // node the template's values cannot be told from the node's own, and that
  // should be said plainly.
  "editor.nodeTemplates.recreateNote": {
    sv: "Värdena hämtas från det som {count} noder i guiden har gemensamt. Noderna själva ändras inte — de får bara tillbaka mallens namn.",
    en: "The values come from what {count} nodes in this guide have in common. The nodes themselves are unchanged — they only get the template's name back.",
  },
  "editor.nodeTemplates.recreateNoteSingle": {
    sv: "Bara en nod kommer ur mallen, så dess värden blir mallens — även rubriken. Kontrollera dem innan du sparar.",
    en: "Only one node came from the template, so its values become the template's — including the title. Check them before saving.",
  },
  "editor.nodeTemplates.confirmDeleteYes": { sv: "Ta bort mallen", en: "Delete template" },
  "editor.nodeTemplates.confirmDeleteNo": { sv: "Behåll", en: "Keep" },
  "editor.nodeTemplates.deleteAria": {
    sv: "Ta bort mallen {label}",
    en: "Delete the template {label}",
  },
  "editor.nodeTemplates.nameRequired": {
    sv: "Ge mallen ett namn.",
    en: "Give the template a name.",
  },
  "editor.nodeTemplates.addNew": { sv: "Lägg till nodmall", en: "Add node template" },
  "editor.nodeTemplates.createHeading": {
    sv: "Skapa en ny nodmall",
    en: "Create a new node template",
  },
  "editor.nodeTemplates.createNote": {
    sv: "Välj en grundtyp och namnge mallen. Den hamnar i palettens Mallar-grupp.",
    en: "Choose a base type and name the template. It appears in the palette's Templates group.",
  },
  "editor.nodeTemplates.baseLabel": { sv: "Grundtyp", en: "Base type" },
  "editor.nodeTemplates.baseMissing": {
    sv: "Grundtypen går inte att använda. Välj en annan.",
    en: "That base type is unavailable. Pick another.",
  },
  // The keys are the node type's, because a base type *is* a node type — there
  // is no third concept in between. See docs/STORIES/007-ett-falt-ett-stalle.md.
  "editor.nodeTemplates.base.question": { sv: "Enkelvalsfråga", en: "Single-choice question" },
  "editor.nodeTemplates.base.multi-choice": { sv: "Flervalsfråga", en: "Multiple-choice question" },
  "editor.nodeTemplates.base.text-question": { sv: "Textfråga", en: "Text question" },
  "editor.nodeTemplates.base.number-question": { sv: "Sifferfråga", en: "Number question" },

  // Editor-skalet (guide-editor)
  "editor.shell.startNodeWarning": {
    // Names the node menu (⋯ on the card), not a right-click: the menu opens
    // by pointer, tap and Shift+F10 alike, and K3 says the words must too.
    sv: "Guiden saknar startnod. Öppna en frågas meny (⋯) och välj <strong>Gör till startnod</strong>.",
    en: "The guide has no start node. Open a question's menu (⋯) and choose <strong>Make start node</strong>.",
  },
  "editor.shell.actions": { sv: "Guidens åtgärder", en: "Guide actions" },
  "editor.shell.canvas": { sv: "Arbetsytan", en: "The canvas" },
  "editor.shortcuts.region": { sv: "Hoppa mellan delarna", en: "Jump between the parts" },
  "editor.shell.sidebar": { sv: "Nodpanel", en: "Side panel" },
  "editor.shell.sidebarTabs": { sv: "Sidopanel", en: "Side panel tabs" },
  // The handle on the panel's left edge (story 141): a separator whose value is the width.
  "editor.shell.panelWidth": { sv: "Panelens bredd", en: "Panel width" },
  "editor.shell.panelOpen": { sv: "Öppna sidopanelen", en: "Open the side panel" },
  "editor.shell.panelClose": { sv: "Fäll in sidopanelen", en: "Collapse the side panel" },
  "editor.shell.tabProperties": { sv: "Egenskaper", en: "Properties" },
  "editor.shell.tabPreview": { sv: "Förhandsgranskning", en: "Preview" },
  /*
   * Två knappar som gjorde samma sak, skilda bara av var de började — en
   * storlek och en startpunkt, inte två syften. Namnen sa ingenting om vilken
   * man skulle ta.
   *
   * Nu säger de det: den ena visar steget man redigerar i sin riktiga storlek,
   * den andra kör hela guiden från början. Ordet *Granska* vore det närmaste
   * men är upptaget — nodtypen `review` heter så — och två olika saker med
   * samma namn i samma editor är värre än ett längre namn.
   */
  "editor.shell.previewOpen": { sv: "Visa i full storlek", en: "Full size" },
  "editor.shell.previewSelectNode": {
    sv: "Markera en nod för att förhandsgranska den.",
    en: "Select a node to preview it.",
  },
  "editor.toast.fullscreenFailed": {
    sv: "Helskärmsläget kunde inte öppnas i den här webbläsaren.",
    en: "Fullscreen could not be opened in this browser.",
  },
  "editor.toast.noStartNode": {
    sv: "Guiden har ingen startnod ännu.",
    en: "The guide has no start node yet.",
  },
  "editor.toast.emptyGuide": {
    sv: "Guiden är tom – lägg till en nod först.",
    en: "The guide is empty – add a node first.",
  },
  "editor.toast.exportBlocked": {
    sv: "Guiden kan inte exporteras ännu",
    en: "The guide can't be exported yet",
  },
  "editor.toast.templateExported": { sv: "Mallen {name} exporterades.", en: "The template {name} was exported." },
  "editor.toast.templateNotGuide": { sv: "{file} är en mall, inte en guide. Den lades i paletten och guiden är orörd.", en: "{file} is a template, not a guide. It was added to the palette and the guide is untouched." },
  "editor.toast.guideNotTemplate": { sv: "{file} är en guide, inte en mall. Välj Importera guide om du vill ersätta den du har.", en: "{file} is a guide, not a template. Choose Import guide if you want to replace the one you have." },
  "editor.toast.templateImported": { sv: "Mallen {name} lades till i biblioteket.", en: "The template {name} was added to the library." },
  "editor.toast.templateUnknownBase": { sv: "Mallen {name} bygger på fälttypen {base}, som inte finns i den här editorn. Den syns inte i paletten.", en: "The template {name} is based on the field type {base}, which does not exist in this editor. It will not appear in the palette." },
  "editor.toast.templateDisabledBase": { sv: "Mallen {name} bygger på {base}, som är avstängd på den här nivån. Den syns i paletten när {capability} slås på.", en: "The template {name} is based on {base}, which is switched off at this level. It appears in the palette once {capability} is enabled." },
  "editor.toast.templateNeedsFormat": { sv: "Mallen {name} använder formatet {format}, som den här editorn inte känner till. Fältet visas men kontrolleras inte.", en: "The template {name} uses the format {format}, which this editor does not know. The field appears but is not checked." },
  "editor.toast.exported": {
    sv: "Guiden har exporterats som flowweaver-guide.json.",
    en: "The guide was exported as flowweaver-guide.json.",
  },
  "editor.toast.schemaExported": {
    sv: "Inlämningens schema har exporterats som {file}.",
    en: "The submission schema was exported as {file}.",
  },
  "editor.toast.importFailed": {
    sv: "Filen {file} kunde inte importeras",
    en: "The file {file} could not be imported",
  },
  "editor.toast.imported": {
    sv: "Filen {file} har importerats.",
    en: "The file {file} was imported.",
  },
  "editor.toast.pageOnlyNoPage": {
    sv: "{label} bor i en sida — skapa en sida först.",
    en: "{label} lives in a page — create a page first.",
  },
  "editor.dialogs.choosePage.title": { sv: "Vilken sida?", en: "Which page?" },
  "editor.dialogs.choosePage.message": {
    sv: "{label} läggs sist i sidan du väljer.",
    en: "{label} is placed last in the page you choose.",
  },
  "editor.canvas.moveToPage": { sv: "Flytta till sidan {title}", en: "Move to the page {title}" },
  "editor.canvas.removeFromPage": { sv: "Lyft ut ur sidan", en: "Lift out of the page" },
  "editor.canvas.movedToPage": {
    sv: "Fältet ligger nu sist i sidan {title}.",
    en: "The field now sits last in the page {title}.",
  },
  "editor.canvas.removedFromPage": {
    sv: "Fältet ligger nu på arbetsytan.",
    en: "The field is on the workspace now.",
  },
  "editor.canvas.untitledPage": { sv: "namnlös sida", en: "untitled page" },
  "editor.toast.pageOnlyDrag": {
    sv: "{label} läggs till genom att dra in den i en sida.",
    en: "{label} is added by dragging it into a page.",
  },
  "editor.toast.templateUpdated": {
    sv: 'Mallen "{label}" uppdaterades från noden.',
    en: 'The template "{label}" was updated from the node.',
  },
  "editor.toast.cannotSaveTemplate": {
    sv: "Den här noden kan inte sparas som mall.",
    en: "This node can't be saved as a template.",
  },
  "editor.toast.templateSaved": {
    sv: 'Mallen "{label}" sparades och finns i alla guider.',
    en: 'The template "{label}" was saved and is available in all guides.',
  },
  "editor.confirm.importGuide.title": { sv: "Importera guide?", en: "Import guide?" },
  "editor.confirm.importGuide.message": { sv: "Guiden {name} ersätts av innehållet i {file}. Det går inte att ångra.", en: "The guide {name} will be replaced by the contents of {file}. This cannot be undone." },
  "editor.confirm.importGuide.confirm": { sv: "Ersätt guiden", en: "Replace the guide" },
  "editor.confirm.importGuide.unnamed": { sv: "den här guiden", en: "this guide" },
  "editor.confirm.removeStartNode.title": {
    sv: "Ta bort startnoden?",
    en: "Remove the start node?",
  },
  "editor.confirm.removeStartNode.message": {
    sv: "Guiden kommer att sakna startnod tills du väljer en ny fråga som startnod.",
    en: "The guide will have no start node until you choose a new question as the start node.",
  },
  "editor.confirm.removeStartNode.confirm": {
    sv: "Ta bort startnod",
    en: "Remove start node",
  },
  "editor.confirm.makeStartNode.titlePage": {
    sv: "Gör sidan till startnod?",
    en: "Make the page the start node?",
  },
  "editor.confirm.makeStartNode.titleQuestion": {
    sv: "Gör frågan till startnod?",
    en: "Make the question the start node?",
  },
  "editor.confirm.makeStartNode.messageOne": {
    sv: "{count} inkommande koppling tas bort eftersom en startnod inte kan ha inkommande kopplingar.",
    en: "{count} incoming connection will be removed because a start node can't have incoming connections.",
  },
  "editor.confirm.makeStartNode.messageMany": {
    sv: "{count} inkommande kopplingar tas bort eftersom en startnod inte kan ha inkommande kopplingar.",
    en: "{count} incoming connections will be removed because a start node can't have incoming connections.",
  },
  "editor.confirm.makeStartNode.confirm": {
    sv: "Gör till startnod",
    en: "Make start node",
  },
  "editor.confirm.resetGuide.title": {
    sv: "Återställ exempelguiden?",
    en: "Reset the example guide?",
  },
  "editor.confirm.resetGuide.message": {
    sv: "Din nuvarande guide ersätts med exempelguiden. Detta går inte att ångra.",
    en: "Your current guide will be replaced with the example guide. This can't be undone.",
  },
  "editor.confirm.resetGuide.confirm": {
    sv: "Återställ guide",
    en: "Reset guide",
  },
  "editor.errors.more": {
    sv: "Ytterligare {count} fel hittades.",
    en: "{count} more errors were found.",
  },
  "editor.pageWarnings.noFields": {
    sv: "Sidan har inga fält ännu. Dra in fält från paletten till sidans yta.",
    en: "The page has no fields yet. Drag fields from the palette onto the page area.",
  },

  // Nodpaletten
  "editor.palette.title": { sv: "Lägg till nod", en: "Add node" },
  "editor.palette.templates": { sv: "Mallar", en: "Templates" },
  "editor.palette.add": { sv: "Lägg till {label}", en: "Add {label}" },
  "editor.palette.hide": { sv: "Fäll in nodpaletten", en: "Collapse the node palette" },
  "editor.palette.show": { sv: "Öppna nodpaletten", en: "Open the node palette" },
  "editor.palette.search": { sv: "Sök nod", en: "Find a node" },
  "editor.palette.searchEmpty": { sv: "Inga nodtyper matchar. Prova ett annat ord.", en: "No node types match. Try another word." },
  "editor.palette.searchCount": { sv: "Träffar: {count}", en: "Matches: {count}" },
  "editor.palette.menuClose": { sv: "Stäng nodkategorin", en: "Close the node category" },
  "editor.palette.group.content": { sv: "Innehåll", en: "Content" },
  "editor.palette.group.logic": { sv: "Logik", en: "Logic" },
  "editor.palette.group.integrations": { sv: "Integrationer", en: "Integrations" },
  "editor.palette.group.endings": { sv: "Avslut", en: "Endings" },
  "editor.palette.group.notes": { sv: "Anteckningar", en: "Notes" },

  // Verktygsfältet
  "editor.toolbar.menuAria": { sv: "Editormeny", en: "Editor menu" },
  "editor.toolbar.file": { sv: "Arkiv", en: "File" },
  /*
   * "Snabbstart" — Johans ord, 28/8, och det beskriver vad greppet gör i stället
   * för vad det består av. Inte "Formulärmall": det beskriver vår maskineri, och
   * menyn läses av någon som aldrig hört ordet mall. Efter greppet finns inget
   * mall-läge kvar, så ordet vore dessutom osant tre sekunder senare.
   */
  "editor.toolbar.newForm": { sv: "Snabbstart: formulär", en: "Quick start: form" },
  // "Guide", inte "JSON": redaktören vet inte vad JSON är (Johans öra på
  // USP-filmen), och menyn ska tala hennes språk. Filnamnet .json syns
  // ändå i filväljaren — formatet är inte hemligt, bara inte rubriken.
  "editor.toolbar.importJson": { sv: "Importera guide", en: "Import guide" },
  "editor.toolbar.importTemplate": { sv: "Importera mall…", en: "Import template…" },
  "editor.toolbar.exportJson": { sv: "Exportera guide", en: "Export guide" },
  "editor.toolbar.exportSchema": { sv: "Exportera inlämningens schema", en: "Export submission schema" },
  "editor.toolbar.reset": { sv: "Återställ exempelguide", en: "Reset example guide" },
  "editor.toolbar.edit": { sv: "Redigera", en: "Edit" },
  "editor.toolbar.undo": { sv: "Ångra", en: "Undo" },
  "editor.toolbar.redo": { sv: "Gör om", en: "Redo" },
  "editor.toolbar.guide": { sv: "Guide", en: "Guide" },
  "editor.toolbar.modules": { sv: "Moduler", en: "Modules" },
  "editor.toolbar.showStartNode": { sv: "Visa startnod", en: "Show start node" },
  // The run of the guide on the canvas (story 065). In the Guide menu and not
  // in Vy: it is something the guide does, not a way of looking at it.
  "editor.toolbar.proveGuide": { sv: "Prova guiden", en: "Try the guide" },
  "editor.toolbar.routesHere": { sv: "Vägar hit", en: "Paths to here" },
  "editor.openList.more": { sv: "{count} fler", en: "{count} more" },
  "editor.properties.visibilityScope": { sv: "Gäller fältet på samma sida. För att välja väg mellan steg, använd en Regel.", en: "Applies to the field on the same page. To choose a path between steps, use a Rule." },
  /*
   * Berättelse 134, kriterium 3 som Johan avgjorde via Astra 29/9: raden
   * säger inställningens omfattning i en mening och inget mer. Den tidigare
   * jämförelsen med fältets *visas om* och Regeln (tre mekanismer som alla
   * börjar med samma ord) fick raden att bli tre meningar under ett reglage;
   * behövs jämförelsen får den en hjälpknapp. Kort text, men den radbryts på
   * smala skärmar — "en rad" betyder aldrig trunkering.
   */
  "editor.properties.optionVisibilityScope": {
    sv: "Styr bara om det här svarsalternativet visas.",
    en: "Only controls whether this answer option is shown.",
  },
  /*
   * Konceptbild 3 (UPPDRAG-2026-09-28-SVARSALTERNATIV, 29/9): rubriken över
   * villkorsgruppen i ett öppet alternativs "Villkorsstyrd synlighet". Bara
   * den här ytan har en rubrik i bilden — fältets egen "visas om" ovanför
   * (`renderVisibility`) har ingen motsvarighet och lämnas orörd.
   */
  "editor.properties.optionVisibilityHeading": { sv: "Visa alternativet när", en: "Show the option when" },
  /*
   * The first of a condition's three controls, in all three places one is
   * written (uppdrag 29/9 Del B, Astra §3). Konceptbild 3 named it for the
   * option's condition: "Variabel" is the technique's word, "Svar eller
   * värde" says what one actually chooses between. The field's "visas om"
   * and the rule said "Variabel" until the three became one renderer.
   */
  "editor.properties.condition-subject": { sv: "Svar eller värde", en: "Answer or value" },
  "editor.properties.ruleScope": { sv: "Regeln väljer väg mellan steg. Ska ett fält bara synas ibland på sin sida, använd fältets \"visas om\" i stället.", en: "The rule chooses a path between steps. For a field that should only sometimes show on its page, use the field's conditional visibility instead." },
  "editor.node.sentTo": { sv: "Skickas till: {names}", en: "Sent to: {names}" },
  // Under a calculation's title on the card, after its first three rows (uppdrag 29/9 Del D).
  "editor.node.moreCalculations": { sv: "+{n} uträkningar", en: "+{n} more calculations" },
  "editor.node.oneMoreCalculation": { sv: "+1 uträkning", en: "+1 more calculation" },
  // The same rows, in the node's accessible name — the list is aria-hidden
  // (uppdrag 29/9 Del D K-numren, Siv, mätt 29/9: unreachable by Tab and no
  // part of the group's own name or description otherwise).
  "editor.node.calculationsHint": { sv: "Räknar ut: {list}", en: "Works out: {list}" },
  /* Sidan upprepas (story 084); kortet ritar "× barn", namnet säger det med ord. */
  "editor.node.repeats": { sv: "upprepas per {word}", en: "repeats per {word}" },
  /*
   * The band on a conditional field (story 077). The subject and the value
   * are the guide's own words — a question's title, an option's label — so
   * only the words around them are ours. The list operators read as the rule
   * editor names them; the numeric ones are symbols in every language.
   */
  "editor.node.visibleIf": {
    sv: "Visas bara om {subject} {operator} {value}{more}",
    en: "Only shown if {subject} {operator} {value}{more}",
  },
  "editor.node.operator.equals": { sv: "är", en: "is" },
  "editor.node.operator.not-equals": { sv: "inte är", en: "is not" },
  "editor.node.operator.greater-than": { sv: ">", en: ">" },
  "editor.node.operator.greater-than-or-equal": { sv: "≥", en: "≥" },
  "editor.node.operator.less-than": { sv: "<", en: "<" },
  "editor.node.operator.less-than-or-equal": { sv: "≤", en: "≤" },
  "editor.node.operator.one-of": { sv: "är någon av", en: "is one of" },
  "editor.node.operator.not-one-of": { sv: "inte är någon av", en: "is not one of" },
  "editor.node.operator.all-of": { sv: "innehåller bara", en: "contains only" },
  "editor.node.operator.not-all-of": { sv: "innehåller annat än", en: "contains other than" },
  "editor.node.sentToVisitor": { sv: "Skickas till: besökarens egen adress", en: "Sent to: the visitor's own address" },
  "editor.announce.connectionRemoved": { sv: "Koppling borttagen", en: "Connection removed" },
  "editor.announce.nodeCreated": { sv: "{type} tillagd", en: "{type} added" },
  "editor.announce.nodeRemoved": { sv: "{title} borttagen", en: "{title} removed" },
  "editor.announce.nodeMoved": { sv: "{title} flyttad", en: "{title} moved" },
  /*
   * Delad mellan versionslistan och panelens omordnade listor (svarsalternativ,
   * betygsstegen) — samma fras, samma sätt att säga var något landade. En nod
   * flyttad med tangenten sades redan via `editor.announce.nodeMoved`; en rad
   * eller ett alternativ som bytte plats med pekare eller Alt+piltangent
   * sades inte alls (mätt mot artiklarna 22/9, docs/IDEAS.md). `{title}` är
   * det som flyttades — versionens rubrik, alternativets etikett, stegets
   * nummer — så det inte krävs en tredje nyckel bara för att listan skiljer.
   */
  "editor.announce.reordered": {
    sv: "{title}, nu på plats {position} av {count}",
    en: "{title}, now in position {position} of {count}",
  },
  "editor.shell.smallScreenNotice": { sv: "Editorn är gjord för större skärmar. Guiderna du bygger fungerar utmärkt på mobilen — men att bygga dem gör det inte än.", en: "The editor is made for larger screens. The guides you build work fine on a phone — building them does not, yet." },
  "editor.toolbar.listView": { sv: "Visa som lista", en: "View as list" },
  "editor.toolbar.canvasView": { sv: "Visa arbetsytan", en: "Show the canvas" },
  "editor.quickOpen.aria": { sv: "Sök i guiden", en: "Search the guide" },
  "editor.quickOpen.placeholder": { sv: "Skriv för att hoppa eller lägga till …", en: "Type to jump or add …" },
  "editor.quickOpen.goTo": { sv: "Gå till: {title}", en: "Go to: {title}" },
  "editor.quickOpen.addNode": { sv: "Lägg till nod: {type}", en: "Add node: {type}" },
  "editor.quickOpen.empty": { sv: "Inga träffar", en: "No matches" },
  "editor.properties.pageAdvice": { sv: "En sida per ämne, tre till sex fält — långa formulär blir lättare att svara på i korta steg.", en: "One page per topic, three to six fields — long forms are easier to answer in short steps." },
  "editor.toolbar.nodeTemplates": { sv: "Nodmallar…", en: "Node templates…" },
  // "Vy" rather than "Visa": the menu now holds *Visa alla som besökaren ser
  // dem*, and a word that names both the menu and one of its rows names
  // nothing. The tour (`editor.tour.menus`) already said "vy" — now it is true.
  "editor.toolbar.view": { sv: "Vy", en: "View" },
  "editor.toolbar.allVisitorView": {
    sv: "Visa alla som besökaren ser dem",
    en: "Show them all as a visitor sees them",
  },
  "editor.toolbar.allStructureView": {
    sv: "Visa alla som struktur",
    en: "Show them all as structure",
  },
  "editor.toolbar.showVariables": { sv: "Visa variabelnamn", en: "Show variable names" },
  "editor.toolbar.help": { sv: "Hjälp", en: "Help" },
  "editor.toolbar.getStarted": { sv: "Kom igång", en: "Get started" },
  "editor.toolbar.shortcuts": { sv: "Kortkommandon", en: "Keyboard shortcuts" },
  "editor.shortcuts.title": { sv: "Kortkommandon", en: "Keyboard shortcuts" },
  "editor.shortcuts.close": { sv: "Stäng", en: "Close" },
  "editor.shortcuts.hint": { sv: "Tryck på ? när som helst för att öppna den här listan.", en: "Press ? anytime to open this list." },
  "editor.shortcuts.group.general": { sv: "Allmänt", en: "General" },
  "editor.shortcuts.group.canvas": { sv: "Arbetsyta", en: "Canvas" },
  "editor.shortcuts.group.node": { sv: "Markerad nod", en: "Selected node" },
  "editor.shortcuts.group.other": { sv: "Övrigt", en: "Other" },
  "editor.shortcuts.undo": { sv: "Ångra", en: "Undo" },
  "editor.shortcuts.redo": { sv: "Gör om", en: "Redo" },
  "editor.shortcuts.zoomIn": { sv: "Zooma in", en: "Zoom in" },
  "editor.shortcuts.zoomOut": { sv: "Zooma ut", en: "Zoom out" },
  "editor.shortcuts.zoomReset": { sv: "Återställ zoom", en: "Reset zoom" },
  "editor.shortcuts.zoomWheel": { sv: "Zooma med mushjulet", en: "Zoom with the mouse wheel" },
  "editor.shortcuts.delete": { sv: "Ta bort markerad nod eller koppling", en: "Delete selected node or connection" },
  "editor.shortcuts.duplicate": { sv: "Duplicera markerad nod", en: "Duplicate selected node" },
  "editor.shortcuts.deselect": { sv: "Avmarkera", en: "Clear selection" },
  "editor.shortcuts.selectNode": { sv: "Markera noden (när den har fokus)", en: "Select the node (when focused)" },
  /*
   * Panorering stod inte i listan, medan mellanslag stod under *markera noden*.
   * Alltså lärde hjälpen ut den ena av två saker samma tangent gjorde — och
   * inte den som handen faktiskt håller nere.
   */
  "editor.shortcuts.pan": {
    sv: "Panorera arbetsytan (håll och dra)",
    en: "Pan the workspace (hold and drag)",
  },
  "editor.shortcuts.enterPorts": { sv: "Nå nodens portar", en: "Reach the node's ports" },
  "editor.shortcuts.connect": { sv: "Koppla: på en utgång, sedan på en ingång", en: "Connect: on an output, then on an input" },
  "editor.shortcuts.connectCancel": { sv: "Avbryt kopplingen", en: "Cancel the connection" },
  "editor.shortcuts.focusNode": { sv: "Gå till närmaste nod åt det hållet", en: "Go to the nearest node that way" },
  "editor.shortcuts.moveNode": { sv: "Flytta noden (när den är markerad)", en: "Move the node (when selected)" },
  "editor.shortcuts.moveNodeFar": { sv: "Flytta noden längre", en: "Move the node further" },
  "editor.shortcuts.group.reach": { sv: "Ta dig runt", en: "Getting around" },
  "editor.shortcuts.closeMenu": { sv: "Stäng meny eller dialog", en: "Close menu or dialog" },
  "editor.shortcuts.showHelp": { sv: "Visa kortkommandon", en: "Show keyboard shortcuts" },
  "editor.shortcuts.key.space": { sv: "Mellanslag", en: "Space" },
  "editor.shortcuts.key.wheel": { sv: "mushjul", en: "wheel" },
  "editor.shortcuts.save": { sv: "Spara", en: "Save" },
  "editor.shortcuts.nodeMenu": { sv: "Öppna nodens meny", en: "Open the node's menu" },
  "editor.shortcuts.fit": { sv: "Passa in allt i vyn", en: "Fit everything in view" },
  // Shown when no host answers `save-request` — the one thing the editor
  // knows about saving is that it is not the one doing it (story 083).
  "editor.save.hostSavesHint": { sv: "Sparningen sköts av sidan du arbetar i.", en: "Saving is handled by the page you are working in." },
  "editor.tour.start": { sv: "Rundtur", en: "Take a tour" },
  "editor.tour.next": { sv: "Nästa", en: "Next" },
  "editor.tour.back": { sv: "Föregående", en: "Back" },
  "editor.tour.done": { sv: "Klar", en: "Done" },
  "editor.tour.close": { sv: "Avsluta rundturen", en: "End tour" },
  "editor.tour.count": { sv: "{n} av {total}", en: "{n} of {total}" },
  "editor.tour.aria": { sv: "Rundtur i editorn", en: "Editor tour" },
  "editor.tour.menus": { sv: "Överst finns menyerna: arkiv och export, redigering, moduler, vy och hjälp.", en: "The menus up top: file and export, editing, modules, view and help." },
  "editor.tour.templates": { sv: "Under Guide-menyn skapar du egna nodmallar att återanvända – och hoppar till startnoden.", en: "Under the Guide menu you create reusable node templates — and jump to the start node." },
  "editor.tour.palette": { sv: "Här bygger du guiden — dra in frågor, regler och resultat i flödet.", en: "This is where you build the guide — drag in questions, rules and results." },
  "editor.tour.node": { sv: "Klicka på en nod för att ändra dess text och svarsalternativ.", en: "Click a node to change its text and answer options." },
  "editor.tour.rule": { sv: "En Regel väljer vilket resultat användaren hamnar på utifrån svaren.", en: "A Rule picks which result the user reaches based on the answers." },
  "editor.tour.preview": { sv: "Prova guiden direkt här — en fråga i taget, utan att lämna editorn.", en: "Try the guide right here — one question at a time, without leaving the editor." },
  "editor.toolbar.zoomIn": { sv: "Zooma in", en: "Zoom in" },
  "editor.toolbar.zoomOut": { sv: "Zooma ut", en: "Zoom out" },
  "editor.toolbar.zoomReset": { sv: "Zooma 100 %", en: "Zoom to 100%" },
  "editor.toolbar.fitToContent": { sv: "Anpassa till innehåll", en: "Fit to content" },
  "editor.toolbar.fullscreen": { sv: "Helskärm", en: "Fullscreen" },
  "editor.toolbar.exitFullscreen": { sv: "Avsluta helskärm", en: "Exit fullscreen" },
  "editor.toolbar.darkMode": { sv: "Mörkt läge", en: "Dark mode" },
  "editor.toolbar.lightMode": { sv: "Ljust läge", en: "Light mode" },
  // The label says what the choice *means*, not merely that a language picker
  // exists. Switching language switches what you write in, and that was stated
  // nowhere before.
  "editor.toolbar.localeLabel": { sv: "Språk", en: "Language" },
  // What you are doing, not what we call it: "Redigerar källan" was jargon
  // for anyone who did not yet know a guide can be translated (bedömningen
  // 3/9, K). The pair with translatingTo says which mode you are in.
  "editor.toolbar.editingSource": {
    sv: "Skriver på",
    en: "Writing in",
  },
  "editor.toolbar.translatingTo": {
    sv: "Översätter till",
    en: "Translating into",
  },
  "editor.toolbar.localeAria": { sv: "Redigeringsspråk", en: "Editing language" },
  "editor.toolbar.importFileAria": {
    sv: "Välj en JSON-fil att importera",
    en: "Choose a JSON file to import",
  },
  "editor.toolbar.importReadError": {
    sv: "Filen kunde inte läsas. Försök igen.",
    en: "The file could not be read. Please try again.",
  },
  "editor.toolbar.translationProgress": {
    sv: "{translated}/{total} översatta",
    en: "{translated}/{total} translated",
  },

  // Egenskapspanelen
  "editor.properties.header-default": { sv: "Egenskaper", en: "Properties" },
  "editor.properties.page-placement": { sv: "Plats {position} av {count}", en: "Slot {position} of {count}" },
  "editor.properties.placement-in-page": { sv: "Placering i sidan", en: "Placement in page" },
  "editor.properties.move-up-node": { sv: "Flytta upp {title}", en: "Move {title} up" },
  "editor.properties.move-up": { sv: "↑ Flytta upp", en: "↑ Move up" },
  "editor.properties.move-down-node": { sv: "Flytta ned {title}", en: "Move {title} down" },
  "editor.properties.move-down": { sv: "↓ Flytta ned", en: "↓ Move down" },
  "editor.properties.node-title-fallback": { sv: "fältet", en: "the field" },
  "editor.properties.translation-mode": { sv: "Översättningsläge · {locale}", en: "Translation mode · {locale}" },
  // {locale} är källspråkets NAMN på UI-språket (localeLabel) — hinten
  // hårdkodade "svensk källa", vilket var sant tills första guiden med
  // engelsk källa mötte översättningsläget.
  "editor.properties.translation-hint": { sv: "Källan på {locale} visas som referens. Låsta fält redigeras på {locale}.", en: "The source in {locale} is shown for reference. Locked fields are edited in {locale}." },
  "editor.properties.empty-state": { sv: "Markera en nod för att redigera den.", en: "Select a node to edit it." },
  // The guide's own details, in the panel when no node is selected.
  // The check row at the bottom of the canvas. It says what is broken for a
  // resident, unlike validation, which says whether the file can be read.
  /*
   * Ändringsöversikten inför en publicering (berättelse 125).
   *
   * Meningarna sätts ihop av tjänsten i `src/viewer/services/`, men orden bor
   * här: de läses av en redaktör, aldrig av en besökare, och det är vad som
   * avgör vilken fil en nyckel hör hemma i (`built-in-strings.ts`). Tjänsten
   * slår upp dem med `t()` — en uppslagning är ingen import, och grinden mellan
   * de två träden håller.
   *
   * **"Steget" och "fältet", inte "frågan".** Tabellen i berättelsen skriver
   * *frågan har tagits bort*, och det är rätt ord exakt när noden är en fråga.
   * Ett resultat, en sida eller en text är också noder som tas bort, och
   * *frågan* om dem är fel på ett sätt som får en redaktör att undra vilken
   * fråga. Svenskan skiljer i en enda dimension här — ett steg i guiden, eller
   * ett fält på en sida — så nycklarna är bundna till den och inte till varje
   * nodtyp för sig.
   *
   * Rubriken nämns vid namn i `content`, resten inte: *innehållet har ändrats*
   * om en omskriven fråga är sant och obrukbart, och vilken inställning som
   * flyttades svarar noden själv på när man öppnar den.
   */
  /*
   * Publiceringsdialogen (berättelse 125).
   *
   * Underrubriken lovar ingenting om pågående besök, och det är med flit: vad
   * som händer med ett halvfärdigt svar vid en omladdning över en publicering
   * är inte mätt, och en mening om det vore ett löfte ingen kontrollerat.
   */
  "editor.publish.title": { sv: "Publicera version {version}", en: "Publish version {version}" },
  "editor.publish.subtitle": {
    sv: "Version {version} blir guidens publicerade version och ersätter version {previous}.",
    en: "Version {version} becomes the guide's published version, replacing version {previous}.",
  },
  "editor.publish.subtitleFirst": {
    sv: "Version {version} blir guidens publicerade version. Det är den första.",
    en: "Version {version} becomes the guide's published version. It is the first.",
  },
  "editor.publish.errors": {
    sv: "Kan inte publicera: {count} fel behöver åtgärdas",
    en: "Cannot publish: {count} errors need fixing",
  },
  "editor.publish.oneError": {
    sv: "Kan inte publicera: 1 fel behöver åtgärdas",
    en: "Cannot publish: 1 error needs fixing",
  },
  /*
   * Knappens ord är berättelsens: *Gå till frågan*. Den står bara i fellistan,
   * och ett fel sitter i praktiken alltid på något man frågar om — till skillnad
   * från ändringsöversikten, som räknar upp steg och fält av alla slag och
   * därför säger "steget".
   */
  "editor.publish.goToNode": { sv: "Gå till frågan", en: "Go to the question" },
  "editor.publish.blocked": {
    sv: "Åtgärda felen först, så går den att publicera.",
    en: "Fix the errors first, and it can be published.",
  },
  "editor.publish.warnings": {
    sv: "{count} varningar — guiden går att publicera ändå",
    en: "{count} warnings — the guide can still be published",
  },
  "editor.publish.oneWarning": {
    sv: "1 varning — guiden går att publicera ändå",
    en: "1 warning — the guide can still be published",
  },
  "editor.publish.changes": { sv: "Det här ändras för besökaren", en: "This is what changes for a visitor" },
  "editor.publish.outline": { sv: "Det här publiceras", en: "This is what gets published" },
  "editor.publish.updated": { sv: "Översikten är uppdaterad", en: "The overview has been updated" },
  "editor.publish.note": { sv: "Vad ändrades?", en: "What changed?" },
  "editor.publish.previewStart": { sv: "Förhandsgranska från start", en: "Preview from the start" },
  /*
   * Var "Frågan" (Del 5, UPPDRAG-2026-09-28-ENHETLIGHET): etiketten sa vad
   * raden HANDLAR OM, inte vad knappen GÖR — mätt (`askPreview` dispatchar
   * `publish-preview-intent` med radens `nodeId`, samma väg som syskonknappen
   * `previewStart` men startad från just den noden i stället för från
   * början). Samma verbform som `previewStart` ("Förhandsgranska från
   * start"): en handling, inte ett substantiv.
   */
  "editor.publish.previewNode": { sv: "Förhandsgranska härifrån", en: "Preview from here" },
  /*
   * K3, öppen fråga 4 (UPPDRAG-2026-09-28-ENHETLIGHET, Siv 28/9): den synliga
   * texten är delad ("Förhandsgranska härifrån" på varje rad, med flit — det
   * är samma handling överallt), men flera ändrade noder gav flera knappar
   * med exakt samma tillgängliga namn. Samma mönster som
   * `move-up-node`/`move-down-node`: `aria-label` bär radens egen titel,
   * den synliga texten ändras inte.
   */
  "editor.publish.previewNodeNamed": { sv: "Förhandsgranska härifrån: {title}", en: "Preview from here: {title}" },
  "editor.publish.previewWarning": {
    sv: "Tidigare frågor är inte besvarade. Villkor kan därför påverka vad som visas.",
    en: "Earlier questions have not been answered. Conditions may therefore affect what is shown.",
  },
  "editor.publish.confirm": { sv: "Publicera", en: "Publish" },
  /*
   * Vilkas ändringar granskningen innehåller, och anteckningen som säger att
   * någon inte var klar (berättelse 130).
   *
   * Johan: *"Om inte Anna hade tänkt klart och inte vill att det skulle
   * publiceras?"* Rutan sa redan **vad** som ändras — versionerna, krocken och
   * namnen skyddar innehållet. Det som saknades var **vems** det är, och en
   * väg att säga *vänta*.
   *
   * **Ingen könsgissning:** namnet står, aldrig ett pronomen. Och tiden i
   * parentes efter namnet, för att raden ska gå att läsa i en svep — *Anna
   * Andersson (08:29) och du*.
   *
   * Engelskan säger inte samma mening. *Anna Andersson has changed* och *you
   * have changed* böjs olika, och en mening som måste välja verbform efter hur
   * många namn listan råkar ha är en mening som blir fel en dag. Därför en
   * etikett på engelska och en mening på svenska — båda säger samma sak, och
   * ingen av dem är en översättning som kämpar.
   */
  "editor.publish.contributors": {
    sv: "Sedan version {previous} har {who} ändrat guiden.",
    en: "Changed since version {previous}: {who}.",
  },
  "editor.publish.contributorsFirst": {
    sv: "{who} har ändrat guiden.",
    en: "Changed: {who}.",
  },
  "editor.publish.contributorsOnlyYou": {
    sv: "Sedan version {previous} har bara du ändrat guiden.",
    en: "Changed since version {previous}: you only.",
  },
  "editor.publish.contributorsOnlyYouFirst": {
    sv: "Bara du har ändrat guiden.",
    en: "Changed: you only.",
  },
  /** Den inloggade i uppräkningen — *Anna Andersson och du*. */
  "editor.publish.contributorsYou": { sv: "du", en: "you" },
  /** Bindeordet före det sista namnet. Kommatecken mellan de andra. */
  "editor.publish.contributorsAnd": { sv: "och", en: "and" },
  /*
   * Arbetsanteckningen, ritad som en varning: guiden GÅR att publicera, och
   * ingen ska kunna säga att de inte visste. *Publicera ändå?* står som en
   * egen mening efter citatet — en fråga man svarar på med knappen.
   */
  "editor.publish.draftNote": {
    sv: "{name} skrev {clock}",
    en: "{name} wrote at {clock}",
  },
  "editor.publish.draftNoteAsk": { sv: "Publicera ändå?", en: "Publish anyway?" },
  /*
   * Krockrutan (berättelse 129). Två ändrade guiden, och ingen sammanslagning
   * görs — den som läser det här ska välja vad som ska gälla.
   *
   * **Ingen av meningarna gissar kön.** Namnet är vad leverantören kallar
   * personen och säger ingenting om hur den ska omtalas: *hon får den här
   * rutan* är fel om en verklig människa, varje gång. Därför *{name} får den
   * här rutan* och aldrig ett pronomen.
   *
   * Och valen säger vad som händer, inte vad de heter. *Ladda om* ensamt är
   * ett ord ingen vågar trycka på när man just fått veta att något gått fel.
   */
  "editor.conflict.title": {
    sv: "{name} sparade {clock} medan du arbetade.",
    en: "{name} saved at {clock} while you were working.",
  },
  "editor.conflict.titleUnknown": {
    sv: "Arbetskopian ändrades {clock} medan du arbetade.",
    en: "The working copy changed at {clock} while you were working.",
  },
  /*
   * Meningen under rubriken.
   *
   * Den sa *Ingen sammanslagning görs — välj vad som ska gälla* till 19/9, och
   * det var sant så länge det inte fanns någon. Med berättelse 131 finns den,
   * och den är dessutom förstahandsvalet — en ruta som säger att ingenting
   * slås ihop ovanför en knapp som heter *Slå ihop ändringar* säger två saker
   * som inte kan vara sanna samtidigt. Sett i bild 19/9.
   *
   * Nu säger den vad som gäller: ingenting är skrivet än, och valen nedanför
   * är vad som kan hända.
   */
  "editor.conflict.body": {
    sv: "Ni har båda ändrat guiden. Ingenting är sparat än — välj hur det ska gå vidare.",
    en: "You have both changed the guide. Nothing is saved yet — choose how to carry on.",
  },
  /*
   * Förstahandsvalet, och det enda som är fyllt (Johan 18/9: *"Kommer det bli
   * tydligt?"*). Det förlorar ingenting längre — kopian ligger i webbläsaren
   * innan rutan ens visas — så det finns en knapp att trycka på utan att förstå
   * resten, och den är rätt.
   *
   * **Namnet står i knappen**, inte bara i rubriken: den som är ovan läser
   * knappen och inte meningen ovanför, och *se ändringarna* svarar inte på
   * frågan *vems?*. `{owner}` är namnet i genitiv, räknat av `possessive.ts`
   * — svenskan och engelskan böjer olika, och ett namn som slutar på s böjs
   * inte alls i svenskan.
   */
  "editor.conflict.reload": {
    sv: "Ladda om och se {owner} ändringar",
    en: "Reload and see {owner} changes",
  },
  /** Och hos en värd som inte vet vem. Aldrig en genitiv utan namn. */
  "editor.conflict.reloadUnknown": {
    sv: "Ladda om och se ändringarna",
    en: "Reload and see the changes",
  },
  "editor.conflict.reloadNote": {
    sv: "Dina ändringar sedan {clock} sparas i den här webbläsaren, så du kan fortsätta där du var.",
    en: "Your changes since {clock} are kept in this browser, so you can carry on where you were.",
  },
  /*
   * **Slå ihop ändringar** — förstahandsvalet sedan berättelse 131 (Johan
   * 19/9: *"om vi gör diffen, vad rekommenderar du då?"*).
   *
   * Det förlorar ingenting alls: båda kopiorna fryses i historiken innan den
   * sammanslagna skrivs, och kräver noll val när ni rört olika saker — vilket
   * är det vanliga. *Slå ihop* och inte *sammanfoga* eller *gå igenom*: Johans
   * ord 18/9, för det är vardagligare än det första och tydligare än det
   * andra.
   *
   * **Och *Behåll mina ändringar* är borta.** Det var samma sak som *Min* på
   * varje rad i sammanslagningen, fast utan att se vad man skriver över — ett
   * val som gör mindre än ett annat ska inte stå bredvid det.
   */
  "editor.conflict.merge": { sv: "Slå ihop ändringar", en: "Merge changes" },
  "editor.conflict.mergeNote": {
    sv: "Du går igenom ändring för ändring. Båda kopiorna sparas i historiken först, så ingenting går förlorat.",
    en: "You go through it change by change. Both copies are saved to the history first, so nothing is lost.",
  },
  "editor.conflict.cancel": { sv: "Avbryt", en: "Cancel" },
  "editor.conflict.cancelNote": {
    sv: "Inget händer. Autosparen är av tills du väljer.",
    en: "Nothing happens. Autosave stays off until you choose.",
  },
  /*
   * ── Sammanslagningen (berättelse 131) ──────────────────────────────────
   *
   * Granskningens slag, med två spalter: *{name} ändrade* och *Du ändrade*.
   * Rubriken säger vad rutan är till för, och underrubriken hur mycket som
   * faktiskt kräver ett svar — för det vanliga är noll.
   *
   * **Ingen av meningarna gissar kön.** Namnet är vad leverantören kallar
   * personen; *hennes ändring* är fel om en verklig människa, varje gång.
   */
  "editor.merge.title": { sv: "Slå ihop ändringar", en: "Merge changes" },
  "editor.merge.theirs": { sv: "{name} ändrade", en: "{name} changed" },
  "editor.merge.theirsUnknown": { sv: "Den andra ändrade", en: "The other editor changed" },
  "editor.merge.mine": { sv: "Du ändrade", en: "You changed" },
  /*
   * Det vanliga fallet, och hela skälet berättelsen finns: två som arbetar i
   * samma guide rör oftast olika saker, och då finns ingenting att välja.
   */
  "editor.merge.nothingToChoose": {
    sv: "Ni har ändrat olika saker. Allt följer med — inget att välja.",
    en: "You have changed different things. Everything is kept — nothing to choose.",
  },
  /*
   * Och hur många som är kvar. **Raden säger det**, inte bara knappens
   * tillstånd: en knapp som inte går att trycka på och inte säger varför är
   * en knapp man trycker på fem gånger och sedan ger upp inför.
   */
  "editor.merge.remainingOne": { sv: "1 val kvar att göra.", en: "1 choice left to make." },
  "editor.merge.remaining": {
    sv: "{count} val kvar att göra.",
    en: "{count} choices left to make.",
  },
  "editor.merge.ready": { sv: "Allt är valt.", en: "Everything is chosen." },
  "editor.merge.overlapsTitle": {
    sv: "Ni har ändrat samma sak",
    en: "You have changed the same thing",
  },
  "editor.merge.restTitle": { sv: "Följer med", en: "Kept" },
  /*
   * Knapparna per krockande rad. Den ena bär **namnet i genitiv** — *Annas* —
   * och det räknas av `possessive.ts` och inte av en sträng: svenskan och
   * engelskan böjer olika, och ett namn som slutar på s böjs inte alls i
   * svenskan. Därför finns bara reservordet här, för en värd som inte vet vem.
   */
  "editor.merge.pickTheirsUnknown": { sv: "Den andras", en: "Theirs" },
  "editor.merge.pickMine": { sv: "Min", en: "Mine" },
  /* En rad båda gjort likadant. Ingen fråga — men den ska synas, annars undrar
     den som läser listan vart posten tog vägen. */
  "editor.merge.same": { sv: "Ni gjorde samma ändring.", en: "You made the same change." },
  "editor.merge.nothing": { sv: "—", en: "—" },
  "editor.merge.previewStart": { sv: "Förhandsgranska från start", en: "Preview from the start" },
  "editor.merge.confirm": { sv: "Bekräfta", en: "Confirm" },
  "editor.merge.cancel": { sv: "Avbryt", en: "Cancel" },
  /*
   * Och det som städas bort: en väg till en nod som den ena tog bort. Sägs
   * alltid, aldrig tyst — en sammanslagning som städar utan att säga det har
   * kastat något.
   */
  "editor.merge.droppedOne": {
    sv: "1 väg tas bort, för att den ledde till ett steg som inte finns kvar.",
    en: "1 route is removed, because it led to a step that is no longer there.",
  },
  "editor.merge.dropped": {
    sv: "{count} vägar tas bort, för att de ledde till steg som inte finns kvar.",
    en: "{count} routes are removed, because they led to steps that are no longer there.",
  },
  "editor.diff.untitled": { sv: "Utan rubrik", en: "Untitled" },
  "editor.diff.start": {
    sv: 'Guiden börjar nu med "{node}".',
    en: 'The guide now starts with "{node}".',
  },
  "editor.diff.node.addedStep": { sv: "{node}: steget har lagts till.", en: "{node}: the step has been added." },
  "editor.diff.node.removedStep": { sv: "{node}: steget har tagits bort.", en: "{node}: the step has been removed." },
  "editor.diff.node.addedField": { sv: "{node}: fältet har lagts till.", en: "{node}: the field has been added." },
  "editor.diff.node.removedField": { sv: "{node}: fältet har tagits bort.", en: "{node}: the field has been removed." },
  "editor.diff.route.added": {
    sv: '{node} → {option}: leder nu till "{to}".',
    en: '{node} → {option}: now leads to "{to}".',
  },
  "editor.diff.route.changed": {
    sv: '{node} → {option}: leder nu till "{to}", tidigare "{from}".',
    en: '{node} → {option}: now leads to "{to}", previously "{from}".',
  },
  "editor.diff.route.removed": {
    sv: "{node} → {option}: leder inte längre vidare.",
    en: "{node} → {option}: no longer leads anywhere.",
  },
  "editor.diff.option.added": {
    sv: '{node}: alternativet "{option}" har lagts till.',
    en: '{node}: the option "{option}" has been added.',
  },
  "editor.diff.option.removed": {
    sv: '{node}: alternativet "{option}" har tagits bort.',
    en: '{node}: the option "{option}" has been removed.',
  },
  "editor.diff.option.renamed": {
    sv: '{node}: alternativet "{before}" heter nu "{after}".',
    en: '{node}: the option "{before}" is now called "{after}".',
  },
  "editor.diff.option.reordered": {
    sv: "{node}: alternativen har fått en ny ordning.",
    en: "{node}: the options are in a new order.",
  },
  "editor.diff.content.heading": { sv: "{node}: rubriken har ändrats.", en: "{node}: the heading has changed." },
  "editor.diff.content.other": { sv: "{node}: innehållet har ändrats.", en: "{node}: the content has changed." },
  "editor.diff.page.moved": {
    sv: '{page}: fältet "{field}" har flyttats.',
    en: '{page}: the field "{field}" has moved.',
  },
  "editor.diff.none": {
    sv: "Inga ändringar i innehållet som besökaren ser.",
    en: "No changes to the content a visitor sees.",
  },
  "editor.health.clean": { sv: "Inga problem", en: "No problems" },
  "editor.health.summary": { sv: "{errors} fel · {warnings} varningar", en: "{errors} errors · {warnings} warnings" },
  "editor.health.summaryErrors": { sv: "{errors} fel", en: "{errors} errors" },
  "editor.health.summaryWarnings": { sv: "{warnings} varningar", en: "{warnings} warnings" },
  "editor.health.oneError": { sv: "1 fel", en: "1 error" },
  "editor.health.oneWarning": { sv: "1 varning", en: "1 warning" },
  "editor.health.open": { sv: "Visa problem i guiden", en: "Show problems in the guide" },
  "editor.health.close": { sv: "Dölj problem", en: "Hide problems" },
  "editor.health.heading": { sv: "Problem i guiden", en: "Problems in the guide" },
  "editor.health.cleanBody": { sv: "Alla svar leder vidare, alla resultat går att nå och alla variabler sätts någonstans.", en: "Every answer leads somewhere, every result is reachable, and every variable is set somewhere." },
  "editor.health.goToNode": { sv: "Gå till noden", en: "Go to the node" },
  "editor.health.errorLabel": { sv: "Fel", en: "Error" },
  "editor.health.warningLabel": { sv: "Varning", en: "Warning" },
  "editor.health.calculationReadsEmpty": { sv: "\"{node}\": läser \"{name}\", som är tom när besökaren kommer fram — rutan visar streck tills hen svarat. Ge fältet ett startvärde.", en: "\"{node}\": reads \"{name}\", which is empty when the visitor arrives — the box shows a dash until they answer. Give the field a start value." },
  "editor.health.optionWithoutText": { sv: "\"{node}\": svarsalternativ {n} saknar text.", en: "\"{node}\": answer option {n} has no text." },
  // The message at the top of the panel when a mode locks it. Disabled fields
  // without an explanation look broken rather than deliberate.
  // The jump to the next untranslated node. It belongs to the language choice,
  // not to a mode — whoever translates their own guide needs it just as much.
  "editor.toolbar.nextUntranslated": { sv: "Nästa oöversatta", en: "Next untranslated" },
  // "Stop", not "node": since story 017 the button also jumps to the guide's
  // viewer texts, so a guide with three untranslated nodes said "52 nodes
  // remaining". The toolbar's own comment warns against exactly this — a label
  // that promises one thing and says another.
  "editor.toolbar.nextUntranslatedAria": { sv: "Gå till nästa oöversatta text, {n} kvar", en: "Go to the next untranslated text, {n} remaining" },
  "editor.toolbar.allTranslated": { sv: "Allt är översatt", en: "Everything is translated" },
  "editor.mode.readonly.title": { sv: "Läsläge", en: "Read-only" },
  "editor.mode.readonly.body": { sv: "Guiden går inte att ändra här.", en: "The guide cannot be changed here." },
  "editor.mode.translator.title": { sv: "Översättningsläge", en: "Translation mode" },
  "editor.mode.translator.body": { sv: "Bara texterna i det valda språket går att ändra. Källtexten och flödet är låsta.", en: "Only the texts in the selected language can be changed. The source text and the flow are locked." },
  "editor.mode.translator.pickLocale": { sv: "Välj ett språk i verktygsraden för att börja översätta.", en: "Choose a language in the toolbar to start translating." },
  "editor.properties.guide-heading": { sv: "Guiden", en: "The guide" },
  "editor.properties.guide-name": { sv: "Namn", en: "Name" },
  "editor.properties.guide-name-placeholder": { sv: "T.ex. Ansöka om bygglov", en: "E.g. Apply for a building permit" },
  "editor.properties.guide-description": { sv: "Beskrivning", en: "Description" },
  "editor.properties.guide-description-placeholder": { sv: "Vad guiden svarar på, och för vem", en: "What the guide answers, and for whom" },
  "editor.properties.guide-owner": { sv: "Ansvarig", en: "Owner" },
  "editor.properties.guide-owner-description": { sv: "Vem som ansvarar för innehållet. En person, en enhet eller en funktionsbrevlåda.", en: "Who is responsible for the content. A person, a unit or a shared mailbox." },
  "editor.properties.guide-updated": { sv: "Senast ändrad", en: "Last changed" },
  "editor.properties.guide-updated-never": { sv: "Inte sparad än", en: "Not saved yet" },
  /*
   * Mätaren (story 116). En switch, samma form som en nods booleska egenskap
   * redan får — Johan 13/9: "gör en switch ... som vi ibland gjort
   * inställningarna".
   *
   * Texten säger vad besökaren får se, aldrig vad fältet heter i filen: den som
   * bygger en enkät letar efter "hur långt det är kvar", inte efter "progress".
   * Hjälpraden säger tre saker man annars upptäcker själv — att mätaren tar
   * stegmärkningens plats, när man ska låta bli, och att resultatsidan är
   * undantagen.
   */
  "editor.properties.guide-progress-heading": { sv: "För besökaren", en: "For the visitor" },
  "editor.properties.guide-progress": { sv: "Visa hur långt det är kvar", en: "Show how far there is left" },
  "editor.properties.guide-progress-description": {
    sv: "Besökaren ser hur stor del av frågorna och sidorna som är avklarad, i stället för vilket steg i ordningen. Hjälper i en enkät eller en längre ansökan; i en guide på några få steg säger den inget. Resultatsidan säger \"Resultat\" som vanligt.",
    en: "The visitor sees how much of the questions and pages is done, instead of which step in order. It helps in a survey or a longer application; in a guide of a few steps it says nothing. A result page says \"Result\" as before.",
  },
  /*
   * The help above the language boxes.
   *
   * It used to explain what the source *is*, because the editor could change
   * it. They cannot: the source is the host's, set from outside. What they
   * decide is which of the offered languages this guide is available in, so
   * that is what the sentence says.
   */
  "editor.properties.locale-offer-help": {
    sv: "Bocka för de språk guiden ska erbjudas på. Källspråket är alltid med. Att bocka av döljer språket för besökaren — översättningen finns kvar.",
    en: "Tick the languages this guide is offered in. The source is always included. Unticking hides the language from visitors; the translation is kept.",
  },
  /*
   * A language the guide carries that the host no longer offers. It stays in
   * the list, ticked: the translation exists, and dropping it would hide
   * someone's work behind a configuration change.
   */
  "editor.properties.locale-not-offered": {
    sv: "erbjuds inte längre",
    en: "no longer offered",
  },
  "editor.properties.locale-no-viewer-strings": {
    sv: "Visarens texter saknas — värdsystemet registrerar dem",
    en: "Viewer texts missing — the host registers them",
  },
  "editor.properties.locale-translated": {
    sv: "{count} fält översatta",
    en: "{count} fields translated",
  },
  // Changing the source requires the target language to be fully translated.
  // Otherwise every field becomes untranslated at a stroke, and a guide that
  // looked finished suddenly stands at zero.
  "editor.properties.locale-source": { sv: "(källa)", en: "(source)" },
  "editor.properties.languages-heading": { sv: "Språk", en: "Languages" },
  "editor.properties.ui-texts-heading": { sv: "Visartexter", en: "Display texts" },
  "editor.properties.no-node-type": { sv: 'Ingen nodtyp är registrerad för "{type}".', en: 'No node type is registered for "{type}".' },
  "editor.properties.node-type-not-included": { sv: 'Nodtypen "{label}" ingår inte i den valda funktionsnivån. Nodens data finns kvar oförändrad.', en: 'The node type "{label}" is not part of the selected feature level. The node\'s data is kept unchanged.' },
  "editor.properties.field-width": { sv: "Fältbredd", en: "Field width" },
  "editor.properties.field-width-full": { sv: "Helbredd", en: "Full width" },
  "editor.properties.field-width-half": { sv: "Halvbredd", en: "Half width" },
  "editor.properties.field-width-third": { sv: "Tredjedelsbredd", en: "Third width" },
  "editor.properties.field-width-help": { sv: "Halvbreda fält ryms två i rad och tredjedelsbreda fält tre i rad. På mobil visas de i helbredd.", en: "Half-width fields fit two per row and third-width fields three per row. On mobile they display at full width." },
  "editor.properties.break-before": { sv: "Ny rad före", en: "New row before" },
  "editor.properties.node-type": { sv: "Nodtyp", en: "Node type" },
  "editor.properties.template": { sv: "Mall", en: "Template" },
  "editor.properties.template-none": { sv: "Ingen mall", en: "No template" },
  // A template that was removed. The node still carries the key — without it
  // the template cannot be reconstructed — so it should show in the picker
  // rather than silently drop away.
  "editor.properties.template-missing": {
    sv: "Saknad mall ({type})",
    en: "Missing template ({type})",
  },
  "editor.properties.template-hint": {
    sv: "Styr bara vad noden heter. Att byta eller ta bort påverkar inga egenskaper.",
    en: "Only affects what the node is called. Switching or removing changes no properties.",
  },
  "editor.properties.module": { sv: "Modul", en: "Module" },
  "editor.properties.node-select-none": { sv: "— ingen —", en: "— none —" },
  "editor.properties.mapStart.none": { sv: "Ingen startvy vald — kartan öppnar där värdens karta själv börjar.", en: "No start view chosen — the map opens where the host's map begins." },
  "editor.properties.mapStart.pick": { sv: "Välj på kartan", en: "Pick on the map" },
  "editor.properties.mapStart.clear": { sv: "Rensa", en: "Clear" },
  "editor.properties.mapStart.noProvider": { sv: "Ingen karta inkopplad här — startvyn väljs där en kartleverantör finns.", en: "No map connected here — the start view is chosen where a map provider exists." },
  "editor.properties.variable-type": { sv: "Variabeltyp", en: "Variable type" },
  "editor.properties.position": { sv: "Position", en: "Position" },
  "editor.properties.conditional-visibility": { sv: "Villkorsstyrd synlighet", en: "Conditional visibility" },
  "editor.properties.variable": { sv: "Variabel", en: "Variable" },
  /*
   * Avstängd väljare som säger varför. En tom lista går inte att skilja från en
   * trasig, och redaktören ska veta vad som ska göras: skapa en fråga med
   * formatet e-post.
   */
  /* Ett valt värde vars fråga bytt format eller tagits bort. Det står kvar i
     listan, märkt, i stället för att tyst försvinna ur panelen. */
  "editor.properties.variable-gone": { sv: "frågan finns inte längre", en: "the question is gone" },
  /* Etiketten i nodkortets fot. Kort med flit: den står bredvid variabelnamnet
     på ett fält som kan vara 198 px brett. */
  "editor.properties.recipient-add": { sv: "Lägg till mottagare …", en: "Add recipient …" },
  "editor.properties.recipient-all-chosen": { sv: "Alla i katalogen är valda", en: "Every recipient in the catalog is chosen" },
  "editor.properties.recipient-remove": { sv: "Ta bort {name}", en: "Remove {name}" },
  /* Ett id vars rad tagits ur katalogen. Det står kvar, märkt — samma regel som
     e-postväljaren fick i story 054: tysta bort ingenting. */
  /* Läses upp av `aria-live` efter en ändring: den som ser etiketten dyka upp
     får svaret gratis, en skärmläsare får ingenting utan de här. Antalet är med
     för att det är hela poängen med ett flerval. */
  "editor.properties.recipient-added": { sv: "{label} tillagd. {n} valda.", en: "{label} added. {n} chosen." },
  "editor.properties.recipient-added-one": { sv: "{label} tillagd. 1 vald.", en: "{label} added. 1 chosen." },
  "editor.properties.recipient-removed": { sv: "{label} borttagen. {n} valda.", en: "{label} removed. {n} chosen." },
  "editor.properties.recipient-removed-one": { sv: "{label} borttagen. 1 vald.", en: "{label} removed. 1 chosen." },
  /* What is left to pick from — a recipient is a recipient, not a "value"
     as in the rule picker the control came from. */
  "editor.properties.recipient-count": { sv: "{n} mottagare", en: "{n} recipients" },
  "editor.properties.recipient-one": { sv: "1 mottagare", en: "1 recipient" },
  "editor.properties.recipient-gone": { sv: "finns inte i katalogen", en: "not in the catalog" },
  "editor.node.required": { sv: "obligatorisk", en: "required" },
  "editor.properties.no-email-question": { sv: "Ingen fråga med formatet e-post finns i guiden", en: "No question with the email format exists in this guide" },
  "editor.properties.select-variable": { sv: "Välj variabel", en: "Select variable" },
  "editor.properties.condition": { sv: "Villkor", en: "Condition" },
  "editor.properties.op-equals": { sv: "Är lika med", en: "Is equal to" },
  "editor.properties.op-not-equals": { sv: "Är inte lika med", en: "Is not equal to" },
  "editor.properties.tryout-label": { sv: "Pröva ett värde", en: "Try a value" },
  "editor.properties.tryout-placeholder": { sv: "Skriv något och se vad som händer", en: "Type something and see what happens" },
  "editor.properties.tryout-passes": { sv: "Godkänns.", en: "Accepted." },
  "editor.properties.tryout-help": {
    sv: "Prövas mot samma regler som visaren använder. Ingenting sparas i guiden.",
    en: "Checked against the same rules the viewer uses. Nothing is saved in the guide.",
  },
  "editor.properties.validation-heading": { sv: "Validering", en: "Validation" },
  /*
   * Folden längst ned i panelen: variabelnamnet, dess etikett, CSS-klasserna.
   * *Avancerat* och inte *Tekniskt* — ordet säger att det finns mer här för
   * den som vill, inte att det som står ovanför är otekniskt.
   */
  "editor.properties.advanced-heading": { sv: "Avancerat", en: "Advanced" },
  "editor.properties.op-one-of": { sv: "Är någon av", en: "Is one of" },
  "editor.properties.op-not-one-of": { sv: "Är inte någon av", en: "Is not one of" },
  /*
   * Samma operatorer, ett ord som följer variabeln.
   *
   * Johan på plattan 31/8, om `land.value är någon av XS`: *"borde det inte
   * vara lika med?"* Villkoret var rätt — svaret är en lista och `one-of`
   * betyder "något av dina svar finns i listan" — men ORDET är skrivet för ett
   * svar mot flera värden, och det läses som att svaret är ett.
   *
   * "Innehåller" säger vad frågan gäller: listan, inte värdet. Och de fyra ska
   * läsas som fyra olika frågor, inte som två plus två varianter, vilket är
   * varför `all-of` heter *innehåller bara* och inte *innehåller alla* — det
   * senare läses som "innehåller något av", som är den fråga den INTE är.
   *
   * `all-of`/`not-all-of` har ett ord och inte två: de erbjuds bara på en
   * flervärd variabel, och på en envärd kan de bara nås av en graf någon
   * skrivit för hand. Att uppfinna ett andra ord för det fallet vore ett ord
   * ingen skulle se.
   */
  "editor.properties.op-one-of-multi": { sv: "Innehåller något av", en: "Contains any of" },
  "editor.properties.op-not-one-of-multi": { sv: "Innehåller inget av", en: "Contains none of" },
  "editor.properties.op-all-of": { sv: "Innehåller bara", en: "Contains only" },
  "editor.properties.op-not-all-of": { sv: "Innehåller annat än", en: "Contains something other than" },
  "editor.properties.op-list-hint": {
    sv: "Flera värden, åtskilda med komma. T.ex. SE, DK, FI",
    en: "Several values, separated by commas. For example SE, DK, FI",
  },
  "editor.properties.op-greater-than": { sv: "Är större än", en: "Is greater than" },
  "editor.properties.op-greater-than-or-equal": { sv: "Är minst", en: "Is at least" },
  "editor.properties.op-less-than": { sv: "Är mindre än", en: "Is less than" },
  "editor.properties.op-less-than-or-equal": { sv: "Är högst", en: "Is at most" },
  "editor.properties.value": { sv: "Värde", en: "Value" },
  "editor.properties.move-option": { sv: "Flytta {label}", en: "Move {label}" },
  "editor.properties.drag-to-reorder": { sv: "Dra för att ändra ordning", en: "Drag to reorder" },
  "editor.properties.option-n": { sv: "Alternativ {number}", en: "Option {number}" },
  "editor.properties.move-option-up": { sv: "Flytta {label} uppåt", en: "Move {label} up" },
  "editor.properties.move-option-down": { sv: "Flytta {label} nedåt", en: "Move {label} down" },
  /*
   * The rating's rows (story 115). A step is not an option — it has no value
   * of its own — so it says *Steg 2* and the buttons say *steget*.
   */
  "editor.properties.rating-step-n": { sv: "Steg {number}", en: "Step {number}" },
  "editor.properties.move-rating-step-up": { sv: "Flytta steget uppåt", en: "Move step up" },
  "editor.properties.move-rating-step-down": { sv: "Flytta steget nedåt", en: "Move step down" },
  "editor.properties.label": { sv: "Etikett", en: "Label" },
  "editor.properties.source-reference": { sv: "Källa ({locale}): {source}", en: "Source ({locale}): {source}" },
  "editor.properties.remove": { sv: "Ta bort", en: "Remove" },
  /*
   * Berättelse 062. "Utesluter andra val" och inte "Enda val" eller "Står
   * ensamt": redaktören ska läsa vad knappen GÖR med de andra alternativen,
   * för det är där verkan syns. Erbjuds bara på en flervalsfråga.
   */
  "editor.properties.option-exclusive": {
    sv: "Utesluter andra val",
    en: "Excludes other choices",
  },
  /*
   * Etapp 2 (UPPDRAG-2026-09-28-SVARSALTERNATIV, 28/9): hjälptexten från
   * konceptbilden, under "Utesluter andra val" i det utfällda alternativet.
   */
  "editor.properties.option-exclusive-hint": {
    sv: "När detta väljs kan inga andra alternativ väljas.",
    en: "When this is chosen, no other options can be chosen.",
  },
  /*
   * Etapp 2 (UPPDRAG-2026-09-28-SVARSALTERNATIV, 28/9): konceptbildens
   * "+ Lägg till svarsalternativ" — samma handling, ordet matchar nu
   * sektionens egen rubrik ("Svarsalternativ") i stället för det
   * generiska "alternativ" som andra `control: "options"`-fält (Egen
   * lista) fortfarande använder sin egen etikett för.
   */
  "editor.properties.add-option": { sv: "Lägg till svarsalternativ", en: "Add answer option" },
  /*
   * Platshållaren för ett tomt alternativ (Ted, etapp 2) — skrivs ALDRIG
   * till datamodellen, bara visad medan `label` är tomt. Namnet
   * `option-untitled` är ledarens samordning (28/9), inte mitt eget val —
   * så Ted inte lägger en andra, olikanamnd nyckel för samma platshållare.
   */
  "editor.properties.option-untitled": { sv: "Nytt alternativ", en: "New option" },
  "editor.properties.options-count": { sv: "{count} alternativ", en: "{count} options" },
  "editor.properties.option-label-field": { sv: "Svarsalternativ", en: "Answer option" },
  "editor.properties.option-storage-label": { sv: "Lagringsvärde", en: "Storage value" },
  "editor.properties.remove-option-full": { sv: "Ta bort alternativ", en: "Remove option" },
  "editor.properties.option-expand": { sv: "Visa {label}", en: "Show {label}" },
  "editor.properties.option-collapse": { sv: "Dölj {label}", en: "Hide {label}" },
  "editor.properties.format-bold": { sv: "Fet", en: "Bold" },
  "editor.properties.format-italic": { sv: "Kursiv", en: "Italic" },
  "editor.properties.format-link": { sv: "Länk", en: "Link" },
  "editor.properties.format-bullet-list": { sv: "Punktlista", en: "Bulleted list" },
  "editor.properties.format-numbered-list": { sv: "Numrerad lista", en: "Numbered list" },
  /*
   * The plus in every text and formula field, and its menu: one name and the
   * same tooltip (Astra 30/9, B9). It was "Lägg till" in the text field
   * (Johans val 26/9: the menu may offer more than answers, so the button's
   * name must not lock in what is behind it) and "Infoga variabel" in the
   * formula — the same action under two names. "Variabel" holds both: an
   * answer is a variable, and so is a calculation.
   *
   * Menyns första grupp hette "Svar"; Astras förslag (Johan 28/9, skickat
   * "för bättring av menyn") döper om den till "Svar från guiden" — samma
   * nyckel, nytt värde, ingen ny sträng.
   */
  "editor.properties.insert-variable": { sv: "Infoga variabel", en: "Insert variable" },
  "editor.properties.answers-group": { sv: "Svar från guiden", en: "Answers from the guide" },
  /*
   * Johans iPad 27/9: en egen grupp för det ingen fråga satte (`idag`
   * i dag, fler kan komma). Ett förslag bland tre — Funktioner, Inbyggt,
   * Datum — se rapporten till Johan; byte är den här raden.
   */
  "editor.properties.computed-group": { sv: "Inbyggt", en: "Built-in" },
  "editor.properties.formula-calculations-group": { sv: "Uträkningar", en: "Calculations" },
  "editor.properties.formula-answers-group": { sv: "Svar", en: "Answers" },
  /*
   * Johans iPad 27/9: plusset heter "Stäng" medan menyn står öppen — ett
   * kryss (samma ikon, roterad 45°), inte ett andra ord för samma knapp.
   */
  "editor.properties.close-menu": { sv: "Stäng", en: "Close" },
  // Story 136: the rich text field — under the field, on a chip, in the link dialog, and in text mode.
  "editor.properties.rich-text-hint": { sv: "Formateringen visas direkt i texten.", en: "Formatting shows directly in the text." },
  "editor.properties.rich-text-text-mode": {
    sv: "Texten innehåller något som inte kan visas formaterat, så den visas som den är lagrad.",
    en: "The text holds something that cannot be shown formatted, so it is shown as it is stored.",
  },
  "editor.properties.answer-chip": { sv: "{label}, svar", en: "{label}, answer" },
  // Story 139: the formula's chip is a variable.
  "editor.properties.variable-chip": { sv: "{label}, variabel", en: "{label}, variable" },
  "editor.properties.variable-search": { sv: "Sök variabel", en: "Search variables" },
  // Story 143 (Astras ord 30/9): the condition row's searchable field picker.
  "editor.properties.field-picker-search": { sv: "Sök fråga eller variabel", en: "Search question or variable" },
  "editor.properties.field-picker-none": { sv: "Inga träffar", en: "No matches" },
  "editor.properties.field-picker-placeholder": { sv: "Välj fråga eller variabel", en: "Choose a question or variable" },
  "editor.properties.field-picker-clear": { sv: "Rensa sökningen", en: "Clear the search" },
  "editor.properties.field-picker-count": { sv: "{n} träffar av {total}", en: "{n} matches of {total}" },
  "editor.properties.field-picker-count-one": { sv: "1 träff av {total}", en: "1 match of {total}" },
  "editor.properties.link-address": { sv: "Adress", en: "Address" },
  "editor.properties.link-add": { sv: "Lägg till länk", en: "Add link" },
  "editor.properties.format-text": { sv: "Formatera text", en: "Format text" },
  "editor.properties.no-variables-to-send": { sv: "Inga variabler att skicka ännu.", en: "No variables to send yet." },
  "editor.properties.row-n": { sv: "Rad {number}", en: "Row {number}" },
  "editor.properties.response-field": { sv: "Fält i svaret", en: "Field in the response" },
  "editor.properties.response-field-placeholder": { sv: "t.ex. maxLoan", en: "e.g. maxLoan" },
  "editor.properties.mapping-variable-placeholder": { sv: "t.ex. maxLån", en: "e.g. maxLoan" },
  "editor.properties.remove-row": { sv: "Ta bort raden", en: "Remove row" },
  "editor.properties.add-field": { sv: "Lägg till fält", en: "Add field" },
  "editor.properties.available-variables": { sv: "Tillgängliga variabler:", en: "Available variables:" },
  "editor.properties.assignment-variable-placeholder": { sv: "t.ex. lån", en: "e.g. loan" },
  // Story 078: the row's own alias, shown before the name wherever a question's alias is.
  "editor.properties.assignment-label-placeholder": { sv: "t.ex. Maxlån — visas i stället för namnet", en: "e.g. Maximum loan — shown instead of the name" },
  "editor.properties.formula": { sv: "Formel", en: "Formula" },
  "editor.properties.formula-placeholder": { sv: "t.ex. pris - kontantinsats", en: "e.g. price - down payment" },
  "editor.properties.add-calculation": { sv: "Lägg till uträkning", en: "Add calculation" },
  // Story 092: the row the errand is in the receiver's list — the first column is the title.
  "editor.properties.column-n": { sv: "Kolumn {number}", en: "Column {number}" },
  "editor.properties.column-title": { sv: "Kolumn 1 — Titel", en: "Column 1 — Title" },
  "editor.properties.column-heading": { sv: "Rubrik", en: "Heading" },
  "editor.properties.column-heading-placeholder": { sv: "t.ex. Adress", en: "e.g. Address" },
  "editor.properties.column-cell": { sv: "Cell", en: "Cell" },
  "editor.properties.column-cell-placeholder": { sv: "t.ex. {{namn}} — Enter ger en radbrytning", en: "e.g. {{namn}} — Enter gives a line break" },
  "editor.properties.remove-column": { sv: "Ta bort kolumnen", en: "Remove column" },
  "editor.properties.add-column": { sv: "Lägg till kolumn", en: "Add column" },
  "editor.properties.rule-n": { sv: "Regel {number}", en: "Rule {number}" },
  "editor.properties.rule-name": { sv: "Regelns namn", en: "Rule name" },
  "editor.properties.add-condition": { sv: "Lägg till villkor", en: "Add condition" },
  "editor.properties.remove-rule": { sv: "Ta bort regeln", en: "Remove rule" },
  "editor.properties.add-rule": { sv: "Lägg till regel", en: "Add rule" },
  // The empty collection's instruction (Astra 30/9, attachment 4).
  "editor.properties.empty-rules": { sv: "Inga regler har lagts till ännu. Lägg till den första regeln.", en: "No rules have been added yet. Add the first rule." },
  "editor.properties.empty-options": { sv: "Frågan har inga svarsalternativ ännu. Lägg till det första.", en: "The question has no answer options yet. Add the first one." },
  // A condition list (uppdrag 29/9 Del B, Astra §3–§5): the combine selector,
  // the still word between groups, a group's heading, the lock.
  "editor.properties.combine-conditions": { sv: "Kombinera villkor", en: "Combine conditions" },
  "editor.properties.match-all-conditions": { sv: "Alla villkor", en: "All conditions" },
  "editor.properties.match-any-condition": { sv: "Minst ett villkor", en: "At least one condition" },
  "editor.properties.join-all": { sv: "OCH", en: "AND" },
  "editor.properties.join-any": { sv: "ELLER", en: "OR" },
  "editor.properties.condition-n": { sv: "Villkor {number}", en: "Condition {number}" },
  "editor.properties.locked-structure": { sv: "Låst struktur", en: "Locked structure" },
  "editor.properties.rules-locked": { sv: "Regler med flera villkor har låst struktur. Du kan ändra värdena. Aktivera Logik för att ändra kombinationen eller lägga till och ta bort villkor.", en: "Rules with several conditions have a locked structure. You can change the values. Turn on Logic to change the combination or to add and remove conditions." },
  // The rule list's last card: the `default` exit (uppdrag 29/9 Del A, Astra §6).
  "editor.properties.otherwise": { sv: "Annars", en: "Otherwise" },
  "editor.properties.otherwise-help": { sv: "När ingen regel uppfylls", en: "When no rule is met" },
  "editor.properties.otherwise-name": { sv: "Namn på utfallet", en: "Name of the outcome" },
  // Calculation cards (Astra §7): the head's fallback, the list's still line, the fields.
  "editor.properties.assignment-untitled": { sv: "Ny uträkning", en: "New calculation" },
  "editor.properties.assignments-order": { sv: "Uträkningarna körs uppifrån. Senare rader kan använda resultat från tidigare.", en: "Calculations run from the top. Later rows can use the results of earlier ones." },
  "editor.properties.variable-name": { sv: "Variabelnamn", en: "Variable name" },
  "editor.properties.remove-calculation": { sv: "Ta bort uträkningen", en: "Remove calculation" },
  /*
   * The formula help under a calculation's formula (uppdrag 29/9 Del D,
   * Astra §10). Only what `formula-evaluator.ts` parses; the examples are
   * formula text and stay untranslated in the markup — a formula names
   * variables, and variables are not words of the interface.
   */
  "editor.formulaHelp.summary": { sv: "Formelhjälp", en: "Formula help" },
  "editor.formulaHelp.write": { sv: "Skriv en formel", en: "Write a formula" },
  "editor.formulaHelp.write-text": { sv: "Använd variabelnamn direkt, till exempel {example}.", en: "Use variable names directly, for example {example}." },
  "editor.formulaHelp.arithmetic": { sv: "Räknesätt", en: "Arithmetic" },
  "editor.formulaHelp.arithmetic-text": { sv: "Plus, minus, gånger, delat med och parenteser", en: "Plus, minus, times, divided by and parentheses" },
  "editor.formulaHelp.numbers": { sv: "Tal och argument", en: "Numbers and arguments" },
  "editor.formulaHelp.numbers-decimals": { sv: "Decimaler: {comma} eller {point}", en: "Decimals: {comma} or {point}" },
  "editor.formulaHelp.numbers-separator": { sv: "Skilj argument med semikolon: {example}", en: "Separate arguments with a semicolon: {example}" },
  "editor.formulaHelp.common": { sv: "Vanliga funktioner", en: "Common functions" },
  "editor.formulaHelp.round": { sv: "Avrundar till närmaste heltal.", en: "Rounds to the nearest whole number." },
  "editor.formulaHelp.min": { sv: "Väljer det lägsta värdet.", en: "Picks the lowest value." },
  "editor.formulaHelp.max": { sv: "Väljer det högsta värdet.", en: "Picks the highest value." },
  "editor.formulaHelp.pow": { sv: "Upphöjer ett tal, till exempel {example}.", en: "Raises a number to a power, for example {example}." },
  "editor.formulaHelp.more": { sv: "Fler funktioner", en: "More functions" },
  "editor.formulaHelp.floor": { sv: "Avrundar nedåt.", en: "Rounds down." },
  "editor.formulaHelp.ceil": { sv: "Avrundar uppåt.", en: "Rounds up." },
  "editor.formulaHelp.abs": { sv: "Talet utan tecken.", en: "The number without its sign." },
  "editor.formulaHelp.sqrt": { sv: "Kvadratroten.", en: "The square root." },
  "editor.formulaHelp.dates": { sv: "Datum och ålder", en: "Dates and age" },
  "editor.formulaHelp.age": { sv: "Åldern i hela år, ur ett personnummer eller ett datum.", en: "The age in whole years, from a personnummer or a date." },
  "editor.formulaHelp.days": { sv: "Antalet dagar mellan två datum.", en: "The number of days between two dates." },
  "editor.formulaHelp.today": { sv: "Dagens datum.", en: "Today's date." },
  "editor.formulaHelp.example": { sv: "Exempel:", en: "Example:" },
  "editor.formulaHelp.footnote": { sv: "Infoga variabel hämtar namnet från guiden.", en: "Insert variable takes the name from the guide." },
  "editor.properties.variable-missing": { sv: "{name} (saknas)", en: "{name} (missing)" },
  "editor.properties.select-value": { sv: "Välj värde", en: "Select value" },
  "editor.properties.value-missing": { sv: "{value} (saknas)", en: "{value} (missing)" },
  "editor.properties.value-search": { sv: "Sök bland värdena…", en: "Search the values…" },
  "editor.properties.value-pick-variable": { sv: "Välj variabel först", en: "Choose a variable first" },
  /*
   * Värdeväljarens texter, med KONTROLLENS platshållarnamn.
   *
   * Panelen lånade mottagarlistans strängar en stund, och de fyller `{name}`
   * och `{count}` medan kontrollen fyller `{label}` och `{n}`. Två uppsättningar
   * namn som aldrig möttes: statusraden sa "{name} borttagen. {count} valda."
   * rakt ut. Texten fanns — den var bara aldrig ifylld.
   */
  "editor.properties.value-remove": { sv: "Ta bort {label}", en: "Remove {label}" },
  "editor.properties.value-added": { sv: "{label} tillagt. {n} valda.", en: "{label} added. {n} selected." },
  "editor.properties.value-added-one": { sv: "{label} tillagt. 1 vald.", en: "{label} added. 1 selected." },
  "editor.properties.value-removed": { sv: "{label} borttaget. {n} valda.", en: "{label} removed. {n} selected." },
  "editor.properties.value-removed-one": { sv: "{label} borttaget. 1 vald.", en: "{label} removed. 1 selected." },
  // What the value picker counts (uppdrag 29/9 Del D, Astra §11): what is
  // left to choose, or the matches while a term is typed. It said "{n} värden".
  "editor.properties.value-count": { sv: "{n} kvar att välja", en: "{n} left to choose" },
  "editor.properties.value-one": { sv: "1 kvar att välja", en: "1 left to choose" },
  "editor.properties.value-matches": { sv: "{n} träffar", en: "{n} matches" },
  "editor.properties.value-one-match": { sv: "1 träff", en: "1 match" },
  "editor.properties.value-none": { sv: "Inga träffar på {term}", en: "No matches for {term}" },
  "editor.properties.value-more": { sv: "{n} till — sök för att hitta dem", en: "{n} more — search to find them" },
  "editor.properties.remove-condition": { sv: "Ta bort villkoret", en: "Remove condition" },
  "editor.properties.variable-type-number": { sv: "Siffra", en: "Number" },
  "editor.properties.variable-type-choice": { sv: "Svarsalternativ", en: "Answer options" },
  "editor.properties.variable-type-text": { sv: "Text", en: "Text" },
  "editor.properties.bold-placeholder-text": { sv: "fet text", en: "bold text" },
  "editor.properties.italic-placeholder-text": { sv: "kursiv text", en: "italic text" },
  "editor.properties.link-placeholder-text": { sv: "länktext", en: "link text" },
  "editor.properties.list-item-placeholder": { sv: "Listpunkt", en: "List item" },
  "editor.properties.annotation-placeholder": { sv: "Kommentar", en: "Comment" },
  "editor.properties.add-comment": { sv: "Lägg till kommentar", en: "Add comment" },
  "editor.properties.remove-comment": { sv: "Ta bort kommentaren", en: "Remove comment" },
  "editor.properties.annotation-arrow": { sv: "Pil", en: "Arrow" },
  "editor.properties.move-comment": { sv: "Flytta kommentar {number} på bilden", en: "Move comment {number} on the image" },

  // Canvasen och noderna
  "editor.canvas.emptyTitle": { sv: "Tom arbetsyta", en: "Empty canvas" },
  "editor.canvas.emptyQuickStart": { sv: "Eller börja från ett färdigt recept: Arkiv → Snabbstart: formulär.", en: "Or start from a ready recipe: File → Quick start: form." },
  "editor.canvas.emptyText": { sv: "Dra ut din första nod från paletten till vänster för att börja bygga guiden.", en: "Drag your first node from the palette on the left to start building the guide." },
  "editor.canvas.connectFrom": {
    sv: "Kopplar från {port}. Välj en ingång, eller Esc för att avbryta.",
    en: "Connecting from {port}. Choose an input, or Esc to cancel.",
  },
  "editor.canvas.connectDone": {
    sv: "{from} kopplad till {to}.",
    en: "{from} connected to {to}.",
  },
  "editor.canvas.connectRefused": {
    sv: "Går inte att koppla dit.",
    en: "That cannot be connected.",
  },
  "editor.canvas.connectCancelled": {
    sv: "Kopplingen avbruten.",
    en: "Connection cancelled.",
  },
  "editor.canvas.setStartNode": { sv: "Gör till startnod", en: "Make start node" },
  // "Hit", not "härifrån": the question is how somebody ends up at this node,
  // which is the one you ask about a refusal.
  "editor.canvas.duplicate": { sv: "Duplicera", en: "Duplicate" },
  "editor.canvas.updateTemplate": { sv: "Uppdatera mall", en: "Update template" },
  "editor.canvas.recreateTemplate": {
    sv: "Återskapa mall",
    en: "Recreate template",
  },
  "editor.canvas.exportTemplate": { sv: "Exportera som mall", en: "Export as template" },
  "editor.canvas.detachTemplate": {
    sv: "Ta bort mall",
    en: "Remove template",
  },
  "editor.canvas.saveAsTemplate": { sv: "Spara som mall", en: "Save as template" },

  /*
   * The version list. The words a host would otherwise have to invent, and
   * every one of them is a decision: "Visa den" rather than "Aktivera" because
   * an editor is choosing what a resident sees, not switching a mode, and
   * "Anteckning" rather than "Alias" because they are naming a moment rather
   * than an identifier.
   */
  /*
   * The pair that kept being misread, and the fix is in the words rather than
   * in the layout. "Öppna" and "Visa den" both sound like *look at it*, and the
   * difference between them is not what happens — it is **who sees it**. Only
   * me, or every visitor. So each label says whose eyes it is about, and the
   * length is worth it: this is the one place in the list where pressing the
   * wrong button is expensive.
   */
  "editor.versions.open": { sv: "Öppna i editorn", en: "Open in the editor" },
  /*
   * "Publicera", eftersom märket heter "Publicerad".
   *
   * Det var "Visa för besökare", vilket sa vems ögon det handlar om och inte
   * hette samma sak som tillståndet det leder till. Verb och particip av ett ord
   * är starkare än två uttryck för en sak: man trycker Publicera och raden säger
   * Publicerad.
   *
   * Det är dessutom ordet redaktören redan tryckt på tusen gånger i sitt CMS.
   *
   * **Ordet säger vad, aldrig när.** I en värd som buffrar sina inställningar
   * händer ingenting förrän dialogen sparas, och i en som skriver direkt händer
   * det med en gång. Bara värden vet vilket, så tidpunkten hör hemma i värdens
   * egen fråga — precis som med Ta bort.
   */
  "editor.versions.activate": { sv: "Publicera", en: "Publish" },
  /*
   * Vad man gör när arbetet i editorn ska in i den version man står i.
   *
   * "Spara", inte "Spara över". Det hette det senare medan skrivandet gick rakt
   * in i versionen och knappen fanns för undantaget — då var ersättandet det
   * ovanliga och värt att säga. Med utkast är det tvärtom: det man har är ett
   * utkast av den här versionen, och att spara det är den vanliga vägen ut.
   *
   * Ett ord för det man gör oftast ska vara det korta.
   */
  "editor.versions.save": { sv: "Spara", en: "Save" },
  /*
   * Att kasta ett utkast, bredvid att spara det. Två utgångar ur samma
   * tillstånd, lika stora — den ena bakom en meny hade gjort den till något man
   * letar efter, och det är fel sorts ansträngning för ett beslut någon redan
   * fattat.
   */
  "editor.versions.discard": { sv: "Kasta", en: "Discard" },
  /*
   * Att ta en gammal version som den man arbetar i.
   *
   * "Återställ", Apples ord i Time Machine och i Versioner, valt 17/9 framför
   * "Öppna som arbetskopia" — det senare förklarar mekaniken (att det blir ett
   * utkast) för någon som bara vill tillbaka till det som fungerade. Ordet är
   * dessutom redan inlärt: det är vad man trycker på i varje system som håller
   * historik.
   *
   * Det säger inget om vad besökarna ser, och det är med flit: att återställa
   * ändrar arbetskopian, aldrig den publicerade versionen. Den vägen heter
   * Publicera och kostar ett eget beslut.
   */
  "editor.versions.restore": { sv: "Återställ", en: "Restore" },
  /*
   * Samma handling, med versionen i namnet — det knappen faktiskt visar.
   *
   * *Återställ* ensamt läser som *ångra allt*; med raden bredvid sig är det
   * tydligt för den som ser hela listan, och otydligt för den som hör knappen
   * läsas upp eller bara tittar på den. Berättelse 124, kriterium 22: ordet är
   * aldrig ensamt.
   */
  /*
   * Radens namn när värden numrerar sina versioner. Ordet är samma som
   * kolumnrubriken, och numret är värdens — listan räknar aldrig själv.
   */
  "editor.versions.numbered": { sv: "Version {number}", en: "Version {number}" },
  "editor.versions.restoreNamed": { sv: "Återställ {version}", en: "Restore {version}" },
  /*
   * ── Krockfrysningarna (berättelse 131) ─────────────────────────────────
   *
   * Två rader per krock, och Johan mätte 20/9 att de inte gick att skilja: de
   * hette båda *Sparad vid krock*, stod på samma minut, och sa *av Anna
   * Andersson* om bådas arbete — för hon var den som slog ihop.
   *
   * Raden säger därför **vems kopia** det är, och den byggs här och lagras
   * aldrig: vem *du* är beror på vem som läser, och en lagrad etikett hade
   * sagt *din* om någon annans arbete första gången en kollega öppnade
   * historiken.
   *
   * `{owner}` är namnet i genitiv, räknat av `possessive.ts` — svenskan och
   * engelskan böjer olika, och ett namn som slutar på s böjs inte alls i
   * svenskan.
   */
  "editor.versions.conflict": { sv: "Sparad vid krock", en: "Saved at a clash" },
  "editor.versions.conflictTheirs": {
    sv: "Sparad vid krock · {owner} kopia",
    en: "Saved at a clash · {owner} copy",
  },
  "editor.versions.conflictMine": {
    sv: "Sparad vid krock · din kopia",
    en: "Saved at a clash · your copy",
  },
  /*
   * Och knappen, som är kortare än rubriken med flit (Johan 20/9: *"Återställ
   * Sparad vid krock är otympligt"*). Regeln *aldrig ett ensamt Återställ*
   * står kvar — knappen bär vems kopia det är, vilket är det som skiljer
   * raderna åt. Att upprepa *Sparad vid krock* i knappen hade varit den
   * uppgiften en tredje gång på samma rad.
   */
  "editor.versions.restoreConflictTheirs": {
    sv: "Återställ {owner} kopia",
    en: "Restore {owner} copy",
  },
  "editor.versions.restoreConflictMine": { sv: "Återställ din kopia", en: "Restore your copy" },
  "editor.versions.restoreConflict": {
    sv: "Återställ kopian från krocken",
    en: "Restore the copy from the clash",
  },
  "editor.versions.duplicate": { sv: "Duplicera", en: "Duplicate" },
  "editor.versions.rename": { sv: "Byt namn", en: "Rename" },
  "editor.versions.note": { sv: "Anteckning", en: "Note" },
  "editor.versions.delete": { sv: "Ta bort", en: "Remove" },
  /*
   * The one control that stays on the row, and what it opens.
   *
   * Six labelled buttons per row read as six offers of equal weight, and they
   * took five sixths of the width — the version's own name was down to six
   * characters while "Duplicera" had room to spare. The words are worth more
   * than the buttons: they move into a menu and keep their length.
   */
  "editor.versions.actions": { sv: "Åtgärder", en: "Actions" },
  /*
   * The state, in the word the editor already uses for it.
   *
   * It read "Visas för besökare" — the same words as the button that gets you
   * there, so that pressing an action and reading the state back matched. That
   * mattered while the six actions were spread across the row and the badge was
   * the only thing distinguishing them. The action now sits beside the badge
   * with its own label, so the pairing is on screen rather than in the wording,
   * and the badge can go back to being one word.
   *
   * "Publicerad" over "Aktiv" or "Live": it is the verb this editor's own CMS
   * uses, and the one they have already pressed a hundred times. "Live" is
   * jargon in Swedish, and "Aktiv" says in use without saying by whom.
   *
   * Worth knowing: a page can be unpublished in Sitevision while this version
   * is still the one the module would render. The badge is about the version,
   * not the page — green means *this is the one residents get*, not *residents
   * can reach it*.
   */
  "editor.versions.current": {
    sv: "Publicerad",
    en: "Published",
  },
  /*
   * Var det man skriver kom ifrån. Samma ord som knappen som tog en dit —
   * tryck "Öppna i editorn" och raden säger att den är öppen.
   */
  "editor.versions.openState": { sv: "Öppen", en: "Open" },
  /*
   * Sägs, varnas inte om. Någon mitt i en mening har en mening, inte ett
   * problem — och ordet står på raden arbetet hör till, inte i ett hörn.
   */
  "editor.versions.draftState": { sv: "Utkast", en: "Draft" },
  "editor.versions.missing": { sv: "borttagen", en: "removed" },
  /*
   * Vem som frös versionen, under dess namn i historiken (berättelse 126).
   * Värden skriver namnet ur sin egen session; listan bara läser det, och
   * ritar ingen rad alls när värden inte har någon inloggning att fråga.
   */
  "editor.versions.by": { sv: "av {name}", en: "by {name}" },
  "editor.versions.empty": { sv: "Inga versioner än.", en: "No versions yet." },
  "editor.versions.action": {
    sv: "{action}: {version}",
    en: "{action}: {version}",
  },
  /*
   * Why the live version cannot be removed, on the button itself.
   *
   * Hiding it would be a smaller lie and a worse one: the row would simply be
   * missing an action every other row has, and an editor would go looking for
   * what they did wrong. Disabled with the reason attached answers the question
   * where it is asked.
   */
  "editor.versions.deleteBlocked": {
    sv: "Visa en annan version för besökare först",
    en: "Show another version to visitors first",
  },
  "editor.versions.column.version": { sv: "Version", en: "Version" },
  "editor.versions.column.file": { sv: "Fil", en: "File" },
  "editor.versions.column.saved": { sv: "Sparad", en: "Saved" },
  "editor.versions.column.actions": { sv: "Åtgärder", en: "Actions" },
  "editor.versions.sort": { sv: "Ordning", en: "Order" },
  "editor.versions.sort.saved": { sv: "Senast sparad", en: "Last saved" },
  "editor.versions.sort.label": { sv: "Namn", en: "Name" },
  "editor.versions.sort.custom": { sv: "Egen ordning", en: "Your own order" },
  /*
   * Said once, above the list, rather than as a tooltip on every handle: the
   * keyboard path is the only path for some people, and a hint nobody can
   * reach is not a hint.
   */
  "editor.versions.reorderHint": {
    sv: "Dra för att ändra ordning, eller flytta med Alt + piltangent.",
    en: "Drag to reorder, or move with Alt + arrow key.",
  },
  "editor.versions.move": {
    sv: "Flytta {version}",
    en: "Move {version}",
  },
  "editor.canvas.removeConnection": { sv: "Ta bort koppling", en: "Remove connection" },
  "editor.canvas.connectionColor": { sv: "Färg på kopplingen", en: "Connection colour" },
  "editor.canvas.color.default": { sv: "Standard", en: "Default" },
  "editor.canvas.color.content": { sv: "Indigo", en: "Indigo" },
  "editor.canvas.color.rule": { sv: "Lila", en: "Purple" },
  "editor.canvas.color.calc": { sv: "Turkos", en: "Teal" },
  "editor.canvas.color.service": { sv: "Bärnsten", en: "Amber" },
  "editor.canvas.color.end": { sv: "Grön", en: "Green" },
  "editor.canvas.color.danger": { sv: "Röd", en: "Red" },
  "editor.canvas.removeNode": { sv: "Ta bort nod", en: "Remove node" },
  // The instruction on an empty page. It is an instruction and not content: it
  // is never saved, and never shows in the viewer.
  "editor.canvas.emptyPageHint": { sv: "Dra hit ett fält från paletten", en: "Drag a field here from the palette" },
  "editor.canvas.dropFieldHere": { sv: "Släpp fält här", en: "Drop field here" },
  // The gap rides the health marker's convention: a compact mark in the
  // header, the reason in the mark's name and in the node's accessible name.
  // It used to be a text chip that ate the header's width on every node.
  "editor.node.untranslated": { sv: "Saknar översättning", en: "Missing translation" },
  // The button that opens the canvas menu without a right-click. Named for what
  // it opens, not for how it looks — a screen reader saying "tre punkter" tells
  // nobody anything.
  // Fliken på startnodens axel. Ordet, inte en pil: pilen sa för lite.
  "editor.node.startBadge": { sv: "Start", en: "Start" },
  // The eye and the pencil in a node's header. The button shows what you GET
  // if you press it, so the name changes with the view — and there is no
  // `aria-pressed`, because a name that changes and a pressed state at once is
  // the same fact read twice.
  "editor.node.visitorView": { sv: "Som besökaren ser den", en: "As a visitor sees it" },
  // "Justera", not "Ändra" (Johan 3/9): the panel edits in both views; what
  // only the structure has is the grip, the field menu and the drop zone —
  // order and placement.
  "editor.node.structureView": { sv: "Justera", en: "Adjust" },
  "editor.node.menu": { sv: "Åtgärder för noden", en: "Node actions" },
  // Handtaget mitt på en koppling. Namnger båda ändarna — "koppling" ensamt är
  // oanvändbart i en guide med nio av dem.
  "editor.node.menuClose": { sv: "Stäng åtgärderna", en: "Close the actions" },
  // Syns bara när ingen nod är på skärmen. Säger vart man kommer, inte vad
  // knappen gör med vyn.
  "editor.canvas.backToGuide": { sv: "Tillbaka till guiden", en: "Back to the guide" },
  // Verktygsfältet på canvasen (Uppdrag 23/9, Del A punkt 2). Samma handling som
  // Vy-menyns "Anpassa till innehåll" (fit-to-content-request) — det är en
  // vänligare, snabbare formulering för en knapp man ser hela tiden, inte en
  // ny funktion.
  "editor.canvas.showWholeFlow": { sv: "Visa hela flödet", en: "Show the whole flow" },
  // The zoom bar's reading, said before the number (Uppdrag 29/9, Astra §5:
  // "ett begripligt sammanhang som aktuell zoomnivå"). Hidden text, not a
  // live region — nothing is announced while a pinch runs.
  "editor.canvas.zoomLevel": { sv: "Zoomnivå", en: "Zoom level" },
  // The line at the top of the canvas while a run is going on (story 065).
  // `{total}` is the most steps the guide can be, never a promise of how many
  // this route will take — a branch decides that as it is answered.
  "editor.proving.status": {
    // No total: "of 6" was the LONGEST route, not this run's length — seen
    // as "steg 5 av 6" on a result (Johan 2/9). The viewer never claims one.
    sv: "Provar guiden · steg {step}",
    en: "Trying the guide · step {step}",
  },
  "editor.routes.status": { sv: "Vägar till: {title}", en: "Paths to: {title}" },
  "editor.routes.prompt": { sv: "Tryck på en nod för att se vägarna dit", en: "Press a node to see the paths to it" },
  "editor.proving.restart": { sv: "Börja om", en: "Start over" },
  "editor.proving.end": { sv: "Avsluta", en: "End" },
  // Editing while a run is going on makes the trail a lie, so the run is over
  // and says so. The line stays until it is started again or ended.
  "editor.proving.changed": {
    sv: "Guiden ändrad — börja om",
    en: "The guide changed — start over",
  },
  /*
   * The buttons a run puts where a file picker and a map would be, and the line
   * that admits what they do. Editor keys and not viewer ones: a guide must not
   * be able to reword the tool's own words (story 017), and a visitor never
   * meets them — they exist only while `proving` is on.
   */
  "editor.proving.addPicture": { sv: "Lägg till provbild", en: "Add test picture" },
  "editor.proving.addFile": { sv: "Lägg till provfil", en: "Add test file" },
  "editor.proving.addPlace": { sv: "Peka ut provplats", en: "Mark test location" },
  "editor.proving.standIn": {
    sv: "på låtsas, bara i provet",
    en: "make-believe, only in the run",
  },
  // The answer itself, so the field and the review step (story 049) both read
  // as a place rather than as a pair of coordinates.
  "editor.proving.place": { sv: "Provplats", en: "Test location" },
  /*
   * Pretend answers for a run (story 085): what a host with a login would
   * hand the guide, so a guide that leans on `{{namn}}` can be tried at all.
   * One line per variable; the names nothing declares are listed under it.
   */
  "editor.proving.given": { sv: "Svar från värden", en: "Answers from the host" },
  "editor.proving.givenHint": {
    sv: "En rad per variabel, som en inloggning skulle ge: namn = Anna",
    en: "One line per variable, as a login would give: name = Anna",
  },
  "editor.proving.givenUnmatched": {
    sv: "Ingen nod har: {names}",
    en: "No node has: {names}",
  },
  // What a node's header says instead of the eye while a run is going on.
  "editor.node.here": { sv: "Du är här", en: "You are here" },
  "editor.node.stepBadge": { sv: "Steg {step}", en: "Step {step}" },
  "editor.node.answered": { sv: "besvarad", en: "answered" },
  "editor.canvas.connectionHandle": {
    sv: "Åtgärder för kopplingen från {from} till {to}",
    en: "Actions for the connection from {from} to {to}",
  },
  "editor.node.startNodePrefix": { sv: "Startnod, ", en: "Start node, " },
  "editor.node.unknownType": { sv: 'Ingen nodtyp är registrerad för "{type}".', en: 'No node type is registered for "{type}".' },
  "editor.node.portInput": { sv: "Ingång", en: "Input" },
  "editor.node.portOutput": { sv: "Utgång", en: "Output" },

  // Dialoger, toast och tema-växlaren
  "editor.dialogs.confirmation.cancel": { sv: "Avbryt", en: "Cancel" },
  "editor.dialogs.confirmation.confirm": { sv: "Bekräfta", en: "Confirm" },
  "editor.dialogs.emailOutput.eyebrow": {
    sv: "Producerat e-postunderlag",
    en: "Generated email draft",
  },
  "editor.dialogs.emailOutput.to": { sv: "Till", en: "To" },
  "editor.dialogs.emailOutput.disclaimer": {
    sv: "Detta är bara ett producerat underlag. Inget e-postmeddelande har skickats.",
    en: "This is only a generated draft. No email has been sent.",
  },
  "editor.dialogs.emailOutput.close": { sv: "Stäng", en: "Close" },
  "editor.dialogs.guidePreview.title": {
    sv: "Förhandsgranska guide",
    en: "Preview guide",
  },
  /*
   * Raden som ersätter navigeringen när ett enda steg granskas. Den namnger
   * den andra knappen genom {run}, så de två inte kan glida isär: byter
   * knappens namn ("Prova guiden") följer den här raden med.
   */
  "editor.dialogs.guidePreview.stillNote": {
    sv: "Så här ser steget ut. Välj {run} för att gå igenom guiden.",
    en: "This is how the step looks. Choose {run} to walk through the guide.",
  },
  "editor.dialogs.guidePreview.closeAria": {
    sv: "Stäng förhandsgranskningen",
    en: "Close the preview",
  },
  "editor.theme.darkLabel": { sv: "Mörkt läge", en: "Dark mode" },
  "editor.theme.lightLabel": { sv: "Ljust läge", en: "Light mode" },
  "editor.theme.switchToDark": {
    sv: "Växla till mörkt läge",
    en: "Switch to dark mode",
  },
  "editor.theme.switchToLight": {
    sv: "Växla till ljust läge",
    en: "Switch to light mode",
  },
  "editor.toast.closeAria": { sv: "Stäng meddelandet", en: "Close the message" },

  // Nodregistret: nodtypers namn (översätts via tOr, sv = kodens källtext)
  // The templates that ship with the tool. They are ours, so their names are
  // ours to translate — a Swedish "E-postfråga" beside an English "Question" in
  // the same palette is our fault, not the organisation's. Story 017: what we
  // ship, we can decide about.
  //
  // Templates an administrator wrote have no key here and fall back to the text
  // they typed. That is deliberate — a template name is their vocabulary, and
  // asking them for an English version of their own words would be work in the
  // wrong place.
  "nodeTemplate.nodmall-email.label": { sv: "E-postfråga", en: "Email question" },
  "nodeTemplate.nodmall-phone.label": { sv: "Telefonnummer", en: "Phone number" },
  "nodeTemplate.nodmall-personnummer.label": {
    sv: "Personnummer",
    en: "Personal ID number",
  },

  /*
   * The twelve fields that had no key.
   *
   * Sixty-three already did, which is why an English properties panel was
   * mostly English — and the dozen that were missing are the ones a person
   * meets late: lookups, code values, the annotation's own text. Found by
   * reading the node type definitions against this table rather than by
   * looking at a screen, because the ones you see are the ones you fix.
   *
   * `sv` repeats the source text, as every other entry in this table does.
   * `tOr` never reads it — for Swedish it returns what the node type itself
   * says — but the table's own gate requires it, and a row that lied about
   * having a Swedish would be the harder thing to notice.
   */
  "nodeProp.allowFreeText.description": { sv: "Av: svaret måste väljas ur listan.", en: "Off: the answer has to be chosen from the list." },
  "nodeProp.allowFreeText.label": { sv: "Tillåt egna värden", en: "Allow values of their own" },
  "nodeProp.arrow.label": { sv: "Pil pekar (utan målnod)", en: "Arrow points (with no target node)" },
  "nodeProp.minChars.description": { sv: "Innan ett uppslag görs.", en: "Before a lookup is made." },
  "nodeProp.minChars.label": { sv: "Minsta antal tecken", en: "Fewest characters" },
  "nodeProp.mockItems.description": { sv: "Värdet är koden, etiketten är det användaren ser.", en: "The value is the code, the label is what a person sees." },
  "nodeProp.mockItems.label": { sv: "Egen lista", en: "A list of your own" },
  /*
   * The rating's direction (story 115). The words are the panel's, so they go
   * through `nodeProp`/`nodeOption` like every other property text — the
   * Swedish in `default-node-properties.ts` is the source, this is the English.
   */
  "nodeProp.layout.label": { sv: "Riktning", en: "Direction" },
  "nodeProp.layout.description": {
    sv: "På en rad tar minst plats och är standard. På höjden ger långa ord en egen rad var.",
    en: "A row takes the least room and is the default. Stacked gives long words a line each.",
  },
  "nodeOption.row": { sv: "På en rad", en: "In a row" },
  "nodeOption.column": { sv: "På höjden", en: "Stacked" },
  "nodeProp.source.label": { sv: "Källa", en: "Source" },
  "nodeProp.targetNodeId.label": { sv: "Peka på nod", en: "Point at a node" },
  "nodeProp.text.label": { sv: "Anteckning", en: "Note" },

  "nodeType.question.label": { sv: "Fråga", en: "Question" },
  "nodeType.multi-choice.label": { sv: "Flervalsfråga", en: "Multiple-choice question" },
  "nodeType.number-question.label": { sv: "Sifferfråga", en: "Number question" },
  "nodeType.text-question.label": { sv: "Textfråga", en: "Text question" },
  "nodeType.autocomplete-question.label": { sv: "Sökfält med förslag", en: "Search field with suggestions" },
  "nodeType.date-question.label": { sv: "Datumfråga", en: "Date question" },
  /*
   * *Betyg*, not *Skalfråga* (Johan 13/9). The word an editor is looking for
   * when they want four boxes on a row is the one they would say out loud.
   */
  "nodeType.rating-question.label": { sv: "Betyg", en: "Rating" },
  "nodeType.map-question.label": { sv: "Plats på karta", en: "Place on a map" },
  "nodeType.consent-question.label": { sv: "Samtycke", en: "Consent" },
  "nodeType.multi-autocomplete-question.label": { sv: "Sökfält med flera val", en: "Search field, several values" },
  "nodeType.file-question.label": { sv: "Bifoga fil", en: "Attach a file" },
  "nodeType.annotation.label": { sv: "Anteckning", en: "Annotation" },
  "nodeType.image.label": { sv: "Bild", en: "Image" },
  /*
   * "Kodexempel", inte "Kod".
   *
   * Johan, 31/8: *"Tänker att redaktören tror att det är en nod man måste
   * skriva kod i."* Noden VISAR ett stycke — den kör ingenting och kräver
   * ingenting av den som bygger guiden. Ett ord som låter som ett krav på
   * programmering i en palett bredvid Fråga och Bild skrämmer bort just den
   * redaktör som hade haft nytta av att visa ett exempel.
   *
   * Samma slags rättning som "standardformat" i stället för JSON i
   * redaktörstext: namnet ska beskriva vad besökaren får se, inte vilket
   * hantverk som ligger bakom.
   */
  "nodeType.code.label": { sv: "Kodexempel", en: "Code sample" },
  "nodeType.annotated-image.label": { sv: "Annoterad bild", en: "Annotated image" },
  "nodeType.page.label": { sv: "Sida", en: "Page" },
  "nodeType.page-heading.label": { sv: "Text", en: "Text" },
  "nodeType.page-spacer.label": { sv: "Blank rad", en: "Blank row" },
  "nodeType.review.label": { sv: "Granska", en: "Review" },
  "nodeType.submit-result.label": { sv: "Inlämning", en: "Submission" },
  "nodeType.result.label": { sv: "Resultat", en: "Result" },
  "nodeType.email-result.label": { sv: "E-postresultat", en: "Email result" },
  "nodeType.rule.label": { sv: "Regel", en: "Rule" },
  "nodeType.calculation.label": { sv: "Uträkning", en: "Calculation" },
  "nodeType.service-call.label": { sv: "Tjänsteanrop", en: "Service call" },

  // Nodregistret: egenskapsfältens etiketter/beskrivningar (global per id)
  "nodeProp.title.label": { sv: "Rubrik", en: "Heading" },
  "nodeProp.presentation.label": { sv: "Visas som", en: "Shown as" },
  "nodeProp.autofill.label": { sv: "Vad fältet är", en: "What the field is" },
  "nodeProp.kind.label": { sv: "Sort", en: "Kind" },
  "nodeProp.allowMarking.label": { sv: "Låt besökaren markera i bilden", en: "Let the visitor mark the picture" },
  "nodeProp.startView.label": { sv: "Startvy", en: "Start view" },
  /*
   * Story 118, and Johans beslut 15/9: *"borde översättas, ska finnas
   * språkstöd rätt igenom."*
   *
   * The label is the same word on both types, so it stays one row. The help
   * text is not — one says *Talet*, the other *Datumet* — so each type has its
   * own row, keyed `nodeProp.<nodeType>.<id>.*`. The panel asks for that key
   * first and falls back to the shared one; see `nodeText` in
   * `properties-panel.ts` for why English needed it and Swedish never did.
   */
  "nodeProp.startValue.label": { sv: "Startvärde", en: "Start value" },
  /*
   * Story 118, criterion 7. The same words on the number question and the date
   * question — what has to happen is the same act whatever the field holds —
   * so one shared row, no type-bound key needed.
   */
  "nodeProp.requireInteraction.label": {
    sv: "Fråga om fältet inte rörts",
    en: "Ask if the field is untouched",
  },
  "nodeProp.requireInteraction.description": {
    sv: "Ett startvärde eller ett reglage räknas annars som svar redan vid ankomst. Har besökaren inte ändrat fältet frågar guiden om hen vill gå vidare ändå.",
    en: "A start value or a slider otherwise counts as an answer on arrival. If the visitor has not changed the field, the guide asks whether to continue anyway.",
  },
  "nodeProp.number-question.startValue.description": {
    sv: "Talet står i fältet när besökaren kommer fram, och går att ändra. Tomt: fältet är tomt.",
    en: "The number stands in the field when the visitor arrives, and can be changed. Empty: the field is empty.",
  },
  "nodeProp.date-question.startValue.description": {
    sv: "ÅÅÅÅ-MM-DD, idag, eller en variabel med ett datum. Datumet står i fältet när besökaren kommer fram, och går att ändra. Tomt: fältet är tomt.",
    en: "YYYY-MM-DD, today, or a variable holding a date. The date stands in the field when the visitor arrives, and can be changed. Empty: the field is empty.",
  },
  /*
   * The second real case, and the one that makes this a rule rather than a
   * fix (PRAXIS 34). `minChars` carries two different Swedish sentences: the
   * single lookup says *"Innan ett uppslag görs."*, which is what the shared
   * English below was written for, and the multi lookup says something else
   * entirely — and wore that English anyway, in silence, until story 118 went
   * looking.
   */
  "nodeProp.multi-autocomplete-question.minChars.description": {
    sv: "0 visar hela listan när fältet får fokus.",
    en: "0 shows the whole list when the field takes focus.",
  },
  "nodeProp.variableName.label": { sv: "Spara svaret som", en: "Save the answer as" },
  "nodeProp.variableName.description": { sv: "T.ex. myndig", en: "E.g. isAdult" },
  "nodeProp.variableLabel.label": { sv: "Variabeletikett", en: "Variable label" },
  "nodeProp.variableLabel.description": { sv: "Ordet som visas i regler, villkor och resultattext. Tomt: frågans rubrik används.", en: "The word shown in rules, conditions and result text. Empty: the question's heading is used." },
  "nodeProp.description.label": { sv: "Beskrivning", en: "Description" },
  /*
   * Etapp 2 (UPPDRAG-2026-09-28-SVARSALTERNATIV, 28/9): "Alternativ" →
   * "Svarsalternativ", konceptbildens egen rubrik. `nodeProp.options.label`
   * gäller bara den riktiga frågan-options-egenskapen (id "options") — Egen
   * lista-fältet (host-uppslagets `mockItems`) delar renderaren men har ett
   * annat id och en egen etikett, och rörs inte av det här bytet.
   */
  "nodeProp.options.label": { sv: "Svarsalternativ", en: "Answer options" },
  "nodeProp.imageUrl.label": { sv: "Bild-URL", en: "Image URL" },
  "nodeProp.imageUrl.description": { sv: "Länk till bilden (https://…).", en: "Link to the image (https://…)." },
  "nodeProp.caption.label": { sv: "Bildtext", en: "Caption" },
  /*
   * Ärendetypen på inlämningsnoden (story 123). Egna nycklar och inte
   * `codeListId`s: på ett uppslagsfält är kodlistan det besökaren väljer UR,
   * här är den varifrån redaktörens ärendetyp kommer, och svenskan skiljer sig
   * därefter.
   */
  "nodeProp.caseType.label": { sv: "Ärendetyp", en: "Case type" },
  "nodeProp.caseType.description": {
    sv: "Vad för slags ärende guiden skapar. Koden följer med ärendet; etiketten äger listan.",
    en: "What kind of errand the guide creates. The errand carries the code; the label belongs to the list.",
  },
  "nodeProp.caseTypeListId.label": { sv: "Kodlista för ärendetyp", en: "Code list for the case type" },
  "nodeProp.caseTypeListId.description": {
    sv: "Listorna en värd registrerat. Tom: ärendet får ingen typ.",
    en: "The lists a host has registered. Empty: the errand gets no type.",
  },
  "nodeProp.alt.label": { sv: "Alternativtext", en: "Alt text" },
  "nodeProp.alt.description": { sv: "Beskriver bilden för skärmläsare.", en: "Describes the image for screen readers." },
  // Fältet inuti noden heter fortfarande vad det innehåller: kod.
  "nodeProp.code.label": { sv: "Kod", en: "Code" },
  "nodeProp.language.label": { sv: "Språk (etikett)", en: "Language (label)" },
  "nodeProp.language.description": { sv: "Visas ovanför koden, t.ex. json.", en: "Shown above the code, e.g. json." },
  "nodeProp.comments.label": { sv: "Kommentarer", en: "Comments" },
  "nodeProp.cssClasses.label": { sv: "CSS-klasser", en: "CSS classes" },
  "nodeProp.cssClasses.description": { sv: "En eller flera, mellanslagsseparerade.", en: "One or more, space-separated." },
  "nodeProp.required.label": { sv: "Obligatoriskt fält", en: "Required field" },
  "nodeProp.minSelected.label": { sv: "Minsta antal val", en: "Minimum number of selections" },
  "nodeProp.maxSelected.label": { sv: "Högsta antal val", en: "Maximum number of selections" },
  "nodeProp.min.label": { sv: "Minsta värde", en: "Minimum value" },
  "nodeProp.max.label": { sv: "Högsta värde", en: "Maximum value" },
  "nodeProp.step.label": { sv: "Steg", en: "Step" },
  "nodeProp.unit.label": { sv: "Enhet", en: "Unit" },
  "nodeProp.unit.description": { sv: "Till exempel år eller kronor.", en: "For example years or kronor." },
  "nodeProp.placeholder.label": { sv: "Platshållare", en: "Placeholder" },
  "nodeProp.minLength.label": { sv: "Minsta textlängd", en: "Minimum text length" },
  "nodeProp.maxLength.label": { sv: "Högsta textlängd", en: "Maximum text length" },
  "nodeProp.format.label": { sv: "Format", en: "Format" },
  /*
   * Two labels the English panel showed in Swedish — "VARFÖR FRÅGAR VI DET
   * HÄR?" and "SKRIVFORM" — because the keys had never been written, and a key
   * that does not exist has no English for the reach gate to miss (found by
   * story 110's session, 11/9).
   */
  "nodeProp.why.label": { sv: "Varför frågar vi det här?", en: "Why do we ask this?" },
  "nodeProp.why.description": {
    sv: "Frivillig förklaring som besökaren kan fälla ut vid frågan — varför uppgiften behövs och vad den används till.",
    en: "An optional explanation the visitor can unfold at the question — why the detail is needed and what it is used for.",
  },
  "nodeProp.mask.label": { sv: "Skrivform", en: "Written form" },
  "nodeProp.mask.description": { sv: "T.ex. ###-##-####. # är en siffra, A en bokstav.", en: "E.g. ###-##-####. # is a digit, A a letter." },
  "nodeProp.pattern.label": { sv: "Mönster (regex)", en: "Pattern (regex)" },
  "nodeProp.pattern.description": { sv: "Används när format är Eget mönster.", en: "Used when the format is Custom pattern." },
  "nodeProp.continueLabel.label": { sv: "Fortsätt-knappens text", en: "Continue button text" },
  "nodeProp.continueLabel.description": { sv: "Tomt = guidens standard.", en: "Empty = the guide's default." },
  "nodeProp.repeats.label": { sv: "Kan upprepas", en: "Can repeat" },
  "nodeProp.repeatWord.label": { sv: "Vad som upprepas", en: "What repeats" },
  "nodeProp.repeatWord.description": { sv: "Ett ord i ental, t.ex. barn. Blir Barn 1 och Lägg till barn.", en: "One word, singular, e.g. child. Becomes Child 1 and Add child." },
  "nodeProp.repeatVariable.label": { sv: "Listans variabelnamn", en: "The list's variable name" },
  "nodeProp.repeatVariable.description": { sv: "Svaren blir en lista med det här namnet; antalet heter namn.count.", en: "The answers become a list with this name; the count is name.count." },
  "nodeProp.repeatMin.label": { sv: "Minsta antal", en: "Minimum count" },
  "nodeProp.repeatMin.description": { sv: "Tomt = 1.", en: "Empty = 1." },
  "nodeProp.repeatMax.label": { sv: "Största antal", en: "Maximum count" },
  "nodeProp.repeatMax.description": { sv: "Tomt = ingen gräns.", en: "Empty = no limit." },
  "nodeProp.addLabel.label": { sv: "Lägg till-knappens text", en: "Add button text" },
  "nodeProp.addLabel.description": { sv: "Tomt = Lägg till följt av ordet.", en: "Empty = Add followed by the word." },
  // Story 138. One label (Johan's); the description differs, because a choice
  // hides and a text field refuses — Astra's words 29/9, one per question type.
  "nodeProp.uniqueAcrossRepeats.label": { sv: "Varje upprepning ska välja olika", en: "Each repetition must choose differently" },
  "nodeProp.question.uniqueAcrossRepeats.description": {
    sv: "Alternativ som valts i en upprepning döljs i de andra.",
    en: "Options chosen in one repetition are hidden in the others.",
  },
  "nodeProp.text-question.uniqueAcrossRepeats.description": {
    sv: "Samma svar får inte anges i flera upprepningar.",
    en: "The same answer may not be given in more than one repetition.",
  },
  "nodeProp.firstLabel.label": { sv: "Fält 1 – etikett", en: "Field 1 – label" },
  "nodeProp.firstVariableName.label": { sv: "Fält 1 – variabel", en: "Field 1 – variable" },
  "nodeProp.firstPlaceholder.label": { sv: "Fält 1 – platshållare", en: "Field 1 – placeholder" },
  "nodeProp.firstRequired.label": { sv: "Fält 1 är obligatoriskt", en: "Field 1 is required" },
  "nodeProp.secondLabel.label": { sv: "Fält 2 – etikett", en: "Field 2 – label" },
  "nodeProp.secondVariableName.label": { sv: "Fält 2 – variabel", en: "Field 2 – variable" },
  "nodeProp.secondPlaceholder.label": { sv: "Fält 2 – platshållare", en: "Field 2 – placeholder" },
  "nodeProp.secondRequired.label": { sv: "Fält 2 är obligatoriskt", en: "Field 2 is required" },
  "nodeProp.to.label": { sv: "Mottagare", en: "Recipient" },
  "nodeProp.to.description": { sv: "E-postadress eller variabel, till exempel {{email}}.", en: "Email address or variable, for example {{email}}." },
  "nodeProp.subject.label": { sv: "Ämne", en: "Subject" },
  "nodeProp.subject.description": {
    sv: "Ämnesraden går alltid i klartext genom varje e-postserver på vägen — även om innehållet krypteras. Skriv inget känsligt här.",
    en: "The subject line always travels in plain text through every mail server on the way — even when the content is encrypted. Write nothing sensitive here.",
  },
  "nodeProp.body.label": { sv: "Brödtext", en: "Body text" },
  "nodeProp.cases.label": { sv: "Regler", en: "Rules" },
  "nodeProp.cases.description": { sv: "Reglerna kontrolleras uppifrån. Den första regel vars villkor uppfylls används.", en: "Rules are checked from the top. The first rule whose condition is met is used." },
  "nodeProp.fallbackLabel.label": { sv: "Namn på utfallet Annars", en: "Name for the Otherwise outcome" },
  "nodeProp.fallbackLabel.description": { sv: "Används när ingen av reglerna ovan uppfylls.", en: "Used when none of the rules above are met." },
  "nodeProp.assignments.label": { sv: "Uträkningar", en: "Calculations" },
  "nodeProp.endpoint.label": { sv: "Endpoint", en: "Endpoint" },
  "nodeProp.endpoint.description": { sv: "Anropet sker i BFF:en, aldrig i klienten.", en: "The call is made in the BFF, never in the client." },
  "nodeProp.method.label": { sv: "Metod", en: "Method" },
  "nodeProp.requestVariables.label": { sv: "Skicka med", en: "Send along" },
  "nodeProp.requestVariables.description": { sv: "Vilka variabler som ingår i anropet.", en: "Which variables are included in the call." },
  "nodeProp.mockResponse.label": { sv: "Exempelsvar (JSON)", en: "Sample response (JSON)" },
  "nodeProp.mockResponse.description": { sv: "Används för att designa och förhandsgranska utan riktigt nätverk.", en: "Used to design and preview without a real network." },
  "nodeProp.responseMappings.label": { sv: "Lägg svaret i variabler", en: "Store the response in variables" },
  "nodeProp.responseMappings.description": { sv: "Läs fält ur svaret (punktnotation för nästlade fält) och lägg i variabler.", en: "Read fields from the response (dot notation for nested fields) and store them in variables." },

  // Nodregistret: select-alternativ (nyckel per värde)
  "nodeOption.radio": { sv: "Radioknappar", en: "Radio buttons" },
  "nodeOption.select": { sv: "Rullgardin", en: "Dropdown" },
  "nodeOption.checkbox": { sv: "Kryssrutor", en: "Checkboxes" },
  "nodeOption.multiselect": { sv: "Flervalslista", en: "Multi-select list" },
  "nodeOption.input": { sv: "Textfält", en: "Text field" },
  "nodeOption.textarea": { sv: "Textområde", en: "Text area" },
  "nodeOption.field": { sv: "Fält", en: "Field" },
  "nodeOption.range": { sv: "Fält med reglage", en: "Field with slider" },
  "nodeOption.stepper": { sv: "Fält med stegknappar", en: "Field with − / + buttons" },
  // Story 096: a Text's *Visas som*. The panel's option and the card's strip
  // say the same word; the visitor's word lives in the viewer strings.
  "nodeOption.text": { sv: "Text", en: "Text" },
  "nodeOption.info": { sv: "Inforuta", en: "Info box" },
  "nodeOption.warning": { sv: "Viktigt", en: "Important" },
  "nodeOption.tip": { sv: "Tips", en: "Tip" },
  "nodeOption.none": { sv: "Ingen", en: "None" },
  "nodeOption.point": { sv: "Punkt", en: "Point" },
  "nodeOption.points": { sv: "Flera punkter", en: "Several points" },
  "nodeOption.area": { sv: "Område", en: "Area" },
  "nodeOption.email": { sv: "E-post", en: "Email" },
  "nodeOption.phone": { sv: "Telefon", en: "Phone" },
  "nodeOption.personnummer": { sv: "Personnummer", en: "Personal ID no." },
  "nodeOption.regex": { sv: "Eget mönster (regex)", en: "Custom pattern (regex)" },
  /*
   * Story 110: vad ett textfält är, i redaktörens ord.
   *
   * "Ort" är `address-level2` och "Land" `country-name` — attributens namn
   * står aldrig i gränssnittet. Engelskan är den brittiska stavningen av
   * organisation, som resten av editorns engelska.
   */
  "nodeOption.name": { sv: "Namn", en: "Name" },
  "nodeOption.given-name": { sv: "Förnamn", en: "First name" },
  "nodeOption.family-name": { sv: "Efternamn", en: "Last name" },
  "nodeOption.street-address": { sv: "Gatuadress", en: "Street address" },
  "nodeOption.address-level2": { sv: "Ort", en: "City or town" },
  "nodeOption.country-name": { sv: "Land", en: "Country" },
  "nodeOption.organization": { sv: "Organisation", en: "Organisation" },
  /*
   * ── canvas.* — what the editor sees on the canvas, never the resident ──
   *
   * These were `preview.*` until 2026-08-04, which named the *component* that
   * draws them. `guide-preview` draws two different things for two different
   * audiences, so the prefix said nothing about which, and I put keys on the
   * wrong side of the line three times in one hour. `canvas.` names the
   * surface, and the surface is the audience.
   *
   * The gate that holds it is `audience.browser.test.ts`: every node type is
   * rendered without `compact`, and every key that render asks for must be a
   * viewer key.
   *
   * The canvas's miniature of a page node, drawn by `renderCompactPageFields`.
   *
   * `guide-preview` renders two different things: the resident's guide, and the
   * thumbnail inside each node on the editor's canvas. The thumbnail is the one
   * with `compact` set, and `<guide-preview compact>` appears in exactly one
   * place in the codebase — `guide-editor.ts`. Nothing a host embeds can reach
   * it.
   *
   * These three label the parts of a page in that thumbnail so the editor can
   * see its shape. A resident never meets them: in the real page render a
   * spacer is an `aria-hidden` div with no text at all, and there is nothing
   * for "Blank rad" to be the name of.
   *
   * `step.untitled` looks like it belongs here and does not — it is also
   * asked for by the heading of every step a resident reads. It lives in
   * `viewer-strings.ts`.
   */
  "canvas.subheading": { sv: "Text", en: "Text" },
  "canvas.blankRow": { sv: "Blank rad", en: "Blank row" },
  "canvas.unnamedField": { sv: "Namnlöst fält", en: "Untitled field" },
  "canvas.route.deadEnd": { sv: "Leder ingenstans", en: "Leads nowhere" },
  "canvas.route.leadsTo": { sv: "Leder till: {title}", en: "Leads to: {title}" },
  "canvas.route.someDeadEnd": { sv: "Någon väg leder ingenstans", en: "Some path leads nowhere" },
  "canvas.route.hasLoop": { sv: "Vägen innehåller en loop", en: "The path contains a loop" },
  "canvas.email.missingVars": { sv: "Saknade variabler: {names}", en: "Missing variables: {names}" },
  "canvas.email.producesData": { sv: "Producerar e-postdata – skickar inte.", en: "Produces email data – does not send." },
  "canvas.email.to": { sv: "Till", en: "To" },
  "canvas.email.subject": { sv: "Ämne", en: "Subject" },
  "canvas.email.body": { sv: "Brödtext", en: "Body" },
  "canvas.paths.title": { sv: "Möjliga vägar hit", en: "Possible paths here" },
  "canvas.paths.unreachable": { sv: "Resultatet kan inte nås från startnoden.", en: "The result can't be reached from the start node." },
  "canvas.paths.summaryOne": { sv: "{count} väg leder hit — markerade grönt på canvasen.", en: "{count} path leads here — highlighted in green on the canvas." },
  "canvas.paths.summaryMany": { sv: "{count} vägar leder hit — markerade grönt på canvasen.", en: "{count} paths lead here — highlighted in green on the canvas." },
  "canvas.paths.atLeastPrefix": { sv: "Minst ", en: "At least " },
  "canvas.paths.more": { sv: "Fler vägar finns men visas inte här.", en: "More paths exist but aren't shown here." },
  "canvas.paths.guideLoop": { sv: "Guiden innehåller en loop.", en: "The guide contains a loop." },
};
