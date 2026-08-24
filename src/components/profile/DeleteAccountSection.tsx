"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

type Props = {
  username: string;
};

export function DeleteAccountSection({ username }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { isSubmitting, guard } = useSingleSubmit();

  async function handleConfirm() {
    if (confirmText.trim().toLowerCase() !== username.toLowerCase()) {
      setError(`Digite @${username} para confirmar.`);
      return;
    }
    setError(null);
    await guard(async () => {
      const { data: scheduled, error: rpcErr } = await supabase.rpc("request_account_deletion");
      if (rpcErr) {
        setError(rpcErr.message || "Não foi possível solicitar a exclusão.");
        return;
      }
      const until =
        typeof scheduled === "string"
          ? scheduled
          : scheduled
            ? String(scheduled)
            : "";
      await supabase.auth.signOut();
      const q = until ? `?until=${encodeURIComponent(until)}` : "";
      router.replace(`/conta-exclusao${q}`);
    });
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
      <p className="text-sm font-bold text-red-700">Excluir conta</p>
      <p className="mt-1 text-xs text-red-700/80">
        Ao solicitar, sua conta fica inativa por 30 dias. No dia 28 você recebe um e-mail de aviso.
        No dia 30 a conta é excluída definitivamente. Se fizer login antes do prazo, a exclusão é
        cancelada e a conta reativa automaticamente.
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50"
        >
          Solicitar exclusão da conta
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-red-800">
            Digite <span className="font-bold">@{username}</span> para confirmar.
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={`@${username}`}
            className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm"
          />
          {error && (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleConfirm()}
              className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {isSubmitting ? "Processando…" : "Confirmar exclusão"}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setOpen(false);
                setConfirmText("");
                setError(null);
              }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
