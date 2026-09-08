"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMemberSince } from "@/lib/publicProfile";
import {
  GENDER_OPTIONS,
  PROFILE_BIO_MAX_LENGTH,
  type DominantHand,
  type ExperienceBand,
  type FavoriteCourt,
  type GenderType,
  type PlayFrequency,
  type PlayerLevelType,
  type PlayStyle,
} from "@/lib/profile";
import { type AddressFields, profileLocationToDbPayload } from "@/lib/address";
import { ProfileLocationField } from "@/components/shared/ProfileLocationField";
import { planLabel } from "@/lib/plans";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import type { UserPlan } from "@/types/plans";
import type { ProfilePhoto } from "@/types/profile";
import { ProfileAvatarEditor } from "./ProfileAvatarEditor";
import { ProfilePhotosEditor } from "./ProfilePhotosEditor";
import { ProfileMeuJogoSection } from "./ProfileMeuJogoSection";

type Props = {
  profileId: string;
  username: string;
  avatarUrl: string | null;
  photos: ProfilePhoto[];
  bio: string;
  gender: GenderType;
  playerLevel: PlayerLevelType;
  address: AddressFields;
  createdAt: string;
  plan: UserPlan;
  dominantHand: DominantHand | null;
  experienceBand: ExperienceBand | null;
  playFrequency: PlayFrequency | null;
  playStyle: PlayStyle | null;
  favoriteCourt: FavoriteCourt | null;
  onClose: () => void;
  onPhotosChanged: (photos: ProfilePhoto[]) => void;
  onAvatarChanged: (avatarUrl: string | null) => void;
  onSaved: () => void;
};

