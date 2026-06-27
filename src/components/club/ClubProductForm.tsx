"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { formatClubPrice, parsePriceInput, productDisplayPrice } from "@/lib/clubFeatures";
import type { ClubProduct, VariantDraft } from "@/types/clubFeatures";

type Props = {
  communityId: string;
  product?: ClubProduct | null;
  onSaved: () => void;
  onClose: () => void;
};

function newVariantRow(): VariantDraft {
  return { key: crypto.randomUUID(), size_label: "", color: "", numbering: "", priceStr: "" };
}

function variantsFromProduct(product: ClubProduct | null | undefined): VariantDraft[] {
  const vs = product?.variants ?? [];
  if (vs.length) {
    return vs.map((v) => ({
      key: v.id,
      size_label: v.size_label ?? "",
      color: v.color ?? "",
      numbering: v.numbering ?? "",
      priceStr: String(v.price),
    }));
  }
  if (product) {
    return [
      {
        key: "legacy",
        size_label: product.size_label ?? "",
        color: product.color ?? "",
        numbering: product.numbering ?? "",
        priceStr: String(product.price),
      },
    ];
  }
  return [newVariantRow()];
}

export function ClubProductForm({ communityId, product, onSaved, onClose }: Props) {
  const supabase = createClient();
  const profile = useAppProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = !!product;

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [variantRows, setVariantRows] = useState<VariantDraft[]>(() => variantsFromProduct(product));
  const [files, setFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState(product?.images ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalImages = existingImages.length + files.length;

  function updateVariant(key: string, patch: Partial<VariantDraft>) {
    setVariantRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addVariantRow() {
    setVariantRows((rows) => [...rows, newVariantRow()]);
  }

  function removeVariantRow(key: string) {
    setVariantRows((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.key !== key)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !description.trim()) {
      setError("Preencha nome e descrição.");
      return;
    }

    const parsedVariants = variantRows.map((row, idx) => {
      const price = parsePriceInput(row.priceStr);
      return { row, price, idx };
    });

    if (parsedVariants.some((v) => v.price == null)) {
      setError("Informe um preço válido em cada opção (tamanho/cor/numeração).");
      return;
    }

    const minPrice = Math.min(...parsedVariants.map((v) => v.price!));

    setLoading(true);
    setError(null);

    try {
      let productId = product?.id;

      if (isEdit && productId) {
        const { error: updErr } = await supabase
          .from("club_products")
          .update({
            name: name.trim(),
            description: description.trim(),
            size_label: null,
            color: null,
            numbering: null,
            price: minPrice,
          })
          .eq("id", productId);
        if (updErr) throw new Error(updErr.message);
      } else {
        const { data, error: insErr } = await supabase
          .from("club_products")
          .insert({
            community_id: communityId,
            name: name.trim(),
            description: description.trim(),
            size_label: null,
            color: null,
            numbering: null,
            price: minPrice,
          })
          .select("id")
          .single();
        if (insErr || !data) throw new Error(insErr?.message ?? "Erro ao criar produto");
        productId = data.id;
      }

      const existingIds = new Set((product?.variants ?? []).map((v) => v.id));
      const keptIds = new Set<string>();

      for (const { row, price, idx } of parsedVariants) {
        const payload = {
          size_label: row.size_label.trim() || null,
          color: row.color.trim() || null,
          numbering: row.numbering.trim() || null,
          price: price!,
          sort_order: idx,
          is_active: true,
        };

        if (existingIds.has(row.key)) {
          keptIds.add(row.key);
          const { error: vErr } = await supabase
            .from("club_product_variants")
            .update(payload)
            .eq("id", row.key);
          if (vErr) throw new Error(vErr.message);
        } else {
          const { error: vErr } = await supabase.from("club_product_variants").insert({
            product_id: productId,
            ...payload,
          });
          if (vErr) throw new Error(vErr.message);
        }
      }

      for (const id of existingIds) {
        if (!keptIds.has(id)) {
          await supabase.from("club_product_variants").delete().eq("id", id);
        }
      }

      for (let i = 0; i < files.length; i++) {
        if (existingImages.length + i >= 3) break;
        const file = files[i];
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const sortOrder = existingImages.length + i;
        const path = `${profile.id}/${communityId}/${productId}/${sortOrder}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("club-product-images")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (upErr) continue;
        const { data: urlData } = supabase.storage.from("club-product-images").getPublicUrl(path);
        await supabase.from("club_product_images").insert({
          product_id: productId,
          url: urlData.publicUrl,
          sort_order: sortOrder,
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  async function removeImage(imageId: string) {
    await supabase.from("club_product_images").delete().eq("id", imageId);
    setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
  }

  const previewPrice = product
    ? productDisplayPrice({
        ...product,
        variants: variantRows.map((r, i) => ({
          id: r.key,
          product_id: product.id,
          size_label: r.size_label || null,
          color: r.color || null,
          numbering: r.numbering || null,
          price: parsePriceInput(r.priceStr) ?? 0,
          is_active: true,
          sort_order: i,
        })),
      })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--toq-navy)]">
            {isEdit ? "Editar produto" : "Novo produto"}
          </h2>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-[var(--toq-text-muted)]">
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Nome</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Descrição</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              maxLength={2000}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">
                Opções (tamanho, cor, numeração e preço)
              </span>
              <button
                type="button"
                onClick={addVariantRow}
                className="text-xs font-bold text-[var(--toq-sky)]"
              >
                + Opção
              </button>
            </div>
            <p className="mt-1 text-[11px] text-[var(--toq-text-muted)]">
              Cadastre cada combinação disponível. Ex.: M + Azul + 42 com um preço; G + Preto + 44 com
              outro.
            </p>
            <div className="mt-2 space-y-3">
              {variantRows.map((row, idx) => (
                <div key={row.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[var(--toq-navy)]">Opção {idx + 1}</span>
                    {variantRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVariantRow(row.key)}
                        className="text-[11px] font-semibold text-red-600"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      value={row.size_label}
                      onChange={(e) => updateVariant(row.key, { size_label: e.target.value })}
                      placeholder="Tamanho (P, M…)"
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    />
                    <input
                      value={row.color}
                      onChange={(e) => updateVariant(row.key, { color: e.target.value })}
                      placeholder="Cor"
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    />
                    <input
                      value={row.numbering}
                      onChange={(e) => updateVariant(row.key, { numbering: e.target.value })}
                      placeholder="Numeração"
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <input
                    value={row.priceStr}
                    onChange={(e) => updateVariant(row.key, { priceStr: e.target.value })}
                    required
                    placeholder="Preço (R$)"
                    className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </div>
              ))}
            </div>
            {previewPrice != null && (
              <p className="mt-2 text-xs text-[var(--toq-text-muted)]">
                A partir de {formatClubPrice(previewPrice)}
              </p>
            )}
          </div>

          <div>
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Fotos (até 3)</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {existingImages.map((img) => (
                <div key={img.id} className="relative h-16 w-16 overflow-hidden rounded-lg bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => void removeImage(img.id)}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
              {files.map((f, i) => (
                <span key={i} className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] text-[var(--toq-navy)]">
                  {f.name}
                </span>
              ))}
            </div>
            {totalImages < 3 && (
              <>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[var(--toq-navy)]"
                >
                  Adicionar foto ({totalImages}/3)
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    const room = 3 - existingImages.length - files.length;
                    setFiles((prev) => [...prev, ...picked.slice(0, room)]);
                    e.target.value = "";
                  }}
                />
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg toq-btn-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? "Salvando…" : "Salvar produto"}
          </button>
        </form>
      </div>
    </div>
  );
}
