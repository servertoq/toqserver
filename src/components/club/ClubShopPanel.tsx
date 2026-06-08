"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { canModerate } from "@/lib/community";
import { formatClubPrice, hasShopWhatsApp, productDisplayPrice } from "@/lib/clubFeatures";
import { cartItemCount, loadClubCart, saveClubCart } from "@/lib/clubCart";
import type { CommunityMemberRole } from "@/types/community";
import type { ClubCartItem, ClubProduct, ClubProductImage, ClubProductVariant } from "@/types/clubFeatures";
import { ClubProductForm } from "./ClubProductForm";
import { ClubProductDetail } from "./ClubProductDetail";
import { ClubCartPanel } from "./ClubCartPanel";

type Props = {
  communityId: string;
  clubName: string;
  shopWhatsapp: string | null;
  buyerUsername: string;
  myRole: CommunityMemberRole | null;
};

export function ClubShopPanel({
  communityId,
  clubName,
  shopWhatsapp,
  buyerUsername,
  myRole,
}: Props) {
  const supabase = createClient();
  const canManage = canModerate(myRole);
  const [products, setProducts] = useState<ClubProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ClubProduct | null | undefined>(undefined);
  const [viewing, setViewing] = useState<ClubProduct | null>(null);
  const [cart, setCart] = useState<ClubCartItem[]>([]);

  useEffect(() => {
    setCart(loadClubCart(communityId));
  }, [communityId]);

  const persistCart = useCallback(
    (items: ClubCartItem[]) => {
      setCart(items);
      saveClubCart(communityId, items);
    },
    [communityId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("club_products")
      .select(
        `
        *,
        images:club_product_images(id, product_id, url, sort_order),
        variants:club_product_variants(id, product_id, size_label, color, numbering, price, is_active, sort_order)
      `
      )
      .eq("community_id", communityId)
      .eq("is_active", true)
      .order("sort_order");

    const mapped: ClubProduct[] = (data ?? []).map((row) => {
      const rawImg = row.images as ClubProductImage | ClubProductImage[] | null;
      const imgs = Array.isArray(rawImg) ? rawImg : rawImg ? [rawImg] : [];
      const rawVar = row.variants as ClubProductVariant | ClubProductVariant[] | null;
      const vars = Array.isArray(rawVar) ? rawVar : rawVar ? [rawVar] : [];
      return {
        ...row,
        price: Number(row.price),
        images: [...imgs].sort((a, b) => a.sort_order - b.sort_order),
        variants: [...vars]
          .filter((v) => v.is_active !== false)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((v) => ({ ...v, price: Number(v.price) })),
      };
    });
    setProducts(mapped);
    setLoading(false);
  }, [communityId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(product: ClubProduct) {
    await supabase.from("club_products").update({ is_active: false }).eq("id", product.id);
    await load();
  }

  function addToCart(item: ClubCartItem) {
    const existing = cart.find(
      (c) => c.productId === item.productId && c.variantId === item.variantId
    );
    if (existing) {
      persistCart(
        cart.map((c) =>
          c.productId === item.productId && c.variantId === item.variantId
            ? { ...c, quantity: c.quantity + item.quantity }
            : c
        )
      );
    } else {
      persistCart([...cart, item]);
    }
  }

  function updateCartQty(variantId: string, productId: string, qty: number) {
    if (qty < 1) {
      persistCart(cart.filter((c) => !(c.variantId === variantId && c.productId === productId)));
      return;
    }
    persistCart(
      cart.map((c) =>
        c.variantId === variantId && c.productId === productId ? { ...c, quantity: qty } : c
      )
    );
  }

  function removeFromCart(variantId: string, productId: string) {
    persistCart(cart.filter((c) => !(c.variantId === variantId && c.productId === productId)));
  }

  const cartCount = cartItemCount(cart);
  const whatsappOk = hasShopWhatsApp(shopWhatsapp);

  if (loading) {
    return <p className="mt-4 text-sm text-[var(--toq-text-muted)]">Carregando loja…</p>;
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-[var(--toq-navy)]">Loja do clube</h2>
        <div className="flex items-center gap-2">
          {cartCount > 0 && (
            <span className="rounded-full bg-[var(--toq-navy)] px-2 py-0.5 text-[11px] font-bold text-white">
              Carrinho: {cartCount}
            </span>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg toq-btn-primary px-3 py-1.5 text-xs font-bold text-white"
            >
              + Novo produto
            </button>
          )}
        </div>
      </div>

      {canManage && !whatsappOk && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
          Ative a loja e informe o WhatsApp nas configurações do clube para que os membros possam
          comprar.
        </p>
      )}

      {products.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-[var(--toq-navy)]">Nenhum produto na loja</p>
          {canManage && (
            <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
              Cadastre o primeiro produto com tamanhos, cores e preços.
            </p>
          )}
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {products.map((product) => {
            const optionCount = product.variants?.length ?? 0;
            return (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => setViewing(product)}
                  className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-[var(--toq-accent)]"
                >
                  {product.images && product.images[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.images[0].url} alt="" className="aspect-[4/3] w-full object-cover" />
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-[var(--toq-navy)]">{product.name}</h3>
                      <span className="shrink-0 text-sm font-bold text-[var(--toq-accent)]">
                        {formatClubPrice(productDisplayPrice(product))}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--toq-text-muted)]">
                      {product.description}
                    </p>
                    {optionCount > 0 && (
                      <p className="mt-2 text-[11px] font-semibold text-[var(--toq-sky)]">
                        {optionCount} {optionCount === 1 ? "opção" : "opções"} — toque para escolher
                      </p>
                    )}
                  </div>
                </button>
                {canManage && (
                  <div className="mt-2 flex gap-3 px-1">
                    <button
                      type="button"
                      onClick={() => setEditing(product)}
                      className="text-xs font-semibold text-[var(--toq-sky)]"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleActive(product)}
                      className="text-xs font-semibold text-red-600"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ClubCartPanel
        items={cart}
        clubName={clubName}
        shopWhatsapp={shopWhatsapp}
        buyerUsername={buyerUsername}
        onUpdateQty={updateCartQty}
        onRemove={removeFromCart}
        onClear={() => persistCart([])}
      />

      {viewing && (
        <ClubProductDetail
          product={viewing}
          clubName={clubName}
          shopWhatsapp={shopWhatsapp}
          buyerUsername={buyerUsername}
          onAddToCart={addToCart}
          onClose={() => setViewing(null)}
        />
      )}

      {editing !== undefined && (
        <ClubProductForm
          communityId={communityId}
          product={editing}
          onSaved={load}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}
