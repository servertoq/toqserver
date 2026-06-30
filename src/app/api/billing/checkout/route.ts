import { NextResponse } from "next/server";
import Stripe from "stripe";
import { planUpgradeAmountCents } from "@/lib/billing/plans";
import { createAdminClient, isStripeConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UserPlan } from "@/types/plans";

const VALID_TARGETS: UserPlan[] = ["professor", "empresario"];

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Pagamentos não configurados. Adicione STRIPE_SECRET_KEY no servidor." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: { targetPlan?: UserPlan };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const targetPlan = body.targetPlan;
  if (!targetPlan || !VALID_TARGETS.includes(targetPlan)) {
    return NextResponse.json({ error: "Plano de destino inválido." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, email, username")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }

  const currentPlan = (profile.plan as UserPlan) ?? "free";
  const amountCents = planUpgradeAmountCents(currentPlan, targetPlan);

  if (amountCents <= 0) {
    return NextResponse.json(
      { error: "Este plano não exige pagamento adicional ou não é um upgrade." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: changeRow, error: insertErr } = await admin
    .from("plan_changes")
    .insert({
      user_id: user.id,
      from_plan: currentPlan,
      to_plan: targetPlan,
      amount_cents: amountCents,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !changeRow) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Não foi possível iniciar a mudança de plano." },
      { status: 500 }
    );
  }

  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: profile.email ?? user.email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "brl",
          unit_amount: amountCents,
          product_data: {
            name: `Upgrade Toq Tennis — ${targetPlan === "professor" ? "Professor" : "Empresário"}`,
            description: `Diferença mensal do plano ${currentPlan} para ${targetPlan}`,
          },
        },
      },
    ],
    metadata: {
      user_id: user.id,
      change_id: changeRow.id,
      from_plan: currentPlan,
      to_plan: targetPlan,
    },
    success_url: `${origin}/inicio/planos?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/inicio/planos?cancelled=1`,
  });

  await admin
    .from("plan_changes")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", changeRow.id);

  if (!session.url) {
    return NextResponse.json({ error: "Stripe não retornou URL de checkout." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
