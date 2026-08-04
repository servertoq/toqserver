"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import {
  CLUB_PRODUCT_AGE_OPTIONS,
  clubProductNumbersForAge,
  clubProductSizesForAge,
  formatClubPrice,
  parsePriceInput,
  productDisplayPrice,
  type ClubProductAgeGroup,
} from "@/lib/clubFeatures";
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

const selectClass =
  "mt-0.5 w-full rounded-lg toq-input px-2 py-1.5 text-sm text-[var(--toq-navy)]";

export function ClubProductForm({ communityId, product, onSaved, onClose }: Props) {
  const supabase = createClient();
  const profile = useAppProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = !!product;
  const [mounted, setMounted] = useState(false);

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [ageGroup, setAgeGroup] = useState<ClubProductAgeGroup>(
    product?.age_group === "infantil" ? "infantil" : "adulto"
  );
  const [variantRows, setVariantRows] = useState<VariantDraft[]>(() => variantsFromProduct(product));
  const [files, setFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState(product?.images ?? []);
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

  const totalImages = existingImages.length + files.length;
  const sizeOptions = clubProductSizesForAge(ageGroup);
  const numberOptions = clubProductNumbersForAge(ageGroup);

  function updateVariant(key: string, patch: Partial<VariantDraft>) {
    setVariantRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addVariantRow() {
    setVariantRows((rows) => [...rows, newVariantRow()]);
  }

  function removeVariantRow(key: string) {
    setVariantRows((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.key !== key)));
  }

  function handleAgeChange(next: ClubProductAgeGroup) {
    setAgeGroup(next);
    const sizes = new Set(clubProductSizesForAge(next));
    const numbers = new Set(clubProductNumbersForAge(next));
    setVariantRows((rows) =>
      rows.map((row) => ({
        ...row,
        size_label: row.size_label && sizes.has(row.size_label as never) ? row.size_label : "",
        numbering: row.numbering && numbers.has(row.numbering as never) ? row.numbering : "",
      }))
    );
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
            age_group: ageGroup,
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
            age_group: ageGroup,
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

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="club-product-form-title"
        className="flex max-h-[min(92dvh,100%)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-[var(--toq-card)] text-[var(--toq-text)] shadow-xl sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--toq-border)] px-5 py-3">
          <h2 id="club-product-form-title" className="text-lg font-bold text-[var(--toq-navy)]">
            {isEdit ? "Editar produto" : "Novo produto"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-sm font-semibold text-[var(--toq-text-muted)] disabled:opacity-50"
          >
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4 [-webkit-overflow-scrolling:touch]">
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Nome</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm"
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
              className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm"
            />
          </label>

          <fieldset>
            <legend className="text-xs font-semibold text-[var(--toq-navy)]">Público</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {CLUB_PRODUCT_AGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleAgeChange(opt.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    ageGroup === opt.value
                      ? "toq-btn-primary text-white"
                      : "border border-[var(--toq-border)] bg-[var(--toq-surface)] text-[var(--toq-text-muted)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--toq-text-muted)]">
              Define as opções de tamanho e numeração disponíveis abaixo.
            </p>
          </fieldset>

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
              Cadastre cada combinação. Deixe tamanho ou numeração em branco se não se aplicar.
            </p>
            <div className="mt-2 space-y-3">
              {variantRows.map((row, idx) => (
                <div
                  key={row.key}
                  className="rounded-xl border border-[var(--toq-border)] bg-[var(--toq-surface)] p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[var(--toq-navy)]">
                      Opção {idx + 1}
                    </span>
                    {variantRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVariantRow(row.key)}
                        className="text-[11px] font-semibold text-red-500"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="block min-w-0">
                      <span className="text-[10px] font-semibold text-[var(--toq-text-muted)]">
                        Tamanho
                      </span>
                      <select
                        value={row.size_label}
                        onChange={(e) => updateVariant(row.key, { size_label: e.target.value })}
                        className={selectClass}
                      >
                        <option value="">Sem tamanho</option>
                        {sizeOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                        {row.size_label && !sizeOptions.includes(row.size_label as never) && (
                          <option value={row.size_label}>{row.size_label}</option>
                        )}
                      </select>
                    </label>
                    <label className="block min-w-0">
                      <span className="text-[10px] font-semibold text-[var(--toq-text-muted)]">
                        Cor
                      </span>
                      <input
                        value={row.color}
                        onChange={(e) => updateVariant(row.key, { color: e.target.value })}
                        placeholder="Ex.: Azul"
                        className={selectClass}
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="text-[10px] font-semibold text-[var(--toq-text-muted)]">
                        Numeração
                      </span>
                      <select
                        value={row.numbering}
                        onChange={(e) => updateVariant(row.key, { numbering: e.target.value })}
                        className={selectClass}
                      >
                        <option value="">Sem numeração</option>
                        {numberOptions.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                        {row.numbering && !numberOptions.includes(row.numbering as never) && (
                          <option value={row.numbering}>{row.numbering}</option>
                        )}
                      </select>
                    </label>
                  </div>
                  <label className="mt-2 block">
                    <span className="text-[10px] font-semibold text-[var(--toq-text-muted)]">
                      Preço (R$)
                    </span>
                    <input
                      value={row.priceStr}
                      onChange={(e) => updateVariant(row.key, { priceStr: e.target.value })}
                      required
                      placeholder="0,00"
                      className={selectClass}
                    />
                  </label>
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
                <div
                  key={img.id}
                  className="relative h-16 w-16 overflow-hidden rounded-lg bg-[var(--toq-surface)]"
                >
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
                <span
                  key={i}
                  className="rounded-lg bg-[var(--toq-surface)] px-2 py-1 text-[10px] text-[var(--toq-navy)]"
                >
                  {f.name}
                </span>
              ))}
            </div>
            {totalImages < 3 && (
              <>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-2 rounded-lg toq-btn-outline px-3 py-2 text-xs font-bold"
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
          </div>

          <div className="shrink-0 border-t border-[var(--toq-border)] bg-[var(--toq-card)] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg toq-btn-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {loading ? "Salvando…" : "Salvar produto"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
