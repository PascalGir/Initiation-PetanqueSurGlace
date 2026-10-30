# Pétanque sur Glace - Initiation curling

Page pour choisir le créneau de l'initiation au curling de Maxime (Curling Club Morges). Même design que [StoneTroopers](https://github.com/PascalGir/stonetroopers).

Adresse de la page : https://pascalgir.github.io/Initiation-PetanqueSurGlace/

## Utilisation

- **Maxime** touche un horaire et choisit sa réponse dans un petit menu : Ça me va, Peut-être ou Impossible. Il peut laisser un message à Pascal.
- **Pascal** ouvre l'« espace Pascal » (lien en bas de page, mot de passe saisi une fois par appareil). Il y voit le message de Maxime et le journal, ajoute des créneaux, les masque à Maxime ou les réaffiche (par créneau ou par mois, ses réponses sont gardées), les supprime, et touche un horaire pour le marquer réservé : il s'affiche alors en grand en haut de la page, avec le bouton d'agenda.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | La page |
| `config.js` | Réglages : adresse du script Google, durée, lieu, rappels d'agenda, bloc « Infos pratiques » |
| `Code.gs` | Script Google Apps Script relié au Google Sheet (copie de référence) |
| `data.js` | Créneaux de départ, utilisés si le Google Sheet ne répond pas ou n'est pas encore branché |
| `CHANGELOG.md` | Historique des versions |
| `icon-180.png` | Icône sur l'écran d'accueil du téléphone |

Tant que `API_URL` est vide dans `config.js`, les réponses restent sur l'appareil de Maxime : branche le Google Sheet avant de lui envoyer le lien.

## Mise en route

1. **Google Sheet** : créer un Google Sheet vide nommé « Pétanque sur Glace », puis **Extensions → Apps Script**. Coller le contenu de `Code.gs`, enregistrer.
2. **Installer** : choisir la fonction `installer` puis **Exécuter** et autoriser l'accès. Les onglets **Creneaux** (avec les créneaux de départ de `CRENEAUX_DEPART`) et **Infos** sont créés ; **Journal** se crée à la première réponse.
3. **Mot de passe** : **Paramètres du projet → Propriétés du script → Ajouter** `CODE_CAPITAINE` avec le mot de passe choisi (jamais dans un fichier public).
4. **Déployer** : **Déployer → Nouveau déploiement → Application Web**, exécuter en tant que *Moi*, accès *Tout le monde*. Copier l'adresse `…/exec` dans `API_URL` de `config.js`.
5. **GitHub Pages** : dans le dépôt, **Settings → Pages → Deploy from a branch → main / (root)**.

Après une modification de `Code.gs` : coller le nouveau code, enregistrer, puis **Déployer → Gérer les déploiements → ✏️ → Nouvelle version → Déployer** (l'adresse ne change pas).

## Le Google Sheet

Onglet **Creneaux** : `ID` (date_heure), `Date` (AAAA-MM-JJ), `Heure` (HH:MM), `Réponse` (Oui / Incertain / Non), `Retenu` (Oui sur le créneau réservé), `Archivé` (Oui = masqué à Maxime). On peut le modifier à la main en gardant les noms d'onglets et de colonnes. Onglet **Infos** : le message de Maxime.

## Mise à jour vers la version 1.5 (Sheet existant)

Coller le nouveau `Code.gs` dans Apps Script, enregistrer, choisir la fonction `majDecembre` puis **Exécuter** (une seule fois) : elle ajoute la colonne `Archivé`, les créneaux de décembre et masque ceux de novembre. Puis **Déployer → Gérer les déploiements → ✏️ → Nouvelle version → Déployer**.
