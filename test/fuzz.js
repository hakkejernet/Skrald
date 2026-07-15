#!/usr/bin/env node
// Property-based/fuzz-test for adresseparseren (js/addressParser.js).
//
// Genererer tusindvis af syntetiske, realistisk-formede DriverLogin-adresser
// og tjekker at parseAddress() aldrig:
//   - kaster en exception
//   - returnerer et resultat der mangler felter, eller hvor et felt er
//     undefined/ikke en streng
//   - returnerer "NaN" eller "undefined" som tekst i outputtet
//   - mister postnummeret
//   - mister bynavnet
//
// Outputtets nøjagtige navn/vej-opdeling behøver IKKE være perfekt for alle
// syntetiske adresser - det er et kendt, accepteret vilkår for denne parser
// (den redigerbare forhåndsvisning i appen findes netop til det). Målet her
// er robusthed: parseren må aldrig gå i stykker eller stille og roligt
// smide postnummer/by væk, uanset hvor "beskidt" eller usædvanligt input er.
//
// Ingen ekstern afhængighed (fx fast-check) er brugt. Projektet har bevidst
// hverken build-proces eller npm-afhængigheder for selve appen (end ikke en
// package.json findes i repoet) - for at holde det konsistent er dette i
// stedet en lille håndrullet generator, kørbar direkte med
// `node test/fuzz.js`, uden npm install.
//
// Kør med: node test/fuzz.js
// Valgfrit: FUZZ_SEED=123 FUZZ_ITERATIONS=20000 node test/fuzz.js

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// --- Indlæs parseren i en isoleret VM-context ---
const ctx = { module: {} };
vm.createContext(ctx);
// "const"/"let" på topniveau bliver IKKE til egenskaber på context-objektet
// (i modsætning til "var"), så vi indfanger dem eksplicit til sidst i hvert
// script - samme mønster brugt i de øvrige ad hoc-tests af denne parser.
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '../js/postalCodes.js'), 'utf8') +
    '\nthis.DK_POSTAL_CODES = DK_POSTAL_CODES;',
  ctx
);
vm.runInContext(
  fs
    .readFileSync(path.join(__dirname, '../js/addressParser.js'), 'utf8')
    .replace('if (typeof module', 'if (false && typeof module') +
    '\nthis.parseAddress = parseAddress;',
  ctx
);
const parseAddress = ctx.parseAddress;
const DK_POSTAL_CODES = ctx.DK_POSTAL_CODES;

// --- Seedet PRNG (mulberry32), så fejlende input kan reproduceres ---
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = process.env.FUZZ_SEED ? Number(process.env.FUZZ_SEED) : 42;
const ITERATIONS = process.env.FUZZ_ITERATIONS ? Number(process.env.FUZZ_ITERATIONS) : 5000;
const rand = mulberry32(SEED);

function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}
function chance(p) {
  return rand() < p;
}
function randInt(min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}

// --- Byggeklodser til realistisk-formede, men varierede adresser ---
const PERSON_NAMES = [
  'Jens Hansen', 'Anna Møller', 'Peder Sørensen', 'Helle Jersild', 'Helle Ahrensen',
  'Martin Boye', 'Mette Kjærgaard', 'Søren Ærø', 'Ida Østergaard', 'Bjørn Åbylund',
  'Hans Ikjær', 'Karsten Æblegaard', 'Ünal Öztürk', 'René Café',
];
const COMPANY_NAMES = [
  'MIHTEC', 'Lundby Kiosken', 'Hyrup Maskinstation', 'Aagaard Rasmussen',
  'Materielgården Tørring-Uldum', 'Brdr. Thorborg', 'KPService', 'Skov & Holm',
  'Vestergaard-Poulsen', 'MLHLastvognsservice', 'Nord-Fragt', 'A1 Transport',
];
const INSTITUTION_NAMES = [
  'Hotel Juelsminde', 'Lægehuset Ejnar Schous', 'Juelsminde Golfklub',
  'Sandbjerg Vig Camping', 'Sønderkærs Bo- og Aktivitetscenter',
];
const COMPANY_SUFFIXES = ['ApS', 'A/S', '', '', ''];
const STREET_NAMES = [
  'Skolegade', 'Klejsvej', 'Gludvej', 'Strandvejlevej', 'Bollervej', 'Klejsgårdvej',
  'Vejlevej', 'Rommesvej', 'Torvegade', 'Overbyvej', 'Lysegårdsvej', 'Allé',
  'Fabriksvej', 'Lundagervej', 'Hovedgaden', 'Møllevej', 'Bakkedraget', 'Skovvej',
];
const HOUSE_LETTER_SUFFIXES = ['', '', '', 'a', 'b', 'c'];
const CO_PREFIXES = ['', '', '', 'v/', 'c/o'];
const LOCALITIES = ['', '', '', '', 'Glud', 'Klejs', 'Barrit'];

