"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapCommunityRow } from "@/lib/community";
import { fetchPlanUsage, planLimitMessage } from "@/lib/plans";
import { matchesLocationSearch, LOCATION_SEARCH_PLACEHOLDER } from "@/lib/locationSearch";
import type { PlanUsage } from "@/types/plans";
import { COMMUNITY_GROUP_CONFIG } from "@/lib/communityGroup";
import type { Community, CommunityGroupKind, CommunityMemberRole } from "@/types/community";
import { useAppProfile } from "@/components/app/AppShell";
import { ClubRecommendDialog } from "@/components/club/ClubRecommendDialog";
import { FeedTopBar } from "@/components/feed/FeedTopBar";
import { appContentClass } from "@/lib/layout";
import { CommunityCard } from "./CommunityCard";
import { PageHeader } from "@/components/shared/PageHeader";

export function CommunitiesPage({ groupKind = "community" }: { groupKind?: CommunityGroupKind }) {
  const config = COMMUNITY_GROUP_CONFIG[groupKind];
  const profile = useAppProfile();
  const supabase = createClient();
  const [communities, setCommunities] = useState<ReturnType<typeof mapCommunityRow>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [recommendOpen, setRecommendOpen] = useState(false);
  const [planUsage, setPlanUsage] = useState<PlanUsage | null>(null);

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
    fetchPlanUsage(supabase).then(setPlanUsage);
  }, [supabase]);

  const canCreateGroup =
    groupKind === "club" ? planUsage?.can_create_club ?? false : planUsage?.can_create_community ?? true;

  useEffect(() => {
    load();
  }, [load]);

  const filtered = communities.filter((c) => {
    if (groupKind === "club") {
      return matchesLocationSearch(search, {
        name: c.name,
        city: c.address_city,
        cep: c.address_zip,
        neighborhood: c.address_neighborhood,
        street: c.address_street,
        description: c.description,
      });
    }
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <FeedTopBar />
      <main className={appContentClass}>
        <PageHeader
          title={config.listTitle}
          subtitle={config.listSubtitle}
          action={
            <div className="flex flex-wrap gap-2">
              {groupKind === "club" && (
                <button
                  type="button"
                  onClick={() => setRecommendOpen(true)}
                  className="rounded-xl border border-[var(--toq-accent)] bg-white px-4 py-2 text-sm font-semibold text-[var(--toq-accent)] hover:bg-[var(--toq-accent)]/5"
                >
                  Indicar um clube
                </button>
              )}
              {canCreateGroup && (
                <Link
                  href={config.createHref}
                  className="toq-btn-primary rounded-xl px-4 py-2 text-sm text-white"
                >
                  {config.createButton}
                </Link>
              )}
            </div>
          }
        />

        {planUsage && !canCreateGroup && (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {planLimitMessage(planUsage, groupKind === "club" ? "club" : "community")}
          </p>
        )}

        <input
          type="search"
          placeholder={groupKind === "club" ? LOCATION_SEARCH_PLACEHOLDER : config.searchPlaceholder}
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

      {groupKind === "club" && (
        <ClubRecommendDialog
          open={recommendOpen}
          userId={profile.id}
          onClose={() => setRecommendOpen(false)}
        />
      )}
    </>
  );
}
