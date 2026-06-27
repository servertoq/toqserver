"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getArticleBySlug } from "@/lib/advertising";
import { canManageAdvertising } from "@/lib/staff";
import { useAppProfile } from "@/components/app/AppShell";
import { FeedTopBar } from "@/components/feed/FeedTopBar";
import { appContentClass } from "@/lib/layout";
import type { AdvertisingArticle } from "@/types/advertising";

export function AdvertisingArticlePage({ slug }: { slug: string }) {
  const supabase = useMemo(() => createClient(), []);
  const profile = useAppProfile();
  const canManage = canManageAdvertising(profile.staffRole);
  const [article, setArticle] = useState<AdvertisingArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error: err } = await getArticleBySlug(supabase, slug);
      setLoading(false);
      if (err) {
        setError(err.message);
        return;
      }
      if (!data) {
        setError("Notícia não encontrada.");
        return;
      }
      if (!data.is_published && !canManage) {
        setError("Notícia não encontrada.");
        return;
      }
      setArticle(data);
    }
    void load();
  }, [slug, supabase, canManage]);

  return (
    <>
      <FeedTopBar />
      <main className={appContentClass}>
        <Link
          href="/inicio/publicidade"
          className="mb-4 inline-flex text-sm font-semibold text-[var(--toq-accent)] hover:underline"
        >
          ← Voltar para publicidade
        </Link>

        {loading ? (
          <p className="text-sm text-[var(--toq-text-muted)]">Carregando…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : article ? (
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="relative aspect-[21/9] bg-slate-100">
              <Image
                src={article.cover_image_url}
                alt=""
                fill
                className="object-cover"
                priority
                unoptimized
              />
            </div>
            <div className="p-5 sm:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
                {article.is_published && article.published_at
                  ? new Date(article.published_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })
                  : "Rascunho — visível só para marketing"}
              </p>
              <h1 className="mt-2 text-2xl font-extrabold text-[var(--toq-navy)] sm:text-3xl">
                {article.title}
              </h1>
              <div
                className="advertising-article-body mt-6"
                dangerouslySetInnerHTML={{ __html: article.body_html }}
              />
            </div>
          </article>
        ) : null}
      </main>
    </>
  );
}
