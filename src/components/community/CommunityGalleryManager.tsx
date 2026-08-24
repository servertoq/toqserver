"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import {
  COMMUNITY_COVER_HINT,
  processCommunityCoverSelection,
} from "@/lib/communityCoverImage";
import {
  COMMUNITY_GALLERY_MAX,
  deleteCommunityGalleryImage,
  fetchCommunityGallery,
  uploadCommunityGalleryImage,
} from "@/lib/communityGallery";
import type { CommunityGalleryImage } from "@/types/community";

type Props = {
  communityId: string;
  onChanged?: () => void;
};

export function CommunityGalleryManager({ communityId, onChanged }: Props) {
  const supabase = createClient();
  const profile = useAppProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<CommunityGalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchCommunityGallery(supabase, communityId);
      setImages(rows);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível carregar a galeria. Rode a migration 085 no Supabase."
      );
    } finally {
      setLoading(false);
    }
  }, [communityId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handlePick(file: File | null) {
    if (!file || uploading) return;
    if (images.length >= COMMUNITY_GALLERY_MAX) {
      setError(`Limite de ${COMMUNITY_GALLERY_MAX} fotos na galeria.`);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const { file: prepared } = await processCommunityCoverSelection(file);
      const { image, error: upErr } = await uploadCommunityGalleryImage(supabase, {
        userId: profile.id,
        communityId,
        file: prepared,
        sortOrder: images.length,
      });
      if (upErr || !image) {
        setError(upErr ?? "Falha ao enviar a foto.");
        return;
      }
      setImages((prev) => [...prev, image]);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível processar a imagem.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemove(imageId: string) {
    setRemovingId(imageId);
    setError(null);
    const { error: delErr } = await deleteCommunityGalleryImage(supabase, imageId);
    setRemovingId(null);
    if (delErr) {
      setError(delErr);
      return;
    }
    setImages((prev) => prev.filter((i) => i.id !== imageId));
    onChanged?.();
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--toq-border)] bg-[var(--toq-surface)] p-4">
      <div>
        <p className="text-sm font-semibold text-[var(--toq-navy)]">Galeria de fotos</p>
        <p className="mt-0.5 text-xs text-[var(--toq-text-muted)]">
          Fotos extras além da capa. Membros e visitantes veem no carrossel (setas). Até{" "}
          {COMMUNITY_GALLERY_MAX} fotos. {COMMUNITY_COVER_HINT}
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-[var(--toq-text-muted)]">Carregando fotos…</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((img) => (
            <li key={img.id} className="relative overflow-hidden rounded-lg border border-[var(--toq-border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="aspect-[3/1] w-full object-cover" />
              <button
                type="button"
                disabled={removingId === img.id}
                onClick={() => void handleRemove(img.id)}
                className="absolute right-1 top-1 rounded bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-black/80 disabled:opacity-50"
              >
                {removingId === img.id ? "…" : "Remover"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={uploading || images.length >= COMMUNITY_GALLERY_MAX}
          onClick={() => fileRef.current?.click()}
          className="rounded-lg toq-btn-outline px-3 py-2 text-xs font-bold disabled:opacity-50"
        >
          {uploading ? "Enviando…" : "+ Adicionar foto"}
        </button>
        <span className="text-[11px] text-[var(--toq-text-muted)]">
          {images.length}/{COMMUNITY_GALLERY_MAX}
        </span>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          void handlePick(e.target.files?.[0] ?? null);
        }}
      />
    </div>
  );
}
