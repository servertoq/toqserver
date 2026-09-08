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
  onUpdated: (avatarUrl: string | null) => void;
};

export function ProfileAvatarEditor({ profileId, name, avatarUrl: initialAvatarUrl, onUpdated }: Props) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isSubmitting: saving, guard } = useSingleSubmit();

  useEffect(() => {
    setAvatarUrl(initialAvatarUrl);
  }, [initialAvatarUrl]);

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

  function handleCropCancel() {
    if (cropSrc?.startsWith("blob:")) {
      URL.revokeObjectURL(cropSrc);
    }
    setCropSrc(null);
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
    onUpdated(url);
    return true;
  }

  async function handleCropConfirm(file: File, previewUrl: string) {
    if (cropSrc?.startsWith("blob:")) {
      URL.revokeObjectURL(cropSrc);
    }
    setCropSrc(null);

    await guard(async () => {
      setError(null);
      try {
        const { uploadMediaToR2 } = await import("@/lib/mediaUpload");
        const { publicUrl } = await uploadMediaToR2(file, {
          folder: "avatars",
          pathPrefix: `${profileId}/avatar`,
        });
        const ok = await persistAvatar(publicUrl);
        if (ok) URL.revokeObjectURL(previewUrl);
      } catch {
        setError("Não foi possível enviar a foto.");
      }
    });
  }

  async function handleRemove() {
    if (saving) return;
    await guard(async () => {
      setError(null);
      await persistAvatar(null);
    });
  }

  return (
    <section className="profile-edit-block">
      <p className="profile-section-label">Foto de perfil</p>
      <p className="mt-1 text-xs text-[var(--toq-profile-muted)]">
        Essa é a foto redonda do feed, amigos e comentários.
      </p>

      <div className="mt-4 flex items-center gap-4">
        <ProfileAvatar src={avatarUrl} name={name} size="lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={saving}
            className="rounded-xl bg-[var(--toq-profile-accent)] px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Salvando…" : avatarUrl ? "Trocar foto" : "Escolher foto"}
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={() => void handleRemove()}
              disabled={saving}
              className="block text-xs font-semibold text-red-500 hover:underline disabled:opacity-50"
            >
              Remover foto de perfil
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => handleAvatarPick(e.target.files)}
      />

      {cropSrc && (
        <AvatarCropModal
          open
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </section>
  );
}
