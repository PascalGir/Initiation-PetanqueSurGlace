// Colle ici l'URL de l'application Web Google Apps Script (voir README).
// Tant qu'elle est vide, les réponses restent sur l'appareil de la personne qui répond.
window.PSG_CONFIG = {
  API_URL: "",
  // Durée d'une initiation en minutes (sert aux plages horaires et à l'export agenda)
  DUREE_MIN: 120,
  // Rappels dans l'agenda, en minutes avant l'initiation (1440 = 1 jour, 120 = 2 h)
  RAPPELS_MIN: [1440, 120],
  LIEU: "Patinoire des Eaux-Minérales, Avenue Henry-Warnery 8, 1110 Morges",
  // Bloc « Infos pratiques » : [titre, texte]
  INFOS: [
    ["Lieu", "Patinoire des Eaux-Minérales, Avenue Henry-Warnery 8, 1110 Morges"],
    ["Durée", "2 heures sur la glace"],
    ["Avec qui", "Initiation privée avec Pascal, membre du Curling Club Morges"],
    ["Tenue", "Habits chauds et souples, gants, baskets propres à semelle plate"]
  ]
};
