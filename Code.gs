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
const COLS = ['ID', 'Date', 'Heure', 'Réponse', 'Retenu', 'Archivé'];
const REPONSES = ['', 'Oui', 'Incertain', 'Non'];
const LIBELLES = { '': 'Pas de réponse', 'Oui': 'Ça me va', 'Incertain': 'Peut-être', 'Non': 'Impossible' };
const TZ = 'Europe/Zurich';

// Créneaux de départ, utilisés par « installer » (nouveau Sheet) et « majDecembre » (Sheet existant)
const CRENEAUX_DEPART = [
  ['2026-12-04', ['13:00', '19:00']],
  ['2026-12-17', ['13:00']],
  ['2026-12-18', ['11:00', '13:00', '17:00', '19:00']]
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
      retenu: String(o['Retenu']).trim() !== '',
      archive: String(o['Archivé'] || '').trim() !== ''
    };
  }).filter(function (c) { return c.id && c.date; });
  const retenu = creneaux.filter(function (c) { return c.retenu; })[0];
  return {
    creneaux: creneaux.map(function (c) { return { id: c.id, date: c.date, heure: c.heure, reponse: c.reponse, archive: c.archive }; }),
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
    case 'setArchive': capitaine_(b); return setArchive_(b);
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
  const col = colonne_(sh, 'Réponse');
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
  const col = colonne_(sh, 'Retenu');
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
  ajouterLigne_(sh, id, date, heure);
  trier_(sh);
  journal_('Pascal', id, '', 'Créneau ajouté');
  return {};
}

// Masquer (archive = true) ou réafficher des créneaux : les réponses de Maxime sont gardées
function setArchive_(b) {
  const sh = feuille_(ONGLET_CRENEAUX);
  const col = colonne_(sh, 'Archivé');
  const ids = Array.isArray(b.ids) ? b.ids : [b.id];
  ids.forEach(function (id) { sh.getRange(ligneParId_(sh, id), col).setValue(b.archive ? 'Oui' : ''); });
  journal_('Pascal', ids.length > 1 ? ids.length + ' créneaux' : ids[0], '', b.archive ? 'Masqué' : 'Réaffiché');
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
// Numéro de colonne d'après son titre ; la colonne est créée si elle manque (Sheet d'une version précédente)
function colonne_(sh, nom) {
  const h = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(function (x) { return String(x).trim(); });
  const i = h.indexOf(nom);
  if (i >= 0) return i + 1;
  const col = sh.getLastColumn() + 1;
  sh.getRange(1, col).setValue(nom);
  return col;
}
function ajouterLigne_(sh, id, date, heure) {
  const n = Math.max(sh.getLastColumn(), COLS.length);
  const row = new Array(n).fill('');
  row[colonne_(sh, 'ID') - 1] = id; row[colonne_(sh, 'Date') - 1] = date; row[colonne_(sh, 'Heure') - 1] = heure;
  sh.appendRow(row);
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
    CRENEAUX_DEPART.forEach(function (j) { j[1].forEach(function (h) { rows.push([j[0] + '_' + h, j[0], h, '', '', '']); }); });
    sh.getRange(2, 1, rows.length, COLS.length).setValues(rows);
    sh.getRange('F2:F').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Oui'], true).setAllowInvalid(false).build());
    sh.getRange('E2:E').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Oui'], true).setAllowInvalid(false).build());
    sh.getRange('D2:D').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Oui', 'Incertain', 'Non'], true).setAllowInvalid(false).build());
  }
  let inf = ss.getSheetByName(ONGLET_INFOS);
  if (!inf) { inf = ss.insertSheet(ONGLET_INFOS); inf.getRange(1, 1, 2, 2).setValues([['Clé', 'Valeur'], ['Message', '']]); inf.setFrozenRows(1); }
  const vide = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
  if (vide && vide.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(vide);
  Logger.log('Onglets prêts : ' + ONGLET_CRENEAUX + ', ' + ONGLET_INFOS + '. Le Journal se crée à la première réponse.');
}

/* ---------- Mise à jour décembre 2026 (à lancer une seule fois sur le Sheet existant) ---------- */
// Ajoute la colonne « Archivé », ajoute les créneaux de décembre qui manquent
// et masque tous les créneaux de novembre (ils restent dans le Sheet avec les réponses de Maxime).
function majDecembre() {
  const sh = feuille_(ONGLET_CRENEAUX);
  const colA = colonne_(sh, 'Archivé');
  let ajoutes = 0, masques = 0;
  CRENEAUX_DEPART.forEach(function (j) {
    j[1].forEach(function (h) {
      const id = j[0] + '_' + h;
      if (!ligneParId_(sh, id, true)) { ajouterLigne_(sh, id, j[0], h); ajoutes++; }
    });
  });
  if (sh.getLastRow() >= 2) {
    const dates = sh.getRange(2, colonne_(sh, 'Date'), sh.getLastRow() - 1, 1).getDisplayValues();
    dates.forEach(function (r, i) {
      if (String(r[0]).indexOf('2026-11') === 0) { sh.getRange(i + 2, colA).setValue('Oui'); masques++; }
    });
  }
  trier_(sh);
  journal_('Pascal', 'Mise à jour', '', ajoutes + ' créneaux de décembre ajoutés, ' + masques + ' de novembre masqués');
  Logger.log(ajoutes + ' créneaux ajoutés, ' + masques + ' créneaux de novembre masqués.');
}
