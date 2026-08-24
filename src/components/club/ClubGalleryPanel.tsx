"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createPortal } from "react-dom";
import {
  communityCoverSlides,
  fetchCommunityGallery,
} from "@/lib/communityGallery";
import type { Community } from "@/types/community";

type GalleryItem = {
  id: string;
  url: string;
  source: "cover" | "gallery" | "feed";
  createdAt: string | null;
  postId?: string;
  authorUsername?: string | null;
};

type Props = {
  community: Community;
};

export function ClubGalleryPanel({ community }: Props) {
  const supabase = createClient();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const galleryRows = await fetchCommunityGallery(supabase, community.id).catch(() => []);
      const coverSlides = communityCoverSlides(community.cover_image_url, galleryRows);

      const coverItems: GalleryItem[] = coverSlides.map((url, i) => ({
        id: `cover-${i}-${url.slice(-24)}`,
        url,
        source: i === 0 && community.cover_image_url?.trim() === url ? "cover" : "gallery",
        createdAt: null,
      }));

      const { data: posts, error: postsErr } = await supabase
        .from("posts")
        .select(
          `
          id,
          created_at,
          author:profiles!posts_author_id_fkey(username),
          images:post_images(url, sort_order, media_type)
        `
        )
        .eq("community_id", community.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (postsErr) throw new Error(postsErr.message);

      const feedItems: GalleryItem[] = [];
      for (const post of posts ?? []) {
        const rawAuthor = post.author as { username?: string } | { username?: string }[] | null;
        const author = Array.isArray(rawAuthor) ? rawAuthor[0] : rawAuthor;
        const rawImages = post.images as
          | Array<{ url: string; sort_order?: number; media_type?: string | null }>
          | null;
        const images = Array.isArray(rawImages) ? rawImages : [];
        const sorted = [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        for (const img of sorted) {
          if (!img.url) continue;
          if (img.media_type === "video") continue;
          feedItems.push({
            id: `feed-${post.id}-${img.url.slice(-32)}`,
            url: img.url,
            source: "feed",
            createdAt: post.created_at as string,
            postId: post.id as string,
            authorUsername: author?.username ?? null,
          });
        }
      }

      // Evita duplicar URL da capa/galeria se alguém postou a mesma imagem
      const seen = new Set(coverItems.map((i) => i.url.split("?")[0]));
      const uniqueFeed = feedItems.filter((i) => {
        const key = i.url.split("?")[0];
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setItems([...coverItems, ...uniqueFeed]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar a galeria.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [community.cover_image_url, community.id, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (lightbox === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowLeft") {
        setLightbox((i) => (i === null ? null : (i - 1 + items.length) % items.length));
      }
      if (e.key === "ArrowRight") {
        setLightbox((i) => (i === null ? null : (i + 1) % items.length));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [lightbox, items.length]);

  const sourceLabel = useMemo(
    () =>
      ({
        cover: "Capa",
        gallery: "Galeria do clube",
        feed: "Feed",
      }) as const,
    []
  );

  if (loading) {
    return <p className="mt-4 text-sm text-[var(--toq-text-muted)]">Carregando galeria…</p>;
  }

  if (error) {
    return (
      <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
        {error}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-[var(--toq-border)] bg-[var(--toq-card)] p-8 text-center">
        <p className="text-sm font-semibold text-[var(--toq-navy)]">Nenhuma foto ainda</p>
        <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
          Fotos da capa/galeria do clube e imagens postadas no feed aparecem aqui.
        </p>
      </div>
    );
  }

  const active = lightbox !== null ? items[lightbox] : null;

  return (
    <div className="mt-4">
      <p className="text-xs text-[var(--toq-text-muted)]">
        {items.length} foto{items.length === 1 ? "" : "s"} · capa, galeria do clube e posts do feed
      </p>

      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setLightbox(index)}
              className="group relative aspect-square w-full overflow-hidden rounded-xl border border-[var(--toq-border)] bg-[var(--toq-surface)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt=""
                className="h-full w-full object-cover transition group-hover:scale-[1.03]"
              />
              <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                {sourceLabel[item.source]}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {mounted &&
        active &&
        lightbox !== null &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-3"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setLightbox(null);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.url}
              alt=""
              className="max-h-[min(88dvh,100%)] max-w-full rounded-lg object-contain"
            />
            {items.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Anterior"
                  className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25"
                  onClick={() =>
                    setLightbox((i) => (i === null ? null : (i - 1 + items.length) % items.length))
                  }
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Próxima"
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25"
                  onClick={() =>
                    setLightbox((i) => (i === null ? null : (i + 1) % items.length))
                  }
                >
                  ›
                </button>
              </>
            )}
            <div className="absolute bottom-4 left-0 right-0 px-4 text-center text-xs text-white/80">
              {sourceLabel[active.source]}
              {active.authorUsername ? ` · @${active.authorUsername}` : ""}
              {" · "}
              {lightbox + 1}/{items.length}
            </div>
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute right-4 top-4 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
            >
              Fechar
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
