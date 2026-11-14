// Chez Ann's — réception des notifications Stripe (paiement de l'acompte)
// Secrets nécessaires : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// À déployer avec : supabase functions deploy stripe-webhook --no-verify-jwt
import Stripe from "npm:stripe@16.12.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

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
    await supabase.from("orders")
      .update({ status: "confirmee", deposit_paid: true, paid_at: new Date().toISOString() })
      .eq("id", orderId).eq("status", "attente_paiement");
  }

  if (orderId && event.type === "checkout.session.expired") {
    await supabase.from("orders")
      .update({ status: "annulee" })
      .eq("id", orderId).eq("status", "attente_paiement");
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
