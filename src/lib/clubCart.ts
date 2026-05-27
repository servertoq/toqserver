import type { ClubCartItem, ClubProductVariant } from "@/types/clubFeatures";
import { formatClubPrice } from "@/lib/clubFeatures";
import { normalizePhoneDigits, whatsappUrl } from "@/lib/courts";

const cartKey = (communityId: string) => `toq-club-cart-${communityId}`;

export function loadClubCart(communityId: string): ClubCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(cartKey(communityId));
    if (!raw) return [];
    return JSON.parse(raw) as ClubCartItem[];
  } catch {
    return [];
  }
}

export function saveClubCart(communityId: string, items: ClubCartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(cartKey(communityId), JSON.stringify(items));
}

export function cartItemCount(items: ClubCartItem[]) {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

export function cartTotal(items: ClubCartItem[]) {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

export function variantLabel(v: Pick<ClubProductVariant, "size_label" | "color" | "numbering">) {
  const parts = [v.size_label, v.color, v.numbering].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Padrão";
}

export function buildSinglePurchaseMessage(
  productName: string,
  variant: Pick<ClubProductVariant, "size_label" | "color" | "numbering" | "price">,
  buyerUsername: string,
  clubName: string,
  quantity = 1
) {
  const lines = [
    `Olá! Quero comprar no clube *${clubName}*:`,
    ``,
    `*${productName}*`,
    `Opção: ${variantLabel(variant)}`,
    `Quantidade: ${quantity}`,
    `Valor unitário: ${formatClubPrice(variant.price)}`,
    `Total: ${formatClubPrice(variant.price * quantity)}`,
    ``,
    `Comprador: @${buyerUsername}`,
  ];
  return lines.join("\n");
}

export function buildCartCheckoutMessage(
  items: ClubCartItem[],
  buyerUsername: string,
  clubName: string
) {
  const lines = [
    `Olá! Quero finalizar meu pedido no clube *${clubName}*:`,
    ``,
  ];

  items.forEach((item, idx) => {
    lines.push(
      `${idx + 1}. *${item.productName}*`,
      `   ${variantLabel(item)}`,
      `   Qtd: ${item.quantity} × ${formatClubPrice(item.price)} = ${formatClubPrice(item.price * item.quantity)}`,
      ``
    );
  });

  lines.push(`*Total: ${formatClubPrice(cartTotal(items))}*`);
  lines.push(``);
  lines.push(`Comprador: @${buyerUsername}`);

  return lines.join("\n");
}

export function openClubWhatsApp(phone: string, message: string) {
  const digits = normalizePhoneDigits(phone);
  if (digits.length < 10) return false;
  window.open(whatsappUrl(phone, message), "_blank", "noopener,noreferrer");
  return true;
}

export function findMatchingVariant(
  variants: ClubProductVariant[],
  size: string,
  color: string,
  numbering: string
): ClubProductVariant | null {
  if (variants.length === 1 && !size && !color && !numbering) {
    return variants[0];
  }
  return (
    variants.find((v) => {
      if (size && v.size_label !== size) return false;
      if (color && v.color !== color) return false;
      if (numbering && v.numbering !== numbering) return false;
      return true;
    }) ?? null
  );
}

export function uniqueVariantValues(
  variants: ClubProductVariant[],
  field: "size_label" | "color" | "numbering",
  filters: { size?: string; color?: string; numbering?: string }
) {
  const filtered = variants.filter((v) => {
    if (filters.size && v.size_label !== filters.size) return false;
    if (filters.color && v.color !== filters.color) return false;
    if (filters.numbering && v.numbering !== filters.numbering) return false;
    return true;
  });
  const values = new Set<string>();
  for (const v of filtered) {
    const val = v[field];
    if (val) values.add(val);
  }
  return [...values].sort();
}
