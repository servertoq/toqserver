"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  buildCardExcerpt,
  createAdvertisingArticle,
  slugifyAdvertisingTitle,
  updateAdvertisingArticle,
  uploadAdvertisingImage,
} from "@/lib/advertising";
import type { AdvertisingArticle } from "@/types/advertising";
import { AdvertisingRichEditor } from "./AdvertisingRichEditor";

type Props = {
  article?: AdvertisingArticle | null;
  userId: string;
  onSaved: () => void;
  onCancel: () => void;
};

export function AdvertisingArticleForm({ article, userId, onSaved, onCancel }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const articleKey = article?.id ?? `draft-${userId}`;

  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [cardExcerpt, setCardExcerpt] = useState(article?.card_excerpt ?? "");
  const [bodyHtml, setBodyHtml] = useState(article?.body_html ?? "<p></p>");
  const [coverUrl, setCoverUrl] = useState(article?.cover_image_url ?? "");
  const [cardUrl, setCardUrl] = useState(article?.card_image_url ?? "");
  const [isPublished, setIsPublished] = useState(article?.is_published ?? false);
  const [slugTouched, setSlugTouched] = useState(Boolean(article?.slug));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCardImage, setShowCardImage] = useState(Boolean(article?.cover_image_url));

  useEffect(() => {
    if (!slugTouched && title.trim()) {
      setSlug(slugifyAdvertisingTitle(title));
    }
  }, [title, slugTouched]);

  useEffect(() => {
    if (!cardExcerpt && bodyHtml) {
      setCardExcerpt(buildCardExcerpt(bodyHtml));
    }
  }, [bodyHtml, cardExcerpt]);

  async function handleCoverUpload(file: File) {
    setLoading(true);
    const url = await uploadAdvertisingImage(supabase, userId, articleKey, file, "cover");
    setLoading(false);
    if (!url) {
      setError("Não foi possível enviar a imagem principal.");
      return;
    }
    setCoverUrl(url);
    setShowCardImage(true);
    if (!cardUrl) setCardUrl(url);
  }

  async function handleCardUpload(file: File) {
    setLoading(true);
    const url = await uploadAdvertisingImage(supabase, userId, articleKey, file, "card");
    setLoading(false);
    if (!url) {
      setError("Não foi possível enviar a imagem do card.");
      return;
    }
    setCardUrl(url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim() || title.trim().length < 3) {
      setError("Informe um título com pelo menos 3 caracteres.");
      return;
    }
    if (!slug.trim()) {
      setError("Informe um slug válido.");
      return;
    }
    if (!coverUrl || !cardUrl) {
      setError("Envie a imagem principal e a imagem do card de publicidade.");
      return;
    }
    if (!bodyHtml || bodyHtml === "<p></p>") {
      setError("Escreva o conteúdo da notícia.");
      return;
    }

    setLoading(true);
    const payload = {
      title,
      slug: slugifyAdvertisingTitle(slug) || slug,
      card_excerpt: cardExcerpt || buildCardExcerpt(bodyHtml),
      body_html: bodyHtml,
      cover_image_url: coverUrl,
      card_image_url: cardUrl,
      is_published: isPublished,
    };

    const result = article
      ? await updateAdvertisingArticle(supabase, article.id, payload)
      : await createAdvertisingArticle(supabase, userId, payload);

    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <label className="block text-sm font-semibold text-[var(--toq-navy)]">
        Título da notícia
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Ex.: Novo torneio amador no TOQ"
          required
        />
      </label>

      <label className="block text-sm font-semibold text-[var(--toq-navy)]">
        URL (slug)
        <input
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
          placeholder="novo-torneio-amador"
        />
      </label>

      <div>
        <p className="text-sm font-semibold text-[var(--toq-navy)]">Imagem principal</p>
        <p className="mt-0.5 text-xs text-[var(--toq-text-muted)]">
          Aparece no topo da página da notícia.
        </p>
        <div className="mt-2 flex flex-wrap items-start gap-3">
          {coverUrl && (
            <div className="relative h-32 w-48 overflow-hidden rounded-xl border border-slate-200">
              <Image src={coverUrl} alt="" fill className="object-cover" unoptimized />
            </div>
          )}
          <label className="inline-flex cursor-pointer rounded-xl border border-dashed border-slate-300 px-4 py-3 text-xs font-semibold text-[var(--toq-navy)] hover:bg-slate-50">
            {coverUrl ? "Trocar imagem" : "Selecionar imagem"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleCoverUpload(file);
              }}
            />
          </label>
        </div>
      </div>

      {showCardImage && (
        <div>
          <p className="text-sm font-semibold text-[var(--toq-navy)]">Imagem do card (publicidade)</p>
          <p className="mt-0.5 text-xs text-[var(--toq-text-muted)]">
            Usada na barrinha rotativa da página inicial. Por padrão, copiamos a imagem principal.
          </p>
          <div className="mt-2 flex flex-wrap items-start gap-3">
            {cardUrl && (
              <div className="relative aspect-square h-32 w-32 overflow-hidden rounded-xl border border-slate-200">
                <Image src={cardUrl} alt="" fill className="object-cover" unoptimized />
              </div>
            )}
            <label className="inline-flex cursor-pointer rounded-xl border border-dashed border-slate-300 px-4 py-3 text-xs font-semibold text-[var(--toq-navy)] hover:bg-slate-50">
              {cardUrl ? "Trocar card" : "Selecionar card"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleCardUpload(file);
                }}
              />
            </label>
          </div>
        </div>
      )}

      <label className="block text-sm font-semibold text-[var(--toq-navy)]">
        Resumo do card
        <textarea
          value={cardExcerpt}
          onChange={(e) => setCardExcerpt(e.target.value)}
          rows={2}
          maxLength={280}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Texto curto exibido no card da página inicial"
        />
      </label>

      <div>
        <p className="mb-2 text-sm font-semibold text-[var(--toq-navy)]">Conteúdo da notícia</p>
        <AdvertisingRichEditor
          value={bodyHtml}
          onChange={setBodyHtml}
          supabase={supabase}
          userId={userId}
          articleKey={articleKey}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--toq-navy)]">
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
        />
        Publicar notícia (aparece na página e no carrossel da home)
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl toq-btn-primary px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {loading ? "Salvando…" : article ? "Salvar alterações" : "Criar notícia"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-semibold text-[var(--toq-navy)]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
