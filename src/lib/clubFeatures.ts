import type { ClubProduct } from "@/types/clubFeatures";

export function formatClubPrice(price: number) {
  return price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function parsePriceInput(value: string): number | null {
  const cleaned = value.replace(/[^\d,.-]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (Number.isNaN(num) || num < 0) return null;
  return Math.round(num * 100) / 100;
}

export function productDisplayPrice(product: ClubProduct) {
  const active = product.variants?.filter((v) => v.is_active !== false) ?? [];
  if (active.length) return Math.min(...active.map((v) => v.price));
  return product.price;
}

export function hasShopWhatsApp(phone: string | null | undefined) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits.length >= 10;
}