const POSTAL_ENTRIES = Object.entries(DK_POSTAL_CODES);

function randomAddressParts() {
  const nameKind = pick(['person', 'company', 'institution']);
  let name = pick(nameKind === 'person' ? PERSON_NAMES : nameKind === 'company' ? COMPANY_NAMES : INSTITUTION_NAMES);

  if (chance(0.3)) name += pick(COMPANY_SUFFIXES);
  if (chance(0.15)) {
    const co = pick(CO_PREFIXES);
    if (co) name += co + pick(PERSON_NAMES).replace(/\s+/g, '');
  }
  // parenteser
  if (chance(0.1)) name += `(Filial ${randInt(1, 9)})`;
  // bindestreger (ud over dem der allerede er indbagt i navnepuljerne ovenfor)
  if (chance(0.1)) name += `-${pick(PERSON_NAMES).split(' ')[1] || 'Nord'}`;

  const street = pick(STREET_NAMES);
  const houseNumber = String(randInt(1, 250));
  const houseLetter = pick(HOUSE_LETTER_SUFFIXES);

  const [postalCode, cityName] = pick(POSTAL_ENTRIES);
  const locality = pick(LOCALITIES);

  return { name, street, houseNumber, houseLetter, postalCode, cityName, locality };
}

function buildRawAddress(parts) {
  const segments = [parts.name, parts.street + parts.houseNumber + parts.houseLetter];
  if (parts.locality) segments.push(parts.locality);
  segments.push(parts.postalCode + parts.cityName);

  // "manglende mellemrum" er standardformatet (ingen separator - sådan
  // DriverLogin reelt leverer det); "ekstra mellemrum" testes ind imellem.
  const sep = chance(0.2) ? '  ' : '';
  return segments.join(sep);
}

// --- Invarianter ---
function checkInvariants(result) {
  const problems = [];

  if (result == null || typeof result !== 'object') {
    problems.push(`resultat er ikke et objekt (${JSON.stringify(result)})`);
    return problems;
  }
  for (const field of ['name', 'street', 'cityLine', 'original']) {
    if (typeof result[field] !== 'string') {
      problems.push(`${field} er ikke en streng (${JSON.stringify(result[field])})`);
    }
  }
  if (typeof result.ok !== 'boolean') {
    problems.push(`ok er ikke boolean (${JSON.stringify(result.ok)})`);
  }

  const combined = `${result.name} ${result.street} ${result.cityLine}`;
  if (/NaN/.test(combined)) problems.push(`output indeholder "NaN": ${JSON.stringify(combined)}`);
  if (/undefined/.test(combined)) problems.push(`output indeholder "undefined": ${JSON.stringify(combined)}`);

  return problems;
}

// --- Kør fuzzeren ---
const failures = [];
for (let i = 0; i < ITERATIONS; i++) {
  const parts = randomAddressParts();
  const raw = buildRawAddress(parts);

  let result;
  let threw = null;
  try {
    result = parseAddress(raw);
  } catch (e) {
    threw = e;
  }

  if (threw) {
    failures.push({ input: raw, problems: [`kastede exception: ${threw.message}`] });
    continue;
  }

  const problems = checkInvariants(result);

  if (!problems.length) {
    if (!result.cityLine.includes(parts.postalCode)) {
      problems.push(`postnummer "${parts.postalCode}" mangler i cityLine ("${result.cityLine}")`);
    }
    const combinedLower = `${result.name} ${result.street} ${result.cityLine}`.toLowerCase();
    if (!combinedLower.includes(parts.cityName.toLowerCase())) {
      problems.push(`bynavn "${parts.cityName}" findes ikke nogen steder i outputtet`);
    }
  }

  if (problems.length) {
    failures.push({ input: raw, problems, result });
  }
}

console.log(`Kørte ${ITERATIONS} syntetiske adresser (seed=${SEED}).`);
if (failures.length === 0) {
  console.log('Alle invarianter holdt for alle input. 0 fejl.');
} else {
  console.log(`${failures.length} fejl fundet (viser op til 20):\n`);
  for (const f of failures.slice(0, 20)) {
    console.log('-', JSON.stringify(f.input));
    for (const p of f.problems) console.log('   ', p);
    if (f.result) console.log('   resultat:', JSON.stringify(f.result));
  }
  process.exitCode = 1;
}
