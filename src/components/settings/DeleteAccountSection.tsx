"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

export function DeleteAccountSection() {
  const supabase = createClient();
  const router = useRouter();
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isSubmitting, guard } = useSingleSubmit();

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("deletion_scheduled_for")
      .eq("id", user.id)
      .maybeSingle();

    setScheduledFor(data?.deletion_scheduled_for ?? null);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function requestDeletion() {
    setError(null);
    await guard(async () => {
      const { data, error: rpcErr } = await supabase.rpc("request_account_deletion");
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      setScheduledFor(data ? String(data) : null);
      setConfirmOpen(false);
    });
  }

  async function cancelDeletion() {
    setError(null);
    await guard(async () => {
      const { error: rpcErr } = await supabase.rpc("cancel_account_deletion");
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      setScheduledFor(null);
    });
  }

  async function signOutAfterDeletion() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const scheduledLabel = scheduledFor
    ? new Date(scheduledFor).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {scheduledFor ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Exclusão agendada</p>
          <p className="mt-1 text-amber-900/90">
            Sua conta será removida em <strong>{scheduledLabel}</strong> (30 dias após o pedido). Até
            lá você pode cancelar e continuar usando o Toq.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void cancelDeletion()}
              className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-950 disabled:opacity-50"
            >
              Cancelar exclusão
            </button>
            <button
              type="button"
              onClick={() => void signOutAfterDeletion()}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-amber-900/80 underline"
            >
              Sair agora
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-[var(--toq-text-muted)]">
            Ao solicitar a exclusão, sua conta entra em um período de 30 dias para desistir. Depois
            disso, o perfil e os dados vinculados são removidos conforme nossa política de
            privacidade.
          </p>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100"
          >
            Excluir minha conta
          </button>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Excluir conta?"
        message="Esta ação agenda a exclusão permanente em 30 dias. Você pode cancelar antes do prazo nas configurações."
        confirmLabel="Sim, excluir conta"
        cancelLabel="Voltar"
        variant="danger"
        loading={isSubmitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void requestDeletion()}
      />
    </div>
  );
}
