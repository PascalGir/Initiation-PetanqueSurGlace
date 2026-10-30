/**
 * Pétanque sur Glace — API de la page web (Google Apps Script)
 *
 * Installation : créer un Google Sheet vide « Pétanque sur Glace », puis Extensions > Apps Script,
 * coller ce fichier, enregistrer, choisir la fonction « installer » et cliquer sur Exécuter (une seule fois).
 * Ensuite : Déployer > Nouveau déploiement > Application Web
 *   - Exécuter en tant que : Moi
 *   - Qui a accès : Tout le monde
 * L'URL obtenue (…/exec) se colle dans config.js sur GitHub.
 *
 * Après chaque modification de ce script : Déployer > Gérer les déploiements > ✏️ > Nouvelle version.
 */

// Mot de passe de Pascal : il n'est PAS écrit ici (ce fichier est public sur GitHub).
// Il est rangé dans Apps Script > Paramètres du projet > Propriétés du script > CODE_CAPITAINE.
// Sans cette propriété, tout le monde peut gérer les créneaux.
function codeCapitaine_() {
  return PropertiesService.getScriptProperties().getProperty('CODE_CAPITAINE') || '';
}

const ONGLET_CRENEAUX = 'Creneaux';
const ONGLET_INFOS = 'Infos';
const ONGLET_JOURNAL = 'Journal';
const COLS = ['ID', 'Date', 'Heure', 'Réponse', 'Retenu'];
const REPONSES = ['', 'Oui', 'Incertain', 'Non'];
const LIBELLES = { '': 'Pas de réponse', 'Oui': 'Ça me va', 'Incertain': 'Peut-être', 'Non': 'Impossible' };
const TZ = 'Europe/Zurich';

// Créneaux de départ (vendredis et dimanches de novembre 2026), utilisés par « installer »
const CRENEAUX_DEPART = [
  ['2026-11-13', ['09:00', '11:00', '13:00', '15:00', '19:00']],
  ['2026-11-15', ['11:00', '13:00', '15:00']],
  ['2026-11-20', ['09:00', '11:00', '13:00', '15:00']],
  ['2026-11-22', ['11:00', '13:00', '15:00']],
  ['2026-11-27', ['09:00', '11:00', '13:00']]
];

/* ---------- Lecture ---------- */

function doGet() {
  try { return json_(lireTout_()); }
  catch (err) { return json_({ error: String(err.message || err) }); }
}

function lireTout_() {
  const creneaux = lignes_(ONGLET_CRENEAUX).map(function (o) {
    return {
      id: String(o['ID']).trim(),
      date: date_(o['Date']),
      heure: heure_(o['Heure']),
      reponse: REPONSES.indexOf(String(o['Réponse']).trim()) >= 0 ? String(o['Réponse']).trim() : '',
      retenu: String(o['Retenu']).trim() !== ''
    };
  }).filter(function (c) { return c.id && c.date; });
  const retenu = creneaux.filter(function (c) { return c.retenu; })[0];
  return {
    creneaux: creneaux.map(function (c) { return { id: c.id, date: c.date, heure: c.heure, reponse: c.reponse }; }),
    retenu: retenu ? retenu.id : '',
    message: info_('Message'),
    capitaine: !!codeCapitaine_()
  };
}

/* ---------- Écriture ---------- */

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const b = JSON.parse(e.postData.contents);
    lock.waitLock(10000);
    const res = action_(b);
    SpreadsheetApp.flush();
    return json_(Object.assign({ ok: true }, res || {}));
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function action_(b) {
  switch (b.action) {
    case 'setReponse': return setReponse_(b);
    case 'setMessage': return setMessage_(b);
    case 'checkCode': capitaine_(b); return {};
    case 'getLog': capitaine_(b); return getLog_();
    case 'setRetenu': capitaine_(b); return setRetenu_(b);
    case 'addCreneau': capitaine_(b); return addCreneau_(b);
    case 'deleteCreneau': capitaine_(b); return deleteCreneau_(b);
    default: throw new Error('action inconnue');
  }
}

function capitaine_(b) {
  const code = codeCapitaine_();
  if (code && String(b.code || '') !== code) throw new Error('code capitaine incorrect');
}

function setReponse_(b) {
  const r = String(b.reponse || '');
  if (REPONSES.indexOf(r) < 0) throw new Error('réponse inconnue');
  const sh = feuille_(ONGLET_CRENEAUX);
  const row = ligneParId_(sh, b.id);
  const col = COLS.indexOf('Réponse') + 1;
  const avant = String(sh.getRange(row, col).getValue()).trim();
  sh.getRange(row, col).setValue(r);
  journal_('Maxime', b.id, LIBELLES[avant] || avant, LIBELLES[r]);
  return {};
}

function setMessage_(b) {
  const txt = String(b.message || '').slice(0, 400);
  const avant = info_('Message');
  setInfo_('Message', txt);
  journal_('Maxime', 'Message', avant, txt);
  return {};
}

