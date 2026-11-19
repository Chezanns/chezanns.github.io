// Chez Ann's — réception des notifications Stripe (paiement) + e-mail de confirmation au client
// Secrets nécessaires : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//                       SMTP_USER, SMTP_PASS (+ optionnels REPLY_TO, MAIL_FROM_NAME, CONTACT_PHONE, NOTIFY_EMAIL)
// Réglage : « Enforce JWT verification » DÉSACTIVÉ pour cette fonction
import Stripe from "npm:stripe@16.12.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.16";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ───────────────────────── E-mails ─────────────────────────
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

// deno-lint-ignore no-explicit-any
function recap(o: any) {
  const rest = (o.total_cents ?? 0) - (o.deposit_cents ?? 0);
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 0;color:#6B4E3D;vertical-align:top;width:42%">${k}</td><td style="padding:6px 0;font-weight:bold">${v}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #EBD5BB;border-radius:14px;padding:12px 16px;margin:16px 0">
${row("Référence", esc(o.ref))}
${row("Box", `${esc(o.box_name)} × ${esc(o.qty)}`)}
${row("Mignardises", (o.items ?? []).map(esc).join("<br>"))}
${row("Épices", esc(SPICE_LABELS[o.spice ?? 0]))}
${row("Retrait", `${esc(dateFr(o.pickup_date))}<br>${esc(o.pickup_slot)}`)}
${row("Déjà payé", eur(o.deposit_cents ?? 0))}
${row("Reste à régler au retrait", rest > 0 ? eur(rest) : "Rien, tout est réglé")}
${o.notes ? row("Votre message", `<span style="font-weight:normal;font-style:italic">« ${esc(o.notes)} »</span>`) : ""}
</table>`;
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
  });
  const name = Deno.env.get("MAIL_FROM_NAME") ?? "Chez Ann's";
  await transporter.sendMail({
    from: { name, address: user },
    replyTo: { name, address: Deno.env.get("REPLY_TO") ?? user }, // les réponses des clients arrivent ici
    to: { name: toName, address: to },
    subject,
    html,
  });
}

// deno-lint-ignore no-explicit-any
async function sendConfirmation(o: any) {
  const phone = Deno.env.get("CONTACT_PHONE");
  const body = `
<p>Bonjour ${esc(o.customer_name)},</p>
<p>Merci pour votre commande ! Votre paiement de <b>${eur(o.deposit_cents ?? 0)}</b> est bien reçu et votre commande est <b>confirmée</b>.</p>
<p>Annie s'occupe de la préparer avec amour pour le jour du retrait.</p>
${recap(o)}
<p style="background:#F7B52A;border-radius:12px;padding:12px 14px;margin:0 0 14px"><b>Et ensuite ?</b> Vous recevrez un second e-mail dès que votre box sera prête, avec l'adresse exacte de retrait.</p>
<p>Une question ? Répondez simplement à cet e-mail${phone ? ` ou appelez le <b>${esc(phone)}</b>` : ""}.</p>
<p>À très vite,<br><b>Annie — Chez Ann's</b></p>`;
  await sendMail(o.email, o.customer_name, `Commande confirmée ✔ ${o.box_name} — Réf. ${o.ref}`, layout("Votre commande est confirmée", body));

  // Copie facultative pour Annie
  const notify = Deno.env.get("NOTIFY_EMAIL");
  if (notify) {
    const short = `<p>Nouvelle commande de <b>${esc(o.customer_name)}</b> (${esc(o.phone)}).</p>${recap(o)}`;
    await sendMail(notify, "Annie", `Nouvelle commande — ${o.box_name} × ${o.qty} — ${dateFr(o.pickup_date)}`, layout("Nouvelle commande", short))
      .catch((e) => console.error("Copie Annie non envoyée", e));
  }
}

// ───────────────────────── Webhook ─────────────────────────
Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Signature manquante", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await req.text(),
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
      undefined,
      cryptoProvider,
    );
  } catch (e) {
    console.error("Signature invalide", e);
    return new Response("Signature invalide", { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = session.metadata?.order_id;

  if (orderId && event.type === "checkout.session.completed" && session.payment_status === "paid") {
    const { data: order } = await supabase.from("orders")
      .update({ status: "confirmee", deposit_paid: true, paid_at: new Date().toISOString() })
      .eq("id", orderId).eq("status", "attente_paiement")
      .select("*").maybeSingle();

    // Un seul e-mail par commande, même si Stripe renvoie l'événement
    if (order && !order.confirm_email_sent_at) {
      try {
        await sendConfirmation(order);
        await supabase.from("orders").update({ confirm_email_sent_at: new Date().toISOString() }).eq("id", orderId);
      } catch (e) {
        console.error("E-mail de confirmation non envoyé", e);
      }
    }
  }

  if (orderId && event.type === "checkout.session.expired") {
    await supabase.from("orders")
      .update({ status: "annulee" })
      .eq("id", orderId).eq("status", "attente_paiement");
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
