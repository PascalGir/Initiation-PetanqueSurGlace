# Pétanque sur Glace - Initiation curling

Page pour choisir le créneau de l'initiation au curling de Maxime (novembre 2026, Curling Club Morges). Même design que [StoneTroopers](https://github.com/PascalGir/stonetroopers).

Adresse de la page : https://pascalgir.github.io/Initiation-PetanqueSurGlace/

## Utilisation

- **Maxime** touche chaque horaire pour répondre : vide → Ça me va → Peut-être → Impossible. Il peut laisser un message à Pascal.
- **Pascal** ouvre l'« espace Pascal » (lien en bas de page, mot de passe saisi une fois par appareil). Il y voit le message de Maxime et le journal, ajoute ou supprime des créneaux, et touche un horaire pour le marquer réservé : il s'affiche alors en grand en haut de la page, avec le bouton d'agenda.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | La page |
| `config.js` | Réglages : adresse du script Google, durée, lieu, rappels d'agenda, bloc « Infos pratiques » |
| `Code.gs` | Script Google Apps Script relié au Google Sheet (copie de référence) |
| `data.js` | Créneaux de départ, utilisés en mode démo ou si le Google Sheet ne répond pas |
| `CHANGELOG.md` | Historique des versions |
| `icon-180.png` | Icône sur l'écran d'accueil du téléphone |

Sans `API_URL` dans `config.js`, la page fonctionne en **mode démo** : les réponses restent sur l'appareil.

## Mise en route

1. **Google Sheet** : créer un Google Sheet vide nommé « Pétanque sur Glace », puis **Extensions → Apps Script**. Coller le contenu de `Code.gs`, enregistrer.
2. **Installer** : choisir la fonction `installer` puis **Exécuter** et autoriser l'accès. Les onglets **Creneaux** (avec les 17 créneaux de novembre) et **Infos** sont créés ; **Journal** se crée à la première réponse.
3. **Mot de passe** : **Paramètres du projet → Propriétés du script → Ajouter** `CODE_CAPITAINE` avec le mot de passe choisi (jamais dans un fichier public).
4. **Déployer** : **Déployer → Nouveau déploiement → Application Web**, exécuter en tant que *Moi*, accès *Tout le monde*. Copier l'adresse `…/exec` dans `API_URL` de `config.js`.
5. **GitHub Pages** : dans le dépôt, **Settings → Pages → Deploy from a branch → main / (root)**.

Après une modification de `Code.gs` : coller le nouveau code, enregistrer, puis **Déployer → Gérer les déploiements → ✏️ → Nouvelle version → Déployer** (l'adresse ne change pas).

## Le Google Sheet

Onglet **Creneaux** : `ID` (date_heure), `Date` (AAAA-MM-JJ), `Heure` (HH:MM), `Réponse` (Oui / Incertain / Non), `Retenu` (Oui sur le créneau réservé). On peut le modifier à la main en gardant les noms d'onglets et de colonnes. Onglet **Infos** : le message de Maxime.
