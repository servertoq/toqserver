"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PLAN_LABELS } from "@/lib/plans";
import type { UserPlan } from "@/types/plans";
import { StaffUsernameSearch, type UsernameSearchUser } from "./StaffUsernameSearch";
import { StaffDeleteContentPanel } from "./StaffDeleteContentPanel";

const STAFF_ASSIGNABLE_PLANS: UserPlan[] = [
  "free",
  "professor",
  "proprietario",
  "proprietario_plus",
];

type Props = {
  onAction: () => void;
};

export function StaffToolsPanel({ onAction }: Props) {
  const supabase = createClient();
  const [selectedUser, setSelectedUser] = useState<UsernameSearchUser | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [planUser, setPlanUser] = useState<UsernameSearchUser | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<UserPlan>("free");

  async function run(
    label: string,
    fn: () => PromiseLike<{ error: { message: string } | null }>,
    clearUser = false
  ) {
    setLoading(true);
    setMessage(null);
    const { error } = await fn();
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(`${label} executado com sucesso.`);
    if (clearUser) setSelectedUser(null);
    onAction();
  }

  async function runUserAction(
    label: string,
    fn: () => PromiseLike<{ error: { message: string } | null }>
  ) {
    if (!selectedUser) {
      setMessage("Selecione um usuário na lista.");
      return;
    }
    await run(label, fn, true);
  }

  return (
    <>
      <section className="overflow-visible rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-[var(--toq-navy)]">Banimento de usuários</h2>
        <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
          Busque o @usuário para banir ou desbanir da plataforma.
        </p>

        <div className="mt-4">
          <StaffUsernameSearch value={selectedUser} onChange={setSelectedUser} />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo do banimento (opcional)"
            className="toq-input mt-2 w-full px-3 py-2 text-sm"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                runUserAction("Banimento", () =>
                  supabase.rpc("staff_ban_user", {
                    p_user_id: selectedUser!.id,
                    p_reason: reason || null,
                  })
                )
              }
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              Banir usuário
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                runUserAction("Desbanimento", () =>
                  supabase.rpc("staff_unban_user", { p_user_id: selectedUser!.id })
                )
              }
              className="rounded-lg toq-btn-outline px-3 py-1.5 text-xs text-green-600 disabled:opacity-50"
            >
              Desbanir usuário
            </button>
          </div>
        </div>

        {message && (
          <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-[var(--toq-navy)]">
            {message}
          </p>
        )}
      </section>

      <section className="mt-4 overflow-visible rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-[var(--toq-navy)]">Plano do usuário</h2>
        <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
          Atribua Usuário, Professor, Proprietário ou Proprietário Plus (sem cobrança automática).
        </p>
        <div className="mt-4">
          <StaffUsernameSearch value={planUser} onChange={setPlanUser} />
          <select
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value as UserPlan)}
            className="toq-input mt-2 w-full px-3 py-2 text-sm"
          >
            {STAFF_ASSIGNABLE_PLANS.map((plan) => (
              <option key={plan} value={plan}>
                {PLAN_LABELS[plan]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              if (!planUser) {
                setMessage("Selecione um usuário para alterar o plano.");
                return;
              }
              await run(
                "Plano atualizado",
                () =>
                  supabase.rpc("staff_set_user_plan", {
                    p_user_id: planUser.id,
                    p_plan: selectedPlan,
                  }),
                false
              );
            }}
            className="mt-2 rounded-lg toq-btn-primary px-3 py-1.5 text-xs text-white disabled:opacity-50"
          >
            Salvar plano
          </button>
        </div>
      </section>

      <StaffDeleteContentPanel onAction={onAction} />
    </>
  );
}
