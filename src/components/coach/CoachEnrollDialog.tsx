"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { emptyCoachEnrollForm, enrollInCoachListing } from "@/lib/coachManagement";
import type { CoachEnrollFormData } from "@/types/coachManagement";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

type Props = {
  open: boolean;
  listingId: string;
  listingTitle: string;
  defaultEmail?: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function CoachEnrollDialog({
  open,
  listingId,
  listingTitle,
  defaultEmail = "",
  onClose,
  onSuccess,
}: Props) {
  const supabase = createClient();
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<CoachEnrollFormData>(emptyCoachEnrollForm(defaultEmail));
  const [error, setError] = useState<string | null>(null);
  const { isSubmitting, guard } = useSingleSubmit();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setForm(emptyCoachEnrollForm(defaultEmail));
      setError(null);
    }
  }, [open, defaultEmail]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.contact_phone.trim() && !form.contact_email.trim()) {
      setError("Informe telefone ou e-mail para o professor entrar em contato.");
      return;
    }

    await guard(async () => {
      setError(null);
      const { error: enrollErr } = await enrollInCoachListing(supabase, listingId, form);
      if (enrollErr) {
        setError(enrollErr);
        return;
      }
      onSuccess();
      onClose();
    });
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="coach-enroll-title"
        className="w-full max-w-md overflow-hidden rounded-t-3xl border border-[var(--toq-border)] bg-white shadow-xl sm:rounded-3xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 id="coach-enroll-title" className="text-lg font-bold text-[var(--toq-navy)]">
            Inscrever-se na aula
          </h2>
          <p className="mt-1 text-sm text-[var(--toq-text-muted)]">{listingTitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Telefone / WhatsApp</span>
            <input
              value={form.contact_phone}
              onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
              inputMode="tel"
              placeholder="(11) 99999-9999"
              className="toq-input mt-1 w-full px-3 py-2.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">E-mail</span>
            <input
              type="email"
              value={form.contact_email}
              onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
              placeholder="seu@email.com"
              className="toq-input mt-1 w-full px-3 py-2.5 text-sm"
            />
          </label>

          <p className="text-[11px] text-[var(--toq-text-muted)]">
            Informe pelo menos um contato. O professor verá seus dados no painel de Gestão de Aulas.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-[var(--toq-navy)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-xl toq-btn-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {isSubmitting ? "Enviando…" : "Inscrever-se"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
