# Bidra till FlowWeaver

Tack för att du vill bidra. Fyra saker gäller:

1. **Signera varje commit** enligt [Developer Certificate of
   Origin](https://developercertificate.org/): `git commit -s` lägger till
   raden `Signed-off-by: Namn <adress>`. Med den intygar du att du har rätt
   att lämna bidraget under projektets licens. Pull requests utan den kan
   inte tas emot.
2. **Ett prov som setts falla.** En rättning har ett prov som föll före
   rättningen och går grönt efter. Ett grönt prov kan gå en annan kodväg än
   felet.
3. **Tillgänglighet är ett krav.** Det som rör färg, rörelse, fokus eller
   träffytor mäts mot [`docs/KRAV.md`](docs/KRAV.md).
4. **Bidrag till editorn lämnas under två licenser.** Editorn
   (`src/editor/` och `src/entries/editor.ts`) är MPL-2.0. Ett bidrag dit lämnar du under MPL-2.0 *och*
   under MIT, så att projektet kan släppa editorn under MIT i en senare
   version utan att fråga varje bidragsgivare igen. Med `Signed-off-by`
   intygar du också det. Allt annat i repot är redan MIT.

Svenska i dokumentation och gränssnitt, engelska i kod — namn och
kommentarer. Den färdiga produkten har inga beroenden på andra
npm-paket; det som skeppas lutar mot webbläsaren eller egen kod.

*Contributions in English are welcome. Sign off every commit with
`git commit -s` (Developer Certificate of Origin). A contribution to the
editor (`src/editor/` and `src/entries/editor.ts`, MPL-2.0) is made under MPL-2.0 and also under MIT, so
that a later version of the editor can be released under MIT without asking
every contributor again; your sign-off covers that too. Everything else is
already MIT.*
