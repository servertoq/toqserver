import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPlanExpiry } from "@/lib/billing/plans";
import { planLabel } from "@/lib/plans";
import type { UserPlan } from "@/types/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Em dev sem secret, permite; em prod exige
    if (process.env.NODE_ENV === "production" && process.env.VERCEL) {
      return false;
    }
    return true;
  }
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function sendRenewalEmail(opts: {
  email: string;
  plan: UserPlan;
  expiresAt: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY ausente" };

  const from = process.env.RESEND_FROM_EMAIL || "Toq Tennis <noreply@mail.toqtennis.com.br>";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.toqtennis.com.br";
  const expiresLabel = formatPlanExpiry(opts.expiresAt) ?? opts.expiresAt;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.email],
      subject: `Seu plano ${planLabel(opts.plan)} vence em breve — Toq Tennis`,
      html: `
        <p>Olá!</p>
        <p>Seu plano <strong>${planLabel(opts.plan)}</strong> na Toq Tennis vence em <strong>${expiresLabel}</strong>.</p>
        <p>Renove agora para manter os benefícios. Se renovar antes do vencimento, os dias restantes entram na conta (ex.: 3 dias restantes + 30 = 33 dias).</p>
        <p><a href="${appUrl}/inicio/planos">Renovar plano</a></p>
        <p>Equipe Toq Tennis</p>
      `,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { sent: false, reason: text };
  }
  return { sent: true };
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: expiredCount, error: expireErr } = await admin.rpc("expire_due_plans");
  if (expireErr) {
    return NextResponse.json({ error: expireErr.message }, { status: 500 });
  }

  const { data: reminders, error: listErr } = await admin.rpc("list_plan_renewal_reminders");
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const rows = (reminders ?? []) as Array<{
    user_id: string;
    email: string | null;
    plan: UserPlan;
    plan_expires_at: string;
  }>;

  let reminded = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.email) continue;
    try {
      const result = await sendRenewalEmail({
        email: row.email,
        plan: row.plan,
        expiresAt: row.plan_expires_at,
      });
      if (result.sent) {
        await admin.rpc("mark_plan_renewal_reminder_sent", { p_user_id: row.user_id });
        reminded += 1;
      } else if (result.reason && !result.reason.includes("ausente")) {
        errors.push(`${row.email}: ${result.reason}`);
      } else if (result.reason?.includes("ausente")) {
        // Sem Resend: marca mesmo assim para não loop infinito em prod sem e-mail
        // Melhor não marcar — deixa tentar de novo quando houver chave
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "erro");
    }
  }

  return NextResponse.json({
    ok: true,
    expired: expiredCount ?? 0,
    reminders_candidates: rows.length,
    reminded,
    errors: errors.slice(0, 10),
  });
}

export async function POST(request: Request) {
  return GET(request);
}
