"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapCommunityRow } from "@/lib/community";
import { COMMUNITY_GROUP_CONFIG } from "@/lib/communityGroup";
import type { Community, CommunityGroupKind, CommunityMemberRole } from "@/types/community";
import { FeedTopBar } from "@/components/feed/FeedTopBar";
import { appContentClass } from "@/lib/layout";
import { CommunityCard } from "./CommunityCard";

export function CommunitiesPage({ groupKind = "community" }: { groupKind?: CommunityGroupKind }) {
  const config = COMMUNITY_GROUP_CONFIG[groupKind];
  const supabase = createClient();
  const [communities, setCommunities] = useState<ReturnType<typeof mapCommunityRow>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/";
      return;
    }

    const { data: rows, error: listErr } = await supabase
      .from("communities")
      .select("*")
      .eq("kind", groupKind)
      .order("member_count", { ascending: false });

    if (listErr) {
      setError(
        groupKind === "club"
          ? "Não foi possível carregar clubes. Execute a migration 019_clubs_and_invites.sql no Supabase."
          : "Não foi possível carregar comunidades. Execute as migrations de comunidades no Supabase."
      );
      setLoading(false);
      return;
    }

    const comms = (rows ?? []).map((c) => ({ ...c, kind: (c.kind ?? groupKind) as CommunityGroupKind })) as Community[];
    const ids = comms.map((c) => c.id);

    const roleByCommunity: Record<string, CommunityMemberRole> = {};
    const pendingByCommunity = new Set<string>();
    const inviteByCommunity = new Set<string>();

    if (ids.length > 0) {
      const { data: memberships } = await supabase
        .from("community_members")
        .select("community_id, role")
        .eq("user_id", user.id)
        .in("community_id", ids);

      for (const m of memberships ?? []) {
        roleByCommunity[m.community_id] = m.role as CommunityMemberRole;
      }

      const { data: pending } = await supabase
        .from("community_join_requests")
        .select("community_id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .in("community_id", ids);

      for (const p of pending ?? []) {
        pendingByCommunity.add(p.community_id);
      }

      const { data: invites } = await supabase
        .from("community_invites")
        .select("community_id")
        .eq("invitee_id", user.id)
        .eq("status", "pending")
        .in("community_id", ids);

      for (const inv of invites ?? []) {
        inviteByCommunity.add(inv.community_id);
      }
    }

    setCommunities(
      comms.map((c) =>
        mapCommunityRow(
          c,
          roleByCommunity[c.id] ?? null,
          pendingByCommunity.has(c.id),
          inviteByCommunity.has(c.id)
        )
      )
    );
    setLoading(false);
  }, [groupKind, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = communities.filter(
    (c) =>
      !search.trim() ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <FeedTopBar />
      <main className={appContentClass}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[var(--toq-navy)]">{config.listTitle}</h1>
            <p className="mt-1 text-sm text-[var(--toq-text-muted)]">{config.listSubtitle}</p>
          </div>
          <Link
            href={config.createHref}
            className="rounded-lg bg-[var(--toq-lime-light)] px-4 py-2 text-sm font-bold text-[var(--toq-navy)] transition hover:bg-[var(--toq-lime-bright)]"
          >
            {config.createButton}
          </Link>
        </div>

        <input
          type="search"
          placeholder={config.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-6 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-[var(--toq-navy)] outline-none ring-[var(--toq-sky)] focus:ring-2"
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
              {communities.length === 0 ? config.emptyList : "Nenhum resultado na busca"}
            </p>
            {communities.length === 0 && groupKind === "community" && (
              <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
                Seja o primeiro a criar uma comunidade para jogadores da sua região ou clube.
              </p>
            )}
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <li key={c.id}>
                <CommunityCard community={c} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
