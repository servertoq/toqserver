import { NextResponse } from "next/server";
import {
  fetchMercadoPagoPayment,
  fetchMercadoPagoPreapproval,
  getMercadoPagoWebhookSecret,
  isMercadoPagoConfigured,
  verifyMercadoPagoWebhookSignature,
} from "@/lib/billing/mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function completeChange(
  changeId: string,
  opts: { paymentId?: string | null; preapprovalId?: string | null }
) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("complete_plan_payment", {
    p_change_id: changeId,
    p_mp_payment_id: opts.paymentId ?? null,
    p_mp_preapproval_id: opts.preapprovalId ?? null,
  });
  if (error) throw new Error(error.message);
}

async function handlePaymentNotification(paymentId: string) {
  const payment = await fetchMercadoPagoPayment(paymentId);
  const status = payment.status;
  const externalRef = payment.external_reference ? String(payment.external_reference) : null;
  if (!externalRef) return { ok: true, skipped: "sem external_reference" };

  if (status === "approved") {
    await completeChange(externalRef, { paymentId: String(payment.id) });
    return { ok: true, completed: externalRef };
  }

  if (status === "cancelled" || status === "rejected") {
    const admin = createAdminClient();
    await admin
      .from("plan_changes")
      .update({ status: "failed", mp_payment_id: String(payment.id) })
      .eq("id", externalRef)
      .eq("status", "pending");
  }

  return { ok: true, status };
}

async function handlePreapprovalNotification(preapprovalId: string) {
  const preapproval = await fetchMercadoPagoPreapproval(preapprovalId);
  const status = preapproval.status;
  const externalRef = preapproval.external_reference
    ? String(preapproval.external_reference)
    : null;
  if (!externalRef) return { ok: true, skipped: "sem external_reference" };

  if (status === "authorized") {
    await completeChange(externalRef, { preapprovalId: String(preapproval.id) });
    return { ok: true, completed: externalRef };
  }

  if (status === "cancelled") {
    const admin = createAdminClient();
    await admin
      .from("plan_changes")
      .update({ status: "cancelled", mp_preapproval_id: String(preapproval.id) })
      .eq("id", externalRef)
      .eq("status", "pending");
  }

  return { ok: true, status };
}

async function handleSubscriptionAuthorizedPayment(paymentId: string) {
  const payment = await fetchMercadoPagoPayment(paymentId);
  if (payment.status !== "approved") {
    return { ok: true, status: payment.status };
  }

  const admin = createAdminClient();
  const externalRef = payment.external_reference ? String(payment.external_reference) : null;

  if (externalRef) {
    const { data: existing } = await admin
      .from("plan_changes")
      .select("id, status")
      .eq("id", externalRef)
      .maybeSingle();
    if (existing) {
      if (existing.status !== "completed") {
        await completeChange(externalRef, { paymentId: String(payment.id) });
      }
      return { ok: true, via: "change_id" };
    }
  }

  const preapprovalId =
    (payment as { metadata?: Record<string, unknown> }).metadata?.preapproval_id != null
      ? String((payment as { metadata?: Record<string, unknown> }).metadata!.preapproval_id)
      : null;

  if (!preapprovalId) {
    return { ok: true, skipped: "sem preapproval para renovação" };
  }

  const { data: prof } = await admin
    .from("profiles")
    .select("id, plan")
    .eq("mp_preapproval_id", preapprovalId)
    .maybeSingle();

  if (!prof || prof.plan === "free") {
    return { ok: true, skipped: "perfil não encontrado" };
  }

  const { data: already } = await admin
    .from("plan_changes")
    .select("id")
    .eq("mp_payment_id", String(payment.id))
    .maybeSingle();
  if (already) return { ok: true, skipped: "payment já processado" };

  const { data: changeRow, error } = await admin
    .from("plan_changes")
    .insert({
      user_id: prof.id,
      from_plan: prof.plan,
      to_plan: prof.plan,
      amount_cents: Math.round(Number(payment.transaction_amount ?? 0) * 100),
      status: "pending",
      provider: "mercadopago",
      payment_mode: "card_recurring",
      charge_kind: "renew",
      mp_payment_id: String(payment.id),
      mp_preapproval_id: preapprovalId,
    })
    .select("id")
    .single();

  if (error || !changeRow) {
    throw new Error(error?.message ?? "Falha ao registrar renovação.");
  }

  await completeChange(changeRow.id, {
    paymentId: String(payment.id),
    preapprovalId,
  });

  return { ok: true, renewed: changeRow.id };
}

async function processNotification(topic: string, id: string) {
  if (topic === "merchant_order") return { ok: true, skipped: "merchant_order" };
  if (topic === "payment") return handlePaymentNotification(id);
  if (topic === "subscription_preapproval" || topic === "preapproval") {
    return handlePreapprovalNotification(id);
  }
  if (topic === "subscription_authorized_payment") {
    return handleSubscriptionAuthorizedPayment(id);
  }
  return { ok: true, skipped: `topic ${topic}` };
}

function normalizeTopic(raw: string) {
  const t = raw.toLowerCase();
  if (t.includes("authorized")) return "subscription_authorized_payment";
  if (t.includes("preapproval")) return "subscription_preapproval";
  if (t.includes("payment")) return "payment";
  if (t.includes("merchant_order")) return "merchant_order";
  return t;
}

function assertWebhookSignature(request: Request, dataId: string) {
  const secret = getMercadoPagoWebhookSecret();
  if (!secret) {
    const isProd =
      process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
    if (isProd) {
      console.error("[mp-webhook] MERCADOPAGO_WEBHOOK_SECRET ausente em produção");
      return NextResponse.json(
        { error: "Webhook sem secret configurada" },
        { status: 503 }
      );
    }
    console.warn("[mp-webhook] secret ausente — validação desligada (dev)");
    return null;
  }

  const ok = verifyMercadoPagoWebhookSignature({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId,
  });

  if (!ok) {
    console.warn("[mp-webhook] assinatura inválida");
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  return null;
}

export async function POST(request: Request) {
  if (!isMercadoPagoConfigured()) {
    return NextResponse.json({ error: "MP não configurado" }, { status: 503 });
  }

  try {
    const url = new URL(request.url);
    let topic = url.searchParams.get("topic") || url.searchParams.get("type") || "";
    let id = url.searchParams.get("id") || url.searchParams.get("data.id") || "";

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as {
        type?: string;
        action?: string;
        data?: { id?: string | number };
        id?: string | number;
      } | null;
      if (body) {
        topic = body.type || body.action || topic;
        id = body.data?.id != null ? String(body.data.id) : body.id != null ? String(body.id) : id;
      }
    }

    // data.id da query é o usado no manifesto oficial do MP
    const dataIdForSignature = url.searchParams.get("data.id") || id;

    if (dataIdForSignature) {
      const rejected = assertWebhookSignature(request, dataIdForSignature);
      if (rejected) return rejected;
    }

    if (!topic || !id) {
      return NextResponse.json({ ok: true, skipped: "sem topic/id" });
    }

    const result = await processNotification(normalizeTopic(topic), id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[mp-webhook]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "webhook error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
