"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

export function ProfilePrivacySettings() {
  const supabase = createClient();
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isSubmitting, guard } = useSingleSubmit();

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error: qErr } = await supabase
      .from("profiles")
      .select("profile_details_friends_only")
      .eq("id", user.id)
      .maybeSingle();

    if (qErr) {
      if (qErr.message.includes("profile_details_friends_only")) {
        setError("Rode a migration 103_profile_privacy_friends_only no Supabase.");
      } else {
        setError(qErr.message);
      }
    } else {
      setFriendsOnly(Boolean(data?.profile_details_friends_only));
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(next: boolean) {
    setError(null);
    const prev = friendsOnly;
    setFriendsOnly(next);

    await guard(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error: upErr } = await supabase
        .from("profiles")
        .update({ profile_details_friends_only: next })
        .eq("id", user.id);

      if (upErr) {
        setFriendsOnly(prev);
        setError(upErr.message);
      }
    });
  }

  if (loading) {
    return <p className="text-sm text-[var(--toq-text-muted)]">Carregando…</p>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--toq-border)] bg-[var(--toq-surface)] p-4">
        <input
          type="checkbox"
          checked={friendsOnly}
          disabled={isSubmitting}
          onChange={(e) => void toggle(e.target.checked)}
          className="mt-1 accent-[var(--toq-accent)]"
        />
        <span>
          <span className="block text-sm font-semibold text-[var(--toq-text)]">
            Detalhes só para amigos
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-[var(--toq-text-muted)]">
            Quem não é seu amigo vê apenas nome, foto e botões de amizade. Partidas, publicações,
            lista de amigos, clubes e a seção Meu jogo ficam ocultos até vocês serem amigos.
          </span>
        </span>
      </label>
    </div>
  );
}
