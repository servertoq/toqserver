import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdvertisingArticle,
  AdvertisingArticleInput,
  AdvertisingCarouselItem,
} from "@/types/advertising";

const IMAGE_BUCKET = "advertising-images";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

export function slugifyAdvertisingTitle(title: string) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function buildCardExcerpt(bodyHtml: string, max = 120) {
  const text = stripHtml(bodyHtml);
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export async function uploadAdvertisingImage(
  supabase: SupabaseClient,
  userId: string,
  articleKey: string,
  file: File,
  suffix: string
): Promise<string | null> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
    return null;
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${articleKey}/${suffix}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) return null;

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function listCarouselArticles(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("list_ad_carousel_articles", { p_limit: 5 });
  return { data: (data as AdvertisingCarouselItem[]) ?? [], error };
}

export async function listPublishedArticles(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("advertising_articles")
    .select("*")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  return { data: (data as AdvertisingArticle[]) ?? [], error };
}

export async function listAllArticlesForStaff(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("advertising_articles")
    .select("*")
    .order("updated_at", { ascending: false });

  return { data: (data as AdvertisingArticle[]) ?? [], error };
}

export async function getArticleBySlug(supabase: SupabaseClient, slug: string) {
  const { data, error } = await supabase
    .from("advertising_articles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  return { data: (data as AdvertisingArticle | null) ?? null, error };
}

export async function createAdvertisingArticle(
  supabase: SupabaseClient,
  authorId: string,
  input: AdvertisingArticleInput
) {
  const { data, error } = await supabase
    .from("advertising_articles")
    .insert({
      author_id: authorId,
      title: input.title.trim(),
      slug: input.slug,
      card_excerpt: input.card_excerpt.trim(),
      body_html: input.body_html,
      cover_image_url: input.cover_image_url,
      card_image_url: input.card_image_url,
      is_published: input.is_published,
    })
    .select("*")
    .single();

  return { data: (data as AdvertisingArticle | null) ?? null, error };
}

export async function updateAdvertisingArticle(
  supabase: SupabaseClient,
  id: string,
  input: AdvertisingArticleInput
) {
  const { data, error } = await supabase
    .from("advertising_articles")
    .update({
      title: input.title.trim(),
      slug: input.slug,
      card_excerpt: input.card_excerpt.trim(),
      body_html: input.body_html,
      cover_image_url: input.cover_image_url,
      card_image_url: input.card_image_url,
      is_published: input.is_published,
    })
    .eq("id", id)
    .select("*")
    .single();

  return { data: (data as AdvertisingArticle | null) ?? null, error };
}

export async function deleteAdvertisingArticle(supabase: SupabaseClient, id: string) {
  return supabase.from("advertising_articles").delete().eq("id", id);
}

export async function canManageAdvertisingClient(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("can_manage_advertising");
  return { allowed: Boolean(data), error };
}
