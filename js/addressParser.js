// Parser for DriverLogin 3 "Kørsel til" adressefelter.
//
// DriverLogin skriver adressen som én sammenhængende streng uden mellemrum,
// f.eks. "HotelJuelsmindeStrandvejlevej37130Juelsminde". Vi kan ikke vide hvor
// ordene skiller, MEN hvert nyt ord starter med stort begyndelsesbogstav, så
// et lille-til-stort bogstav-skift ("lJ", "dS" osv.) er en ordgrænse. Tal er
// den eneste sikre grænse vi kan validere: postnummeret er 4 cifre der findes
// i den officielle postnummerliste, så vi bruger det som anker og arbejder
// baglæns derfra (husnummer -> evt. lokalitetsnavn -> gade -> kundenavn).

const STREET_SUFFIXES = [
  'vej', 'gade', 'allé', 'alle', 'plads', 'boulevard', 'parken', 'gaard',
  'gård', 'toften', 'bakken', 'kæret', 'kær', 'holm', 'engen', 'marken',
  'agre', 'agrene', 'brinken', 'stræde', 'torv', 'torvet', 'vænget',
  'vænge', 'løkken', 'løkke', 'bakke', 'banke', 'banken', 'dalen', 'højen',
  'lunden', 'ringen', 'stien', 'sti', 'vangen', 'vang', 'brink', 'hegnet',
  'have', 'haven', 'krogen', 'krog', 'skrænten', 'stykket', 'gyde',
  'anlæg', 'alleen', 'passage', 'sving', 'svinget', 'kilde', 'kilden',
  'mose', 'mosen', 'agerlund', 'skov', 'skoven', 'skovvej', 'have'
];

function endsWithStreetSuffix(word) {
  const w = word.toLowerCase();
  return STREET_SUFFIXES.some((suf) => w.endsWith(suf) && w.length > suf.length);
}

function isDigits(t) {
  return /^\d+$/.test(t);
}

function isShortLowerLetter(t) {
  return /^[a-zæøå]{1,2}$/.test(t);
}

function isWordLike(t) {
  return /^[A-Za-zÆØÅæøå.\/-]{2,}$/.test(t);
}

function isValidPostalCode(code) {
  return Object.prototype.hasOwnProperty.call(DK_POSTAL_CODES, code);
}

// Sætter mellemrum ind ved sikre ordgrænser: bogstav<->tal og lille->stort bogstav.
function insertWordBoundaries(compact) {
  let s = compact;
  // c/o og v/-adresser bruger lille "v"/"c", som ikke rammer lille->stort reglen.
  s = s.replace(/([^\s])(v\/)/gi, '$1 $2');
  s = s.replace(/([^\s])(c\/o)/gi, '$1 $2');
  s = s.replace(/([a-zA-ZæøåÆØÅ])(\d)/g, '$1 $2');
  s = s.replace(/(\d)([a-zA-ZæøåÆØÅ])/g, '$1 $2');
  s = s.replace(/([a-zæøå])([A-ZÆØÅ])/g, '$1 $2');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * @param {string} raw - Værdien fra "Kørsel til"-kolonnen.
 * @returns {{name: string, street: string, cityLine: string, ok: boolean, original: string}}
 */
function parseAddress(raw) {
  const original = raw || '';
  const compact = original.replace(/\s+/g, '');

  if (!compact) {
    return { name: '', street: '', cityLine: '', ok: false, original };
  }

  const spaced = insertWordBoundaries(compact);
  const tokens = spaced.split(' ').filter(Boolean);

  // Find det bagerste ciffer-token der indeholder et gyldigt postnummer,
  // enten alene (4 cifre) eller sammenklistret med husnummeret foran (fx "37130").
  let postalIdx = -1;
  let postalCode = null;
  let houseDigitsFromSplit = null;

  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (!isDigits(t)) continue;
    if (t.length === 4 && isValidPostalCode(t)) {
      postalIdx = i;
      postalCode = t;
      break;
    }
    if (t.length > 4 && isValidPostalCode(t.slice(-4))) {
      postalIdx = i;
      postalCode = t.slice(-4);
      houseDigitsFromSplit = t.slice(0, -4);
      break;
    }
  }

  if (postalIdx === -1) {
    return { name: spaced, street: '', cityLine: '', ok: false, original };
  }

  if (houseDigitsFromSplit !== null) {
    tokens.splice(postalIdx, 1, houseDigitsFromSplit, postalCode);
    postalIdx += 1;
  }

  const cityTokens = tokens.slice(postalIdx + 1);
  const cityFromText = cityTokens.join(' ');
  const city = cityFromText || DK_POSTAL_CODES[postalCode] || '';

  const beforeTokens = tokens.slice(0, postalIdx);

  let houseNumber = '';
  let locality = '';
  let streetEnd = beforeTokens.length;

  if (beforeTokens.length > 0) {
    const last = beforeTokens[beforeTokens.length - 1];
    const prev = beforeTokens[beforeTokens.length - 2];
    const prevPrev = beforeTokens[beforeTokens.length - 3];

    if (isDigits(last)) {
      houseNumber = last;
      streetEnd = beforeTokens.length - 1;
    } else if (isShortLowerLetter(last) && prev && isDigits(prev)) {
      houseNumber = prev + last;
      streetEnd = beforeTokens.length - 2;
    } else if (isWordLike(last)) {
      if (prev && isDigits(prev)) {
        locality = last;
        houseNumber = prev;
        streetEnd = beforeTokens.length - 2;
      } else if (prev && isShortLowerLetter(prev) && prevPrev && isDigits(prevPrev)) {
        locality = last;
        houseNumber = prevPrev + prev;
        streetEnd = beforeTokens.length - 3;
      }
    }
  }

  const nameStreetTokens = beforeTokens.slice(0, streetEnd);

  let streetStart = nameStreetTokens.length;
  for (let i = nameStreetTokens.length - 1; i >= 0; i--) {
    if (endsWithStreetSuffix(nameStreetTokens[i])) {
      streetStart = i;
      break;
    }
  }
  if (streetStart === nameStreetTokens.length && nameStreetTokens.length > 0 && houseNumber) {
    // Ingen kendt vejendelse fundet - antag sidste ord før husnummeret er vejnavnet.
    streetStart = nameStreetTokens.length - 1;
  }

  const streetName = nameStreetTokens.slice(streetStart).join(' ');
  const name = nameStreetTokens.slice(0, streetStart).join(' ');
  const streetLine = [streetName, houseNumber].filter(Boolean).join(' ').trim();
  const cityLine = locality ? `${locality}, ${postalCode} ${city}` : `${postalCode} ${city}`.trim();

  const ok = Boolean(postalCode && houseNumber);

  return { name, street: streetLine, cityLine, ok, original };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseAddress, insertWordBoundaries, endsWithStreetSuffix };
}
