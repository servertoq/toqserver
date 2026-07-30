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
  open: boolean;
  items: ClubCartItem[];
  clubName: string;
  shopWhatsapp: string | null;
  buyerUsername: string;
  onClose: () => void;
  onUpdateQty: (variantId: string, productId: string, qty: number) => void;
  onRemove: (variantId: string, productId: string) => void;
  onClear: () => void;
};

export function ClubCartPanel({
  open,
  items,
  clubName,
  shopWhatsapp,
  buyerUsername,
  onClose,
  onUpdateQty,
  onRemove,
  onClear,
}: Props) {
  const count = cartItemCount(items);
  const whatsappReady = hasShopWhatsApp(shopWhatsapp);

  if (!open) return null;

  function handleCheckout() {
    if (!whatsappReady || !shopWhatsapp || items.length === 0) return;
    const msg = buildCartCheckoutMessage(items, buyerUsername, clubName);
    openClubWhatsApp(shopWhatsapp, msg);
    onClear();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="club-cart-title"
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-[var(--toq-card)] shadow-xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--toq-border)] px-4 py-3">
          <h3 id="club-cart-title" className="text-sm font-bold text-[var(--toq-navy)]">
            Carrinho
            {count > 0 ? ` (${count})` : ""}
          </h3>
          <div className="flex items-center gap-3">
            {count > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="text-xs font-semibold text-[var(--toq-text-muted)]"
              >
                Limpar
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-[var(--toq-text-muted)]"
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {count === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--toq-text-muted)]">
              Seu carrinho está vazio.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={`${item.productId}-${item.variantId}`}
                  className="flex gap-3 rounded-xl border border-[var(--toq-border)] bg-[var(--toq-surface)] p-3"
                >
                  {item.imageUrl && (
                    <div className="club-product-thumb shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.imageUrl} alt="" className="rounded-lg" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[var(--toq-navy)]">
                      {item.productName}
                    </p>
                    <p className="text-[11px] text-[var(--toq-text-muted)]">
                      {variantLabel(item)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[var(--toq-accent)]">
                      {formatClubPrice(item.price * item.quantity)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateQty(item.variantId, item.productId, item.quantity - 1)
                        }
                        className="rounded border border-[var(--toq-border)] px-2 py-0.5 text-xs font-bold text-[var(--toq-navy)]"
                      >
                        −
                      </button>
                      <span className="text-xs font-bold text-[var(--toq-navy)]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateQty(item.variantId, item.productId, item.quantity + 1)
                        }
                        className="rounded border border-[var(--toq-border)] px-2 py-0.5 text-xs font-bold text-[var(--toq-navy)]"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(item.variantId, item.productId)}
                        className="ml-auto text-xs font-semibold text-red-500"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {count > 0 && (
          <div className="border-t border-[var(--toq-border)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-[var(--toq-navy)]">
                Total: {formatClubPrice(cartTotal(items))}
              </span>
              <button
                type="button"
                onClick={handleCheckout}
                disabled={!whatsappReady}
                className="rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Finalizar no WhatsApp
              </button>
            </div>
            {!whatsappReady && (
              <p className="mt-2 text-xs text-amber-600">
                Configure o WhatsApp da loja nas configurações do clube para finalizar o pedido.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
