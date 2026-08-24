import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production" && process.env.VERCEL) {
      return false;
    }
    return true;
  }
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function sendDeletionWarningEmail(opts: {
  email: string;
  username: string;
  scheduledFor: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY ausente" };

  const from = process.env.RESEND_FROM_EMAIL || "Toq Tennis <noreply@mail.toqtennis.com.br>";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.toqtennis.com.br";
  const when = new Date(opts.scheduledFor).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.email],
      subject: "Sua conta Toq Tennis será excluída em breve",
      html: `
        <p>Olá @${opts.username},</p>
        <p>Você solicitou a exclusão da sua conta. Ela será excluída definitivamente em <strong>${when}</strong> se você não fizer login até lá.</p>
        <p>Para cancelar a exclusão e reativar a conta, basta entrar novamente:</p>
        <p><a href="${appUrl}/">Fazer login na Toq Tennis</a></p>
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
  const warningsSent: string[] = [];
  const purged: string[] = [];
  const errors: string[] = [];

  const { data: warnings, error: warnListErr } = await admin.rpc(
    "list_account_deletion_warnings"
  );
  if (warnListErr) {
    return NextResponse.json({ error: warnListErr.message }, { status: 500 });
  }

  for (const row of (warnings ?? []) as Array<{
    user_id: string;
    email: string;
    username: string;
    deletion_scheduled_for: string;
  }>) {
    if (!row.email) continue;
    const result = await sendDeletionWarningEmail({
      email: row.email,
      username: row.username,
      scheduledFor: row.deletion_scheduled_for,
    });
    if (result.sent || result.reason === "RESEND_API_KEY ausente") {
      const { error: markErr } = await admin.rpc("mark_account_deletion_warning_sent", {
        p_user_id: row.user_id,
      });
      if (markErr) {
        errors.push(`warn mark ${row.user_id}: ${markErr.message}`);
      } else {
        warningsSent.push(row.user_id);
      }
    } else {
      errors.push(`warn mail ${row.user_id}: ${result.reason}`);
    }
  }

  const { data: due, error: dueErr } = await admin.rpc("list_account_deletions_due");
  if (dueErr) {
    return NextResponse.json({ error: dueErr.message }, { status: 500 });
  }

  for (const row of (due ?? []) as Array<{
    user_id: string;
    email: string;
    username: string;
  }>) {
    const { error: delErr } = await admin.auth.admin.deleteUser(row.user_id);
    if (delErr) {
      errors.push(`purge ${row.user_id}: ${delErr.message}`);
    } else {
      purged.push(row.user_id);
    }
  }

  return NextResponse.json({
    warningsSent: warningsSent.length,
    purged: purged.length,
    errors,
  });
}
