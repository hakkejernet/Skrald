// Husker manuelle rettelser lokalt i browseren, nøglet på den rå
// "Kørsel til"-tekst. Da adresserne er identiske fra uge til uge, kan en
// rettelse foretaget én gang genbruges automatisk fremover.

const CORRECTIONS_KEY = 'driverlogin_corrections_v1';

function loadCorrections() {
  try {
    return JSON.parse(localStorage.getItem(CORRECTIONS_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

function saveCorrection(original, stop) {
  if (!original) return;
  const corrections = loadCorrections();
  corrections[original] = {
    name: stop.name,
    street: stop.street,
    cityLine: stop.cityLine,
  };
  localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(corrections));
}

function countCorrections() {
  return Object.keys(loadCorrections()).length;
}

function clearCorrections() {
  localStorage.removeItem(CORRECTIONS_KEY);
}

/**
 * @param {{original: string}[]} stops
 * @returns {object[]} nye stop-objekter, med gemte rettelser anvendt
 */
function applyCorrections(stops) {
  const corrections = loadCorrections();
  return stops.map((stop) => {
    const saved = corrections[stop.original];
    if (!saved) return stop;
    return {
      ...stop,
      name: saved.name,
      street: saved.street,
      cityLine: saved.cityLine,
      ok: true,
      fromMemory: true,
    };
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadCorrections, saveCorrection, countCorrections, clearCorrections, applyCorrections };
}
