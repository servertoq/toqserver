import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!webhookSecret || !stripeKey) {
    return NextResponse.json({ error: "Stripe webhook não configurado." }, { status: 503 });
  }

  const stripe = new Stripe(stripeKey);
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Assinatura ausente." }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Assinatura inválida";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const changeId = session.metadata?.change_id;
    const userId = session.metadata?.user_id;

    if (changeId && userId && session.id) {
      const admin = createAdminClient();
      const { error } = await admin.rpc("complete_plan_upgrade", {
        p_change_id: changeId,
        p_stripe_session_id: session.id,
      });

      if (error) {
        console.error("complete_plan_upgrade:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const changeId = session.metadata?.change_id;
    if (changeId) {
      const admin = createAdminClient();
      await admin
        .from("plan_changes")
        .update({ status: "cancelled" })
        .eq("id", changeId)
        .eq("status", "pending");
    }
  }

  return NextResponse.json({ received: true });
}