export function ProfileEditPanel({
  profileId,
  username,
  avatarUrl,
  photos,
  bio: initialBio,
  gender: initialGender,
  playerLevel: initialPlayerLevel,
  address,
  createdAt,
  plan,
  dominantHand: initialHand,
  experienceBand: initialExp,
  playFrequency: initialFreq,
  playStyle: initialStyle,
  favoriteCourt: initialCourt,
  onClose,
  onPhotosChanged,
  onAvatarChanged,
  onSaved,
}: Props) {
  const supabase = createClient();
  const [gender, setGender] = useState(initialGender);
  const [bio, setBio] = useState(initialBio);
  const [playerLevel, setPlayerLevel] = useState(initialPlayerLevel);
  const [dominantHand, setDominantHand] = useState(initialHand);
  const [experienceBand, setExperienceBand] = useState(initialExp);
  const [playFrequency, setPlayFrequency] = useState(initialFreq);
  const [playStyle, setPlayStyle] = useState(initialStyle);
  const [favoriteCourt, setFavoriteCourt] = useState(initialCourt);
  const [location, setLocation] = useState({
    zip: address.zip,
    city: address.city,
    state: address.state,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { isSubmitting: saving, guard } = useSingleSubmit();

  useEffect(() => {
    setGender(initialGender);
    setBio(initialBio);
    setPlayerLevel(initialPlayerLevel);
    setDominantHand(initialHand);
    setExperienceBand(initialExp);
    setPlayFrequency(initialFreq);
    setPlayStyle(initialStyle);
    setFavoriteCourt(initialCourt);
    setLocation({ zip: address.zip, city: address.city, state: address.state });
  }, [
    initialGender,
    initialBio,
    initialPlayerLevel,
    initialHand,
    initialExp,
    initialFreq,
    initialStyle,
    initialCourt,
    address.zip,
    address.city,
    address.state,
  ]);

  async function handleSave() {
    await guard(async () => {
      setError(null);
      setSuccess(null);
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          gender,
          bio: bio.slice(0, PROFILE_BIO_MAX_LENGTH),
          player_level: playerLevel,
          dominant_hand: dominantHand,
          experience_band: experienceBand,
          play_frequency: playFrequency,
          play_style: playStyle,
          favorite_court: favoriteCourt,
          ...profileLocationToDbPayload(location),
        })
        .eq("id", profileId);

      if (updateErr) {
        setError(updateErr.message || "Não foi possível salvar.");
        return;
      }
      setSuccess("Informações atualizadas.");
      onSaved();
    });
  }

  return (
    <div className="profile-edit-panel">
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--toq-profile-navy)] hover:bg-[var(--toq-surface)]"
          aria-label="Voltar"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-[var(--toq-profile-navy)]">Editar perfil</h2>
      </div>

      <div className="space-y-8">
        <ProfileAvatarEditor
          profileId={profileId}
          name={username}
          avatarUrl={avatarUrl}
          onUpdated={onAvatarChanged}
        />
        <ProfilePhotosEditor userId={profileId} photos={photos} onChange={onPhotosChanged} />

        <section className="profile-edit-block">
          <p className="profile-section-label">Sobre você</p>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-profile-muted)]">
                Nome de usuário
              </span>
              <input
                value={`@${username}`}
                readOnly
                className="mt-1.5 w-full rounded-xl border border-[var(--toq-profile-border)] bg-[var(--toq-surface)] px-3 py-2.5 text-sm text-[var(--toq-profile-navy)]"
              />
              <Link
                href="/inicio/configuracoes"
                className="mt-1 inline-block text-xs font-semibold text-[var(--toq-profile-accent)] hover:underline"
              >
                Alterar em Configurações
              </Link>
            </label>

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-profile-muted)]">
                Bio
              </span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, PROFILE_BIO_MAX_LENGTH))}
                rows={4}
                maxLength={PROFILE_BIO_MAX_LENGTH}
                placeholder="Conte um pouco sobre você…"
                className="mt-1.5 w-full resize-y rounded-xl border border-[var(--toq-profile-border)] bg-[var(--toq-surface)] px-3 py-2.5 text-sm text-[var(--toq-profile-navy)] outline-none focus:border-[var(--toq-profile-accent)]"
              />
              <span className="mt-1 block text-right text-[10px] text-[var(--toq-profile-muted)]">
                {bio.length}/{PROFILE_BIO_MAX_LENGTH}
              </span>
            </label>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-profile-muted)]">
                Localização
              </span>
              <div className="mt-1.5">
                <ProfileLocationField
                  value={location}
                  onChange={setLocation}
                  autoDetect
                  compact
                  hideLabel
                />
              </div>
            </div>

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-profile-muted)]">
                Desde
              </span>
              <input
                value={formatMemberSince(createdAt)}
                readOnly
                className="mt-1.5 w-full rounded-xl border border-[var(--toq-profile-border)] bg-[var(--toq-surface)] px-3 py-2.5 text-sm text-[var(--toq-profile-navy)]"
              />
            </label>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-profile-muted)]">
                Plano
              </span>
              <div className="mt-1.5 flex items-center justify-between rounded-xl border border-[var(--toq-profile-border)] px-3 py-2.5">
                <p className="text-sm font-semibold text-[var(--toq-profile-navy)]">{planLabel(plan)}</p>
                <Link href="/inicio/planos" className="text-xs font-semibold text-[var(--toq-profile-accent)]">
                  Ver ou alterar plano
                </Link>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-profile-muted)]">
                Sexo
              </span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {GENDER_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      gender === opt.value
                        ? "border-[var(--toq-profile-accent)] bg-[var(--toq-profile-accent-soft)] text-[var(--toq-profile-navy)]"
                        : "border-[var(--toq-profile-border)] text-[var(--toq-profile-muted)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="edit-gender"
                      className="sr-only"
                      checked={gender === opt.value}
                      onChange={() => setGender(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        <ProfileMeuJogoSection
          playerLevel={playerLevel}
          dominantHand={dominantHand}
          experienceBand={experienceBand}
          playFrequency={playFrequency}
          playStyle={playStyle}
          favoriteCourt={favoriteCourt}
          isOwnProfile
          editing
          onChange={(next) => {
            if (next.playerLevel) setPlayerLevel(next.playerLevel);
            if (next.dominantHand !== undefined) setDominantHand(next.dominantHand);
            if (next.experienceBand !== undefined) setExperienceBand(next.experienceBand);
            if (next.playFrequency !== undefined) setPlayFrequency(next.playFrequency);
            if (next.playStyle !== undefined) setPlayStyle(next.playStyle);
            if (next.favoriteCourt !== undefined) setFavoriteCourt(next.favoriteCourt);
          }}
        />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-xl bg-[var(--toq-profile-accent)] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Salvar informações"}
          </button>
          {error && (
            <p className="text-xs text-red-500" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="text-xs text-emerald-600" role="status">
              {success}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