function setRetenu_(b) {
  const sh = feuille_(ONGLET_CRENEAUX);
  const col = COLS.indexOf('Retenu') + 1;
  if (sh.getLastRow() >= 2) sh.getRange(2, col, sh.getLastRow() - 1, 1).clearContent();
  if (b.id) sh.getRange(ligneParId_(sh, b.id), col).setValue('Oui');
  journal_('Pascal', b.id || '—', '', b.id ? 'Créneau retenu' : 'Plus de créneau retenu');
  return {};
}

function addCreneau_(b) {
  const date = String(b.date || ''), heure = heure_(b.heure);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(heure)) throw new Error('date ou heure invalide');
  const sh = feuille_(ONGLET_CRENEAUX);
  const id = date + '_' + heure;
  if (ligneParId_(sh, id, true)) throw new Error('ce créneau existe déjà');
  sh.appendRow([id, date, heure, '', '']);
  trier_(sh);
  journal_('Pascal', id, '', 'Créneau ajouté');
  return {};
}

function deleteCreneau_(b) {
  const sh = feuille_(ONGLET_CRENEAUX);
  sh.deleteRow(ligneParId_(sh, b.id));
  journal_('Pascal', b.id, '', 'Créneau supprimé');
  return {};
}

/* ---------- Journal ---------- */

function journal_(qui, quoi, avant, apres) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(ONGLET_JOURNAL);
  if (!sh) { sh = ss.insertSheet(ONGLET_JOURNAL); sh.appendRow(['Quand', 'Qui', 'Créneau', 'Avant', 'Après']); sh.setFrozenRows(1); }
  sh.appendRow([Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), qui, quoi, avant, apres]);
}

function getLog_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(ONGLET_JOURNAL);
  if (!sh || sh.getLastRow() < 2) return { journal: [] };
  const n = Math.min(200, sh.getLastRow() - 1);
  const rows = sh.getRange(sh.getLastRow() - n + 1, 1, n, 5).getDisplayValues().reverse();
  return { journal: rows.map(function (r) { return { quand: r[0], qui: r[1], creneau: r[2], avant: r[3], apres: r[4] }; }) };
}

/* ---------- Outils ---------- */

function feuille_(nom) {
  const sh = SpreadsheetApp.getActive().getSheetByName(nom);
  if (!sh) throw new Error('onglet « ' + nom + ' » introuvable : lancer « installer »');
  return sh;
}
function lignes_(nom) {
  const sh = feuille_(nom);
  if (sh.getLastRow() < 2) return [];
  const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim(); });
  return sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues().map(function (r) {
    const o = {}; h.forEach(function (k, i) { o[k] = r[i]; }); return o;
  });
}
function ligneParId_(sh, id, silencieux) {
  const ids = sh.getRange(1, 1, Math.max(1, sh.getLastRow()), 1).getValues().map(function (r) { return String(r[0]).trim(); });
  const i = ids.indexOf(String(id || '').trim());
  if (i < 1) { if (silencieux) return 0; throw new Error('créneau introuvable'); }
  return i + 1;
}
function trier_(sh) {
  if (sh.getLastRow() > 2) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).sort(1);
}
function date_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  const m = String(v || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : '';
}
function heure_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'HH:mm');
  const m = String(v || '').match(/(\d{1,2})\s*[:h]\s*(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
}
function info_(cle) {
  const o = lignes_(ONGLET_INFOS).filter(function (r) { return String(r['Clé']).trim() === cle; })[0];
  return o ? String(o['Valeur'] || '') : '';
}
function setInfo_(cle, val) {
  const sh = feuille_(ONGLET_INFOS);
  const cles = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(function (r) { return String(r[0]).trim(); });
  const i = cles.indexOf(cle);
  if (i < 1) sh.appendRow([cle, val]); else sh.getRange(i + 1, 2).setValue(val);
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Installation (à lancer une seule fois depuis l'éditeur) ---------- */

function installer() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(ONGLET_CRENEAUX);
  if (!sh) {
    sh = ss.insertSheet(ONGLET_CRENEAUX);
    sh.getRange('A:C').setNumberFormat('@');  // dates et heures gardées en texte (pas de décalage horaire)
    sh.appendRow(COLS);
    sh.setFrozenRows(1);
    const rows = [];
    CRENEAUX_DEPART.forEach(function (j) { j[1].forEach(function (h) { rows.push([j[0] + '_' + h, j[0], h, '', '']); }); });
    sh.getRange(2, 1, rows.length, COLS.length).setValues(rows);
    sh.getRange('E2:E').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Oui'], true).setAllowInvalid(false).build());
    sh.getRange('D2:D').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Oui', 'Incertain', 'Non'], true).setAllowInvalid(false).build());
  }
  let inf = ss.getSheetByName(ONGLET_INFOS);
  if (!inf) { inf = ss.insertSheet(ONGLET_INFOS); inf.getRange(1, 1, 2, 2).setValues([['Clé', 'Valeur'], ['Message', '']]); inf.setFrozenRows(1); }
  const vide = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
  if (vide && vide.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(vide);
  Logger.log('Onglets prêts : ' + ONGLET_CRENEAUX + ', ' + ONGLET_INFOS + '. Le Journal se crée à la première réponse.');
}
