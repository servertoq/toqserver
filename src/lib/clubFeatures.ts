import type { ClubProduct } from "@/types/clubFeatures";

export type ClubProductAgeGroup = "adulto" | "infantil";

export const CLUB_PRODUCT_AGE_OPTIONS: { value: ClubProductAgeGroup; label: string }[] = [
  { value: "adulto", label: "Adulto" },
  { value: "infantil", label: "Infantil" },
];

/** Tamanhos de roupa — adulto */
export const CLUB_PRODUCT_SIZES_ADULTO = [
  "PP",
  "P",
  "M",
  "G",
  "GG",
  "XG",
  "XGG",
  "XXG",
  "Único",
] as const;

/** Tamanhos de roupa — infantil */
export const CLUB_PRODUCT_SIZES_INFANTIL = [
  "2",
  "4",
  "6",
  "8",
  "10",
  "12",
  "14",
  "16",
  "P",
  "M",
  "G",
] as const;

/** Numeração de calçado — adulto (BR) */
export const CLUB_PRODUCT_NUMBERS_ADULTO = [
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
] as const;

/** Numeração de calçado — infantil (BR) */
export const CLUB_PRODUCT_NUMBERS_INFANTIL = [
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
] as const;

export function clubProductSizesForAge(age: ClubProductAgeGroup) {
  return age === "infantil" ? [...CLUB_PRODUCT_SIZES_INFANTIL] : [...CLUB_PRODUCT_SIZES_ADULTO];
}

export function clubProductNumbersForAge(age: ClubProductAgeGroup) {
  return age === "infantil"
    ? [...CLUB_PRODUCT_NUMBERS_INFANTIL]
    : [...CLUB_PRODUCT_NUMBERS_ADULTO];
}

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
