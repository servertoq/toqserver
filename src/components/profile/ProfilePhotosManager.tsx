"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import {
  PROFILE_PHOTOS_MAX,
  deleteProfilePhoto,
  reorderProfilePhotos,
  uploadProfilePhoto,
  type ProfilePhoto,
} from "@/lib/profilePhotos";
import { AvatarCropModal } from "./AvatarCropModal";

type Props = {
  userId: string;
  photos: ProfilePhoto[];
  onChange: (photos: ProfilePhoto[], avatarUrl: string | null) => void;
};

export function ProfilePhotosManager({ userId, photos, onChange }: Props) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isSubmitting, guard } = useSingleSubmit();

  function handlePick(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecione uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 5 MB.");
      return;
    }
    if (photos.length >= PROFILE_PHOTOS_MAX) {
      setError(`Limite de ${PROFILE_PHOTOS_MAX} fotos.`);
      return;
    }
    setError(null);
    setCropSrc(URL.createObjectURL(file));
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  async function handleCropConfirm(file: File) {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    await guard(async () => {
      const { error: upErr, avatarUrl } = await uploadProfilePhoto(supabase, {
        userId,
        file,
      });
      if (upErr) {
        setError(upErr);
        return;
      }
      const { data } = await supabase
        .from("profile_photos")
        .select("id, user_id, url, sort_order, created_at")
        .eq("user_id", userId)
        .order("sort_order")
        .order("created_at");
      onChange((data as ProfilePhoto[]) ?? [], avatarUrl);
    });
  }

  async function handleRemove(photoId: string) {
    await guard(async () => {
      const { error: delErr, avatarUrl } = await deleteProfilePhoto(supabase, {
        userId,
        photoId,
      });
      if (delErr) {
        setError(delErr);
        return;
      }
      onChange(
        photos.filter((p) => p.id !== photoId).map((p, i) => ({ ...p, sort_order: i })),
        avatarUrl
      );
    });
  }

  async function move(photoId: string, dir: -1 | 1) {
    const idx = photos.findIndex((p) => p.id === photoId);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= photos.length) return;
    const ordered = [...photos];
    const tmp = ordered[idx]!;
    ordered[idx] = ordered[next]!;
    ordered[next] = tmp;
    const orderedIds = ordered.map((p) => p.id);
    await guard(async () => {
      const { error: reErr, avatarUrl } = await reorderProfilePhotos(supabase, {
        userId,
        orderedIds,
      });
      if (reErr) {
        setError(reErr);
        return;
      }
      onChange(
        ordered.map((p, i) => ({ ...p, sort_order: i })),
        avatarUrl
      );
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--toq-navy)]">
          Fotos do perfil
        </p>
        <p className="text-[10px] text-[var(--toq-text-muted)]">
          {photos.length}/{PROFILE_PHOTOS_MAX} · use as setas para reordenar
        </p>
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {photos.map((photo, i) => (
          <div
            key={photo.id}
            className="relative aspect-square overflow-hidden rounded-xl border border-[var(--toq-border)] bg-slate-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label="Remover foto"
              disabled={isSubmitting}
              onClick={() => handleRemove(photo.id)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-xs font-bold text-white"
            >
              ×
            </button>
            <div className="absolute bottom-1 left-1 right-1 flex justify-between gap-1">
              <button
                type="button"
                aria-label="Mover para esquerda"
                disabled={isSubmitting || i === 0}
                onClick={() => move(photo.id, -1)}
                className="flex h-6 w-6 items-center justify-center rounded-md bg-black/55 text-white disabled:opacity-30"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Mover para direita"
                disabled={isSubmitting || i === photos.length - 1}
                onClick={() => move(photo.id, 1)}
                className="flex h-6 w-6 items-center justify-center rounded-md bg-black/55 text-white disabled:opacity-30"
              >
                ›
              </button>
            </div>
          </div>
        ))}

        {photos.length < PROFILE_PHOTOS_MAX && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => fileRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--toq-border)] bg-slate-50 text-xs font-semibold text-[var(--toq-navy)] transition hover:bg-slate-100 disabled:opacity-50"
          >
            <span className="text-xl leading-none">+</span>
            Adicionar
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handlePick(e.target.files)}
      />

      {cropSrc && (
        <AvatarCropModal
          open
          imageSrc={cropSrc}
          onConfirm={(file) => {
            void handleCropConfirm(file);
          }}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
