// ─────────────────────────────────────────────────────────────
//  Chez Ann's — réglages du site (seul fichier à modifier)
// ─────────────────────────────────────────────────────────────
window.CHEZ_ANNS_CONFIG = {
  // Supabase → Project Settings → API
  SUPABASE_URL: "https://qkrxzqfuimhuraxnccja.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrcnh6cWZ1aW1odXJheG5jY2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2ODQ2NzUsImV4cCI6MjExMDI2MDY3NX0.g4YDwszpNZvH5c_NQOBoZtSMFhQlG3bHMb924NFNEa0",

  // Affichage uniquement : le vrai calcul est fait côté serveur
  // (variable DEPOSIT_PERCENT de la fonction create-order). Garder la même valeur.
  DEPOSIT_PERCENT: 50,

  // ── Box Caraïbes composée sur mesure ── (garder les mêmes valeurs dans create-order et la table items)
  CARAIBES: {
    PIECES_PER_PERSON: 6,
    MIN_PERSONS: 6,
    MAX_PERSONS: 150,
    DEFAULT_PERSONS: 10,
    STEP: 6,               // ajustement par 6 pièces (= 1 personne)
    BIG_PIECES: 240,       // au-delà de 240 pièces…
    BIG_LEAD_DAYS: 5,      // …5 jours de préparation minimum
    CONTACT_EMAIL: "chezanns.commandes@gmail.com",
    // prix à la pièce : simple 1,50 € · élaborée 2,50 € · premium 4 €
    PRICES: {
      "accras-morue": 1.5, "accras-crevette": 1.5, "samoussa-thon": 1.5, "samoussa-legumes": 1.5, "kalawang": 1.5,
      "dize-mile": 2.5, "navette-poulet-fume": 2.5, "verrine-guacamole": 2.5,
      "mini-bokit-poulet": 4, "mini-bokit-morue": 4, "mini-bokit-steak": 4, "sandwich-madras": 4
    }
  },

  // Nombre de jours minimum entre la commande et le retrait
  // (garder la même valeur que LEAD_DAYS côté serveur)
  LEAD_DAYS: 3, // 72 h

  // Créneaux de retrait proposés (garder la même liste dans create-order/index.ts)
  SLOTS: ["10h – 12h", "14h – 16h", "17h – 19h"],

  // Texte affiché pour le lieu de retrait
  PICKUP_PLACE: "Essonne (91)",
  PICKUP_INFO: "L'adresse exacte vous est envoyée par e-mail dès que votre box est prête.",

  // ── Boutique de Noël ── (garder les mêmes valeurs côté serveur : create-order)
  NOEL: {
    ENABLED: true,
    DEPOSIT_PERCENT: 50,
    LAST_ORDER_DAY: "2026-12-11", // dernier jour pour commander
    FIRST_PICKUP: "2026-12-14",
    LAST_PICKUP: "2026-12-22",
    MAX_BOUDIN_G: 10000,          // 10 kg de boudin maximum par commande
    BIG_ORDER_G: 8000,            // au-delà de 8 kg de boudin…
    BIG_LEAD_DAYS: 5,             // …5 jours de préparation minimum
    // unit "piece" : prix à la pièce, quantités en pièces ; unit "kg" : prix au kilo, quantités en grammes
    PRODUCTS: [
      { id: "dize-mile-sucre", group: "douceurs", name: "Dizé milé", desc: "Petit gâteau fourré à la crème", img: "images/noel-dize-mile.jpg", imgLarge: "images/noel-dize-mile-grand.jpg", unit: "piece", price: 1.25, min: 6, step: 1 },
      { id: "comtesses",       group: "douceurs", name: "Comtesses", desc: "Petits gâteaux sablés", img: "images/noel-comtesses.jpg", imgLarge: "images/noel-comtesses-grand.jpg", unit: "piece", price: 0.50, min: 6, step: 1 },
      { id: "pain-beurre",     group: "douceurs", name: "Pain au beurre en couronne", desc: "Pour 8 à 10 personnes", unit: "piece", price: 8, min: 1, step: 1 },
      { id: "chocolat-creole", group: "douceurs", name: "Chocolat créole", desc: "Le chocolat chaud des fêtes antillaises", unit: "litre", price: 10, min: 1, step: 1 },
      { id: "boudin-creole",   group: "boudins",  name: "Boudin créole",      unit: "kg", price: 18, min: 500, step: 500 },
      { id: "boudin-morue",    group: "boudins",  name: "Boudin de morue",    unit: "kg", price: 30, min: 500, step: 500 },
      { id: "boudin-poulet",   group: "boudins",  name: "Boudin de poulet",   unit: "kg", price: 25, min: 500, step: 500 },
      { id: "boudin-crevette", group: "boudins",  name: "Boudin de crevette", unit: "kg", price: 35, min: 500, step: 500 }
    ]
  },

  // Liens du pied de page
  INSTAGRAM_URL: "",
  CONTACT_PHONE: ""
};
