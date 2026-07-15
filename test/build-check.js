#!/usr/bin/env node
// "Byg"-tjek for et projekt uden build-proces.
//
// Appen har bevidst ingen build-proces eller npm-afhængigheder (se README) -
// så "at bygge appen" betyder her: bekræfte at den statiske side faktisk
// hænger sammen, FØR den deployes til GitHub Pages. Tjekker:
//
//   1. At hver lokal src/href i index.html peger på en fil der findes.
//   2. At alle .js-filer i repoet er syntaktisk gyldige (node --check).
//   3. At den vendorede jsPDF-fil findes (kritisk for offline PDF-generering).
//
// Kør med: node test/build-check.js

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const problems = [];

// --- 1. Lokale referencer i index.html skal pege på filer der findes ---
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);

for (const ref of refs) {
  if (/^https?:\/\//.test(ref)) continue; // eksterne links ignoreres

  // "?v=__BUILD_ID__" bliver først erstattet med commit-SHA'en af deploy-
  // workflowet ved selve deploy - her tjekker vi bare at filstien er gyldig.
  const cleanPath = ref.split('?')[0];
  const filePath = path.join(root, cleanPath);
  if (!fs.existsSync(filePath)) {
    problems.push(`index.html refererer til "${ref}", men filen findes ikke (${cleanPath}).`);
  }
}

// --- 2. Alle .js-filer skal være syntaktisk gyldige ---
function findJsFiles(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(findJsFiles(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

for (const file of findJsFiles(root)) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (e) {
    const detail = e.stderr ? e.stderr.toString() : e.message;
    problems.push(`Syntaksfejl i ${path.relative(root, file)}:\n${detail}`);
  }
}

// --- 3. Den vendorede jsPDF-afhængighed skal findes ---
if (!fs.existsSync(path.join(root, 'lib/jspdf.umd.min.js'))) {
  problems.push("lib/jspdf.umd.min.js mangler - appen kan ikke generere PDF'er uden den.");
}

if (problems.length) {
  console.log(`${problems.length} problem(er) fundet:\n`);
  problems.forEach((p) => console.log('-', p));
  process.exitCode = 1;
} else {
  console.log(`Byg-tjek bestået: ${refs.length} referencer og ${findJsFiles(root).length} .js-filer er alle i orden.`);
}
