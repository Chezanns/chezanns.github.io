# Chez Ann's — site de commande + espace Annie

- `index.html` : le site client. On y choisit une box, on compose ses variétés et on paie l'acompte (ou on demande un devis pour la Box Caraïbes).
- `admin.html` : le tableau de bord d'Annie (commandes par date de retrait, statuts, récap de production).
- `admin.html?demo` : le tableau de bord avec des commandes fictives, pour montrer à Annie avant la mise en ligne.

Stack : GitHub Pages (site) + Supabase (base de données, connexion, fonctions) + Stripe (acompte).

---

## 1. Stripe (compte d'Annie)

L'argent arrive sur le compte Stripe relié à son compte bancaire pro : il faut donc **un compte Stripe au nom de Chez Ann's**, pas celui de Perfect Smile.

1. Créer le compte sur stripe.com et l'activer (SIRET, IBAN pro).
2. Développeurs → Clés API : récupérer la **clé secrète** (`sk_test_…` pour tester, `sk_live_…` en production).

## 2. Supabase

1. Créer un nouveau projet sur supabase.com (région Europe).
2. **SQL Editor** → coller tout `supabase/schema.sql` → **Run**.
3. **Authentication → Sign In / Providers** : désactiver « Allow new users to sign up » (personne ne doit pouvoir se créer un compte).
4. **Authentication → Users → Add user** : créer le compte d'Annie (e-mail + mot de passe, cocher « Auto confirm »).
5. Dans le SQL Editor, lui donner l'accès au tableau de bord :
   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'email-d-annie@exemple.fr';
   ```
6. **Project Settings → API** : noter la *Project URL* et la clé *anon public*.

## 3. Fonctions (depuis le dossier du projet, avec la CLI Supabase)

```bash
supabase login
supabase link --project-ref VOTRE_REF_PROJET

supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set SITE_URL=https://VOTRE-COMPTE.github.io/chez-anns/
supabase secrets set DEPOSIT_PERCENT=30
supabase secrets set LEAD_DAYS=2

supabase functions deploy create-order
supabase functions deploy stripe-webhook --no-verify-jwt
```

## 4. Webhook Stripe

Stripe → Développeurs → Webhooks → **Ajouter un endpoint** :
- URL : `https://VOTRE_REF_PROJET.supabase.co/functions/v1/stripe-webhook`
- Événements : `checkout.session.completed` et `checkout.session.expired`

Copier le **secret de signature** (`whsec_…`) puis :
```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```

## 5. Site

1. Remplir `js/config.js` (URL Supabase + clé anon). Garder `DEPOSIT_PERCENT`, `LEAD_DAYS` et `SLOTS` identiques aux réglages des fonctions.
2. Pousser le dossier sur GitHub → Settings → Pages → branche `main`, dossier `/ (root)`.
3. Envoyer à Annie le lien `…/admin.html` (à ajouter à l'écran d'accueil de son téléphone).

## 6. Tester avant d'ouvrir

1. Passer une commande avec la carte de test `4242 4242 4242 4242` (date future, CVC au choix).
2. Vérifier qu'elle apparaît dans `admin.html` avec « Acompte reçu ».
3. Faire une demande de devis Box Caraïbes et vérifier l'onglet **Devis**.
4. Tout est bon → remplacer les clés `sk_test` par `sk_live` (et recréer le webhook en mode live avec son nouveau `whsec_`).

---

## Modifier les box ou les prix

Le prix est vérifié côté serveur. Pour le changer, il faut modifier **les deux** :
- la table `boxes` dans Supabase (Table Editor → `price_cents`, en centimes : 30 € = 3000) ;
- le prix affiché dans `index.html` (`data-price="30"` et le texte du bouton).

Pour ajouter une mignardise : une ligne dans la table `items` (même `id` que le `value` de la case dans `index.html`), puis la case dans `index.html`.

## Statuts d'une commande

| Statut | Signification |
|---|---|
| `attente_paiement` | le client est sur la page Stripe (invisible dans le tableau de bord) |
| `confirmee` | acompte payé, à préparer |
| `prete` | box prête |
| `recuperee` | box récupérée, solde encaissé |
| `devis` / `devis_traite` | demande Box Caraïbes |
| `annulee` | paiement abandonné (session Stripe expirée au bout d'1 h) |
