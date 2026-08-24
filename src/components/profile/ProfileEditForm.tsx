"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
import {
  DOMINANT_HAND_OPTIONS,
  EXPERIENCE_BAND_OPTIONS,
  FAVORITE_COURT_OPTIONS,
  PLAY_FREQUENCY_OPTIONS,
  PLAY_STYLE_OPTIONS,
  type DominantHand,
  type ExperienceBand,
  type FavoriteCourt,
  type PlayFrequency,
  type PlayStyle,
} from "@/lib/profileGame";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import { type AddressFields, EMPTY_ADDRESS, profileLocationToDbPayload } from "@/lib/address";
import { ProfileLocationField } from "@/components/shared/ProfileLocationField";
import { ProfilePlanSection } from "./ProfilePlanSection";
import type { UserPlan } from "@/types/plans";
import { formatMemberSince } from "@/lib/publicProfile";
import { fetchProfilePhotos, type ProfilePhoto } from "@/lib/profilePhotos";
import { ProfilePhotosManager } from "./ProfilePhotosManager";
import { DeleteAccountSection } from "./DeleteAccountSection";

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
  dominant_hand: DominantHand | null;
  experience_band: ExperienceBand | null;
  play_frequency: PlayFrequency | null;
  play_style: PlayStyle | null;
  favorite_court: FavoriteCourt | null;
  created_at: string;
  address: AddressFields;
  plan: UserPlan;
  show_plan_badge: boolean;
};

type Props = {
  initial: EditableProfile;
  onSaved?: (avatarUrl: string | null) => void;
};

export function ProfileEditForm({ initial, onSaved }: Props) {
  const supabase = createClient();

  const [username] = useState(initial.username);
  const [displayName, setDisplayName] = useState(initial.display_name ?? "");
  const [birthDate, setBirthDate] = useState(initial.birth_date);
  const [gender, setGender] = useState(initial.gender);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [playerLevel, setPlayerLevel] = useState(initial.player_level ?? "iniciante");
  const [dominantHand, setDominantHand] = useState<DominantHand | "">(
    initial.dominant_hand ?? ""
  );
  const [experienceBand, setExperienceBand] = useState<ExperienceBand | "">(
    initial.experience_band ?? ""
  );
  const [playFrequency, setPlayFrequency] = useState<PlayFrequency | "">(
    initial.play_frequency ?? ""
  );
  const [playStyle, setPlayStyle] = useState<PlayStyle | "">(initial.play_style ?? "");
  const [favoriteCourt, setFavoriteCourt] = useState<FavoriteCourt | "">(
    initial.favorite_court ?? ""
  );
  const [address, setAddress] = useState<AddressFields>(initial.address ?? EMPTY_ADDRESS);
  const [showPlanBadge, setShowPlanBadge] = useState(initial.show_plan_badge ?? true);
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url);
  const { isSubmitting: saving, guard } = useSingleSubmit();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [photosLoading, setPhotosLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchProfilePhotos(supabase, initial.id);
        if (!cancelled) setPhotos(list);
      } catch {
        if (!cancelled) setPhotos([]);
      } finally {
        if (!cancelled) setPhotosLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initial.id, supabase]);

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
      const trimmedDisplayName = displayName.trim();

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          display_name: trimmedDisplayName || null,
          birth_date: birthDate,
          gender,
          bio: trimmedBio,
          player_level: playerLevel,
          dominant_hand: dominantHand || null,
          experience_band: experienceBand || null,
          play_frequency: playFrequency || null,
          play_style: playStyle || null,
          favorite_court: favoriteCourt || null,
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
      onSaved?.(avatarUrl);
    });
  }

  function SelectField<T extends string>({
    label,
    value,
    onChange,
    options,
  }: {
    label: string;
    value: T | "";
    onChange: (v: T | "") => void;
    options: { value: T; label: string }[];
  }) {
    return (
      <label className="block">
        <span className="text-xs font-semibold text-[var(--toq-navy)]">{label}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T | "")}
          className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
        >
          <option value="">Não informado</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      {!photosLoading && (
        <ProfilePhotosManager
          userId={initial.id}
          photos={photos}
          onChange={(next, nextAvatar) => {
            setPhotos(next);
            setAvatarUrl(nextAvatar);
          }}
        />
      )}

      <section className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--toq-navy)]">
          Sobre você
        </p>

        <label className="block">
          <span className="text-xs font-semibold text-[var(--toq-navy)]">Nome na rede</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
            maxLength={60}
            placeholder={profileDisplayName({ display_name: null, username })}
            className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
          />
        </label>

        <p className="text-xs text-[var(--toq-text-muted)]">
          Nome de usuário:{" "}
          <span className="font-medium text-[var(--toq-navy)]">@{username}</span>{" "}
          <Link href="/inicio/configuracoes" className="font-semibold text-[var(--toq-accent)]">
            Alterar em Configurações
          </Link>
        </p>

        <label className="block">
          <span className="text-xs font-semibold text-[var(--toq-navy)]">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, PROFILE_BIO_MAX_LENGTH))}
            rows={4}
            maxLength={PROFILE_BIO_MAX_LENGTH}
            placeholder="Conte um pouco sobre você…"
            className="mt-1 w-full resize-y rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
          />
          <span className="mt-1 block text-right text-[10px] text-[var(--toq-text-muted)]">
            {bio.length}/{PROFILE_BIO_MAX_LENGTH}
          </span>
        </label>

        <ProfileLocationField
          value={address}
          onChange={(next) => setAddress({ ...address, ...next })}
          autoDetect
        />

        <p className="text-xs text-[var(--toq-text-muted)]">
          Desde:{" "}
          <span className="font-medium text-[var(--toq-navy)]">
            {formatMemberSince(initial.created_at)}
          </span>
        </p>

        <ProfilePlanSection
          plan={initial.plan}
          showPlanBadge={showPlanBadge}
          onToggleBadge={setShowPlanBadge}
          saving={saving}
        />
      </section>

      <section className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--toq-navy)]">
          Meu jogo
        </p>

        <fieldset>
          <legend className="text-xs font-semibold text-[var(--toq-navy)]">Nível</legend>
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

        <SelectField
          label="Mão dominante"
          value={dominantHand}
          onChange={setDominantHand}
          options={DOMINANT_HAND_OPTIONS}
        />
        <SelectField
          label="Experiência"
          value={experienceBand}
          onChange={setExperienceBand}
          options={EXPERIENCE_BAND_OPTIONS}
        />
        <SelectField
          label="Frequência"
          value={playFrequency}
          onChange={setPlayFrequency}
          options={PLAY_FREQUENCY_OPTIONS}
        />
        <SelectField
          label="Estilo de jogo"
          value={playStyle}
          onChange={setPlayStyle}
          options={PLAY_STYLE_OPTIONS}
        />
        <SelectField
          label="Quadra favorita"
          value={favoriteCourt}
          onChange={setFavoriteCourt}
          options={FAVORITE_COURT_OPTIONS}
        />

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
      </section>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-[var(--toq-profile-accent,#2563eb)] py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Salvando…" : "Salvar alterações"}
      </button>

      <DeleteAccountSection username={username} />
    </form>
  );
}
