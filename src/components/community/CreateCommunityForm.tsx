"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { COMMUNITY_GROUP_CONFIG, groupDetailHref } from "@/lib/communityGroup";
import type { CommunityGroupKind } from "@/types/community";
import { FeedTopBar } from "@/components/feed/FeedTopBar";

export function CreateCommunityForm({ groupKind = "community" }: { groupKind?: CommunityGroupKind }) {
  const config = COMMUNITY_GROUP_CONFIG[groupKind];
  const isClub = groupKind === "club";
  const supabase = createClient();
  const profile = useAppProfile();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(isClub);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCover(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    setCoverFile(file);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    if (trimmedName.length < 3) {
      setError("O nome precisa ter pelo menos 3 caracteres.");
      return;
    }
    if (!trimmedDesc) {
      setError("Adicione uma descrição para a comunidade.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: slug, error: slugErr } = await supabase.rpc("generate_community_slug", {
        p_name: trimmedName,
      });

      if (slugErr || !slug) {
        setError("Não foi possível gerar o identificador. Tente outro nome.");
        return;
      }

      const { data: community, error: insertErr } = await supabase
        .from("communities")
        .insert({
          name: trimmedName,
          slug,
          description: trimmedDesc,
          is_private: isClub ? true : isPrivate,
          kind: groupKind,
          created_by: profile.id,
          accent_color: "#437df4",
        })
        .select("id, slug")
        .single();

      if (insertErr || !community) {
        setError(insertErr?.message ?? "Não foi possível criar a comunidade.");
        return;
      }

      if (coverFile) {
        const ext = coverFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${profile.id}/${community.id}/cover.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("community-covers")
          .upload(path, coverFile, { upsert: true, contentType: coverFile.type });

        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("community-covers").getPublicUrl(path);
          await supabase
            .from("communities")
            .update({ cover_image_url: urlData.publicUrl })
            .eq("id", community.id);
        }
      }

      router.push(groupDetailHref(groupKind, community.slug));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <FeedTopBar />
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:max-w-4xl lg:px-8">
        <h1 className="text-xl font-bold text-[var(--toq-navy)]">{config.createTitle}</h1>
        <p className="mt-1 text-sm text-[var(--toq-text-muted)]">
          {isClub
            ? "Clubes são sempre privados. Só membros veem posts e eventos."
            : "Até 1.000 membros. Você será o administrador."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Nome</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[var(--toq-navy)]"
              placeholder="Ex.: Beach Tennis Zona Sul"
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
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[var(--toq-navy)]"
              placeholder={isClub ? "Conte sobre o clube…" : "Conte do que se trata a comunidade…"}
            />
          </label>

          <div>
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Imagem de capa</span>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[var(--toq-navy)]"
              >
                Escolher imagem
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleCover(e.target.files)}
              />
              {coverPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverPreview} alt="" className="h-14 w-24 rounded-lg object-cover" />
              )}
            </div>
          </div>

          {!isClub && (
          <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
            <legend className="px-1 text-xs font-semibold text-[var(--toq-navy)]">Visibilidade</legend>
            <label className="mt-2 flex cursor-pointer items-start gap-3">
              <input
                type="radio"
                name="visibility"
                checked={!isPrivate}
                onChange={() => setIsPrivate(false)}
                className="mt-1"
              />
              <span>
                <span className="text-sm font-semibold text-[var(--toq-navy)]">Pública</span>
                <span className="block text-xs text-[var(--toq-text-muted)]">
                  Qualquer pessoa pode entrar diretamente (até o limite de membros).
                </span>
              </span>
            </label>
            <label className="mt-3 flex cursor-pointer items-start gap-3">
              <input
                type="radio"
                name="visibility"
                checked={isPrivate}
                onChange={() => setIsPrivate(true)}
                className="mt-1"
              />
              <span>
                <span className="text-sm font-semibold text-[var(--toq-navy)]">Privada</span>
                <span className="block text-xs text-[var(--toq-text-muted)]">
                  Novos membros precisam de aprovação ou convite.
                </span>
              </span>
            </label>
          </fieldset>
          )}

          {isClub && (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-[var(--toq-text-muted)]">
              Este clube será privado. Entrada apenas com aprovação ou convite de admin/moderador.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--toq-lime-light)] py-2.5 text-sm font-bold text-[var(--toq-navy)] transition hover:bg-[var(--toq-lime-bright)] disabled:opacity-50"
          >
            {loading ? "Criando…" : config.createButton}
          </button>
        </form>
      </main>
    </>
  );
}
