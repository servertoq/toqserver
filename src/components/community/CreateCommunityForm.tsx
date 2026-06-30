"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { COMMUNITY_GROUP_CONFIG, groupDetailHref } from "@/lib/communityGroup";
import { fetchPlanUsage, planLimitMessage } from "@/lib/plans";
import type { PlanUsage } from "@/types/plans";
import type { CommunityGroupKind } from "@/types/community";
import { FeedTopBar } from "@/components/feed/FeedTopBar";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import { type AddressFields, EMPTY_ADDRESS, addressToDbPayload } from "@/lib/address";
import {
  type DayHours,
  defaultOperatingHours,
  operatingHoursToJson,
} from "@/lib/operatingHours";
import { AddressForm } from "@/components/shared/AddressForm";
import { OperatingHoursForm } from "@/components/shared/OperatingHoursForm";
import {
  COMMUNITY_COVER_HINT,
  processCommunityCoverSelection,
} from "@/lib/communityCoverImage";

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
  const [coverProcessing, setCoverProcessing] = useState(false);
  const [address, setAddress] = useState<AddressFields>(EMPTY_ADDRESS);
  const [hours, setHours] = useState<DayHours[]>(defaultOperatingHours);
  const { isSubmitting: loading, guard } = useSingleSubmit();
  const [error, setError] = useState<string | null>(null);
  const [planUsage, setPlanUsage] = useState<PlanUsage | null>(null);

  useEffect(() => {
    fetchPlanUsage(supabase).then(setPlanUsage);
  }, [supabase]);

  const canCreate = isClub
    ? planUsage?.can_create_club ?? false
    : planUsage?.can_create_community ?? true;

  async function handleCover(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    setError(null);
    setCoverProcessing(true);
    try {
      const { file: prepared, previewUrl } = await processCommunityCoverSelection(file);
      setCoverFile(prepared);
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      setCoverPreview(previewUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível processar a imagem.");
    } finally {
      setCoverProcessing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
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

    if (planUsage && !canCreate) {
      setError(planLimitMessage(planUsage, isClub ? "club" : "community"));
      return;
    }

    if (loading) return;
    setError(null);

    await guard(async () => {
      const { data: slug, error: slugErr } = await supabase.rpc("generate_community_slug", {
        p_name: trimmedName,
      });

      if (slugErr || !slug) {
        setError("Não foi possível gerar o identificador. Tente outro nome.");
        return;
      }

      const addrDb = isClub ? addressToDbPayload(address) : null;
      const { data: created, error: insertErr } = await supabase.rpc("create_community", {
        p_name: trimmedName,
        p_slug: slug,
        p_description: trimmedDesc,
        p_is_private: isClub ? true : isPrivate,
        p_kind: groupKind,
        p_accent_color: "#437df4",
        ...(isClub && addrDb
          ? {
              p_address_zip: addrDb.address_zip,
              p_address_street: addrDb.address_street,
              p_address_number: addrDb.address_number,
              p_address_neighborhood: addrDb.address_neighborhood,
              p_address_complement: addrDb.address_complement,
              p_address_city: addrDb.address_city,
              p_address_state: addrDb.address_state,
              p_operating_hours: operatingHoursToJson(hours),
            }
          : {}),
      });

      const community = Array.isArray(created) ? created[0] : created;

      if (insertErr || !community?.id) {
        setError(
          insertErr?.message ??
            "Não foi possível criar. Execute as migrations 020 e 021 no Supabase."
        );
        return;
      }

      if (coverFile) {
        const path = `${profile.id}/${community.id}/cover.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from("community-covers")
          .upload(path, coverFile, { upsert: true, contentType: "image/jpeg" });

        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("community-covers").getPublicUrl(path);
          await supabase
            .from("communities")
            .update({ cover_image_url: urlData.publicUrl })
            .eq("id", community.id);
        }
      }

      router.push(groupDetailHref(groupKind, community.slug));
    });
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
          {planUsage && !canCreate && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
              {planLimitMessage(planUsage, isClub ? "club" : "community")}
            </p>
          )}
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
              className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
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
              className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
              placeholder={isClub ? "Conte sobre o clube…" : "Conte do que se trata a comunidade…"}
            />
          </label>

          <div>
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Imagem de capa</span>
            <p className="mt-1 text-[11px] leading-snug text-[var(--toq-text-muted)]">
              {COMMUNITY_COVER_HINT}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={coverProcessing}
                className="rounded-lg toq-input px-3 py-2 text-xs font-semibold text-[var(--toq-navy)] disabled:opacity-50"
              >
                {coverProcessing ? "Processando…" : "Escolher imagem"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => void handleCover(e.target.files)}
              />
              {coverPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverPreview} alt="" className="h-14 w-[4.2rem] rounded-lg object-cover" />
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
            <>
              <AddressForm value={address} onChange={setAddress} />
              <OperatingHoursForm value={hours} onChange={setHours} />
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-[var(--toq-text-muted)]">
                Este clube será privado. Entrada apenas com aprovação ou convite de admin/moderador.
              </p>
            </>
          )}

          <button
            type="submit"
            disabled={loading || (planUsage !== null && !canCreate)}
            className="w-full rounded-lg toq-btn-primary py-2.5 text-sm font-bold text-white transition hover:bg-[var(--toq-accent-hover)] disabled:opacity-50"
          >
            {loading ? "Criando…" : config.createButton}
          </button>
        </form>
      </main>
    </>
  );
}
