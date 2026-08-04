"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { normalizePhoneDigits } from "@/lib/courts";
import type { ClubTournament } from "@/types/clubFeatures";

type Props = {
  /** Quando omitido/null, cria torneio avulso (plano Promotor). */
  communityId?: string | null;
  tournament?: ClubTournament | null;
  onSaved: () => void;
  onClose: () => void;
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ClubTournamentForm({ communityId = null, tournament, onSaved, onClose }: Props) {
  const supabase = createClient();
  const profile = useAppProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = !!tournament;
  const isStandalone = !communityId;
  const [mounted, setMounted] = useState(false);

  const [name, setName] = useState(tournament?.name ?? "");
  const [description, setDescription] = useState(tournament?.description ?? "");
  const [howItWorks, setHowItWorks] = useState(tournament?.how_it_works ?? "");
  const [prizes, setPrizes] = useState(tournament?.prizes ?? "");
  const [whatsapp, setWhatsapp] = useState(tournament?.contact_whatsapp ?? "");
  const [locationLabel, setLocationLabel] = useState(tournament?.location_label ?? "");
  const [isPrivate, setIsPrivate] = useState(tournament?.is_private ?? false);
  const [startsAt, setStartsAt] = useState(toDatetimeLocal(tournament?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(toDatetimeLocal(tournament?.ends_at ?? null));
  const [imageUrl, setImageUrl] = useState(tournament?.image_url ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [mounted, loading, onClose]);

  function handleImagePick(file: File | null) {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
    if (file) setImageUrl("");
  }

  function removeImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setImageUrl("");
  }

  const displayPreview = imagePreview || imageUrl || null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim() || description.trim().length < 10) {
      setError("Preencha nome e descrição (mín. 10 caracteres).");
      return;
    }
    if (howItWorks.trim().length < 10) {
      setError("Descreva como o torneio funciona (mín. 10 caracteres).");
      return;
    }
    if (!prizes.trim()) {
      setError("Informe a premiação.");
      return;
    }
    if (normalizePhoneDigits(whatsapp).length < 10) {
      setError("WhatsApp do responsável inválido.");
      return;
    }
    if (!isEdit && !imageFile && !imageUrl.trim()) {
      setError("Adicione uma imagem de divulgação — ela aparece em Torneios e no Ver completo.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let tournamentId = tournament?.id;
      let finalImageUrl = imageUrl.trim() || null;

      const payload = {
        community_id: communityId,
        created_by: isStandalone ? profile.id : (tournament?.created_by ?? profile.id),
        name: name.trim(),
        description: description.trim(),
        how_it_works: howItWorks.trim(),
        prizes: prizes.trim(),
        contact_whatsapp: whatsapp.trim(),
        location_label: locationLabel.trim() || null,
        is_private: isStandalone ? false : isPrivate,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      };

      if (isEdit && tournamentId) {
        const { error: updErr } = await supabase
          .from("club_tournaments")
          .update(payload)
          .eq("id", tournamentId);
        if (updErr) throw new Error(updErr.message);
      } else {
        const { data, error: insErr } = await supabase
          .from("club_tournaments")
          .insert(payload)
          .select("id")
          .single();
        if (insErr || !data) throw new Error(insErr?.message ?? "Erro ao criar torneio");
        tournamentId = data.id;
      }

      if (imageFile && tournamentId) {
        const ext = imageFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const folder = communityId ?? "standalone";
        const path = `${profile.id}/${folder}/${tournamentId}/cover.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("club-tournament-images")
          .upload(path, imageFile, { upsert: true, contentType: imageFile.type });
        if (upErr) {
          throw new Error(
            "Torneio salvo, mas a imagem não foi enviada. Verifique a migration 026 e o bucket club-tournament-images."
          );
        }
        const { data: urlData } = supabase.storage
          .from("club-tournament-images")
          .getPublicUrl(path);
        // Cache-buster evita imagem antiga após trocar a capa
        finalImageUrl = `${urlData.publicUrl}?v=${Date.now()}`;
      }

      if (tournamentId && finalImageUrl !== (tournament?.image_url ?? null)) {
        const { error: imgErr } = await supabase
          .from("club_tournaments")
          .update({ image_url: finalImageUrl })
          .eq("id", tournamentId);
        if (imgErr) throw new Error(imgErr.message);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar torneio.");
    } finally {
      setLoading(false);
    }
  }

  const previewSrc = displayPreview;

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="club-tournament-form-title"
        className="flex max-h-[min(92dvh,100%)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[var(--toq-border)] bg-[var(--toq-card)] shadow-xl sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--toq-border)] px-5 py-4">
          <h3 id="club-tournament-form-title" className="text-lg font-bold text-[var(--toq-navy)]">
            {isEdit ? "Editar torneio" : isStandalone ? "Novo torneio avulso" : "Novo torneio"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg px-2 py-1 text-sm text-[var(--toq-text-muted)] hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-white/10"
          >
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4 [-webkit-overflow-scrolling:touch]">
          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Nome do torneio</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm"
              required
            />
          </label>

          <div>
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Imagem de divulgação</span>
            <p className="mt-0.5 text-[11px] text-[var(--toq-text-muted)]">
              Obrigatória na criação — aparece no card, no Ver completo e na aba Torneios.
            </p>

            {previewSrc ? (
              <div className="relative mt-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewSrc}
                  alt=""
                  className="aspect-[16/9] w-full rounded-xl object-cover"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute right-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-[11px] font-bold text-white hover:bg-black/80"
                >
                  Remover
                </button>
              </div>
            ) : (
              <div className="mt-2 flex aspect-[16/9] w-full items-center justify-center rounded-xl border border-dashed border-[var(--toq-border)] bg-[var(--toq-surface)]">
                <p className="px-4 text-center text-xs text-[var(--toq-text-muted)]">
                  Nenhuma imagem — adicione uma foto para divulgar o torneio.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-2 rounded-lg border border-[var(--toq-border)] bg-[var(--toq-surface)] px-3 py-2 text-xs font-bold text-[var(--toq-navy)]"
            >
              {displayPreview ? "Trocar imagem" : "Adicionar imagem"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                handleImagePick(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Descrição</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm"
              placeholder="Resumo para divulgação do torneio…"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Como funciona</span>
            <textarea
              value={howItWorks}
              onChange={(e) => setHowItWorks(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm"
              placeholder="Regras, formato, categorias, horários…"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Premiação</span>
            <textarea
              value={prizes}
              onChange={(e) => setPrizes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm"
              placeholder="Troféus, valores, brindes…"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">
              WhatsApp do responsável (inscrições)
            </span>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm"
              placeholder="(11) 99999-9999"
              required
            />
          </label>

          {(isStandalone || locationLabel) && (
            <label className="block">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">
                Local / cidade {isStandalone ? "" : "(opcional)"}
              </span>
              <input
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm"
                placeholder="Ex.: São Paulo / SP — Arena XYZ"
                required={isStandalone}
              />
            </label>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">Início (opcional)</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1 w-full min-w-0 rounded-lg toq-input px-2 py-2 text-sm"
              />
            </label>
            <label className="block min-w-0">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">Fim (opcional)</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1 w-full min-w-0 rounded-lg toq-input px-2 py-2 text-sm"
              />
            </label>
          </div>

          {!isStandalone && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--toq-border)] bg-[var(--toq-surface)] px-3 py-2">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-xs text-[var(--toq-navy)]">
                <strong>Torneio privado</strong> — visível e com inscrição apenas para membros do clube.
                Desmarcado = todos os usuários do site veem na aba Torneios.
              </span>
            </label>
          )}
          {isStandalone && (
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
              Torneios avulsos aparecem na aba Torneios para toda a plataforma.
            </p>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/40" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-[var(--toq-border)] px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg border border-[var(--toq-border)] py-2.5 text-sm font-semibold text-[var(--toq-navy)] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg toq-btn-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? "Salvando…" : isEdit ? "Salvar" : "Criar torneio"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
