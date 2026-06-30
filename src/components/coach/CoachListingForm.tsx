"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import {
  coachListingToForm,
  createCoachListing,
  emptyCoachListingForm,
  updateCoachListing,
} from "@/lib/coachListings";
import { normalizePhoneDigits } from "@/lib/courts";
import type { CoachListing } from "@/types/coachListings";
import { FeedTopBar } from "@/components/feed/FeedTopBar";
import { appContentClass } from "@/lib/layout";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

type Props = {
  initial?: CoachListing;
};

export function CoachListingForm({ initial }: Props) {
  const isEdit = !!initial;
  const supabase = createClient();
  const profile = useAppProfile();
  const router = useRouter();
  const [form, setForm] = useState(initial ? coachListingToForm(initial) : emptyCoachListingForm());
  const [error, setError] = useState<string | null>(null);
  const { isSubmitting: loading, guard } = useSingleSubmit();

  function patch(p: Partial<typeof form>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (form.title.trim().length < 3) {
      setError("Informe um título com pelo menos 3 caracteres.");
      return;
    }
    if (form.description.trim().length < 10) {
      setError("A descrição precisa ter pelo menos 10 caracteres.");
      return;
    }
    if (!form.price_label.trim()) {
      setError("Informe o valor das aulas.");
      return;
    }
    if (normalizePhoneDigits(form.contact_whatsapp).length < 10) {
      setError("Informe um WhatsApp válido com DDD.");
      return;
    }

    await guard(async () => {
      setError(null);

      if (isEdit && initial) {
        const { error: updateErr } = await updateCoachListing(
          supabase,
          initial,
          profile.id,
          form
        );
        if (updateErr) {
          setError(updateErr);
          return;
        }
      } else {
        const { error: createErr } = await createCoachListing(supabase, profile.id, form);
        if (createErr) {
          setError(createErr);
          return;
        }
      }

      router.push("/inicio/aprenda-a-jogar");
      router.refresh();
    });
  }

  return (
    <>
      <FeedTopBar />
      <main className={appContentClass}>
        <header className="mb-6">
          <Link
            href="/inicio/aprenda-a-jogar"
            className="text-sm font-semibold text-[var(--toq-accent)] hover:underline"
          >
            ← Aprenda à Jogar
          </Link>
          <h1 className="mt-2 text-xl font-bold text-[var(--toq-navy)]">
            {isEdit ? "Editar divulgação" : "Divulgar aulas de tênis"}
          </h1>
          <p className="mt-1 text-sm text-[var(--toq-text-muted)]">
            {isEdit
              ? "Atualize suas informações. A publicação no feed também será atualizada."
              : "Crie seu card de professor. Ao publicar, todos verão no feed e nesta seção."}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-4">
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Título</span>
            <input
              value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
              required
              maxLength={120}
              placeholder="Ex.: Aulas particulares de tênis"
              className="toq-input mt-1 w-full px-3 py-2.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Descrição</span>
            <textarea
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
              required
              rows={5}
              maxLength={2000}
              placeholder="Conte sua experiência, tipos de aula, horários, local…"
              className="toq-input mt-1 w-full px-3 py-2.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Valor</span>
            <input
              value={form.price_label}
              onChange={(e) => patch({ price_label: e.target.value })}
              required
              maxLength={80}
              placeholder="Ex.: R$ 150/aula ou A combinar"
              className="toq-input mt-1 w-full px-3 py-2.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">WhatsApp para contato</span>
            <input
              value={form.contact_whatsapp}
              onChange={(e) => patch({ contact_whatsapp: e.target.value })}
              required
              inputMode="tel"
              placeholder="(11) 99999-9999"
              className="toq-input mt-1 w-full px-3 py-2.5 text-sm"
            />
            <p className="mt-1 text-[11px] text-[var(--toq-text-muted)]">
              Interessados serão direcionados para este número.
            </p>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl toq-btn-primary py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? "Salvando…" : isEdit ? "Salvar alterações" : "Publicar divulgação"}
          </button>
        </form>
      </main>
    </>
  );
}
