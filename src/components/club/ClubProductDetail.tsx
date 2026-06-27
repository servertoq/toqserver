"use client";

import { useMemo, useState } from "react";
import { formatClubPrice, hasShopWhatsApp, productDisplayPrice } from "@/lib/clubFeatures";
import {
  buildSinglePurchaseMessage,
  findMatchingVariant,
  openClubWhatsApp,
  uniqueVariantValues,
  variantLabel,
} from "@/lib/clubCart";
import type { ClubCartItem, ClubProduct } from "@/types/clubFeatures";

type Props = {
  product: ClubProduct;
  clubName: string;
  shopWhatsapp: string | null;
  buyerUsername: string;
  onAddToCart: (item: ClubCartItem) => void;
  onClose: () => void;
};

export function ClubProductDetail({
  product,
  clubName,
  shopWhatsapp,
  buyerUsername,
  onAddToCart,
  onClose,
}: Props) {
  const variants = useMemo(
    () => (product.variants ?? []).filter((v) => v.is_active !== false),
    [product.variants]
  );

  const hasSizes = variants.some((v) => v.size_label);
  const hasColors = variants.some((v) => v.color);
  const hasNumbering = variants.some((v) => v.numbering);

  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [numbering, setNumbering] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [hint, setHint] = useState<string | null>(null);

  const sizeOptions = uniqueVariantValues(variants, "size_label", { color, numbering });
  const colorOptions = uniqueVariantValues(variants, "color", { size, numbering });
  const numberingOptions = uniqueVariantValues(variants, "numbering", { size, color });

  const selected = useMemo(
    () => findMatchingVariant(variants, size, color, numbering),
    [variants, size, color, numbering]
  );

  const whatsappReady = hasShopWhatsApp(shopWhatsapp);
  const displayPrice = selected?.price ?? productDisplayPrice(product);

  function validateSelection() {
    if (variants.length === 0) return "Produto sem opções disponíveis.";
    if (variants.length === 1 && !hasSizes && !hasColors && !hasNumbering) return null;
    if (hasSizes && !size) return "Selecione o tamanho.";
    if (hasColors && !color) return "Selecione a cor.";
    if (hasNumbering && !numbering) return "Selecione a numeração.";
    if (!selected) return "Combinação indisponível. Escolha outra opção.";
    return null;
  }

  function handleBuyNow() {
    const err = validateSelection();
    if (err) {
      setHint(err);
      return;
    }
    if (!whatsappReady || !shopWhatsapp || !selected) {
      setHint("O clube ainda não configurou o WhatsApp da loja.");
      return;
    }
    const msg = buildSinglePurchaseMessage(
      product.name,
      selected,
      buyerUsername,
      clubName,
      quantity
    );
    openClubWhatsApp(shopWhatsapp, msg);
  }

  function handleAddToCart() {
    const err = validateSelection();
    if (err) {
      setHint(err);
      return;
    }
    if (!selected) return;

    onAddToCart({
      productId: product.id,
      variantId: selected.id,
      productName: product.name,
      size_label: selected.size_label,
      color: selected.color,
      numbering: selected.numbering,
      price: selected.price,
      quantity,
      imageUrl: product.images?.[0]?.url ?? null,
    });
    setHint("Adicionado ao carrinho!");
    setTimeout(() => setHint(null), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        {product.images?.[0] ? (
          <div className="club-product-media club-product-media--detail">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.images[0].url} alt="" />
          </div>
        ) : null}
        <div className="p-5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-bold text-[var(--toq-navy)]">{product.name}</h2>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 text-sm font-semibold text-[var(--toq-text-muted)]"
            >
              Fechar
            </button>
          </div>
          <p className="mt-2 text-sm text-[var(--toq-text-muted)]">{product.description}</p>
          <p className="mt-3 text-lg font-bold text-[var(--toq-accent)]">
            {formatClubPrice(displayPrice)}
            {selected && quantity > 1 && (
              <span className="ml-2 text-sm font-semibold text-[var(--toq-text-muted)]">
                × {quantity} = {formatClubPrice(displayPrice * quantity)}
              </span>
            )}
          </p>

          {!whatsappReady && (
            <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
              A loja ainda não tem WhatsApp configurado. O administrador deve informar o contato nas
              configurações do clube.
            </p>
          )}

          {variants.length > 0 && (
            <div className="mt-4 space-y-3">
              {hasSizes && (
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--toq-navy)]">Tamanho</span>
                  <select
                    value={size}
                    onChange={(e) => {
                      setSize(e.target.value);
                      setColor("");
                      setNumbering("");
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Selecione…</option>
                    {sizeOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {hasColors && (
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--toq-navy)]">Cor</span>
                  <select
                    value={color}
                    onChange={(e) => {
                      setColor(e.target.value);
                      setNumbering("");
                    }}
                    disabled={hasSizes && !size}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    <option value="">Selecione…</option>
                    {colorOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {hasNumbering && (
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--toq-navy)]">Numeração</span>
                  <select
                    value={numbering}
                    onChange={(e) => setNumbering(e.target.value)}
                    disabled={(hasSizes && !size) || (hasColors && !color)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    <option value="">Selecione…</option>
                    {numberingOptions.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!hasSizes && !hasColors && !hasNumbering && variants.length === 1 && (
                <p className="text-xs text-[var(--toq-text-muted)]">
                  Opção: {variantLabel(variants[0])} — {formatClubPrice(variants[0].price)}
                </p>
              )}
              {selected && (
                <p className="text-xs font-semibold text-[var(--toq-navy)]">
                  Selecionado: {variantLabel(selected)}
                </p>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Quantidade</span>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-3 py-1 text-sm font-bold"
              >
                −
              </button>
              <span className="min-w-[2rem] text-center text-sm font-bold">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="px-3 py-1 text-sm font-bold"
              >
                +
              </button>
            </div>
          </div>

          {hint && (
            <p
              className={`mt-3 rounded-lg px-3 py-2 text-xs ${
                hint.includes("carrinho") ? "bg-green-500/10 text-green-700" : "bg-red-500/10 text-red-600"
              }`}
            >
              {hint}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={variants.length === 0}
              className="flex-1 rounded-lg border-2 border-[var(--toq-navy)] py-2.5 text-sm font-bold text-[var(--toq-navy)] disabled:opacity-50"
            >
              Adicionar ao carrinho
            </button>
            <button
              type="button"
              onClick={handleBuyNow}
              disabled={!whatsappReady || variants.length === 0}
              className="flex-1 rounded-lg bg-[#25D366] py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              Comprar no WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
