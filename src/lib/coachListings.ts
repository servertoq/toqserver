import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhoneDigits, whatsappUrl } from "@/lib/courts";
import type {
  CoachListing,
  CoachListingFormData,
  CoachListingWithProfile,
} from "@/types/coachListings";

const SELECT = `
  id,
  user_id,
  title,
  description,
  price_label,
  contact_whatsapp,
  post_id,
  is_active,
  created_at,
  updated_at,
  profile:profiles!coach_listings_user_id_fkey(id, username, avatar_url)
`;

export function mapCoachListingRow(row: Record<string, unknown>): CoachListingWithProfile {
  const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
  const { profile: _p, ...listing } = row;
  return {
    ...(listing as CoachListing),
    profile: profile as CoachListingWithProfile["profile"],
  };
}

export function coachListingFeedTitle(title: string) {
  return `🎾 Aulas de tênis: ${title.trim()}`;
}

export function coachListingFeedBody(description: string, priceLabel: string) {
  return `Estou divulgando aulas de tênis na plataforma Toq Tennis.

${description.trim()}

Valor: ${priceLabel.trim()}

Confira em Aprenda à Jogar.`;
}

export function coachContactUrl(whatsapp: string, title: string, coachUsername: string) {
  return whatsappUrl(
    whatsapp,
    `Olá! Vi sua divulgação "${title}" no Toq Tennis (@${coachUsername}) e gostaria de saber mais sobre as aulas.`
  );
}

export async function fetchCoachListings(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("coach_listings")
    .select(SELECT)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapCoachListingRow(row as Record<string, unknown>));
}

export async function fetchMyCoachListing(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("coach_listings")
    .select(SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapCoachListingRow(data as Record<string, unknown>) : null;
}

export async function fetchCoachListingById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("coach_listings")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapCoachListingRow(data as Record<string, unknown>) : null;
}

async function syncFeedPost(
  supabase: SupabaseClient,
  input: {
    authorId: string;
    title: string;
    description: string;
    priceLabel: string;
    postId: string | null;
  }
): Promise<{ postId: string | null; error: string | null }> {
  const payload = {
    body: coachListingFeedBody(input.description, input.priceLabel),
    title: coachListingFeedTitle(input.title),
    post_type: "player" as const,
    visibility: "public" as const,
    community_id: null,
  };

  if (input.postId) {
    const { error } = await supabase
      .from("posts")
      .update(payload)
      .eq("id", input.postId)
      .eq("author_id", input.authorId);

    if (error) return { postId: input.postId, error: error.message };
    return { postId: input.postId, error: null };
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({ ...payload, author_id: input.authorId })
    .select("id")
    .single();

  if (error || !data) {
    return { postId: null, error: error?.message ?? "Não foi possível publicar no feed." };
  }

  return { postId: data.id as string, error: null };
}

export async function createCoachListing(
  supabase: SupabaseClient,
  userId: string,
  form: CoachListingFormData
): Promise<{ listing: CoachListingWithProfile | null; error: string | null }> {
  const whatsapp = normalizePhoneDigits(form.contact_whatsapp);
  const { postId, error: postErr } = await syncFeedPost(supabase, {
    authorId: userId,
    title: form.title,
    description: form.description,
    priceLabel: form.price_label,
    postId: null,
  });

  if (postErr || !postId) {
    return { listing: null, error: postErr ?? "Não foi possível publicar no feed." };
  }

  const { data, error } = await supabase
    .from("coach_listings")
    .insert({
      user_id: userId,
      title: form.title.trim(),
      description: form.description.trim(),
      price_label: form.price_label.trim(),
      contact_whatsapp: whatsapp,
      post_id: postId,
    })
    .select(SELECT)
    .single();

  if (error || !data) {
    await supabase.from("posts").delete().eq("id", postId);
    return {
      listing: null,
      error: error?.message.includes("coach_listings_user_id_uidx")
        ? "Você já possui uma divulgação. Edite a existente."
        : (error?.message ?? "Não foi possível cadastrar."),
    };
  }

  return { listing: mapCoachListingRow(data as Record<string, unknown>), error: null };
}

export async function updateCoachListing(
  supabase: SupabaseClient,
  listing: CoachListing,
  userId: string,
  form: CoachListingFormData
): Promise<{ error: string | null }> {
  const whatsapp = normalizePhoneDigits(form.contact_whatsapp);
  const { error: postErr } = await syncFeedPost(supabase, {
    authorId: userId,
    title: form.title,
    description: form.description,
    priceLabel: form.price_label,
    postId: listing.post_id,
  });

  if (postErr) return { error: postErr };

  const { error } = await supabase
    .from("coach_listings")
    .update({
      title: form.title.trim(),
      description: form.description.trim(),
      price_label: form.price_label.trim(),
      contact_whatsapp: whatsapp,
    })
    .eq("id", listing.id)
    .eq("user_id", userId);

  return { error: error?.message ?? null };
}

export async function deleteCoachListing(
  supabase: SupabaseClient,
  listing: CoachListing,
  userId: string
): Promise<{ error: string | null }> {
  if (listing.post_id) {
    await supabase.from("posts").delete().eq("id", listing.post_id).eq("author_id", userId);
  }

  const { error } = await supabase
    .from("coach_listings")
    .delete()
    .eq("id", listing.id)
    .eq("user_id", userId);

  return { error: error?.message ?? null };
}

export function emptyCoachListingForm(): CoachListingFormData {
  return {
    title: "",
    description: "",
    price_label: "",
    contact_whatsapp: "",
  };
}

export function coachListingToForm(listing: CoachListing): CoachListingFormData {
  return {
    title: listing.title,
    description: listing.description,
    price_label: listing.price_label,
    contact_whatsapp: listing.contact_whatsapp,
  };
}
