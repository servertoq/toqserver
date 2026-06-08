"use client";

import { useRef, useState } from "react";
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
} from "@/lib/address";
import {
  type DayHours,
  operatingHoursToJson,
  parseOperatingHours,
} from "@/lib/operatingHours";
import { AddressForm } from "@/components/shared/AddressForm";
import { OperatingHoursForm } from "@/components/shared/OperatingHoursForm";

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

  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description);
  const [isPrivate, setIsPrivate] = useState(isClub ? true : community.is_private);
  const [address, setAddress] = useState<AddressFields>(() => addressFromRow(community));
  const [hours, setHours] = useState<DayHours[]>(() =>
    parseOperatingHours(community.operating_hours)
  );
  const [shopEnabled, setShopEnabled] = useState(community.shop_enabled ?? false);
  const [shopWhatsapp, setShopWhatsapp] = useState(community.shop_whatsapp ?? "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { isSubmitting: loading, guard } = useSingleSubmit();
  const { isSubmitting: deleting, guard: guardDelete } = useSingleSubmit();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (isClub && shopEnabled && !shopWhatsapp.trim()) {
      setError("Informe o WhatsApp da loja para ativar a loja do clube.");
      return;
    }
    setError(null);

    await guard(async () => {
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

      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim(),
        is_private: isClub ? true : isPrivate,
        cover_image_url: coverUrl,
      };

      if (isClub) {
        Object.assign(payload, addressToDbPayload(address));
        payload.operating_hours = operatingHoursToJson(hours);
        payload.shop_enabled = shopEnabled;
        payload.shop_whatsapp = shopWhatsapp.trim() || null;
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

          {isClub && (
            <>
              <AddressForm value={address} onChange={setAddress} />
              <OperatingHoursForm value={hours} onChange={setHours} />
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
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
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-2 block rounded-lg toq-input px-3 py-2 text-xs font-semibold text-[var(--toq-navy)]"
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
            className="w-full rounded-lg toq-btn-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? "Salvando…" : "Salvar alterações"}
          </button>
        </form>

        <div className="mt-8 border-t border-slate-200 pt-6">
          <h3 className="text-sm font-bold text-red-600">Zona de perigo</h3>
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
  );
}
