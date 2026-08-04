"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import type { Community, CommunityGroupKind } from "@/types/community";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import { COMMUNITY_GROUP_CONFIG } from "@/lib/communityGroup";
import {
  type AddressFields,
  addressFromRow,
  addressToDbPayload,
  profileLocationToDbPayload,
} from "@/lib/address";
import {
  type DayHours,
  operatingHoursToJson,
  parseOperatingHours,
} from "@/lib/operatingHours";
import { AddressForm } from "@/components/shared/AddressForm";
import { ProfileCepField } from "@/components/shared/ProfileCepField";
import { OperatingHoursForm } from "@/components/shared/OperatingHoursForm";
import {
  COMMUNITY_COVER_HINT,
  processCommunityCoverSelection,
} from "@/lib/communityCoverImage";
import {
  formatClubWhatsappDisplay,
  parseClubContactInputs,
} from "@/lib/clubContact";

type Props = {
  community: Community;
  groupKind: CommunityGroupKind;
  myRole?: import("@/types/community").CommunityMemberRole | null;
  onSaved: () => void;
  onClose: () => void;
};

export function CommunitySettingsForm({ community, groupKind, onSaved, onClose }: Props) {
  const supabase = createClient();
  const profile = useAppProfile();
  const router = useRouter();
  const config = COMMUNITY_GROUP_CONFIG[groupKind];
  const fileRef = useRef<HTMLInputElement>(null);
  const isClub = (community.kind ?? groupKind) === "club";
  const [mounted, setMounted] = useState(false);

  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description);
  const [isPrivate, setIsPrivate] = useState(isClub ? true : community.is_private);
  const [address, setAddress] = useState<AddressFields>(() => addressFromRow(community));
  const [location, setLocation] = useState({
    zip: community.address_zip ?? "",
    city: community.address_city ?? "",
    state: community.address_state ?? "",
  });
  const [hours, setHours] = useState<DayHours[]>(() =>
    parseOperatingHours(community.operating_hours)
  );
  const [instagram, setInstagram] = useState(community.instagram_url ?? "");
  const [whatsapp, setWhatsapp] = useState(
    community.contact_whatsapp
      ? formatClubWhatsappDisplay(community.contact_whatsapp)
      : ""
  );
  const [shopEnabled, setShopEnabled] = useState(community.shop_enabled ?? false);
  const [shopWhatsapp, setShopWhatsapp] = useState(community.shop_whatsapp ?? "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverProcessing, setCoverProcessing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { isSubmitting: loading, guard } = useSingleSubmit();
  const { isSubmitting: deleting, guard: guardDelete } = useSingleSubmit();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading && !deleting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [mounted, loading, deleting, onClose]);

  async function handleCover(file: File | null) {
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
    if (loading) return;
    if (isClub && shopEnabled && !shopWhatsapp.trim()) {
      setError("Informe o WhatsApp da loja para ativar a loja do clube.");
      return;
    }
    const contact = isClub ? parseClubContactInputs(instagram, whatsapp) : null;
    if (contact && !contact.ok) {
      setError(contact.error);
      return;
    }
    setError(null);

    await guard(async () => {
      let coverUrl = community.cover_image_url;

      if (coverFile) {
        const path = `${profile.id}/${community.id}/cover-${Date.now()}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from("community-covers")
          .upload(path, coverFile, { upsert: true, contentType: "image/jpeg" });

        if (uploadErr) {
          setError(`Não foi possível enviar a capa: ${uploadErr.message}`);
          return;
        }

        const { data: urlData } = supabase.storage.from("community-covers").getPublicUrl(path);
        coverUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      }

      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim(),
        is_private: isClub ? true : isPrivate,
        cover_image_url: coverUrl,
      };

      if (isClub && contact?.ok) {
        Object.assign(payload, addressToDbPayload(address));
        payload.operating_hours = operatingHoursToJson(hours);
        payload.shop_enabled = shopEnabled;
        payload.shop_whatsapp = shopWhatsapp.trim() || null;
        payload.instagram_url = contact.value.instagram_url;
        payload.contact_whatsapp = contact.value.contact_whatsapp;
      } else if (!isClub) {
        Object.assign(payload, profileLocationToDbPayload(location));
      }

      const { error: updateErr } = await supabase
        .from("communities")
        .update(payload)
        .eq("id", community.id);

      if (updateErr) {
        setError(updateErr.message);
        return;
      }

      onSaved();
      onClose();
    });
  }

  async function handleDelete() {
    if (deleting) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setError(null);
    await guardDelete(async () => {
      const { error: deleteErr } = await supabase.rpc("delete_community", {
        p_community_id: community.id,
      });

      if (deleteErr) {
        setError(
          deleteErr.message.includes("migration")
            ? deleteErr.message
            : deleteErr.message ||
                "Não foi possível excluir. Execute a migration 021_addresses_hours_delete.sql no Supabase."
        );
        return;
      }

      router.push(config.basePath);
    });
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading && !deleting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-settings-title"
        className="flex max-h-[min(92dvh,100%)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-[var(--toq-card)] text-[var(--toq-text)] shadow-xl sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--toq-border)] px-5 py-4">
          <h2 id="community-settings-title" className="text-lg font-bold text-[var(--toq-navy)]">
            Configurações
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-[var(--toq-text-muted)]"
          >
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] [-webkit-overflow-scrolling:touch]">
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
              className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)] outline-none focus:border-[var(--toq-accent)]"
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
              className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)] outline-none focus:border-[var(--toq-accent)]"
            />
          </label>

          {!isClub && (
            <fieldset className="rounded-xl border border-[var(--toq-border)] bg-[var(--toq-surface)] p-4">
              <legend className="px-1 text-xs font-semibold text-[var(--toq-navy)]">
                Localização
              </legend>
              <p className="mb-3 text-[11px] text-[var(--toq-text-muted)]">
                CEP preenche cidade e UF para a busca por local.
              </p>
              <ProfileCepField value={location} onChange={setLocation} />
            </fieldset>
          )}

          {isClub && (
            <>
              <AddressForm value={address} onChange={setAddress} />
              <OperatingHoursForm value={hours} onChange={setHours} />
              <div className="space-y-3 rounded-xl border border-[var(--toq-border)] bg-[var(--toq-surface)] p-4">
                <p className="text-xs font-semibold text-[var(--toq-navy)]">Contato do clube</p>
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--toq-navy)]">Instagram</span>
                  <input
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="@seuclube ou link"
                    maxLength={120}
                    className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--toq-navy)]">WhatsApp</span>
                  <input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="(11) 99999-9999"
                    inputMode="tel"
                    maxLength={20}
                    className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
                  />
                </label>
              </div>
              <div className="space-y-3 rounded-xl border border-[var(--toq-border)] bg-[var(--toq-surface)] p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={shopEnabled}
                    onChange={(e) => setShopEnabled(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    <span className="text-sm font-semibold text-[var(--toq-navy)]">Loja do clube ativa</span>
                    <span className="block text-xs text-[var(--toq-text-muted)]">
                      Membros veem a aba Loja e finalizam pelo WhatsApp.
                    </span>
                  </span>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--toq-navy)]">
                    WhatsApp da loja {shopEnabled ? "(obrigatório)" : ""}
                  </span>
                  <input
                    value={shopWhatsapp}
                    onChange={(e) => setShopWhatsapp(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
                  />
                </label>
              </div>
            </>
          )}

          <div>
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Nova capa</span>
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
                {coverProcessing ? "Processando…" : "Trocar imagem"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => void handleCover(e.target.files?.[0] ?? null)}
              />
              {(coverPreview || community.cover_image_url) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverPreview ?? community.cover_image_url ?? ""}
                  alt=""
                  className="h-14 w-[4.2rem] rounded-lg object-cover"
                />
              )}
            </div>
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
            className="w-full rounded-lg toq-btn-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? "Salvando…" : "Salvar alterações"}
          </button>
        </form>

        <div className="mt-8 border-t border-[var(--toq-border)] pt-6">
          <h3 className="text-sm font-bold text-red-500">Zona de perigo</h3>
          <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
            Excluir permanentemente este {isClub ? "clube" : "comunidade"} e todos os posts,
            membros e convites associados. Esta ação não pode ser desfeita.
          </p>
          {confirmDelete && (
            <p className="mt-2 text-xs font-semibold text-red-600">
              Tem certeza? Clique novamente em excluir para confirmar.
            </p>
          )}
          <button
            type="button"
            disabled={deleting}
            onClick={() => void handleDelete()}
            className="mt-3 w-full rounded-lg border border-red-300 bg-red-50 py-2.5 text-sm font-bold text-red-700 disabled:opacity-50"
          >
            {deleting
              ? "Excluindo…"
              : confirmDelete
                ? `Confirmar exclusão de “${community.name}”`
                : `Excluir ${isClub ? "clube" : "comunidade"}`}
          </button>
          {confirmDelete && !deleting && (
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="mt-2 w-full text-xs font-semibold text-[var(--toq-text-muted)]"
            >
              Cancelar
            </button>
          )}
        </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
