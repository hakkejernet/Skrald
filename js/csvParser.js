// Simpel CSV-parser til DriverLogin 3-eksport.
// Understøtter både komma og semikolon som separator, anførselstegn med
// escapede citationstegn ("") og CRLF/LF linjeskift.

/**
 * Afkoder en rå bytebuffer til tekst ved at prøve en kæde af tegnsæt.
 *
 * Vi bruger { fatal: true } og fanger fejlen, i stedet for at afkode løst
 * og bagefter lede efter erstatningstegnet (�) i resultatet - den metode
 * misser filer der reelt er forkert kodet, fordi visse Windows-1252-byte-
 * sekvenser (fx "æ" efterfulgt af bestemte symboler) tilfældigvis også er
 * gyldig UTF-8 og derfor afkodes uden fejl, blot til helt forkerte tegn og
 * uden noget erstatningstegn at spotte bagefter.
 *
 * OBS: "iso-8859-1" er i praksis alias for samme afkoder som "windows-1252"
 * i browsere/Node (WHATWG-encoding-specifikationen), så dette tredje forsøg
 * vil aldrig give et andet resultat end det andet - det er med som et
 * dokumenteret sikkerhedsnet, ikke fordi det reelt afkoder anderledes.
 *
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function decodeCSV(buffer) {
  const encodings = ['utf-8', 'windows-1252', 'iso-8859-1'];
  for (const encoding of encodings) {
    try {
      return new TextDecoder(encoding, { fatal: true }).decode(buffer);
    } catch (e) {
      // Denne kodning kunne ikke afkode bufferen uden fejl - prøv næste.
    }
  }
  // Sidste udvej: løs UTF-8-afkodning fejler aldrig (indsætter i stedet
  // erstatningstegn for ugyldige bytes), så vi er altid garanteret et resultat.
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  return semiCount >= commaCount ? ';' : ',';
}

function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const delimiter = detectDelimiter(text);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      // ignoreres, \n håndterer linjeskiftet
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

const DIACRITICS_RE = new RegExp(
  '[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']',
  'g'
);

function normalizeHeader(h) {
  return h
    .trim()
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'aa')
    .normalize('NFD')
    .replace(DIACRITICS_RE, '');
}

function findAddressColumn(headerRow) {
  const normalized = headerRow.map(normalizeHeader);
  let idx = normalized.findIndex((h) => h === 'korsel til');
  if (idx === -1) idx = normalized.findIndex((h) => h.includes('korsel') && h.includes('til'));
  if (idx === -1) idx = normalized.findIndex((h) => h.includes('adresse'));
  return idx;
}

/**
 * @param {string} text - Rå CSV-tekst.
 * @returns {{addresses: string[], columnName: string, error: string|null}}
 */
function extractAddresses(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) {
    return { addresses: [], columnName: '', error: 'CSV-filen indeholder ingen datarækker.' };
  }

  const header = rows[0];
  const colIdx = findAddressColumn(header);
  if (colIdx === -1) {
    return { addresses: [], columnName: '', error: 'Kunne ikke finde kolonnen "Kørsel til" i CSV-filen.' };
  }

  const addresses = rows
    .slice(1)
    .map((r) => (r[colIdx] || '').trim())
    .filter((v) => v.length > 0);

  return { addresses, columnName: header[colIdx], error: null };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { decodeCSV, parseCSV, extractAddresses, detectDelimiter, findAddressColumn };
}
