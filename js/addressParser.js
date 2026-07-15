// Parser for DriverLogin 3 "Kørsel til" adressefelter.
//
// DriverLogin skriver adressen som én sammenhængende streng uden mellemrum,
// f.eks. "HotelJuelsmindeStrandvejlevej37130Juelsminde". Vi kan ikke vide hvor
// ordene skiller, MEN hvert nyt ord starter med stort begyndelsesbogstav, så
// et lille-til-stort bogstav-skift ("lJ", "dS" osv.) er en ordgrænse. Tal er
// den eneste sikre grænse vi kan validere: postnummeret er 4 cifre der findes
// i den officielle postnummerliste, så vi bruger det som anker og arbejder
// baglæns derfra (husnummer -> evt. lokalitetsnavn -> gade -> kundenavn).

// OBS: "gaard"/"gård", "holm", "lunden", "krog(en)" og bæert "skov" er bevidst
// udeladt her, selvom de findes i rigtige vejnavne (fx "Klejsgårdvej") - de er
// også nogle af de allermest almindelige danske efternavne (Aagaard,
// Vestergaard, Nørgaard, Lund, Holm, Krog, Skov ...), og ville ellers blive
// fejltolket som vejnavnet i stedet for en del af kundenavnet. "vej" fanger
// stadig sammensatte vejnavne som "Klejsgårdvej" og "Skovvej".
const STREET_SUFFIXES = [
  'vej', 'gade', 'allé', 'alle', 'plads', 'boulevard', 'parken',
  'toften', 'bakken', 'kæret', 'kær', 'engen', 'marken',
  'agre', 'agrene', 'brinken', 'stræde', 'torv', 'torvet', 'vænget',
  'vænge', 'løkken', 'løkke', 'bakke', 'banke', 'banken', 'dalen', 'højen',
  'ringen', 'stien', 'sti', 'vangen', 'vang', 'brink', 'hegnet',
  'have', 'haven', 'skrænten', 'stykket', 'gyde',
  'anlæg', 'alleen', 'passage', 'sving', 'svinget', 'kilde', 'kilden',
  'mose', 'mosen', 'agerlund', 'skoven', 'skovvej'
];

// Statiske regexer hoistes til modul-niveau, så de kun kompileres én gang i
// stedet for ved hvert kald (isDigits/isShortLowerLetter/isWordLike kaldes
// pr. token i løkker). Ingen af dem bruger g/y-flag, så de er stateless og
// sikre at genbruge på tværs af kald.
const DIGITS_RE = /^\d+$/;
const SHORT_LOWER_LETTER_RE = /^\p{Ll}{1,2}$/u;
const WORD_LIKE_RE = /^[\p{L}.\/-]{2,}$/u;

function endsWithStreetSuffix(word) {
  const w = word.toLowerCase();
  return STREET_SUFFIXES.some((suf) => w.endsWith(suf) && w.length > suf.length);
}

function isDigits(t) {
  return DIGITS_RE.test(t);
}

function isShortLowerLetter(t) {
  return SHORT_LOWER_LETTER_RE.test(t);
}

function isWordLike(t) {
  return WORD_LIKE_RE.test(t);
}

function isValidPostalCode(code) {
  return Object.prototype.hasOwnProperty.call(DK_POSTAL_CODES, code);
}

// c/o og v/-adresser bruger lille "v"/"c", som ikke rammer lille->stort reglen.
const V_SLASH_RE = /([^\s])(v\/)/gi;
const C_O_RE = /([^\s])(c\/o)/gi;

// Selskabsformer (ApS, A/S) skal holdes samlet og adskilt fra ord på begge
// sider, uanset store/små bogstaver (fx "MIHTECApSKlejsgårdvej" skal give
// "MIHTEC ApS Klejsgårdvej", ikke "MIHTECAp" + "SKlejsgårdvej"). De to
// retninger (før/efter) er slået sammen med alternering (A/S|ApS), så det
// er to gennemløb i stedet for fire.
const COMPANY_SUFFIX_BEFORE_RE = /(?<=\p{L})(?=A\/S|ApS)/gu;
const COMPANY_SUFFIX_AFTER_RE = /(?<=A\/S|ApS)(?=\p{L})/gu;
// Beskyttes midlertidigt med et mærke, så lille->stort-reglen nedenfor ikke
// splitter dem ad indeni (Ap|S). Ét gennemløb med en erstatnings-funktion
// i stedet for to separate replace-kald pr. selskabsform.
const COMPANY_SUFFIX_RE = /(A\/S|ApS)/g;
const COMPANY_SUFFIX_PLACEHOLDER = { 'A/S': ' ASSUFFIX ', ApS: ' APSSUFFIX ' };
const COMPANY_SUFFIX_RESTORE_RE = /ASSUFFIX|APSSUFFIX/g;
const COMPANY_SUFFIX_RESTORE = { ASSUFFIX: 'A/S', APSSUFFIX: 'ApS' };

