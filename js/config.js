// ─────────────────────────────────────────────────────────────
//  Chez Ann's — réglages du site (seul fichier à modifier)
// ─────────────────────────────────────────────────────────────
window.CHEZ_ANNS_CONFIG = {
  // Supabase → Project Settings → API
  SUPABASE_URL: "https://qkrxzqfuimhuraxnccja.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrcnh6cWZ1aW1odXJheG5jY2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2ODQ2NzUsImV4cCI6MjExMDI2MDY3NX0.g4YDwszpNZvH5c_NQOBoZtSMFhQlG3bHMb924NFNEa0",

  // Affichage uniquement : le vrai calcul est fait côté serveur
  // (variable DEPOSIT_PERCENT de la fonction create-order). Garder la même valeur.
  DEPOSIT_PERCENT: 30,

  // Nombre de jours minimum entre la commande et le retrait
  // (garder la même valeur que LEAD_DAYS côté serveur)
  LEAD_DAYS: 2,

  // Créneaux de retrait proposés (garder la même liste dans create-order/index.ts)
  SLOTS: ["10h – 12h", "14h – 16h", "17h – 19h"],

  // Texte affiché pour le lieu de retrait
  PICKUP_PLACE: "Essonne (91)",
  PICKUP_INFO: "L'adresse exacte vous est envoyée par SMS après la commande.",

  // Liens du pied de page
  INSTAGRAM_URL: "",
  CONTACT_PHONE: ""
};
