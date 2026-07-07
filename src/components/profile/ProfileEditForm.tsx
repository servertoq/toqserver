"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  GENDER_OPTIONS,
  PLAYER_LEVEL_OPTIONS,
  PROFILE_BIO_MAX_LENGTH,
  profileDisplayName,
  validateDisplayName,
  type GenderType,
  type PlayerLevelType,
} from "@/lib/profile";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import { type AddressFields, EMPTY_ADDRESS, profileLocationToDbPayload } from "@/lib/address";
import { ProfileCepField } from "@/components/shared/ProfileCepField";
import { ProfilePlanSection } from "./ProfilePlanSection";
import type { UserPlan } from "@/types/plans";
import { ProfileAvatar } from "./ProfileAvatar";
import { AvatarCropModal } from "./AvatarCropModal";

export type EditableProfile = {
  id: string;
  username: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  birth_date: string;
  gender: GenderType;
  bio: string;
  player_level: PlayerLevelType;
  created_at: string;
  address: AddressFields;
  plan: UserPlan;
  show_plan_badge: boolean;
};

type Props = {
  initial: EditableProfile;
  onSaved?: () => void;
};

export function ProfileEditForm({ initial, onSaved }: Props) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [username] = useState(initial.username);
  const [displayName, setDisplayName] = useState(initial.display_name ?? "");
  const [birthDate, setBirthDate] = useState(initial.birth_date);
  const [gender, setGender] = useState<GenderType>(initial.gender);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [playerLevel, setPlayerLevel] = useState<PlayerLevelType>(initial.player_level ?? "iniciante");
  const [address, setAddress] = useState<AddressFields>(initial.address ?? EMPTY_ADDRESS);
  const [showPlanBadge, setShowPlanBadge] = useState(initial.show_plan_badge ?? true);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initial.avatar_url);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const { isSubmitting: saving, guard } = useSingleSubmit();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (avatarFile && avatarPreview && avatarPreview !== initial.avatar_url) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarFile, avatarPreview, initial.avatar_url]);

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
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  function handleCropConfirm(file: File, previewUrl: string) {
    if (avatarFile && avatarPreview && avatarPreview !== initial.avatar_url) {
      URL.revokeObjectURL(avatarPreview);
    }
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setAvatarFile(file);
    setAvatarPreview(previewUrl);
  }

  async function uploadAvatar(userId: string): Promise<string | null> {
    if (!avatarFile) return initial.avatar_url;

    const ext = avatarFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });

    if (uploadErr) return null;

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const displayNameErr = validateDisplayName(displayName);
    if (displayNameErr) {
      setError(displayNameErr);
      return;
    }

    if (!birthDate) {
      setError("Informe a data de nascimento.");
      return;
    }

    const trimmedBio = bio.slice(0, PROFILE_BIO_MAX_LENGTH);

    if (saving) return;

    await guard(async () => {
      const avatarUrl = await uploadAvatar(initial.id);
      const trimmedDisplayName = displayName.trim();

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          display_name: trimmedDisplayName || null,
          birth_date: birthDate,
          gender,
          bio: trimmedBio,
          player_level: playerLevel,
          avatar_url: avatarUrl,
          show_plan_badge: showPlanBadge,
          ...profileLocationToDbPayload(address),
        })
        .eq("id", initial.id);

      if (updateErr) {
        setError(updateErr.message || "Não foi possível salvar o perfil.");
        return;
      }

      setSuccess("Perfil atualizado com sucesso.");
      setAvatarFile(null);
      onSaved?.();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700" role="status">
          {success}
        </p>
      )}

      <ProfilePlanSection
        plan={initial.plan}
        showPlanBadge={showPlanBadge}
        onToggleBadge={setShowPlanBadge}
        saving={saving}
      />

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <ProfileAvatar
          src={avatarPreview}
          name={profileDisplayName({ display_name: displayName, username })}
          size="lg"
          ringClassName="ring-4 ring-[var(--toq-accent-soft)]/40"
        />
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => handleAvatarPick(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg toq-input px-3 py-2 text-xs font-semibold text-[var(--toq-navy)] hover:bg-slate-50"
          >
            Alterar foto de perfil
          </button>
          <p className="mt-1 text-[10px] text-[var(--toq-text-muted)]">JPG, PNG ou WebP · máx. 5 MB</p>
        </div>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--toq-navy)]">Nome na rede</span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
          maxLength={60}
          placeholder={profileDisplayName({ display_name: null, username })}
          className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
        />
        <p className="mt-1 text-[10px] text-[var(--toq-text-muted)]">
          É assim que seu nome aparece para outros jogadores. A URL do perfil é editada em
          Configurações.
        </p>
      </label>

      <p className="text-xs text-[var(--toq-text-muted)]">
        URL do perfil:{" "}
        <span className="font-medium text-[var(--toq-navy)]">@{username}</span>
      </p>

      <p className="text-xs text-[var(--toq-text-muted)]">
        E-mail: <span className="font-medium text-[var(--toq-navy)]">{initial.email}</span> (não
        editável)
      </p>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--toq-navy)]">Data de nascimento</span>
        <input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          required
          className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
        />
      </label>

      <fieldset>
        <legend className="text-xs font-semibold text-[var(--toq-navy)]">Sexo</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {GENDER_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="gender"
                checked={gender === opt.value}
                onChange={() => setGender(opt.value)}
              />
              <span className="text-sm text-[var(--toq-navy)]">{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-semibold text-[var(--toq-navy)]">Nível do jogador</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {PLAYER_LEVEL_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="player_level"
                checked={playerLevel === opt.value}
                onChange={() => setPlayerLevel(opt.value)}
              />
              <span className="text-sm text-[var(--toq-navy)]">{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <ProfileCepField
        value={address}
        onChange={(next) => setAddress({ ...address, ...next })}
      />

      <label className="block">
        <span className="text-xs font-semibold text-[var(--toq-navy)]">Bio</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, PROFILE_BIO_MAX_LENGTH))}
          rows={4}
          maxLength={PROFILE_BIO_MAX_LENGTH}
          placeholder="Conte um pouco sobre você, seu nível de jogo, clubes que frequenta…"
          className="mt-1 w-full resize-y rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
        />
        <span className="mt-1 block text-right text-[10px] text-[var(--toq-text-muted)]">
          {bio.length}/{PROFILE_BIO_MAX_LENGTH}
        </span>
      </label>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-[var(--toq-profile-accent,#2563eb)] py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50 sm:w-auto sm:px-8"
      >
        {saving ? "Salvando…" : "Salvar alterações"}
      </button>

      {cropSrc && (
        <AvatarCropModal
          open
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </form>
  );
}
