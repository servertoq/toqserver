import { NextResponse } from "next/server";
import {
  createCardPreapproval,
  createCheckoutPreference,
  isMercadoPagoConfigured,
} from "@/lib/billing/mercadopago";
import { normalizePlan, quotePlanCharge, type PlanPaymentMode } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { planLabel } from "@/lib/plans";
import type { UserPlan } from "@/types/plans";

const VALID_TARGETS: UserPlan[] = ["professor", "promotor", "proprietario", "proprietario_plus"];
const VALID_MODES: PlanPaymentMode[] = ["pix", "card_once", "card_recurring"];

export async function POST(request: Request) {
  if (!isMercadoPagoConfigured()) {
    return NextResponse.json(
      {
        error:
          "Pagamentos não configurados. Adicione MERCADOPAGO_ACCESS_TOKEN no servidor.",
      },
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

  let body: { targetPlan?: UserPlan; paymentMode?: PlanPaymentMode };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const targetPlan = body.targetPlan;
  const paymentMode = body.paymentMode ?? "pix";

  if (!targetPlan || !VALID_TARGETS.includes(targetPlan)) {
    return NextResponse.json({ error: "Plano de destino inválido." }, { status: 400 });
  }
  if (!VALID_MODES.includes(paymentMode)) {
    return NextResponse.json({ error: "Forma de pagamento inválida." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, email, username, is_banned, plan_activated_at, plan_expires_at")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }

  if (profile.is_banned) {
    return NextResponse.json({ error: "Conta suspensa." }, { status: 403 });
  }

  const currentPlan = normalizePlan((profile.plan as UserPlan) ?? "free");
  const quote = quotePlanCharge(currentPlan, targetPlan, profile.plan_activated_at);

  if (quote.amountCents <= 0) {
    return NextResponse.json(
      { error: "Este plano não exige pagamento ou não é um upgrade/renovação válida." },
      { status: 400 }
    );
  }

  // Recorrência: valor mensal integral do plano destino
  const recurringAmount =
    paymentMode === "card_recurring"
      ? quotePlanCharge("free", targetPlan).amountCents
      : quote.amountCents;

  const admin = createAdminClient();
  const { data: changeRow, error: insertErr } = await admin
    .from("plan_changes")
    .insert({
      user_id: user.id,
      from_plan: currentPlan,
      to_plan: targetPlan,
      amount_cents: paymentMode === "card_recurring" ? recurringAmount : quote.amountCents,
      status: "pending",
      provider: "mercadopago",
      payment_mode: paymentMode,
      charge_kind: quote.chargeKind,
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

  const email = profile.email ?? user.email;
  if (!email) {
    return NextResponse.json({ error: "E-mail da conta é obrigatório para pagar." }, { status: 400 });
  }

  const successUrl = `${origin}/inicio/planos?success=1`;
  const cancelUrl = `${origin}/inicio/planos?cancelled=1`;
  const notificationUrl = `${origin}/api/billing/webhook`;

  try {
    if (paymentMode === "card_recurring") {
      const sub = await createCardPreapproval({
        changeId: changeRow.id,
        userId: user.id,
        email,
        reason: `Toq Tennis — ${planLabel(targetPlan)} (mensal)`,
        amountCents: recurringAmount,
        fromPlan: currentPlan,
        toPlan: targetPlan,
        chargeKind: quote.chargeKind,
        backUrl: successUrl,
      });

      await admin
        .from("plan_changes")
        .update({ mp_preapproval_id: sub.id })
        .eq("id", changeRow.id);

      return NextResponse.json({ url: sub.initPoint, provider: "mercadopago" });
    }

    const pref = await createCheckoutPreference({
      changeId: changeRow.id,
      userId: user.id,
      email,
      title: `Toq Tennis — ${planLabel(targetPlan)}`,
      description: quote.description,
      amountCents: quote.amountCents,
      fromPlan: currentPlan,
      toPlan: targetPlan,
      chargeKind: quote.chargeKind,
      paymentMode,
      successUrl,
      cancelUrl,
      notificationUrl,
    });

    await admin
      .from("plan_changes")
      .update({ mp_preference_id: pref.id })
      .eq("id", changeRow.id);

    return NextResponse.json({ url: pref.initPoint, provider: "mercadopago" });
  } catch (err) {
    await admin.from("plan_changes").update({ status: "failed" }).eq("id", changeRow.id);
    const message = err instanceof Error ? err.message : "Falha ao criar checkout.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
