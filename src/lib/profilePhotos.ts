import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteMediaFromR2, uploadMediaToR2 } from "@/lib/mediaUpload";
import type { ProfilePhoto } from "@/types/profile";

export const PROFILE_PHOTOS_MAX = 5;

export function sortProfilePhotos(photos: ProfilePhoto[] | null | undefined): ProfilePhoto[] {
  return [...(photos ?? [])].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
}

export function mapProfilePhotoRows(raw: unknown): ProfilePhoto[] {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return sortProfilePhotos(
    list.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        user_id: String(r.user_id),
        url: String(r.url),
        sort_order: Number(r.sort_order ?? 0),
        created_at: r.created_at ? String(r.created_at) : undefined,
      };
    })
  );
}

export function profileCarouselUrls(
  photos: ProfilePhoto[] | null | undefined,
  avatarUrl?: string | null
): string[] {
  const urls = sortProfilePhotos(photos)
    .map((p) => p.url?.trim())
    .filter((u): u is string => Boolean(u));
  if (urls.length > 0) return urls;
  const avatar = avatarUrl?.trim();
  return avatar ? [avatar] : [];
}

export async function fetchProfilePhotos(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfilePhoto[]> {
  const { data, error } = await supabase
    .from("profile_photos")
    .select("id, user_id, url, sort_order, created_at")
    .eq("user_id", userId)
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(error.message);
  return mapProfilePhotoRows(data);
}

export async function syncProfileAvatarFromPhotos(
  supabase: SupabaseClient,
  userId: string,
  photos: ProfilePhoto[]
): Promise<string | null> {
  const first = sortProfilePhotos(photos)[0];
  const nextUrl = first?.url ?? null;
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: nextUrl })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  return nextUrl;
}

export async function uploadProfilePhoto(
  supabase: SupabaseClient,
  input: { userId: string; file: File; sortOrder: number }
): Promise<{ photo: ProfilePhoto | null; error: string | null }> {
  let publicUrl: string;
  try {
    const uploaded = await uploadMediaToR2(input.file, {
      folder: "profile-photos",
      pathPrefix: `${input.userId}`,
    });
    publicUrl = uploaded.publicUrl;
  } catch (err) {
    return {
      photo: null,
      error: err instanceof Error ? err.message : "Falha ao enviar a foto.",
    };
  }

  const { data, error } = await supabase
    .from("profile_photos")
    .insert({
      user_id: input.userId,
      url: publicUrl,
      sort_order: input.sortOrder,
    })
    .select("id, user_id, url, sort_order, created_at")
    .single();

  if (error || !data) {
    await deleteMediaFromR2(publicUrl).catch(() => undefined);
    return { photo: null, error: error?.message ?? "Não foi possível salvar a foto." };
  }

  return { photo: mapProfilePhotoRows([data])[0] ?? null, error: null };
}

export async function deleteProfilePhoto(
  supabase: SupabaseClient,
  photo: ProfilePhoto
): Promise<string | null> {
  const { error } = await supabase.from("profile_photos").delete().eq("id", photo.id);
  if (error) return error.message;
  await deleteMediaFromR2(photo.url).catch(() => undefined);
  return null;
}

export async function reorderProfilePhotos(
  supabase: SupabaseClient,
  photos: ProfilePhoto[]
): Promise<string | null> {
  const ordered = photos.map((photo, index) => ({
    id: photo.id,
    user_id: photo.user_id,
    url: photo.url,
    sort_order: index,
  }));

  const { error } = await supabase.from("profile_photos").upsert(ordered, { onConflict: "id" });
  return error?.message ?? null;
}
