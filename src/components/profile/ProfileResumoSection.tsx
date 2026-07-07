"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatAge, formatMemberSince, genderLabel } from "@/lib/publicProfile";
import {
  GENDER_OPTIONS,
  PLAYER_LEVEL_OPTIONS,
  PROFILE_BIO_MAX_LENGTH,
  playerLevelLabel,
  profileAboutSectionTitle,
  type GenderType,
  type PlayerLevelType,
} from "@/lib/profile";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import { type AddressFields, profileLocationToDbPayload } from "@/lib/address";
import { ProfileCepField } from "@/components/shared/ProfileCepField";
import { planMonthlyPriceLabel } from "@/lib/billing/plans";
import { planLabel } from "@/lib/plans";
import type { UserPlan } from "@/types/plans";

type Props = {
  profileId: string;
  birthDate: string;
  gender: GenderType;
  bio: string;
  playerLevel: PlayerLevelType;
  plan: UserPlan;
  address: AddressFields;
  createdAt: string;
  displayName?: string | null;
  username: string;
  isOwnProfile: boolean;
  onSaved?: () => void;
};

export function ProfileResumoSection({
  profileId,
  birthDate,
  gender: initialGender,
  bio: initialBio,
  playerLevel: initialPlayerLevel,
  plan,
  address: initialAddress,
  createdAt,
  displayName,
  username,
  isOwnProfile,
  onSaved,
}: Props) {
  const supabase = createClient();
  const [gender, setGender] = useState(initialGender);
  const [bio, setBio] = useState(initialBio);
  const [playerLevel, setPlayerLevel] = useState(initialPlayerLevel);
  const [location, setLocation] = useState({
    zip: initialAddress.zip,
    city: initialAddress.city,
    state: initialAddress.state,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { isSubmitting: saving, guard } = useSingleSubmit();

  useEffect(() => {
    setGender(initialGender);
    setBio(initialBio);
    setPlayerLevel(initialPlayerLevel);
    setLocation({
      zip: initialAddress.zip,
      city: initialAddress.city,
      state: initialAddress.state,
    });
  }, [
    initialGender,
    initialBio,
    initialPlayerLevel,
    initialAddress.zip,
    initialAddress.city,
    initialAddress.state,
  ]);

  const age = formatAge(birthDate);
  const memberSince = formatMemberSince(createdAt);
  const sectionTitle = profileAboutSectionTitle(
    { display_name: displayName, username },
    isOwnProfile
  );

  async function handleSave() {
    if (!isOwnProfile || saving) return;

    await guard(async () => {
      setError(null);
      setSuccess(null);

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          gender,
          bio: bio.slice(0, PROFILE_BIO_MAX_LENGTH),
          player_level: playerLevel,
          ...profileLocationToDbPayload(location),
        })
        .eq("id", profileId);

      if (updateErr) {
        setError(updateErr.message || "Não foi possível salvar.");
        return;
      }

      setSuccess("Informações atualizadas.");
      onSaved?.();
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--toq-profile-border)] bg-[var(--toq-card)] p-4 sm:p-5">
      <p className="profile-section-label">{sectionTitle}</p>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <ResumoField label="Idade" value={`${age} anos`} />

        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-profile-muted)]">
            Sexo
          </dt>
          <dd className="mt-1.5">
            {isOwnProfile ? (
              <div className="flex flex-wrap gap-2">
                {GENDER_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      gender === opt.value
                        ? "border-[var(--toq-profile-accent)] bg-[var(--toq-profile-accent-soft)] text-[var(--toq-profile-navy)]"
                        : "border-[var(--toq-profile-border)] text-[var(--toq-profile-muted)] hover:border-[var(--toq-profile-accent)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="resumo-gender"
                      className="sr-only"
                      checked={gender === opt.value}
                      onChange={() => setGender(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm font-semibold text-[var(--toq-profile-navy)]">
                {genderLabel(gender)}
              </p>
            )}
          </dd>
        </div>

        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-profile-muted)]">
            Nível do jogador
          </dt>
          <dd className="mt-1.5">
            {isOwnProfile ? (
              <div className="flex flex-wrap gap-2">
                {PLAYER_LEVEL_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      playerLevel === opt.value
                        ? "border-[var(--toq-profile-accent)] bg-[var(--toq-profile-accent-soft)] text-[var(--toq-profile-navy)]"
                        : "border-[var(--toq-profile-border)] text-[var(--toq-profile-muted)] hover:border-[var(--toq-profile-accent)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="resumo-player-level"
                      className="sr-only"
                      checked={playerLevel === opt.value}
                      onChange={() => setPlayerLevel(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            ) : (
              <span className="inline-flex rounded-full bg-[var(--toq-profile-accent-soft)] px-3 py-1 text-xs font-bold text-[var(--toq-profile-accent)]">
                {playerLevelLabel(playerLevel)}
              </span>
            )}
          </dd>
        </div>

        <ResumoField label="Na rede desde" value={memberSince} />

        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-profile-muted)]">
            Localização
          </dt>
          <dd className="mt-1.5">
            <ProfileCepField
              value={location}
              onChange={setLocation}
              readOnly={!isOwnProfile}
              compact
            />
          </dd>
        </div>

        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-profile-muted)]">
            Plano
          </dt>
          <dd className="mt-1.5">
            <p className="text-sm font-semibold text-[var(--toq-profile-navy)]">
              {planLabel(plan)}
              <span className="font-normal text-[var(--toq-profile-muted)]">
                {" "}
                · {planMonthlyPriceLabel(plan)}
              </span>
            </p>
            {isOwnProfile && (
              <Link
                href="/inicio/planos"
                className="mt-1 inline-block text-xs font-semibold text-[var(--toq-profile-accent)] hover:underline"
              >
                Ver ou alterar plano
              </Link>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-profile-muted)]">
            Bio
          </span>
          {isOwnProfile ? (
            <>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, PROFILE_BIO_MAX_LENGTH))}
                rows={4}
                maxLength={PROFILE_BIO_MAX_LENGTH}
                placeholder="Conte um pouco sobre você, seu nível de jogo, clubes que frequenta…"
                className="mt-1.5 w-full resize-y rounded-xl border border-[var(--toq-profile-border)] bg-[var(--toq-surface)] px-3 py-2 text-sm text-[var(--toq-profile-navy)] outline-none focus:border-[var(--toq-profile-accent)]"
              />
              <span className="mt-1 block text-right text-[10px] text-[var(--toq-profile-muted)]">
                {bio.length}/{PROFILE_BIO_MAX_LENGTH}
              </span>
            </>
          ) : bio ? (
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[var(--toq-profile-navy)]">
              {bio}
            </p>
          ) : (
            <p className="mt-1.5 text-sm italic text-[var(--toq-profile-muted)]">
              Este jogador ainda não adicionou uma bio.
            </p>
          )}
        </label>
      </div>

      {isOwnProfile && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-xl bg-[var(--toq-profile-accent)] px-5 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
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
      )}
    </section>
  );
}

function ResumoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-profile-muted)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-[var(--toq-profile-navy)]">{value}</dd>
    </div>
  );
}
