"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { normalizeUsername, validateUsername } from "@/lib/profile";
import { profilePath } from "@/lib/publicProfile";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

export function ProfileUrlForm() {
  const supabase = createClient();
  const profile = useAppProfile();
  const { isSubmitting, guard } = useSingleSubmit();
  const [username, setUsername] = useState(profile.username);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setUsername(profile.username);
  }, [profile.username]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const normalized = normalizeUsername(username.trim());
    const usernameErr = validateUsername(normalized);
    if (usernameErr) {
      setError(usernameErr);
      return;
    }

    if (normalized.toLowerCase() === profile.username.toLowerCase()) {
      setSuccess("Nenhuma alteração na URL do perfil.");
      return;
    }

    await guard(async () => {
      const { data: available, error: checkErr } = await supabase.rpc("is_username_available", {
        p_username: normalized,
      });

      if (checkErr) {
        setError("Não foi possível verificar a URL do perfil.");
        return;
      }

      if (!available) {
        setError("Esta URL já está em uso.");
        return;
      }

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ username: normalized })
        .eq("id", profile.id);

      if (updateErr) {
        if (updateErr.code === "23505") {
          setError("Esta URL já está em uso.");
        } else {
          setError(updateErr.message || "Não foi possível atualizar a URL.");
        }
        return;
      }

      setSuccess("URL do perfil atualizada. A página será recarregada.");
      window.setTimeout(() => window.location.reload(), 800);
    });
  }

  const previewPath = profilePath(normalizeUsername(username.trim()) || profile.username);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700" role="status">
          {success}
        </p>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-[var(--toq-navy)]">
          URL do perfil
        </span>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm text-[var(--toq-text-muted)]">/jogador/</span>
          <input
            value={username}
            onChange={(e) => setUsername(normalizeUsername(e.target.value))}
            maxLength={30}
            required
            className="toq-input min-w-0 flex-1 px-3 py-2.5 text-sm"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <p className="mt-1.5 text-xs text-[var(--toq-text-muted)]">
          Use apenas letras, números e underscore. Ex.:{" "}
          <span className="font-medium text-[var(--toq-navy)]">carla_talacio</span>
        </p>
        <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
          Prévia:{" "}
          <span className="font-medium text-[var(--toq-accent)]">{previewPath}</span>
        </p>
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="toq-btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {isSubmitting ? "Salvando…" : "Salvar URL"}
      </button>
    </form>
  );
}
