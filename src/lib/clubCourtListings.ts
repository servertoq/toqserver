import type { SupabaseClient } from "@supabase/supabase-js";
import { formatClubPrice } from "@/lib/clubFeatures";
import { courtSizeLabel } from "@/lib/courts";
import type { ClubCourt } from "@/types/clubFeatures";
import type { CourtRentalVisibility } from "@/types/courtManagement";

type CommunityRef = {
  id: string;
  name: string;
  slug: string;
};

export function clubCourtFeedTitle(name: string) {
  return name.trim();
}

export function clubCourtFeedBody(
  description: string,
  sizeLabel: string,
  clubName: string,
  minPrice: number | null,
  visibility: CourtRentalVisibility
) {
  const lines = [
    description.trim(),
    `Tamanho: ${courtSizeLabel(sizeLabel)}`,
    visibility === "public"
      ? `Clube: ${clubName} — disponível para locação por terceiros.`
      : `Exclusivo para membros do clube ${clubName}.`,
  ];
  if (minPrice != null && minPrice > 0) {
    lines.push(`A partir de ${formatClubPrice(minPrice)}`);
  }
  return lines.filter(Boolean).join("\n\n");
}

function minPlanPrice(court: ClubCourt): number | null {
  const plans = (court.plans ?? []).filter((p) => p.is_active !== false);
  if (plans.length === 0) return null;
  return Math.min(...plans.map((p) => Number(p.price)));
}

async function writeCourtFeedPost(
  supabase: SupabaseClient,
  input: {
    authorId: string;
    title: string;
    body: string;
    postId: string | null;
    communityId: string | null;
  },
  postType: "court" | "player"
): Promise<{ postId: string | null; error: string | null }> {
  const payload = {
    body: input.body,
    title: input.title,
    post_type: postType,
    visibility: "public" as const,
    community_id: input.communityId,
  };

  if (input.postId) {
    const { error } = await supabase
      .from("posts")
      .update(payload)
      .eq("id", input.postId);

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

function isMissingCourtPostTypeError(message: string | undefined) {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("post_type") && lower.includes("court");
}

export async function syncClubCourtFeedPost(
  supabase: SupabaseClient,
  court: ClubCourt,
  community: CommunityRef,
  authorId: string
): Promise<{ postId: string | null; error: string | null }> {
  const minPrice = minPlanPrice(court);
  const communityId =
    court.rental_visibility === "members_only" ? community.id : null;

  const input = {
    authorId,
    title: clubCourtFeedTitle(court.name),
    body: clubCourtFeedBody(
      court.description,
      court.size_label,
      community.name,
      minPrice,
      court.rental_visibility ?? "members_only"
    ),
    postId: court.post_id ?? null,
    communityId,
  };

  let result = await writeCourtFeedPost(supabase, input, "court");
  if (result.error && isMissingCourtPostTypeError(result.error)) {
    result = await writeCourtFeedPost(supabase, input, "player");
  }

  return result;
}

export async function removeClubCourtFeedPost(
  supabase: SupabaseClient,
  postId: string | null
): Promise<void> {
  if (!postId) return;
  await supabase.from("posts").delete().eq("id", postId);
}
