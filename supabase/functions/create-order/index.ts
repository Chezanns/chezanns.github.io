// Chez Ann's — création d'une commande + session de paiement Stripe pour l'acompte
// Secrets nécessaires : STRIPE_SECRET_KEY, SITE_URL (+ optionnels DEPOSIT_PERCENT, LEAD_DAYS)
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
const LEAD_DAYS = Number(Deno.env.get("LEAD_DAYS") ?? "2");
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
      return fail(`Les commandes se font au moins ${LEAD_DAYS} jours à l'avance.`);
    }
    if (!SLOTS.includes(pickup_slot)) return fail("Créneau invalide.");

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
    // Niveau d'épices : 0 pas épicé, 1 peu épicé, 2 épicé, 3 ça chauffe bien
    const spice = Number(b.spice);
    if (!Number.isInteger(spice) || spice < 0 || spice > 3) return fail("Choisissez le niveau d'épices.");
    const SPICE_LABELS = ["Pas épicé", "Peu épicé", "Épicé", "Ça chauffe bien"];

    // On garde l'ordre choisi par le client
    const itemNames = ids.map((id) => items.find((i) => i.id === id)!.name);

    const ref = makeRef();
    const base = {
      ref, box_id: box.id, box_name: box.name, items: itemNames, spice,
      customer_name, phone, email, notes: notes || null, pickup_date, pickup_slot,
    };

    // ── Box sur devis : simple demande, pas de paiement ──
    if (box.price_cents === null) {
      const guests = Math.floor(Number(b.guests));
      if (!(guests >= 1 && guests <= 500)) return fail("Indiquez le nombre de personnes.");
      const { error } = await supabase.from("orders").insert({ ...base, qty: 1, guests, status: "devis" });
      if (error) throw error;
      return json({ ok: true, ref });
    }

    // ── Box à prix fixe : acompte via Stripe ──
    const qty = Math.min(10, Math.max(1, Math.floor(Number(b.qty) || 1)));
    const total_cents = box.price_cents * qty;
    const deposit_cents = Math.round((total_cents * DEPOSIT_PERCENT) / 100);

    const { data: order, error } = await supabase.from("orders")
      .insert({ ...base, qty, total_cents, deposit_cents, status: "attente_paiement" })
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
            name: `Acompte ${DEPOSIT_PERCENT} % — ${box.name} × ${qty}`,
            description: `${SPICE_LABELS[spice]} · Retrait le ${dateFr(pickup_date)} (${pickup_slot}) · Réf. ${ref} · Solde de ${((total_cents - deposit_cents) / 100).toFixed(2).replace(".", ",")} € à régler au retrait`,
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
