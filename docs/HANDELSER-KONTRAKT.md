# Händelsekontraktet: guide-progress

Visaren berättar besökarens resa för värden — tratten utan DOM-skrapning
(story 070). EN händelse, `guide-progress` (bubbles, composed), på
`<guide-preview>`.

```js
viewer.addEventListener("guide-progress", (event) => {
  const { kind, nodeId, nodeType, step } = event.detail;
});
```

| kind | När |
| --- | --- |
| `start` | guiden laddad och första steget visas |
| `next` | besökaren gick framåt (steget som NÅDDES i detaljerna) |
| `back` | besökaren gick bakåt |
| `result` | ett resultat/e-postresultat/inlämning nåddes (utöver next/back) |
| `validation-stopped` | Nästa stoppades av validering (fältets nod i detaljerna) |
| `submitted` | inlämningen togs emot av mottagaren |
| `restart` | Börja om / Nytt ärende |

**Detaljerna bär aldrig svar** — `nodeId`, `nodeType` och `step` räcker
för tratten; svaren är besökarens.

**Editorns speglar är tysta**: en visare med `editor-view` eller
`proving` skickar ingenting — tratten är publicerade värdars, inte
redaktörens klickande i tittläge och prov.
