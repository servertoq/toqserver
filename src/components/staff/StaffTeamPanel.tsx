"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { STAFF_ROLE_LABELS } from "@/lib/staff";
import type { StaffRole } from "@/types/staff";
import { StaffUsernameSearch, type UsernameSearchUser } from "./StaffUsernameSearch";

type StaffRow = {
  user_id: string;
  role: StaffRole;
  profile: { username: string } | null;
};

export function StaffTeamPanel() {
  const supabase = createClient();
  const [members, setMembers] = useState<StaffRow[]>([]);
  const [selectedUser, setSelectedUser] = useState<UsernameSearchUser | null>(null);
  const [role, setRole] = useState<StaffRole>("moderator");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("staff_members")
      .select("user_id, role, profile:profiles!staff_members_user_id_fkey(username)")
      .order("created_at");

    setMembers(
      (data ?? []).map((row) => ({
        user_id: row.user_id,
        role: row.role as StaffRole,
        profile: Array.isArray(row.profile) ? row.profile[0] : row.profile,
      }))
    );
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function grantRole(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) {
      setError("Selecione um usuário na lista.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: err } = await supabase.rpc("staff_grant_role", {
      p_user_id: selectedUser.id,
      p_role: role,
    });

    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }

    setSelectedUser(null);
    await load();
  }

  async function revoke(userId: string) {
    setLoading(true);
    const { error: err } = await supabase.rpc("staff_revoke_role", { p_user_id: userId });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    await load();
  }

  return (
    <section className="overflow-visible rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-[var(--toq-navy)]">Equipe (CEO / CTO)</h2>
      <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
        Gerencie cargos: CEO, CTO, Moderador e Marketing.
      </p>

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{error}</p>
      )}

      <form onSubmit={grantRole} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1">
          <StaffUsernameSearch
            value={selectedUser}
            onChange={setSelectedUser}
            placeholder="@usuário"
            label="Adicionar membro"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as StaffRole)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          {(Object.keys(STAFF_ROLE_LABELS) as StaffRole[]).map((r) => (
            <option key={r} value={r}>
              {STAFF_ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl toq-btn-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Adicionar
        </button>
      </form>

      <ul className="mt-4 divide-y divide-slate-100">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between gap-2 py-2.5">
            <div>
              <p className="text-sm font-semibold text-[var(--toq-navy)]">
                @{m.profile?.username ?? m.user_id.slice(0, 8)}
              </p>
              <p className="text-xs text-[var(--toq-text-muted)]">{STAFF_ROLE_LABELS[m.role]}</p>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() => void revoke(m.user_id)}
              className="text-xs font-semibold text-red-600 disabled:opacity-50"
            >
              Remover
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
