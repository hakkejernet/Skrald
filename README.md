# DriverLogin CSV → Spoke OCR Generator

Lokal HTML/CSS/JavaScript-app til at konvertere CSV-eksporter fra
DriverLogin 3 til store, OCR-venlige PDF'er som kan importeres i Spoke.

Ingen server, ingen build-proces, ingen internetforbindelse nødvendig efter
første indlæsning - alt (inkl. jsPDF-biblioteket) ligger i repoet.

## Brug

1. Åbn `index.html` i Safari på iPhone/iPad (evt. "Tilføj til hjemmeskærm").
2. Vælg eller træk én eller flere CSV-filer ind.
3. Tryk **Konverter**.
4. Gennemgå den udtrukne liste pr. fil - rækker der ikke kunne tolkes
   sikkert er markeret **Tjek**. Ret felterne direkte hvis noget er forkert,
   eller brug **⇄**-knappen til hurtigt at bytte kundenavn og vej om.
5. Tryk **Generér PDF** for hver fil for at downloade den.

Rettelser huskes lokalt i browseren (nøglet på den rå adressetekst), så
samme adresse ikke skal rettes igen ugen efter - det kræver at DriverLogin
skriver adressen identisk hver gang. Antal huskede rettelser og en
nulstillingsknap vises under Konverter-knappen.

## Hvordan adressen tolkes

DriverLogin skriver kolonnen "Kørsel til" som én sammenhængende streng uden
mellemrum, f.eks. `HotelJuelsmindeStrandvejlevej37130Juelsminde`. Parseren
(`js/addressParser.js`):

1. Finder postnummeret (4 cifre, valideret mod den officielle danske
   postnummerliste i `js/postalCodes.js`) og bruger det som anker.
2. Arbejder baglæns fra postnummeret for at finde husnummer (inkl. bogstav,
   f.eks. `11a`) og et evt. lokalitetsnavn foran postnummeret (f.eks. `Glud`,
   `Klejs`).
3. Bruger lille-til-stort bogstav-skift til at genfinde ordgrænser i resten
   af strengen (kundenavn og vejnavn), da hvert ord i den sammenfiltrede
   streng starter med stort begyndelsesbogstav.
4. Genkender `v/`- og `c/o`-adresser og holder dem samlet med kundenavnet.

Da opdelingen mellem kundenavn og vejnavn ikke altid kan afgøres 100 %
sikkert, er der indbygget en redigerbar forhåndsvisning, så du kan rette
enkelte linjer inden PDF'en genereres.

## Tests

- `test/regression.js` - konkrete, virkelige adresser og CSV-tilfælde fundet
  og rettet undervejs i projektet. Kør med `node test/regression.js`.
- `test/fuzz.js` - en lille håndrullet property-based/fuzz-test (ingen
  eksterne afhængigheder) der genererer tusindvis af syntetiske,
  realistisk-formede adresser og tjekker at parseren aldrig crasher,
  returnerer undefined/NaN, mister postnummer/by, eller (når den melder
  `ok:true`) returnerer en tom vejlinje. Tjekker *robusthed*, ikke at
  navn/vej-opdelingen er perfekt for alle syntetiske input - det er et
  kendt, accepteret vilkår for denne parser.
  ```
  node test/fuzz.js
  FUZZ_SEED=123 FUZZ_ITERATIONS=20000 node test/fuzz.js   # flere iterationer, anden seed
  ```
- `test/build-check.js` - bekræfter at index.html's filreferencer findes og
  at alle .js-filer er syntaktisk gyldige (der er ingen build-proces at
  fejle i, så dette er stedfortræder for et "byg"-trin). Kør med
  `node test/build-check.js`.

Alle tre kører automatisk i GitHub Actions ved hvert push og hver pull
request mod `main` (`.github/workflows/ci.yml`), med 10.000 fuzz-iterationer.
For at forhindre at en fejlende commit rent faktisk kan merges til `main`,
skal denne CI-check også slås til som en *required status check* under
repoets branch protection-indstillinger (Settings → Branches) - det er ikke
noget en workflow-fil alene kan gennemtvinge.

## Mapper

- `index.html`, `style.css` - UI
- `js/csvParser.js` - CSV-indlæsning (komma/semikolon, anførselstegn)
- `js/addressParser.js` - adresse-parsing
- `js/postalCodes.js` - danske postnumre → bynavn (kilde: PostNord)
- `js/corrections.js` - husker manuelle rettelser lokalt (localStorage)
- `js/pdfGenerator.js` - PDF-generering med jsPDF
- `js/app.js` - UI-logik
- `lib/jspdf.umd.min.js` - jsPDF (MIT-licens), vendored for offline-brug
