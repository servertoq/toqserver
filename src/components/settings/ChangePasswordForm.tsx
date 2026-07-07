"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

function userCanSetPassword(identities: { provider?: string }[] | undefined) {
  return identities?.some((identity) => identity.provider === "email") ?? false;
}

export function ChangePasswordForm() {
  const supabase = createClient();
  const { isSubmitting, guard } = useSingleSubmit();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasEmailPassword, setHasEmailPassword] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email ?? null);
      setHasEmailPassword(userCanSetPassword(user.identities));
    })();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!userEmail) {
      setError("Não foi possível identificar sua conta.");
      return;
    }

    if (newPassword.length < 8) {
      setError("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    await guard(async () => {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (signInError) {
        setError("Senha atual incorreta.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError("Não foi possível atualizar a senha. Tente novamente.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Senha atualizada com sucesso.");
    });
  }

  if (hasEmailPassword === null) {
    return <p className="text-sm text-[var(--toq-text-muted)]">Carregando…</p>;
  }

  if (!hasEmailPassword) {
    return (
      <div className="settings-info-box">
        <p className="text-sm text-[var(--toq-text-muted)]">
          Sua conta usa login social (Google). Para definir uma senha, use{" "}
          <strong className="text-[var(--toq-navy)]">Esqueci minha senha</strong> na tela de
          entrada com o e-mail da sua conta.
        </p>
      </div>
    );
  }

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
          Senha atual
        </span>
        <input
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="toq-input w-full px-3 py-2.5 text-sm"
          required
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-[var(--toq-navy)]">Nova senha</span>
        <input
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="toq-input w-full px-3 py-2.5 text-sm"
          minLength={8}
          required
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-[var(--toq-navy)]">
          Confirmar nova senha
        </span>
        <input
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="toq-input w-full px-3 py-2.5 text-sm"
          minLength={8}
          required
        />
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="toq-btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {isSubmitting ? "Salvando…" : "Atualizar senha"}
      </button>
    </form>
  );
}
