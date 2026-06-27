"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FeedTopBar } from "@/components/feed/FeedTopBar";
import { useAppProfile } from "@/components/app/AppShell";
import { appContentClass } from "@/lib/layout";
import {
  canAccessTicketBox,
  canManageAdvertising,
  canManageStaff,
  canModeratePlatform,
  STAFF_ROLE_LABELS,
} from "@/lib/staff";
import { loadStaffTickets } from "@/lib/staffTickets";
import type { StaffRole } from "@/types/staff";
import type { SupportTicketWithReporter } from "@/types/support";
import { StaffTicketBox } from "./StaffTicketBox";
import { StaffTicketDetailModal } from "./StaffTicketDetailModal";
import { StaffToolsPanel } from "./StaffToolsPanel";
import { StaffTeamPanel } from "./StaffTeamPanel";

export function StaffModerationPage() {
  const supabase = createClient();
  const profile = useAppProfile();
  const staffRole = profile.staffRole;

  const [reports, setReports] = useState<SupportTicketWithReporter[]>([]);
  const [suggestions, setSuggestions] = useState<SupportTicketWithReporter[]>([]);
  const [support, setSupport] = useState<SupportTicketWithReporter[]>([]);
  const [selected, setSelected] = useState<SupportTicketWithReporter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canModerate = canModeratePlatform(staffRole);
  const canAdvertising = canManageAdvertising(staffRole);
  const showReports = canAccessTicketBox(staffRole, "report");
  const showSuggestions = canAccessTicketBox(staffRole, "suggestion");
  const showSupport = canAccessTicketBox(staffRole, "help");

  const load = useCallback(async () => {
    if (!staffRole) return;
    setLoading(true);
    setError(null);
    try {
      const tasks: Promise<void>[] = [];
      if (showReports) {
        tasks.push(loadStaffTickets(supabase, "report").then(setReports));
      }
      if (showSuggestions) {
        tasks.push(loadStaffTickets(supabase, "suggestion").then(setSuggestions));
      }
      if (showSupport) {
        tasks.push(loadStaffTickets(supabase, "help").then(setSupport));
      }
      await Promise.all(tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar painel.");
    }
    setLoading(false);
  }, [showReports, showSuggestions, showSupport, staffRole, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  if (!staffRole) {
    return (
      <>
        <FeedTopBar />
        <main className={appContentClass}>
          <p className="text-sm text-red-600">Acesso restrito à equipe Toq Tennis.</p>
        </main>
      </>
    );
  }

  const boxCount = [showReports, showSuggestions, showSupport].filter(Boolean).length;

  return (
    <>
      <FeedTopBar />
      <main className={appContentClass}>
        <header className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--toq-text-muted)]">
            Equipe Toq
          </p>
          <h1 className="mt-1 text-xl font-bold text-[var(--toq-navy)]">Painel de moderação</h1>
          <p className="mt-1 text-sm text-[var(--toq-text-muted)]">
            Cargo: {STAFF_ROLE_LABELS[staffRole as StaffRole]}
          </p>
        </header>

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        {canAdvertising && !canModerate && (
          <p className="mb-4 rounded-xl border border-[var(--toq-accent)]/30 bg-[var(--toq-accent-soft)] px-4 py-3 text-sm text-[var(--toq-navy)]">
            Para criar e editar notícias de publicidade (cards da home), acesse{" "}
            <Link href="/inicio/publicidade" className="font-bold text-[var(--toq-accent)] hover:underline">
              Publicidade
            </Link>
            .
          </p>
        )}

        {loading ? (
          <p className="text-sm text-[var(--toq-text-muted)]">Carregando filas…</p>
        ) : (
          <div
            className={`grid gap-4 ${
              boxCount >= 3 ? "lg:grid-cols-3" : boxCount === 2 ? "md:grid-cols-2" : ""
            }`}
          >
            {showReports && (
              <StaffTicketBox
                title="Denúncias"
                emoji="🚩"
                tickets={reports}
                onSelect={setSelected}
                emptyLabel="Nenhuma denúncia pendente."
              />
            )}
            {showSuggestions && (
              <StaffTicketBox
                title="Sugestões"
                emoji="💡"
                tickets={suggestions}
                onSelect={setSelected}
                emptyLabel="Nenhuma sugestão recebida."
              />
            )}
            {showSupport && (
              <StaffTicketBox
                title="Suporte"
                emoji="🤝"
                tickets={support}
                onSelect={setSelected}
                emptyLabel="Nenhum pedido de ajuda."
              />
            )}
          </div>
        )}

        {canModerate && (
          <div className="mt-6">
            <StaffToolsPanel onAction={load} />
          </div>
        )}

        {canManageStaff(staffRole) && (
          <div className="mt-6">
            <StaffTeamPanel />
          </div>
        )}

        {selected && (
          <StaffTicketDetailModal
            ticket={selected}
            canModerate={canModerate}
            onClose={() => setSelected(null)}
            onUpdated={load}
          />
        )}
      </main>
    </>
  );
}
