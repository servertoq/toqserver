"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  PROFILE_PHOTOS_MAX,
  deleteProfilePhoto,
  reorderProfilePhotos,
  syncProfileAvatarFromPhotos,
  uploadProfilePhoto,
} from "@/lib/profilePhotos";
import type { ProfilePhoto } from "@/types/profile";

type Props = {
  userId: string;
  photos: ProfilePhoto[];
  onChange: (photos: ProfilePhoto[], avatarUrl: string | null) => void;
};

export function ProfilePhotosEditor({ userId, photos, onChange }: Props) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const dragFrom = useRef<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function persist(next: ProfilePhoto[]) {
    const avatarUrl = await syncProfileAvatarFromPhotos(supabase, userId, next);
    onChange(next, avatarUrl);
  }

  async function handlePick(file: File | null) {
    if (!file || uploading) return;
    if (photos.length >= PROFILE_PHOTOS_MAX) {
      setError(`Até ${PROFILE_PHOTOS_MAX} fotos.`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Envie uma imagem.");
      return;
    }

    setUploading(true);
    setError(null);
    const { photo, error: upErr } = await uploadProfilePhoto(supabase, {
      userId,
      file,
      sortOrder: photos.length,
    });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (upErr || !photo) {
      setError(upErr ?? "Falha ao enviar a foto.");
      return;
    }
    await persist([...photos, photo]);
  }

  async function handleRemove(photo: ProfilePhoto) {
    setBusyId(photo.id);
    setError(null);
    const delErr = await deleteProfilePhoto(supabase, photo);
    setBusyId(null);
    if (delErr) {
      setError(delErr);
      return;
    }
    const next = photos.filter((p) => p.id !== photo.id).map((p, i) => ({ ...p, sort_order: i }));
    const reorderErr = await reorderProfilePhotos(supabase, next);
    if (reorderErr) {
      setError(reorderErr);
      return;
    }
    await persist(next);
  }

  async function moveTo(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= photos.length || to >= photos.length) return;
    const next = [...photos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    const ordered = next.map((p, i) => ({ ...p, sort_order: i }));
    setError(null);
    const err = await reorderProfilePhotos(supabase, ordered);
    if (err) {
      setError(err);
      return;
    }
    await persist(ordered);
  }

  return (
    <section className="profile-edit-block">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="profile-section-label">Fotos do perfil</p>
          <p className="mt-1 text-xs text-[var(--toq-profile-muted)]">Arraste para reordenar</p>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}

      <ul className="profile-photos-editor mt-4">
        {photos.map((photo, index) => (
          <li
            key={photo.id}
            className="profile-photos-editor-item"
            draggable
            onDragStart={() => {
              dragFrom.current = index;
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              const from = dragFrom.current;
              dragFrom.current = null;
              if (from == null) return;
              void moveTo(from, index);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" />
            {index === 0 && <span className="profile-photos-editor-main">Principal</span>}
            <button
              type="button"
              className="profile-photos-editor-remove"
              aria-label="Remover foto"
              disabled={busyId === photo.id}
              onClick={() => void handleRemove(photo)}
            >
              ×
            </button>
          </li>
        ))}

        {photos.length < PROFILE_PHOTOS_MAX && (
          <li>
            <button
              type="button"
              className="profile-photos-editor-add"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <span className="profile-photos-editor-plus" aria-hidden>
                +
              </span>
              {uploading ? "Enviando…" : "Adicionar foto"}
            </button>
          </li>
        )}
      </ul>

      <p className="mt-3 text-xs text-[var(--toq-profile-muted)]">
        Até {PROFILE_PHOTOS_MAX} fotos. A primeira será sua foto principal.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => void handlePick(e.target.files?.[0] ?? null)}
      />
    </section>
  );
}
