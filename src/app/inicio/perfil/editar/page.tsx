"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile, useUpdateAppProfile } from "@/components/app/AppShell";
import { appContentClass } from "@/lib/layout";
import type { GenderType, PlayerLevelType } from "@/lib/profile";
import type {
  DominantHand,
  ExperienceBand,
  FavoriteCourt,
  PlayFrequency,
  PlayStyle,
} from "@/lib/profileGame";
import { addressFromRow } from "@/lib/address";
import {
  ProfileEditForm,
  type EditableProfile,
} from "@/components/profile/ProfileEditForm";

export default function EditarPerfilPage() {
  const appProfile = useAppProfile();
  const updateAppProfile = useUpdateAppProfile();
  const supabase = createClient();
  const [profile, setProfile] = useState<EditableProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, email, avatar_url, birth_date, gender, bio, player_level, dominant_hand, experience_band, play_frequency, play_style, favorite_court, created_at, plan, show_plan_badge, address_zip, address_street, address_number, address_neighborhood, address_complement, address_city, address_state"
      )
      .eq("id", appProfile.id)
      .single();

    if (err || !data) {
      setError(err?.message ?? "Não foi possível carregar o perfil.");
      setProfile(null);
      setLoading(false);
      return;
    }

    setProfile({
      id: data.id ?? appProfile.id,
      username: data.username,
      display_name: data.display_name ?? null,
      email: data.email,
      avatar_url: data.avatar_url,
      birth_date: data.birth_date,
      gender: data.gender as GenderType,
      bio: data.bio ?? "",
      player_level: (data.player_level as PlayerLevelType) ?? "iniciante",
      dominant_hand: (data.dominant_hand as DominantHand | null) ?? null,
      experience_band: (data.experience_band as ExperienceBand | null) ?? null,
      play_frequency: (data.play_frequency as PlayFrequency | null) ?? null,
      play_style: (data.play_style as PlayStyle | null) ?? null,
      favorite_court: (data.favorite_court as FavoriteCourt | null) ?? null,
      created_at: data.created_at,
      plan: (data.plan as EditableProfile["plan"]) ?? "free",
      show_plan_badge: data.show_plan_badge ?? true,
      address: addressFromRow(data),
    });
    setLoading(false);
  }, [appProfile.id, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className={appContentClass}>
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/inicio/perfil"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--toq-border)] text-[var(--toq-navy)]"
          aria-label="Voltar"
        >
          ‹
        </Link>
        <h1 className="text-lg font-bold text-[var(--toq-navy)]">Editar perfil</h1>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--toq-text-muted)]">Carregando…</p>
      ) : error || !profile ? (
        <p className="text-sm text-red-600">
          {error ?? "Perfil indisponível. Rode a migration 086 no Supabase se ainda não rodou."}
        </p>
      ) : (
        <ProfileEditForm
          initial={profile}
          onSaved={(url) => {
            updateAppProfile({ avatar_url: url });
            void load();
          }}
        />
      )}
    </main>
  );
}
