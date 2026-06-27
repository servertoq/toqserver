"use client";

import { formatClubPrice, hasShopWhatsApp } from "@/lib/clubFeatures";
import {
  buildCartCheckoutMessage,
  cartItemCount,
  cartTotal,
  openClubWhatsApp,
  variantLabel,
} from "@/lib/clubCart";
import type { ClubCartItem } from "@/types/clubFeatures";

type Props = {
  items: ClubCartItem[];
  clubName: string;
  shopWhatsapp: string | null;
  buyerUsername: string;
  onUpdateQty: (variantId: string, productId: string, qty: number) => void;
  onRemove: (variantId: string, productId: string) => void;
  onClear: () => void;
};

export function ClubCartPanel({
  items,
  clubName,
  shopWhatsapp,
  buyerUsername,
  onUpdateQty,
  onRemove,
  onClear,
}: Props) {
  const count = cartItemCount(items);
  const whatsappReady = hasShopWhatsApp(shopWhatsapp);

  if (count === 0) return null;

  function handleCheckout() {
    if (!whatsappReady || !shopWhatsapp) return;
    const msg = buildCartCheckoutMessage(items, buyerUsername, clubName);
    openClubWhatsApp(shopWhatsapp, msg);
    onClear();
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[var(--toq-navy)]">
          Carrinho ({count} {count === 1 ? "item" : "itens"})
        </h3>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-semibold text-[var(--toq-text-muted)]"
        >
          Limpar
        </button>
      </div>

      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li
            key={`${item.productId}-${item.variantId}`}
            className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3"
          >
            {item.imageUrl && (
              <div className="club-product-thumb shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt="" className="rounded-lg" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[var(--toq-navy)]">{item.productName}</p>
              <p className="text-[11px] text-[var(--toq-text-muted)]">{variantLabel(item)}</p>
              <p className="mt-1 text-xs font-semibold text-[var(--toq-accent)]">
                {formatClubPrice(item.price * item.quantity)}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateQty(item.variantId, item.productId, item.quantity - 1)}
                  className="rounded border border-slate-200 px-2 py-0.5 text-xs font-bold"
                >
                  −
                </button>
                <span className="text-xs font-bold">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => onUpdateQty(item.variantId, item.productId, item.quantity + 1)}
                  className="rounded border border-slate-200 px-2 py-0.5 text-xs font-bold"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(item.variantId, item.productId)}
                  className="ml-auto text-xs font-semibold text-red-600"
                >
                  Remover
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
        <span className="text-sm font-bold text-[var(--toq-navy)]">
          Total: {formatClubPrice(cartTotal(items))}
        </span>
        <button
          type="button"
          onClick={handleCheckout}
          disabled={!whatsappReady}
          className="rounded-lg bg-[#25D366] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Finalizar no WhatsApp
        </button>
      </div>

      {!whatsappReady && (
        <p className="mt-2 text-xs text-amber-700">
          Configure o WhatsApp da loja nas configurações do clube para finalizar o pedido.
        </p>
      )}
    </div>
  );
}
