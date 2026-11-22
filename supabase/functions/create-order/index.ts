// Chez Ann's — création d'une commande (box ou boutique de Noël) + session de paiement Stripe (acompte ou totalité)
// Secrets nécessaires : STRIPE_SECRET_KEY, SITE_URL
// Optionnels : DEPOSIT_PERCENT (box, 30), LEAD_DAYS (3),
//              NOEL_DEPOSIT_PERCENT (50), NOEL_LAST_ORDER_DAY (2026-12-11),
//              NOEL_FIRST_PICKUP (2026-12-14), NOEL_LAST_PICKUP (2026-12-22), NOEL_MAX_BOUDIN_G (10000),
//              NOEL_BIG_ORDER_G (8000), NOEL_BIG_LEAD_DAYS (5)
import Stripe from "npm:stripe@16.12.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SITE_URL = (Deno.env.get("SITE_URL") ?? "").replace(/\/?$/, "/");
const DEPOSIT_PERCENT = Number(Deno.env.get("DEPOSIT_PERCENT") ?? "30");
const LEAD_DAYS = Number(Deno.env.get("LEAD_DAYS") ?? "3");
// Boutique de Noël (garder les mêmes valeurs que NOEL dans js/config.js)
const NOEL_DEPOSIT_PERCENT = Number(Deno.env.get("NOEL_DEPOSIT_PERCENT") ?? "50");
const NOEL_LAST_ORDER_DAY = Deno.env.get("NOEL_LAST_ORDER_DAY") ?? "2026-12-11";
const NOEL_FIRST_PICKUP = Deno.env.get("NOEL_FIRST_PICKUP") ?? "2026-12-14";
const NOEL_LAST_PICKUP = Deno.env.get("NOEL_LAST_PICKUP") ?? "2026-12-22";
const NOEL_MAX_BOUDIN_G = Number(Deno.env.get("NOEL_MAX_BOUDIN_G") ?? "10000");
const NOEL_BIG_ORDER_G = Number(Deno.env.get("NOEL_BIG_ORDER_G") ?? "8000"); // au-delà : délai allongé
const NOEL_BIG_LEAD_DAYS = Number(Deno.env.get("NOEL_BIG_LEAD_DAYS") ?? "5");
const SPICE_LABELS = ["Pas épicé", "Peu épicé", "Épicé", "Ça décoiffe"];
// Garder la même liste que SLOTS dans js/config.js
const SLOTS = ["10h – 12h", "14h – 16h", "17h – 19h"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (msg: string, status = 400) => json({ error: msg }, status);

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const parisToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dateFr = (iso: string) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const qtyLabel = (unit: string, q: number) =>
  unit === "kg"
    ? (q < 1000 ? `${q} g` : (q / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " kg")
    : `${q} pièce${q > 1 ? "s" : ""}`;
const makeRef = () => {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (const b of crypto.getRandomValues(new Uint8Array(5))) s += a[b % a.length];
  return "CA-" + s;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("Méthode non autorisée", 405);

  try {
    const b = await req.json();

    // ── Champs client ──
    const customer_name = str(b.customer_name, 80);
    const phone = str(b.phone, 20);
    const email = str(b.email, 120);
    const notes = str(b.notes, 500);
    const pickup_date = str(b.pickup_date, 10);
    const pickup_slot = str(b.pickup_slot, 30);
    if (!customer_name) return fail("Indiquez votre prénom et votre nom.");
    if (phone.replace(/\D/g, "").length < 9) return fail("Numéro de téléphone invalide.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Adresse e-mail invalide.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pickup_date)) return fail("Date invalide.");
    if (pickup_date < addDays(parisToday(), LEAD_DAYS)) {
      return fail(`Les commandes se font au moins ${LEAD_DAYS * 24} h avant la date de retrait.`);
    }
    if (!SLOTS.includes(pickup_slot)) return fail("Créneau invalide.");
    const pay_full = b.pay_full === true;
    const customer = { customer_name, phone, email, notes: notes || null, pickup_date, pickup_slot };

    // ══════════════ Boutique de Noël ══════════════
    if (b.kind === "noel") {
      if (parisToday() > NOEL_LAST_ORDER_DAY) return fail("Les commandes de Noël sont closes.");
      if (pickup_date < NOEL_FIRST_PICKUP || pickup_date > NOEL_LAST_PICKUP) {
        return fail(`Retrait possible du ${dateFr(NOEL_FIRST_PICKUP)} au ${dateFr(NOEL_LAST_PICKUP)}.`);
      }
      const wanted = new Map<string, number>();
      for (const l of Array.isArray(b.lines) ? b.lines.slice(0, 30) : []) {
        const id = str(l?.id, 60);
        const q = Math.floor(Number(l?.qty));
        if (id && q > 0) wanted.set(id, q);
      }
      if (!wanted.size) return fail("Votre commande de Noël est vide.");
      const { data: products } = await supabase.from("products").select("*").in("id", [...wanted.keys()]).eq("active", true);
      if (!products || products.length !== wanted.size) return fail("Un des produits n'est plus disponible.");

      // deno-lint-ignore no-explicit-any
      const lines: any[] = [];
      let total_cents = 0, boudin_g = 0;
      for (const p of products.sort((a, z) => a.sort - z.sort)) {
        const q = wanted.get(p.id)!;
        if (q < p.min_qty) return fail(`${p.name} : minimum ${qtyLabel(p.unit, p.min_qty)}.`);
        if (q % p.step) return fail(`${p.name} : par tranche de ${qtyLabel(p.unit, p.step)}.`);
        const line_cents = p.unit === "kg" ? Math.round((p.price_cents * q) / 1000) : p.price_cents * q;
        if (p.is_boudin) boudin_g += q;
        total_cents += line_cents;
        lines.push({ id: p.id, name: p.name, unit: p.unit, qty: q, line_cents, boudin: p.is_boudin });
      }
      if (boudin_g > NOEL_MAX_BOUDIN_G) return fail(`Maximum ${qtyLabel("kg", NOEL_MAX_BOUDIN_G)} de boudin par commande.`);
      if (boudin_g > NOEL_BIG_ORDER_G && pickup_date < addDays(parisToday(), NOEL_BIG_LEAD_DAYS)) {
        return fail(`Au-delà de ${qtyLabel("kg", NOEL_BIG_ORDER_G)} de boudin, il faut compter ${NOEL_BIG_LEAD_DAYS} jours de préparation : choisissez une date à partir du ${dateFr(addDays(parisToday(), NOEL_BIG_LEAD_DAYS))}.`);
      }
      const fresh = boudin_g > 0 && b.boudin_fresh === true; // boudins congelés par défaut, frais sur demande
      for (const l of lines) if (l.boudin) l.fresh = fresh;
      let spice = 0;
      if (boudin_g > 0) {
        spice = Number(b.spice);
        if (!Number.isInteger(spice) || spice < 0 || spice > 3) return fail("Choisissez le niveau d'épices des boudins.");
      }
      const deposit_cents = pay_full ? total_cents : Math.round((total_cents * NOEL_DEPOSIT_PERCENT) / 100);
      const ref = makeRef();
      const { data: order, error } = await supabase.from("orders").insert({
        ...customer, ref, kind: "noel", box_id: null, box_name: "Commande de Noël", qty: 1,
        items: lines.map((l) => `${l.name} — ${qtyLabel(l.unit, l.qty)}${l.boudin ? (l.fresh ? " (frais)" : " (congelé)") : ""}`), lines, spice,
        total_cents, deposit_cents, pay_full, status: "attente_paiement",
      }).select("id").single();
      if (error) throw error;

      const rest = ((total_cents - deposit_cents) / 100).toFixed(2).replace(".", ",");
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: email,
        locale: "fr",
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: deposit_cents,
            product_data: {
              name: pay_full ? "Commande de Noël — paiement complet" : `Acompte ${NOEL_DEPOSIT_PERCENT} % — Commande de Noël`,
              description: lines.map((l) => `${l.name} ${qtyLabel(l.unit, l.qty)}`).join(", ") +
                (boudin_g ? ` · Boudins : ${SPICE_LABELS[spice]}, ${fresh ? "frais" : "congelés"}` : "") +
                ` · Retrait le ${dateFr(pickup_date)} (${pickup_slot}) · Réf. ${ref}` +
                (pay_full ? " · Rien à régler au retrait" : ` · Solde de ${rest} € à régler au retrait`),
            },
          },
        }],
        metadata: { order_id: order.id, ref },
        payment_intent_data: { metadata: { order_id: order.id, ref } },
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
        success_url: `${SITE_URL}?commande=ok&ref=${ref}`,
        cancel_url: `${SITE_URL}?commande=annulee#noel`,
      });
      await supabase.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);
      return json({ url: session.url });
    }

    // ══════════════ Box ══════════════

    // ── Box ──
    const { data: box } = await supabase.from("boxes").select("*")
      .eq("id", str(b.box_id, 40)).eq("active", true).maybeSingle();
    if (!box) return fail("Cette box n'est pas disponible.");

    // ── Variétés ──
    const ids: string[] = Array.isArray(b.items)
      ? [...new Set(b.items.filter((x: unknown) => typeof x === "string").map((x: string) => x.slice(0, 60)))]
      : [];
    if (ids.length < 1) return fail("Choisissez au moins une variété.");
    if (ids.length > box.max_varieties) return fail(`Maximum ${box.max_varieties} variétés pour cette box.`);
    const { data: items } = await supabase.from("items").select("id,name,univers").in("id", ids).eq("active", true);
    if (!items || items.length !== ids.length) return fail("Une des mignardises choisies n'est plus disponible.");
    if (box.only_univers && items.some((i) => i.univers !== box.only_univers)) {
      return fail("Cette box se compose uniquement de mignardises Caraïbes.");
    }
    // Niveau d'épices : 0 pas épicé, 1 peu épicé, 2 épicé, 3 ça décoiffe
    const spice = Number(b.spice);
    if (!Number.isInteger(spice) || spice < 0 || spice > 3) return fail("Choisissez le niveau d'épices.");

    // On garde l'ordre choisi par le client
    const itemNames = ids.map((id) => items.find((i) => i.id === id)!.name);

    const ref = makeRef();
    const base = { ...customer, ref, kind: "box", box_id: box.id, box_name: box.name, items: itemNames, spice };

    // ── Box sur devis : simple demande, pas de paiement ──
    if (box.price_cents === null) {
      const guests = Math.floor(Number(b.guests));
      if (!(guests >= 1 && guests <= 500)) return fail("Indiquez le nombre de personnes.");
      const { error } = await supabase.from("orders").insert({ ...base, qty: 1, guests, status: "devis" });
      if (error) throw error;
      return json({ ok: true, ref });
    }

    // ── Box à prix fixe : paiement via Stripe ──
    const qty = Math.min(10, Math.max(1, Math.floor(Number(b.qty) || 1)));
    const total_cents = box.price_cents * qty;
    // Le client choisit : acompte (DEPOSIT_PERCENT %) ou totalité
    const deposit_cents = pay_full ? total_cents : Math.round((total_cents * DEPOSIT_PERCENT) / 100);
    const rest = ((total_cents - deposit_cents) / 100).toFixed(2).replace(".", ",");

    const { data: order, error } = await supabase.from("orders")
      .insert({ ...base, qty, total_cents, deposit_cents, pay_full, status: "attente_paiement" })
      .select("id").single();
    if (error) throw error;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      locale: "fr",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: deposit_cents,
          product_data: {
            name: pay_full
              ? `${box.name} × ${qty} — paiement complet`
              : `Acompte ${DEPOSIT_PERCENT} % — ${box.name} × ${qty}`,
            description: `${SPICE_LABELS[spice]} · Retrait le ${dateFr(pickup_date)} (${pickup_slot}) · Réf. ${ref}` +
              (pay_full ? " · Rien à régler au retrait" : ` · Solde de ${rest} € à régler au retrait`),
          },
        },
      }],
      metadata: { order_id: order.id, ref },
      payment_intent_data: { metadata: { order_id: order.id, ref } },
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // la session expire au bout d'1 h
      success_url: `${SITE_URL}?commande=ok&ref=${ref}`,
      cancel_url: `${SITE_URL}?commande=annulee`,
    });

    await supabase.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);
    return json({ url: session.url });
  } catch (e) {
    console.error(e);
    return fail("Erreur serveur, réessayez dans un instant.", 500);
  }
});
