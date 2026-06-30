"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

type Props = {
  open: boolean;
  userId: string;
  onClose: () => void;
};

export function ClubRecommendDialog({ open, userId, onClose }: Props) {
  const supabase = createClient();
  const [clubName, setClubName] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { isSubmitting: saving, guard } = useSingleSubmit();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  useEffect(() => {
    if (!open) {
      setClubName("");
      setContact("");
      setNotes("");
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = clubName.trim();
    const contactValue = contact.trim();

    if (name.length < 2) {
      setError("Informe o nome do clube com pelo menos 2 caracteres.");
      return;
    }
    if (contactValue.length < 3) {
      setError("Informe um contato (telefone, Instagram, etc.) para localizarmos o clube.");
      return;
    }

    await guard(async () => {
      setError(null);

      const { error: insertErr } = await supabase.from("club_recommendations").insert({
        user_id: userId,
        club_name: name,
        contact: contactValue,
        notes: notes.trim(),
      });

      if (insertErr) {
        setError(
          insertErr.message.includes("club_recommendations")
            ? "Não foi possível enviar. Execute a migration 033_club_recommendations.sql no Supabase."
            : insertErr.message
        );
        return;
      }

      setSuccess(true);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="club-recommend-dialog-title"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--toq-border)] bg-white shadow-[0_16px_48px_rgba(5,16,36,0.14)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id="club-recommend-dialog-title" className="text-base font-bold text-[var(--toq-navy)]">
              Indicar um clube
            </h2>
            <p className="mt-0.5 text-xs text-[var(--toq-text-muted)]">
              Não encontrou o clube que você joga? Indique para a equipe Toq entrar em contato.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="shrink-0 text-sm font-semibold text-[var(--toq-text-muted)] hover:text-[var(--toq-navy)] disabled:opacity-50"
          >
            Fechar
          </button>
        </div>

        {success ? (
          <div className="px-5 py-8 text-center">
            <p className="text-3xl" aria-hidden>
              ✓
            </p>
            <p className="mt-3 text-sm font-bold text-[var(--toq-navy)]">Indicação enviada</p>
            <p className="mt-2 text-xs text-[var(--toq-text-muted)]">
              Obrigado! Vamos usar o contato informado para localizar o clube e avaliar a inclusão na
              plataforma.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-xl toq-btn-primary px-5 py-2.5 text-sm font-bold text-white"
            >
              Ok
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <label className="block">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">Nome do clube</span>
              <input
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                required
                maxLength={120}
                placeholder="Ex.: Clube Tênis São Paulo"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">Contato do clube</span>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                required
                maxLength={200}
                placeholder="Telefone, WhatsApp, Instagram, e-mail…"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <p className="mt-1 text-[11px] text-[var(--toq-text-muted)]">
                Informe como podemos localizar o clube para convidá-lo à plataforma.
              </p>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">
                Observações <span className="font-normal text-[var(--toq-text-muted)]">(opcional)</span>
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Cidade, endereço, como você conhece o clube…"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl toq-btn-primary py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? "Enviando…" : "Enviar indicação"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
