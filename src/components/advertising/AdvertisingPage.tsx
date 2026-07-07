"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  deleteAdvertisingArticle,
  listAllArticlesForStaff,
  listPublishedArticles,
} from "@/lib/advertising";
import { canManageAdvertising } from "@/lib/staff";
import { useAppProfile } from "@/components/app/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { appContentClass } from "@/lib/layout";
import type { AdvertisingArticle } from "@/types/advertising";
import { AdvertisingArticleForm } from "./AdvertisingArticleForm";

type View = "list" | "create" | "edit";

export function AdvertisingPage() {
  const supabase = useMemo(() => createClient(), []);
  const profile = useAppProfile();
  const canManage = canManageAdvertising(profile.staffRole);

  const [articles, setArticles] = useState<AdvertisingArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [editing, setEditing] = useState<AdvertisingArticle | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = canManage
      ? await listAllArticlesForStaff(supabase)
      : await listPublishedArticles(supabase);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setArticles(data);
  }, [canManage, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const { error: err } = await deleteAdvertisingArticle(supabase, deleteId);
    setDeleting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDeleteId(null);
    await load();
  }

  const publishedCount = canManage
    ? articles.length
    : articles.filter((a) => a.is_published).length;

  const visibleArticles = useMemo(() => {
    const base = canManage ? articles : articles.filter((a) => a.is_published);
    const q = search.trim().toLowerCase();
    if (!q) return base;

    return base.filter((article) => {
      const title = article.title.toLowerCase();
      const excerpt = article.card_excerpt.toLowerCase();
      const slug = article.slug.toLowerCase();
      const published = article.published_at
        ? new Date(article.published_at).toLocaleDateString("pt-BR").toLowerCase()
        : "";
      const created = new Date(article.created_at).toLocaleDateString("pt-BR").toLowerCase();

      return (
        title.includes(q) ||
        excerpt.includes(q) ||
        slug.includes(q) ||
        published.includes(q) ||
        created.includes(q)
      );
    });
  }, [articles, canManage, search]);

  return (
    <>
      <main className={appContentClass}>
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[var(--toq-navy)]">Publicidade</h1>
            <p className="mt-1 text-sm text-[var(--toq-text-muted)]">
              Notícias, novidades e conteúdos oficiais da plataforma.
            </p>
          </div>
          {canManage && view === "list" && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setView("create");
              }}
              className="rounded-xl toq-btn-primary px-4 py-2 text-sm font-bold text-white"
            >
              Nova notícia
            </button>
          )}
        </header>

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        {view === "create" && canManage && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-4 text-sm font-bold text-[var(--toq-navy)]">Criar notícia</h2>
            <AdvertisingArticleForm
              userId={profile.id}
              onSaved={() => {
                setView("list");
                void load();
              }}
              onCancel={() => setView("list")}
            />
          </section>
        )}

        {view === "edit" && canManage && editing && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-4 text-sm font-bold text-[var(--toq-navy)]">Editar notícia</h2>
            <AdvertisingArticleForm
              article={editing}
              userId={profile.id}
              onSaved={() => {
                setView("list");
                setEditing(null);
                void load();
              }}
              onCancel={() => {
                setView("list");
                setEditing(null);
              }}
            />
          </section>
        )}

        {view === "list" && (
          <>
            <input
              type="search"
              placeholder="Buscar por título, data ou conteúdo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="toq-input mb-6 w-full px-4 py-2.5 text-sm"
            />

            {loading ? (
              <p className="text-sm text-[var(--toq-text-muted)]">Carregando…</p>
            ) : visibleArticles.length === 0 ? (
              <p className="text-sm text-[var(--toq-text-muted)]">
                {publishedCount === 0 ? "Nenhuma notícia publicada ainda." : "Nenhum resultado na busca."}
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleArticles.map((article) => (
                  <article
                    key={article.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <Link href={`/inicio/publicidade/${article.slug}`} className="block">
                      <div className="relative aspect-[16/10] bg-slate-100">
                        <Image
                          src={article.card_image_url || article.cover_image_url}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        {canManage && !article.is_published && (
                          <span className="absolute left-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                            Rascunho
                          </span>
                        )}
                      </div>
                      <div className="p-4">
                        <h2 className="text-base font-bold text-[var(--toq-navy)]">
                          {article.title}
                        </h2>
                        {article.card_excerpt && (
                          <p className="mt-1 line-clamp-2 text-sm text-[var(--toq-text-muted)]">
                            {article.card_excerpt}
                          </p>
                        )}
                        <p className="mt-2 text-[11px] text-[var(--toq-text-muted)]">
                          {article.published_at
                            ? new Date(article.published_at).toLocaleDateString("pt-BR")
                            : "Não publicado"}
                        </p>
                      </div>
                    </Link>
                    {canManage && (
                      <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(article);
                            setView("edit");
                          }}
                          className="text-xs font-semibold text-[var(--toq-navy)]"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(article.id)}
                          className="text-xs font-semibold text-red-600"
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        <ConfirmDialog
          open={!!deleteId}
          title="Excluir notícia"
          message="Esta notícia será removida permanentemente."
          confirmLabel="Excluir"
          variant="danger"
          loading={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteId(null)}
        />
      </main>
    </>
  );
}
