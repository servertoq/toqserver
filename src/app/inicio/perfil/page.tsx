"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { FeedTopBar } from "@/components/feed/FeedTopBar";

type FullProfile = {
  username: string;
  email: string;
  avatar_url: string | null;
  birth_date: string;
  gender: string;
  created_at: string;
};

export default function PerfilPage() {
  const appProfile = useAppProfile();
  const supabase = createClient();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select("username, email, avatar_url, birth_date, gender, created_at")
        .eq("id", appProfile.id)
        .single();

      setProfile(data as FullProfile | null);
      setLoading(false);
    }
    load();
  }, [appProfile.id, supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <>
      <FeedTopBar />
      <main className="mx-auto max-w-2xl px-4 py-6 md:max-w-3xl md:px-6">
        {loading ? (
          <p className="text-sm text-[var(--toq-text-muted)]">Carregando perfil…</p>
        ) : profile ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:gap-6 sm:text-left">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-24 w-24 rounded-full object-cover ring-4 ring-[var(--toq-lime-light)]/40"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--toq-sky)] text-3xl font-bold text-white">
                  {profile.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="mt-4 sm:mt-0">
                <h1 className="text-xl font-bold text-[var(--toq-navy)]">@{profile.username}</h1>
                <p className="mt-1 text-sm text-[var(--toq-text-muted)]">{profile.email}</p>
                <p className="mt-3 text-xs text-[var(--toq-text-muted)]">
                  Membro desde{" "}
                  {new Date(profile.created_at).toLocaleDateString("pt-BR", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            <dl className="mt-6 grid gap-3 border-t border-slate-100 pt-6 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-[var(--toq-text-muted)]">Data de nascimento</dt>
                <dd className="font-semibold text-[var(--toq-navy)]">
                  {new Date(profile.birth_date + "T12:00:00").toLocaleDateString("pt-BR")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[var(--toq-text-muted)]">Sexo</dt>
                <dd className="font-semibold capitalize text-[var(--toq-navy)]">{profile.gender}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-6 w-full rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-[var(--toq-text-muted)] transition hover:border-red-300 hover:text-red-600 sm:w-auto sm:px-8"
            >
              Sair da conta
            </button>
          </div>
        ) : (
          <p className="text-sm text-red-600">Não foi possível carregar o perfil.</p>
        )}
      </main>
    </>
  );
}
