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
   sikkert er markeret **Tjek**. Ret felterne direkte hvis noget er forkert.
5. Tryk **Generér PDF** for hver fil for at downloade den.

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

## Mapper

- `index.html`, `style.css` - UI
- `js/csvParser.js` - CSV-indlæsning (komma/semikolon, anførselstegn)
- `js/addressParser.js` - adresse-parsing
- `js/postalCodes.js` - danske postnumre → bynavn (kilde: PostNord)
- `js/pdfGenerator.js` - PDF-generering med jsPDF
- `js/app.js` - UI-logik
- `lib/jspdf.umd.min.js` - jsPDF (MIT-licens), vendored for offline-brug
