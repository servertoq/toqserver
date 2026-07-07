"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import { AvatarCropModal } from "./AvatarCropModal";
import { ProfileAvatar } from "./ProfileAvatar";

type Props = {
  profileId: string;
  name: string;
  avatarUrl: string | null;
  isOwnProfile: boolean;
  onUpdated?: (avatarUrl: string | null) => void;
};

export function ProfileSidebarAvatar({
  profileId,
  name,
  avatarUrl: initialAvatarUrl,
  isOwnProfile,
  onUpdated,
}: Props) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isSubmitting: saving, guard } = useSingleSubmit();

  useEffect(() => {
    setAvatarUrl(initialAvatarUrl);
  }, [initialAvatarUrl]);

  useEffect(() => {
    if (!menuOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  function openFilePicker() {
    setMenuOpen(false);
    fileRef.current?.click();
  }

  function handleAvatarPick(list: FileList | null) {
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
    setError(null);
    setCropSrc(URL.createObjectURL(file));
  }

  function handleResizeCurrent() {
    if (!avatarUrl) return;
    setMenuOpen(false);
    setError(null);
    const url = avatarUrl.split("?")[0];
    setCropSrc(`${url}?t=${Date.now()}`);
  }

  function handleCropCancel() {
    if (cropSrc?.startsWith("blob:")) {
      URL.revokeObjectURL(cropSrc);
    }
    setCropSrc(null);
  }

  async function uploadAvatar(file: File): Promise<string | null> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${profileId}/avatar.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadErr) return null;

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  }

  async function persistAvatar(url: string | null) {
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", profileId);

    if (updateErr) {
      setError(updateErr.message || "Não foi possível atualizar a foto.");
      return false;
    }

    setAvatarUrl(url);
    onUpdated?.(url);
    return true;
  }

  async function handleCropConfirm(file: File, previewUrl: string) {
    if (cropSrc && cropSrc.startsWith("blob:")) {
      URL.revokeObjectURL(cropSrc);
    }
    setCropSrc(null);

    await guard(async () => {
      setError(null);
      const uploadedUrl = await uploadAvatar(file);
      if (!uploadedUrl) {
        setError("Não foi possível enviar a foto.");
        return;
      }

      const ok = await persistAvatar(uploadedUrl);
      if (!ok) return;
      URL.revokeObjectURL(previewUrl);
    });
  }

  async function handleRemovePhoto() {
    setMenuOpen(false);
    if (saving) return;

    await guard(async () => {
      setError(null);
      await persistAvatar(null);
    });
  }

  return (
    <div className="relative">
      <ProfileAvatar
        src={avatarUrl}
        name={name}
        size="lg"
        ringClassName="ring-4 ring-[var(--toq-profile-accent-soft)]"
      />

      <span
        className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--toq-profile-accent)] text-white shadow-md"
        title="Jogador Toq"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
        </svg>
      </span>

      {isOwnProfile && (
        <div ref={menuRef} className="absolute -bottom-0.5 -left-0.5">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            disabled={saving}
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--toq-card)] bg-[var(--toq-profile-accent)] text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
            aria-label="Editar foto de perfil"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
          </button>

          {menuOpen && (
            <div
              className="absolute left-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-xl border border-[var(--toq-profile-border)] bg-[var(--toq-card)] py-1 text-left shadow-lg"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                onClick={openFilePicker}
                className="block w-full px-3 py-2 text-left text-xs font-semibold text-[var(--toq-profile-navy)] hover:bg-[var(--toq-profile-accent-soft)]"
              >
                Substituir foto
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleResizeCurrent}
                  className="block w-full px-3 py-2 text-left text-xs font-semibold text-[var(--toq-profile-navy)] hover:bg-[var(--toq-profile-accent-soft)]"
                >
                  Redimensionar
                </button>
              )}
              {avatarUrl && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleRemovePhoto()}
                  className="block w-full px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  Remover foto
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handleAvatarPick(e.target.files)}
      />

      {error && (
        <p className="mt-2 max-w-[12rem] text-center text-[10px] text-red-500" role="alert">
          {error}
        </p>
      )}

      {cropSrc && (
        <AvatarCropModal
          open
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
