"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import type { Community } from "@/types/community";

type Props = {
  community: Community;
  onSaved: () => void;
  onClose: () => void;
};

export function CommunitySettingsForm({ community, onSaved, onClose }: Props) {
  const supabase = createClient();
  const profile = useAppProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const isClub = (community.kind ?? "community") === "club";

  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description);
  const [isPrivate, setIsPrivate] = useState(isClub ? true : community.is_private);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let coverUrl = community.cover_image_url;

      if (coverFile) {
        const ext = coverFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${profile.id}/${community.id}/cover.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("community-covers")
          .upload(path, coverFile, { upsert: true, contentType: coverFile.type });

        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("community-covers").getPublicUrl(path);
          coverUrl = urlData.publicUrl;
        }
      }

      const { error: updateErr } = await supabase
        .from("communities")
        .update({
          name: name.trim(),
          description: description.trim(),
          is_private: isClub ? true : isPrivate,
          cover_image_url: coverUrl,
        })
        .eq("id", community.id);

      if (updateErr) {
        setError(updateErr.message);
        return;
      }

      onSaved();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 text-[var(--toq-text)] shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--toq-navy)]">Configurações</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-[var(--toq-text-muted)]"
          >
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Nome</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[var(--toq-navy)] outline-none focus:border-[var(--toq-lime-light)]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Descrição</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              required
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[var(--toq-navy)] outline-none focus:border-[var(--toq-lime-light)]"
            />
          </label>

          <div>
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Nova capa</span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-2 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[var(--toq-navy)]"
            >
              Trocar imagem
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {!isClub && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
            />
            <span className="text-sm text-[var(--toq-navy)]">Comunidade privada</span>
          </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--toq-lime-light)] py-2.5 text-sm font-bold text-[var(--toq-navy)] disabled:opacity-50"
          >
            {loading ? "Salvando…" : "Salvar alterações"}
          </button>
        </form>
      </div>
    </div>
  );
}
