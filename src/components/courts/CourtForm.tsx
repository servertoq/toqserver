"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { courtToFormData, emptyCourtForm, formDataToInsert, normalizePhoneDigits } from "@/lib/courts";
import { fetchManagedClubs, type ManagedClub } from "@/lib/courtManagement";
import { groupDetailHref } from "@/lib/communityGroup";
import type { Court, CourtFormData } from "@/types/courts";
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
  const [managedClubs, setManagedClubs] = useState<ManagedClub[]>([]);

  useEffect(() => {
    if (isEdit) return;
    void fetchManagedClubs(supabase, profile.id)
      .then(setManagedClubs)
      .catch(() => setManagedClubs([]));
  }, [isEdit, profile.id, supabase]);

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
    if (
      form.latitude == null ||
      form.longitude == null ||
      !Number.isFinite(form.latitude) ||
      !Number.isFinite(form.longitude)
    ) {
      setError("Informe a localização (usar localização atual ou latitude/longitude).");
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
          {isEdit ? "Editar quadra" : "Cadastrar quadra avulsa"}
        </h1>
        <p className="mt-1 text-sm text-[var(--toq-text-muted)]">
          Anúncio simples com WhatsApp para contato. Planos, preços, agenda e reservas ficam nas
          quadras do clube e na <strong>Gestão de Quadras</strong>.
        </p>

        {!isEdit && managedClubs.length > 0 && (
          <div className="mt-4 max-w-2xl rounded-xl border border-[var(--toq-accent)]/40 bg-[var(--toq-accent)]/10 px-4 py-3">
            <p className="text-sm font-semibold text-[var(--toq-navy)]">
              Você administra clube — use o cadastro completo
            </p>
            <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
              Cadastre no clube e gerencie horários/reservas só em Gestão de Quadras — um único lugar,
              sem dados divergentes.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {managedClubs.map((club) => (
                <Link
                  key={club.id}
                  href={`${groupDetailHref("club", club.slug)}?tab=courts&action=nova`}
                  className="inline-flex h-8 items-center rounded-lg toq-btn-primary px-3 text-xs font-bold text-white"
                >
                  + Nova em {club.name}
                </Link>
              ))}
            </div>
          </div>
        )}

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
              className="rounded-lg border border-[var(--toq-border)] bg-[var(--toq-card)] px-5 py-2.5 text-sm font-semibold text-[var(--toq-text-muted)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
