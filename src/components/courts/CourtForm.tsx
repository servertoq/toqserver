"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { courtToFormData, emptyCourtForm, formDataToInsert, normalizePhoneDigits } from "@/lib/courts";
import type { Court, CourtFormData } from "@/types/courts";
import { COURT_SIZE_OPTIONS } from "@/types/courts";
import { FeedTopBar } from "@/components/feed/FeedTopBar";
import { appContentClass } from "@/lib/layout";
import { CourtLocationPicker } from "./CourtLocationPicker";

type Props = {
  initial?: Court;
};

export function CourtForm({ initial }: Props) {
  const isEdit = !!initial;
  const supabase = createClient();
  const profile = useAppProfile();
  const router = useRouter();
  const [form, setForm] = useState<CourtFormData>(initial ? courtToFormData(initial) : emptyCourtForm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(p: Partial<CourtFormData>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      setError("Informe o nome da quadra.");
      return;
    }
    if (form.description.trim().length < 10) {
      setError("A descrição precisa ter pelo menos 10 caracteres.");
      return;
    }
    if (!form.city.trim() || form.state.trim().length !== 2) {
      setError("Informe cidade e UF.");
      return;
    }
    if (normalizePhoneDigits(form.contact_phone).length < 10) {
      setError("Informe um WhatsApp válido com DDD.");
      return;
    }

    setLoading(true);
    setError(null);

    const payload = formDataToInsert(form, profile.id);

    if (isEdit && initial) {
      const { error: updateErr } = await supabase.from("courts").update(payload).eq("id", initial.id);
      if (updateErr) {
        setError(updateErr.message);
        setLoading(false);
        return;
      }
      router.push(`/inicio/quadras/${initial.id}`);
    } else {
      const { data, error: insertErr } = await supabase
        .from("courts")
        .insert(payload)
        .select("id")
        .single();

      if (insertErr || !data) {
        setError(insertErr?.message ?? "Não foi possível cadastrar a quadra.");
        setLoading(false);
        return;
      }
      router.push(`/inicio/quadras/${data.id}`);
    }

    setLoading(false);
  }

  return (
    <>
      <FeedTopBar />
      <main className={appContentClass}>
        <h1 className="text-xl font-bold text-[var(--toq-navy)]">
          {isEdit ? "Editar quadra" : "Cadastrar quadra"}
        </h1>
        <p className="mt-1 text-sm text-[var(--toq-text-muted)]">
          Informe os dados da quadra para outros jogadores encontrarem e entrarem em contato.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-5">
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Nome da quadra</span>
            <input
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              maxLength={80}
              required
              placeholder="Ex.: Quadra 1 — Clube Central"
              className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Tamanho</span>
            <select
              value={form.size_label}
              onChange={(e) => patch({ size_label: e.target.value })}
              className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm"
            >
              {COURT_SIZE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Descrição</span>
            <textarea
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={4}
              maxLength={2000}
              required
              placeholder="Piso, iluminação, estacionamento, horários…"
              className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">WhatsApp para contato</span>
            <input
              type="tel"
              value={form.contact_phone}
              onChange={(e) => patch({ contact_phone: e.target.value })}
              placeholder="(11) 99999-9999"
              required
              className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-[var(--toq-text-muted)]">
              Será usado no botão &quot;Entrar em contato&quot;.
            </p>
          </label>

          <CourtLocationPicker value={form} onChange={patch} />

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg toq-btn-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {loading ? "Salvando…" : isEdit ? "Salvar alterações" : "Cadastrar quadra"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-[var(--toq-text-muted)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
