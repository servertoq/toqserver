import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommunityGalleryImage } from "@/types/community";
import { deleteMediaFromR2, uploadMediaToR2 } from "@/lib/mediaUpload";

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
  let publicUrl: string;
  try {
    const uploaded = await uploadMediaToR2(input.file, {
      folder: "community-covers",
      pathPrefix: `${input.userId}/${input.communityId}/gallery`,
    });
    publicUrl = uploaded.publicUrl;
  } catch (err) {
    return {
      image: null,
      error: err instanceof Error ? err.message : "Falha no upload.",
    };
  }

  const { data, error } = await supabase
    .from("community_gallery_images")
    .insert({
      community_id: input.communityId,
      url: publicUrl,
      sort_order: input.sortOrder,
      created_by: input.userId,
    })
    .select("id, community_id, url, sort_order, created_at")
    .single();

  if (error || !data) {
    try {
      await deleteMediaFromR2(publicUrl);
    } catch {
      // ignore
    }
    return { image: null, error: error?.message ?? "Não foi possível salvar a foto." };
  }

  return { image: mapGalleryRows([data])[0] ?? null, error: null };
}

export async function deleteCommunityGalleryImage(
  supabase: SupabaseClient,
  imageId: string
): Promise<{ error: string | null }> {
  const { data: row } = await supabase
    .from("community_gallery_images")
    .select("url")
    .eq("id", imageId)
    .maybeSingle();

  const { error } = await supabase.from("community_gallery_images").delete().eq("id", imageId);
  if (error) return { error: error.message };

  if (row?.url) {
    try {
      await deleteMediaFromR2(row.url);
    } catch {
      // ignore
    }
  }
  return { error: null };
}
