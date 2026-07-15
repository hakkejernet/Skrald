#!/usr/bin/env node
// Regressionstestsuite for CSV-indlæsning, CSV-parsing og adresse-parsing.
//
// Disse tests dækker konkrete, virkelige adresser og fejl der er fundet og
// rettet undervejs i projektet - kør denne fil for at sikre at en senere
// ændring ikke genindfører en tidligere rettet fejl.
//
// Kør med: node test/regression.js

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// --- Indlæs modulerne i en isoleret VM-context ---
// TextDecoder findes ikke automatisk i en tom vm-context, i modsætning til
// i browseren eller Node's almindelige globale scope - skal gives eksplicit.
const ctx = { module: {}, TextDecoder };
vm.createContext(ctx);

function loadScript(relPath, extraTail) {
  const src = fs
    .readFileSync(path.join(__dirname, '..', relPath), 'utf8')
    .replace('if (typeof module', 'if (false && typeof module');
  vm.runInContext(src + (extraTail || ''), ctx);
}

loadScript('js/postalCodes.js', '\nthis.DK_POSTAL_CODES = DK_POSTAL_CODES;');
loadScript(
  'js/csvParser.js',
  '\nthis.decodeCSV = decodeCSV;\nthis.parseCSV = parseCSV;\nthis.extractAddresses = extractAddresses;'
);
loadScript('js/addressParser.js', '\nthis.parseAddress = parseAddress;');

const { decodeCSV, parseCSV, extractAddresses, parseAddress } = ctx;

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    console.log(`FEJL: ${label}`);
    console.log(`  forventet: ${e}`);
    console.log(`  fik:       ${a}`);
  }
}

function assertTrue(cond, label) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log(`FEJL: ${label}`);
  }
}

// =====================================================================
// Adresseparsing - virkelige adresser fundet og rettet undervejs i projektet
// =====================================================================
const ADDRESS_CASES = [
  ['HotelJuelsmindeStrandvejlevej37130Juelsminde', 'Hotel Juelsminde', 'Strandvejlevej 3', '7130 Juelsminde'],
  ['JensHansenSkolegade11a7130Juelsminde', 'Jens Hansen', 'Skolegade 11a', '7130 Juelsminde'],
  ['PederSørensenGludvej10Glud7130Juelsminde', 'Peder Sørensen', 'Gludvej 10', 'Glud, 7130 Juelsminde'],
  ['FirmaABCv/HansIkjærFabriksvej256000Kolding', 'Firma ABC v/Hans Ikjær', 'Fabriksvej 25', '6000 Kolding'],
  ['AnnaMøllerKlejsvej45Klejs7130Juelsminde', 'Anna Møller', 'Klejsvej 45', 'Klejs, 7130 Juelsminde'],
  ['LundbyKioskenApSBollervej1148700Horsens', 'Lundby Kiosken ApS', 'Bollervej 114', '8700 Horsens'],
  ['MIHTECApSKlejsgårdvej22Klejs7130Juelsminde', 'MIHTEC ApS', 'Klejsgårdvej 22', 'Klejs, 7130 Juelsminde'],
  ['HyrupMaskinstationA/SVejlevej597140Stouby', 'Hyrup Maskinstation A/S', 'Vejlevej 59', '7140 Stouby'],
  ['AagaardRasmussenApSRommesvej17100Vejle', 'Aagaard Rasmussen ApS', 'Rommesvej 1', '7100 Vejle'],
  ['MaterielgårdenTørringUldumTorvegade677160Tørring', 'Materielgården Tørring Uldum', 'Torvegade 67', '7160 Tørring'],
  ['MLHLastvognsserviceLundagervej148722Hedensted', 'MLHLastvognsservice', 'Lundagervej 14', '8722 Hedensted'],
  ['MøllersApS,JuelsmindeOdelsgade47130Juelsminde', 'Møllers ApS', 'Odelsgade 4', '7130 Juelsminde'],
  ['Vejlevej66HelleJersildVejlevej667140Stouby', 'Helle Jersild', 'Vejlevej 66', '7140 Stouby'],
  ['Klejsgårdvej3HelleAhrensen7130Juelsminde', 'Helle Ahrensen', 'Klejsgårdvej 3', '7130 Juelsminde'],
  ['LægehusetEjnarSchousAllé67130Juelsminde', 'Lægehuset Ejnar Schous', 'Allé 6', '7130 Juelsminde'],
];

for (const [input, name, street, cityLine] of ADDRESS_CASES) {
  const r = parseAddress(input);
  assertEqual(
    { name: r.name, street: r.street, cityLine: r.cityLine, ok: r.ok },
    { name, street, cityLine, ok: true },
    `parseAddress(${JSON.stringify(input)})`
  );
}

// Kendte "kan ikke tolkes sikkert"-tilfælde - skal flages, ikke gætte forkert
assertEqual(parseAddress('').ok, false, 'tom streng giver ok:false');
assertEqual(parseAddress('IngenPostnummerHer').ok, false, 'adresse uden postnummer giver ok:false');

// =====================================================================
// CSV-parsing
// =====================================================================
assertEqual(
  parseCSV('a;b;c\n1;2;3\n'),
  [['a', 'b', 'c'], ['1', '2', '3']],
  'parseCSV: semikolon-separeret'
);
assertEqual(
  parseCSV('a,b,c\n1,2,3\n'),
  [['a', 'b', 'c'], ['1', '2', '3']],
  'parseCSV: komma-separeret'
);
assertEqual(
  parseCSV('a;"b;med;semikolon";c\n')[0],
  ['a', 'b;med;semikolon', 'c'],
  'parseCSV: anførselstegn beskytter separator inde i feltet'
);
assertEqual(
  parseCSV('a;"citat ""i"" felt"\n')[0],
  ['a', 'citat "i" felt'],
  'parseCSV: fordoblet anførselstegn escaper et citationstegn'
);

const csvWithHeader = 'Stop nr;Kørsel fra;Kørsel til;Tid\n1;X;JensHansenSkolegade11a7130Juelsminde;08:00\n';
assertEqual(
  extractAddresses(csvWithHeader),
  { addresses: ['JensHansenSkolegade11a7130Juelsminde'], columnName: 'Kørsel til', error: null },
  'extractAddresses: finder "Kørsel til"-kolonnen'
);
assertTrue(
  extractAddresses('a;b\n1;2\n').error !== null,
  'extractAddresses: fejler pænt når "Kørsel til"-kolonnen mangler'
);

// =====================================================================
// decodeCSV - se commit "Make CSV file decoding robust to Windows-1252
// that looks like valid UTF-8" for baggrunden for disse tests.
// =====================================================================
assertEqual(
  decodeCSV(Buffer.from('Jens Hansen, Skolegade', 'utf8')),
  'Jens Hansen, Skolegade',
  'decodeCSV: almindelig UTF-8'
);
assertEqual(
  decodeCSV(new TextEncoder().encode('Møller, Ørbæk, Å-gade')),
  'Møller, Ørbæk, Å-gade',
  'decodeCSV: gyldig UTF-8 med æøå'
);
assertEqual(
  decodeCSV(Buffer.from([0x66, 0xf8, 0x64, 0x65, 0x76, 0x65, 0x6a])),
  'fødevej',
  'decodeCSV: ægte Windows-1252-bytes ("ø" er altid ugyldig UTF-8-startbyte)'
);

// =====================================================================
console.log(`\n${passed} bestået, ${failed} fejlet.`);
if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log('Alle regressionstests bestået.');
}
