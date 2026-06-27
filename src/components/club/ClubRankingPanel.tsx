"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { canModerate } from "@/lib/community";
import type { CommunityMember, CommunityMemberRole } from "@/types/community";
import type { ClubRankingCategory, ClubRankingEntry } from "@/types/clubFeatures";
import { ClubRankingPodium } from "./ClubRankingPodium";

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
  const [deleteTarget, setDeleteTarget] = useState<ClubRankingCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function deleteCategory() {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from("club_ranking_categories").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    await load();
    setDeleting(false);
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
              className="rounded-lg toq-btn-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((cat) => {
            const entries = entriesByCategory[cat.id] ?? [];

            return (
              <section
                key={cat.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-[var(--toq-navy)]">{cat.name}</h3>
                    <p className="text-[11px] text-[var(--toq-text-muted)]">Medido em: {cat.unit_label}</p>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(cat)}
                      className="shrink-0 text-xs font-semibold text-red-600"
                    >
                      Excluir
                    </button>
                  )}
                </div>

                <ClubRankingPodium
                  entries={entries}
                  unitLabel={cat.unit_label}
                  canManage={canManage}
                  onRemove={(id) => void removeEntry(id)}
                />

                {canManage && members.length > 0 && (
                  <div className="mt-auto flex flex-col gap-2 border-t border-slate-100 bg-slate-50/50 px-3 py-3">
                    <label className="block">
                      <span className="text-[10px] font-semibold text-[var(--toq-text-muted)]">Membro</span>
                      <select
                        value={addUserId[cat.id] ?? ""}
                        onChange={(e) => setAddUserId((p) => ({ ...p, [cat.id]: e.target.value }))}
                        className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                      >
                        <option value="">Selecionar…</option>
                        {members.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            @{m.profile.username}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex gap-2">
                      <label className="min-w-0 flex-1">
                        <span className="text-[10px] font-semibold text-[var(--toq-text-muted)]">
                          {cat.unit_label}
                        </span>
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
                        className="mt-auto shrink-0 rounded-lg toq-btn-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir categoria"
        message={
          deleteTarget
            ? `Excluir "${deleteTarget.name}" e todas as pontuações desta categoria? Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deleting}
        onConfirm={() => void deleteCategory()}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
