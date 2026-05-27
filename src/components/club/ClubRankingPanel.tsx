"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { canModerate } from "@/lib/community";
import type { CommunityMember, CommunityMemberRole } from "@/types/community";
import type { ClubRankingCategory, ClubRankingEntry } from "@/types/clubFeatures";

type Props = {
  communityId: string;
  myRole: CommunityMemberRole | null;
};

export function ClubRankingPanel({ communityId, myRole }: Props) {
  const supabase = createClient();
  const profile = useAppProfile();
  const canManage = canModerate(myRole);
  const [categories, setCategories] = useState<ClubRankingCategory[]>([]);
  const [entriesByCategory, setEntriesByCategory] = useState<Record<string, ClubRankingEntry[]>>({});
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCatName, setNewCatName] = useState("");
  const [newCatUnit, setNewCatUnit] = useState("pontos");
  const [addUserId, setAddUserId] = useState<Record<string, string>>({});
  const [addScore, setAddScore] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    const { data: cats } = await supabase
      .from("club_ranking_categories")
      .select("*")
      .eq("community_id", communityId)
      .order("sort_order");

    const categoryList = (cats ?? []) as ClubRankingCategory[];
    setCategories(categoryList);

    const byCat: Record<string, ClubRankingEntry[]> = {};
    for (const cat of categoryList) {
      const { data: entries } = await supabase
        .from("club_ranking_entries")
        .select(
          `
          id, category_id, user_id, score, notes,
          profile:profiles!club_ranking_entries_user_id_fkey(id, username, avatar_url)
        `
        )
        .eq("category_id", cat.id)
        .order("score", { ascending: false });

      byCat[cat.id] = (entries ?? []).map((e) => {
        const p = Array.isArray(e.profile) ? e.profile[0] : e.profile;
        return {
          id: e.id,
          category_id: e.category_id,
          user_id: e.user_id,
          score: Number(e.score),
          notes: e.notes,
          profile: p ?? undefined,
        };
      });
    }
    setEntriesByCategory(byCat);

    const { data: memRows } = await supabase
      .from("community_members")
      .select(
        `user_id, role, joined_at, profile:profiles!community_members_user_id_fkey(id, username, avatar_url)`
      )
      .eq("community_id", communityId);

    setMembers(
      (memRows ?? []).map((m) => {
        const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
        return {
          user_id: m.user_id,
          role: m.role as CommunityMember["role"],
          joined_at: m.joined_at,
          profile: p ?? { id: m.user_id, username: "?", avatar_url: null },
        };
      })
    );

    setLoading(false);
  }, [communityId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setSaving(true);
    await supabase.from("club_ranking_categories").insert({
      community_id: communityId,
      name: newCatName.trim(),
      unit_label: newCatUnit.trim() || "pontos",
      sort_order: categories.length,
    });
    setNewCatName("");
    setNewCatUnit("pontos");
    await load();
    setSaving(false);
  }

  async function deleteCategory(id: string) {
    if (!confirm("Excluir esta categoria e todas as pontuações?")) return;
    await supabase.from("club_ranking_categories").delete().eq("id", id);
    await load();
  }

  async function addEntry(categoryId: string) {
    const userId = addUserId[categoryId];
    const score = parseFloat(addScore[categoryId]?.replace(",", ".") ?? "");
    if (!userId || Number.isNaN(score)) return;

    setSaving(true);
    await supabase.from("club_ranking_entries").upsert(
      {
        category_id: categoryId,
        user_id: userId,
        score,
        updated_by: profile.id,
      },
      { onConflict: "category_id,user_id" }
    );
    setAddUserId((p) => ({ ...p, [categoryId]: "" }));
    setAddScore((p) => ({ ...p, [categoryId]: "" }));
    await load();
    setSaving(false);
  }

  async function removeEntry(entryId: string) {
    await supabase.from("club_ranking_entries").delete().eq("id", entryId);
    await load();
  }

  if (loading) {
    return <p className="mt-4 text-sm text-[var(--toq-text-muted)]">Carregando ranking…</p>;
  }

  return (
    <div className="mt-4 space-y-6">
      <h2 className="text-sm font-bold text-[var(--toq-navy)]">Ranking do clube</h2>

      {canManage && (
        <form onSubmit={addCategory} className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-[var(--toq-navy)]">Nova categoria</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Ex.: Pontos mensais, Jogos no clube…"
              className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={newCatUnit}
              onChange={(e) => setNewCatUnit(e.target.value)}
              placeholder="Unidade (pontos, jogos…)"
              className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[var(--toq-lime-light)] px-4 py-2 text-xs font-bold text-[var(--toq-navy)] disabled:opacity-50"
            >
              Criar categoria
            </button>
          </div>
        </form>
      )}

      {categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-[var(--toq-navy)]">Nenhuma categoria no ranking</p>
          {canManage && (
            <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
              Crie categorias como pontos, jogos disputados, vitórias, etc.
            </p>
          )}
        </div>
      ) : (
        categories.map((cat) => {
          const entries = entriesByCategory[cat.id] ?? [];
          const availableMembers = members;

          return (
            <section key={cat.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <h3 className="font-bold text-[var(--toq-navy)]">{cat.name}</h3>
                  <p className="text-[11px] text-[var(--toq-text-muted)]">Medido em: {cat.unit_label}</p>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => void deleteCategory(cat.id)}
                    className="text-xs font-semibold text-red-600"
                  >
                    Excluir categoria
                  </button>
                )}
              </div>

              {entries.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-[var(--toq-text-muted)]">
                  Nenhum jogador nesta categoria ainda.
                </p>
              ) : (
                <ol className="divide-y divide-slate-100">
                  {entries.map((entry, idx) => (
                    <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--toq-lime-light)]/40 text-sm font-bold text-[var(--toq-navy)]">
                        {idx + 1}
                      </span>
                      {entry.profile?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={entry.profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--toq-sky)] text-xs font-bold text-white">
                          {entry.profile?.username?.charAt(0).toUpperCase() ?? "?"}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--toq-navy)]">
                          @{entry.profile?.username ?? "jogador"}
                        </span>
                      </span>
                      <span className="text-sm font-bold text-[var(--toq-lime-dark)]">
                        {entry.score.toLocaleString("pt-BR")} {cat.unit_label}
                      </span>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => void removeEntry(entry.id)}
                          className="text-xs text-red-600"
                        >
                          ×
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              {canManage && members.length > 0 && (
                <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                  <label className="min-w-[140px] flex-1">
                    <span className="text-[10px] font-semibold text-[var(--toq-text-muted)]">Membro</span>
                    <select
                      value={addUserId[cat.id] ?? ""}
                      onChange={(e) => setAddUserId((p) => ({ ...p, [cat.id]: e.target.value }))}
                      className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    >
                      <option value="">Selecionar…</option>
                      {availableMembers.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          @{m.profile.username}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="w-24">
                    <span className="text-[10px] font-semibold text-[var(--toq-text-muted)]">{cat.unit_label}</span>
                    <input
                      type="text"
                      value={addScore[cat.id] ?? ""}
                      onChange={(e) => setAddScore((p) => ({ ...p, [cat.id]: e.target.value }))}
                      placeholder="0"
                      className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void addEntry(cat.id)}
                    className="rounded-lg bg-[var(--toq-lime-light)] px-3 py-1.5 text-xs font-bold text-[var(--toq-navy)] disabled:opacity-50"
                  >
                    Adicionar
                  </button>
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