// \p{L} dækker enhver bogstav-variant (inkl. accenter som "é" i "Allé"),
// ikke kun dansk æøå - ellers glider tal fast på et ord der ender på en
// bogstav uden for en snæver liste (fx "Allé6" blev aldrig splittet).
//
// Disse tre forbliver bevidst SEPARATE gennemløb og er IKKE slået sammen
// til én alterneringsregex, selvom det først ser ud til at være muligt
// (ingen af dem overlapper jo i hvad de matcher). Problemet er at et
// enkelt samlet gennemløb forbruger tegnene i rækkefølge og derfor kan
// "stjæle" et tal fra den forkerte nabo: i "11a7130" finder ét kombineret
// gennemløb fejlagtigt "1a" (ciffer->bogstav) fordi det forrige match
// ("e1") allerede har forbrugt det første ciffer, i stedet for at finde
// "a7" (bogstav->ciffer) som de tre separate, fulde gennemløb gør. Det
// splitter "Skolegade11a7130" forkert til "Skolegade 11 a7130" i stedet
// for korrekt "Skolegade 11a 7130". Bekræftet med et regressionstjek før
// denne kode blev skrevet - behold som tre gennemløb.
const LETTER_DIGIT_RE = /(\p{L})(\d)/gu;
const DIGIT_LETTER_RE = /(\d)(\p{L})/gu;
const LOWER_UPPER_RE = /(\p{Ll})(\p{Lu})/gu;

// Sætter mellemrum ind ved sikre ordgrænser: bogstav<->tal og lille->stort bogstav.
function insertWordBoundaries(compact) {
  let s = compact;
  s = s.replace(V_SLASH_RE, '$1 $2');
  s = s.replace(C_O_RE, '$1 $2');
  s = s.replace(COMPANY_SUFFIX_BEFORE_RE, ' ');
  s = s.replace(COMPANY_SUFFIX_AFTER_RE, ' ');
  s = s.replace(COMPANY_SUFFIX_RE, (m) => COMPANY_SUFFIX_PLACEHOLDER[m]);
  s = s.replace(LETTER_DIGIT_RE, '$1 $2');
  s = s.replace(DIGIT_LETTER_RE, '$1 $2');
  s = s.replace(LOWER_UPPER_RE, '$1 $2');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(COMPANY_SUFFIX_RESTORE_RE, (m) => COMPANY_SUFFIX_RESTORE[m]);
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
    if (t.length > 4) {
      const last4 = t.slice(-4);
      if (isValidPostalCode(last4)) {
        postalIdx = i;
        postalCode = last4;
        houseDigitsFromSplit = t.slice(0, -4);
        break;
      }
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

  if (!houseNumber) {
    // Nogle stop har vejnavn+husnummer FØR kundenavnet i stedet for efter
    // (fx "Klejsgårdvej 3 Helle Ahrensen" i stedet for det normale
    // "Helle Ahrensen Klejsgårdvej 3"), så det almindelige baglæns-tjek
    // ovenfor finder intet husnummer. Led i stedet forlæns efter det første
    // sted en kendt vejendelse efterfølges direkte af et tal.
    for (let i = 0; i < beforeTokens.length - 1; i++) {
      if (!endsWithStreetSuffix(beforeTokens[i]) || !isDigits(beforeTokens[i + 1])) continue;
      let hn = beforeTokens[i + 1];
      let restStart = i + 2;
      if (isShortLowerLetter(beforeTokens[i + 2])) {
        hn += beforeTokens[i + 2];
        restStart = i + 3;
      }
      const name = beforeTokens.slice(0, i).concat(beforeTokens.slice(restStart)).join(' ');
      const streetLine = [beforeTokens[i], hn].filter(Boolean).join(' ').trim();
      const cityLine = `${postalCode} ${city}`.trim();
      return { name, street: streetLine, cityLine, ok: true, original };
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
  let name = nameStreetTokens.slice(0, streetStart).join(' ');
  const streetLine = [streetName, houseNumber].filter(Boolean).join(' ').trim();
  const cityLine = locality ? `${locality}, ${postalCode} ${city}` : `${postalCode} ${city}`.trim();

  // Nogle adresser nævner vej+husnummer to gange (fx som uformelt
  // stedsnavn før kundenavnet, og igen formelt lige før postnummeret) -
  // fjern gentagelsen fra kundenavnet, så den kun står i vej-feltet.
  if (streetLine) {
    if (name === streetLine) {
      name = '';
    } else if (name.startsWith(streetLine + ' ')) {
      name = name.slice(streetLine.length + 1).trim();
    }
  }

  // Nogle adresser nævner byen en ekstra gang lige efter kundenavnet, adskilt
  // med komma (fx "Møllers ApS ,Juelsminde") - fjern det, så byen kun står i
  // postnr/by-feltet.
  if (city) {
    const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const trailingCityRe = new RegExp('\\s*,\\s*' + escapedCity + '\\s*$', 'i');
    name = name.replace(trailingCityRe, '').trim();
  }

  const ok = Boolean(postalCode && houseNumber);

  return { name, street: streetLine, cityLine, ok, original };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseAddress, insertWordBoundaries, endsWithStreetSuffix };
}
