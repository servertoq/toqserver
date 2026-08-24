import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommunityGalleryImage } from "@/types/community";

export const COMMUNITY_GALLERY_MAX = 8;

export const COMMUNITY_GALLERY_SELECT =
  "gallery_images:community_gallery_images(id, community_id, url, sort_order, created_at)";

export function sortGalleryImages(
  images: CommunityGalleryImage[] | null | undefined
): CommunityGalleryImage[] {
  return [...(images ?? [])].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
}

/** Capa + fotos da galeria para o carrossel. */
export function communityCoverSlides(
  coverImageUrl: string | null | undefined,
  gallery: CommunityGalleryImage[] | null | undefined
): string[] {
  const urls: string[] = [];
  const cover = coverImageUrl?.trim();
  if (cover) urls.push(cover);
  for (const img of sortGalleryImages(gallery)) {
    const u = img.url?.trim();
    if (u && !urls.includes(u)) urls.push(u);
  }
  return urls;
}

export function mapGalleryRows(raw: unknown): CommunityGalleryImage[] {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return sortGalleryImages(
    list.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        community_id: String(r.community_id),
        url: String(r.url),
        sort_order: Number(r.sort_order ?? 0),
        created_at: r.created_at ? String(r.created_at) : undefined,
      };
    })
  );
}

export async function fetchCommunityGallery(
  supabase: SupabaseClient,
  communityId: string
): Promise<CommunityGalleryImage[]> {
  const { data, error } = await supabase
    .from("community_gallery_images")
    .select("id, community_id, url, sort_order, created_at")
    .eq("community_id", communityId)
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(error.message);
  return mapGalleryRows(data);
}

export async function uploadCommunityGalleryImage(
  supabase: SupabaseClient,
  input: {
    userId: string;
    communityId: string;
    file: File;
    sortOrder: number;
  }
): Promise<{ image: CommunityGalleryImage | null; error: string | null }> {
  const ext = input.file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${input.userId}/${input.communityId}/gallery/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("community-covers")
    .upload(path, input.file, { upsert: false, contentType: input.file.type || "image/jpeg" });

  if (upErr) {
    return { image: null, error: upErr.message };
  }

  const { data: urlData } = supabase.storage.from("community-covers").getPublicUrl(path);
  const url = `${urlData.publicUrl}?t=${Date.now()}`;

  const { data, error } = await supabase
    .from("community_gallery_images")
    .insert({
      community_id: input.communityId,
      url,
      sort_order: input.sortOrder,
      created_by: input.userId,
    })
    .select("id, community_id, url, sort_order, created_at")
    .single();

  if (error || !data) {
    return { image: null, error: error?.message ?? "Não foi possível salvar a foto." };
  }

  return { image: mapGalleryRows([data])[0] ?? null, error: null };
}

export async function deleteCommunityGalleryImage(
  supabase: SupabaseClient,
  imageId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("community_gallery_images").delete().eq("id", imageId);
  return { error: error?.message ?? null };
}
