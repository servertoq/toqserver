"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { normalizePhoneDigits } from "@/lib/courts";
import type { ClubTournament } from "@/types/clubFeatures";

type Props = {
  communityId: string;
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

export function ClubTournamentForm({ communityId, tournament, onSaved, onClose }: Props) {
  const supabase = createClient();
  const profile = useAppProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = !!tournament;

  const [name, setName] = useState(tournament?.name ?? "");
  const [description, setDescription] = useState(tournament?.description ?? "");
  const [howItWorks, setHowItWorks] = useState(tournament?.how_it_works ?? "");
  const [prizes, setPrizes] = useState(tournament?.prizes ?? "");
  const [whatsapp, setWhatsapp] = useState(tournament?.contact_whatsapp ?? "");
  const [isPrivate, setIsPrivate] = useState(tournament?.is_private ?? false);
  const [startsAt, setStartsAt] = useState(toDatetimeLocal(tournament?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(toDatetimeLocal(tournament?.ends_at ?? null));
  const [imageUrl, setImageUrl] = useState(tournament?.image_url ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    setLoading(true);
    setError(null);

    try {
      let tournamentId = tournament?.id;
      let finalImageUrl = imageUrl.trim() || null;

      const payload = {
        community_id: communityId,
        name: name.trim(),
        description: description.trim(),
        how_it_works: howItWorks.trim(),
        prizes: prizes.trim(),
        contact_whatsapp: whatsapp.trim(),
        is_private: isPrivate,
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
        const path = `${profile.id}/${communityId}/${tournamentId}/cover.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("club-tournament-images")
          .upload(path, imageFile, { upsert: true, contentType: imageFile.type });
        if (!upErr) {
          const { data: urlData } = supabase.storage
            .from("club-tournament-images")
            .getPublicUrl(path);
          finalImageUrl = urlData.publicUrl;
        }
      }

      if (tournamentId && finalImageUrl !== (tournament?.image_url ?? null)) {
        await supabase
          .from("club_tournaments")
          .update({ image_url: finalImageUrl })
          .eq("id", tournamentId);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar torneio.");
    } finally {
      setLoading(false);
    }
  }

  const previewSrc = imageFile ? URL.createObjectURL(imageFile) : imageUrl || null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-[var(--toq-navy)]">
            {isEdit ? "Editar torneio" : "Novo torneio"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-[var(--toq-text-muted)] hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Nome do torneio</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Descrição</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="(11) 99999-9999"
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">Início (opcional)</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">Fim (opcional)</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
              />
            </label>
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
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

          <div>
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Imagem de divulgação</span>
            {previewSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewSrc}
                alt=""
                className="mt-2 aspect-[16/9] w-full rounded-xl object-cover"
              />
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="mt-2 w-full text-sm"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-semibold text-[var(--toq-navy)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-[var(--toq-lime-light)] py-2 text-sm font-bold text-[var(--toq-navy)] disabled:opacity-50"
          >
            {loading ? "Salvando…" : isEdit ? "Salvar" : "Criar torneio"}
          </button>
        </div>
      </form>
    </div>
  );
}
