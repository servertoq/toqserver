"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapCourtRow } from "@/lib/courts";
import type { CourtWithOwner } from "@/types/courts";
import { FeedTopBar } from "@/components/feed/FeedTopBar";
import { appContentClass } from "@/lib/layout";
import { CourtCard } from "./CourtCard";
import { PageHeader } from "@/components/shared/PageHeader";

export function CourtsPage() {
  const supabase = createClient();
  const [courts, setCourts] = useState<CourtWithOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const { data, error: listErr } = await supabase
      .from("courts")
      .select(
        `
        *,
        owner:profiles!courts_owner_id_fkey(id, username, avatar_url)
      `
      )
      .order("created_at", { ascending: false });

    if (listErr) {
      setError(
        "Não foi possível carregar quadras. Execute a migration 020_courts.sql no Supabase."
      );
      setLoading(false);
      return;
    }

    setCourts((data ?? []).map((row) => mapCourtRow(row)));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = courts.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      (c.neighborhood?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <>
      <FeedTopBar />
      <main className={appContentClass}>
        <PageHeader
          title="Quadras"
          subtitle="Encontre quadras cadastradas ou anuncie a sua para outros jogadores."
          action={
            <Link href="/inicio/quadras/cadastrar" className="toq-btn-primary rounded-xl px-4 py-2 text-sm text-white">
              Cadastrar quadra
            </Link>
          }
        />

        <input
          type="search"
          placeholder="Buscar por nome, cidade ou bairro…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="toq-input mb-6 w-full px-4 py-2.5 text-sm"
        />

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-[var(--toq-text-muted)]">Carregando…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-[var(--toq-navy)]">
              {courts.length === 0 ? "Nenhuma quadra cadastrada ainda" : "Nenhum resultado na busca"}
            </p>
            <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
              Seja o primeiro a cadastrar uma quadra na sua região.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <li key={c.id}>
                <CourtCard court={c} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
