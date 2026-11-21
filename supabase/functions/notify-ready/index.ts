// Chez Ann's — « Marquer prête » depuis le tableau de bord + e-mail au client avec l'adresse de retrait
// Secrets nécessaires : SMTP_USER, SMTP_PASS, PICKUP_ADDRESS
//                       (+ optionnels REPLY_TO, MAIL_FROM_NAME, PICKUP_NOTE, CONTACT_PHONE)
// Réglage : « Enforce JWT verification » ACTIVÉ (seule Annie, connectée, peut l'appeler)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.16";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// ───────────────────────── E-mail ─────────────────────────
const SPICE_LABELS = ["Pas épicé", "Peu épicé", "Épicé", "Ça décoiffe"];
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const eur = (cents: number) => {
  const d = cents % 100 ? 2 : 0;
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) + " €";
};
const dateFr = (iso: string) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function layout(title: string, body: string) {
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#FBEADA">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBEADA;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFF8EF;border:2px solid #F2C46A;border-radius:20px;font-family:Arial,Helvetica,sans-serif;color:#2B1A12">
<tr><td style="padding:28px 28px 8px;text-align:center">
<div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:38px;color:#B81F2C;line-height:1">Chez Ann's</div>
<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#6B4E3D;margin-top:6px">Mignardises créoles faites maison</div>
</td></tr>
<tr><td style="padding:12px 28px 4px"><h1 style="margin:0;font-size:22px;color:#2B1A12">${title}</h1></td></tr>
<tr><td style="padding:8px 28px 28px;font-size:15px;line-height:1.55">${body}</td></tr>
</table>
<p style="font-family:Arial,sans-serif;font-size:12px;color:#6B4E3D;margin:14px 0 0">Chez Ann's · chezanns.github.io</p>
</td></tr></table></body></html>`;
}

async function sendMail(to: string, toName: string, subject: string, html: string) {
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  if (!user || !pass) throw new Error("SMTP_USER ou SMTP_PASS manquant");
  // Gmail en SSL sur le port 465 (les ports 25 et 587 sont bloqués sur Supabase)
  const transporter = nodemailer.createTransport({
    host: Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass: pass.replace(/\s+/g, "") },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  const name = Deno.env.get("MAIL_FROM_NAME") ?? "Chez Ann's";
  console.log(`Envoi e-mail à ${to} : ${subject}`);
  const info = await transporter.sendMail({
    from: { name, address: user },
    replyTo: { name, address: Deno.env.get("REPLY_TO") ?? user }, // les réponses des clients arrivent ici
    to: { name: toName, address: to },
    subject,
    html,
  });
  console.log("E-mail envoyé", info.messageId);
}

// deno-lint-ignore no-explicit-any
async function sendReady(o: any) {
  const address = Deno.env.get("PICKUP_ADDRESS") ?? "";
  const note = Deno.env.get("PICKUP_NOTE");
  const phone = Deno.env.get("CONTACT_PHONE");
  const rest = (o.total_cents ?? 0) - (o.deposit_cents ?? 0);
  const maps = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(address);
  const body = `
<p>Bonjour ${esc(o.customer_name)},</p>
<p>Bonne nouvelle : votre <b>${esc(o.box_name)}${o.qty > 1 ? " × " + esc(o.qty) : ""}</b> est <b>prête</b> !</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #EBD5BB;border-radius:14px;margin:16px 0">
<tr><td style="padding:16px">
<div style="font-size:13px;color:#6B4E3D;text-transform:uppercase;letter-spacing:1px">Rendez-vous</div>
<div style="font-size:18px;font-weight:bold;margin:4px 0 12px">${esc(dateFr(o.pickup_date))} · ${esc(o.pickup_slot)}</div>
<div style="font-size:13px;color:#6B4E3D;text-transform:uppercase;letter-spacing:1px">Adresse de retrait</div>
<div style="font-size:17px;font-weight:bold;margin:4px 0 6px;white-space:pre-line">${esc(address)}</div>
${note ? `<div style="font-size:14px;color:#4A3427;white-space:pre-line">${esc(note)}</div>` : ""}
<div style="margin-top:14px"><a href="${maps}" style="display:inline-block;background:#B81F2C;color:#FFF6EA;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:999px">Ouvrir dans Google Maps</a></div>
</td></tr></table>
<p>${rest > 0
    ? `Il vous restera <b>${eur(rest)}</b> à régler au moment du retrait.`
    : "Tout est déjà réglé, vous n'avez plus qu'à venir la chercher."}</p>
<p style="font-size:14px;color:#4A3427">Référence : <b>${esc(o.ref)}</b> · Épices : ${esc(SPICE_LABELS[o.spice ?? 0])}</p>
<p>Un empêchement ? Répondez à cet e-mail${phone ? ` ou appelez le <b>${esc(phone)}</b>` : ""}.</p>
<p>À tout à l'heure,<br><b>Annie — Chez Ann's</b></p>`;
  await sendMail(o.email, o.customer_name, `Votre box est prête 🎉 — Réf. ${o.ref}`, layout("Votre commande est prête !", body));
}

// ───────────────────────── Fonction ─────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    // Vérifie que c'est bien un compte admin (Annie) qui appelle
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await supabase.auth.getUser(token);
    const user = auth?.user;
    if (!user) return json({ error: "Non connecté" }, 401);
    const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!admin) return json({ error: "Accès refusé" }, 403);

    const { order_id } = await req.json();
    const { data: order } = await supabase.from("orders").select("*").eq("id", String(order_id ?? "")).maybeSingle();
    if (!order) return json({ error: "Commande introuvable" }, 404);
    if (!["confirmee", "prete"].includes(order.status)) return json({ error: "Cette commande ne peut pas être marquée prête" }, 400);

    await supabase.from("orders").update({ status: "prete" }).eq("id", order.id);

    // Un seul e-mail « prête » par commande
    if (order.ready_email_sent_at) return json({ ok: true, emailed: false, already: true });
    try {
      await sendReady(order);
      await supabase.from("orders").update({ ready_email_sent_at: new Date().toISOString() }).eq("id", order.id);
      return json({ ok: true, emailed: true });
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.error("E-mail « prête » non envoyé :", reason);
      return json({ ok: true, emailed: false, error: reason });
    }
  } catch (e) {
    console.error(e);
    return json({ error: "Erreur serveur" }, 500);
  }
});
