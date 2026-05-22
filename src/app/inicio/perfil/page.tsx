"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { FeedTopBar } from "@/components/feed/FeedTopBar";
import { appContentClass } from "@/lib/layout";
import type { GenderType } from "@/lib/profile";
import Link from "next/link";
import { FriendsPanel } from "@/components/profile/FriendsPanel";
import { ProfileEditForm, type EditableProfile } from "@/components/profile/ProfileEditForm";
import { profilePath } from "@/lib/publicProfile";

export default function PerfilPage() {
  const appProfile = useAppProfile();
  const supabase = createClient();
  const [profile, setProfile] = useState<EditableProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, email, avatar_url, birth_date, gender, bio, created_at")
      .eq("id", appProfile.id)
      .single();

    if (data) {
      setProfile({
        ...data,
        id: data.id ?? appProfile.id,
        gender: data.gender as GenderType,
        bio: data.bio ?? "",
      });
    } else {
      setProfile(null);
    }
    setLoading(false);
  }, [appProfile.id, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSaved() {
    load();
    window.location.reload();
  }

  return (
    <>
      <FeedTopBar />
      <main className={appContentClass}>
        {loading ? (
          <p className="text-sm text-[var(--toq-text-muted)]">Carregando perfil…</p>
        ) : profile ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-lg font-bold text-[var(--toq-navy)]">Meu perfil</h1>
                <Link
                  href={profilePath(profile.username)}
                  className="text-xs font-semibold text-[var(--toq-sky)] hover:underline"
                >
                  Ver perfil público
                </Link>
              </div>
              <p className="mb-6 text-xs text-[var(--toq-text-muted)]">
                Membro desde{" "}
                {new Date(profile.created_at).toLocaleDateString("pt-BR", {
                  month: "long",
                  year: "numeric",
                })}
              </p>

              <ProfileEditForm initial={profile} onSaved={handleSaved} />
            </div>

            <FriendsPanel userId={appProfile.id} />
          </div>
        ) : (
          <p className="text-sm text-red-600">
            Não foi possível carregar o perfil. Execute a migration 007_profiles_bio.sql no
            Supabase se o campo bio ainda não existir.
          </p>
        )}
      </main>
    </>
  );
}
