import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteMediaFromR2, uploadMediaToR2 } from "@/lib/mediaUpload";

export const PROFILE_PHOTOS_MAX = 6;

export type ProfilePhoto = {
  id: string;
  user_id: string;
  url: string;
  sort_order: number;
  created_at?: string;
};

export function sortProfilePhotos(
  photos: ProfilePhoto[] | null | undefined
): ProfilePhoto[] {
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

/** URLs do carrossel: fotos salvas, senão avatar legado. */
export function profilePhotoSlides(
  photos: ProfilePhoto[] | null | undefined,
  avatarUrl: string | null | undefined
): string[] {
  const sorted = sortProfilePhotos(photos);
  if (sorted.length > 0) {
    return sorted.map((p) => p.url).filter(Boolean);
  }
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

async function syncAvatarFromPhotos(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const photos = await fetchProfilePhotos(supabase, userId);
  const primary = photos[0]?.url ?? null;
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: primary })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  return primary;
}

export async function uploadProfilePhoto(
  supabase: SupabaseClient,
  input: { userId: string; file: File; sortOrder?: number }
): Promise<{ photo: ProfilePhoto | null; avatarUrl: string | null; error: string | null }> {
  const existing = await fetchProfilePhotos(supabase, input.userId);
  if (existing.length >= PROFILE_PHOTOS_MAX) {
    return { photo: null, avatarUrl: null, error: `Limite de ${PROFILE_PHOTOS_MAX} fotos.` };
  }

  let publicUrl: string;
  try {
    const uploaded = await uploadMediaToR2(input.file, {
      folder: "profile-photos",
      pathPrefix: `${input.userId}/gallery`,
    });
    publicUrl = uploaded.publicUrl;
  } catch (err) {
    return {
      photo: null,
      avatarUrl: null,
      error: err instanceof Error ? err.message : "Falha no upload.",
    };
  }

  const sortOrder =
    input.sortOrder ??
    (existing.length === 0 ? 0 : Math.max(...existing.map((p) => p.sort_order)) + 1);

  const { data, error } = await supabase
    .from("profile_photos")
    .insert({
      user_id: input.userId,
      url: publicUrl,
      sort_order: sortOrder,
    })
    .select("id, user_id, url, sort_order, created_at")
    .single();

  if (error || !data) {
    try {
      await deleteMediaFromR2(publicUrl);
    } catch {
      // ignore
    }
    return {
      photo: null,
      avatarUrl: null,
      error: error?.message ?? "Não foi possível salvar a foto.",
    };
  }

  const avatarUrl = await syncAvatarFromPhotos(supabase, input.userId);
  return { photo: mapProfilePhotoRows([data])[0] ?? null, avatarUrl, error: null };
}

export async function deleteProfilePhoto(
  supabase: SupabaseClient,
  input: { userId: string; photoId: string }
): Promise<{ avatarUrl: string | null; error: string | null }> {
  const { data: row, error: fetchErr } = await supabase
    .from("profile_photos")
    .select("id, user_id, url")
    .eq("id", input.photoId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (fetchErr || !row) {
    return { avatarUrl: null, error: fetchErr?.message ?? "Foto não encontrada." };
  }

  const { error } = await supabase.from("profile_photos").delete().eq("id", input.photoId);
  if (error) return { avatarUrl: null, error: error.message };

  try {
    await deleteMediaFromR2(row.url);
  } catch {
    // ignore legacy URLs
  }

  const remaining = await fetchProfilePhotos(supabase, input.userId);
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i]!.sort_order !== i) {
      await supabase
        .from("profile_photos")
        .update({ sort_order: i })
        .eq("id", remaining[i]!.id);
    }
  }

  const avatarUrl = await syncAvatarFromPhotos(supabase, input.userId);
  return { avatarUrl, error: null };
}

export async function reorderProfilePhotos(
  supabase: SupabaseClient,
  input: { userId: string; orderedIds: string[] }
): Promise<{ avatarUrl: string | null; error: string | null }> {
  for (let i = 0; i < input.orderedIds.length; i++) {
    const { error } = await supabase
      .from("profile_photos")
      .update({ sort_order: i })
      .eq("id", input.orderedIds[i]!)
      .eq("user_id", input.userId);
    if (error) return { avatarUrl: null, error: error.message };
  }
  const avatarUrl = await syncAvatarFromPhotos(supabase, input.userId);
  return { avatarUrl, error: null };
}
