import type { SupabaseClient } from "@supabase/supabase-js";
import type { StaffRole } from "@/types/staff";
import type { SupportTopic } from "@/types/support";
import type { FeedComment, FeedPost } from "@/types/feed";

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  ceo: "CEO",
  cto: "CTO",
  moderator: "Moderador",
  marketing: "Marketing",
};

export function staffRoleFromEmbed(
  embed: { role: StaffRole } | { role: StaffRole }[] | null | undefined
): StaffRole | null {
  if (embed == null) return null;
  const row = Array.isArray(embed) ? embed[0] : embed;
  return row?.role ?? null;
}

/** Usa RPC SECURITY DEFINER — não depende de RLS em staff_members. */
export async function fetchStaffRolesByUserId(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, StaffRole>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const out = new Map<string, StaffRole>();
  if (unique.length === 0) return out;

  await Promise.all(
    unique.map(async (id) => {
      const { data } = await supabase.rpc("get_staff_role", { p_user_id: id });
      if (data) out.set(id, data as StaffRole);
    })
  );
  return out;
}

export async function enrichPostsWithStaffRoles(
  supabase: SupabaseClient,
  posts: FeedPost[]
): Promise<FeedPost[]> {
  if (posts.length === 0) return posts;
  const roles = await fetchStaffRolesByUserId(
    supabase,
    posts.map((p) => p.author.id)
  );
  return posts.map((p) => ({
    ...p,
    author: { ...p.author, staff_role: roles.get(p.author.id) ?? null },
  }));
}

export async function enrichCommentsWithStaffRoles(
  supabase: SupabaseClient,
  comments: FeedComment[]
): Promise<FeedComment[]> {
  const ids: string[] = [];
  const walk = (list: FeedComment[]) => {
    for (const c of list) {
      ids.push(c.author.id);
      if (c.replies?.length) walk(c.replies);
    }
  };
  walk(comments);
  const roles = await fetchStaffRolesByUserId(supabase, ids);

  const apply = (list: FeedComment[]): FeedComment[] =>
    list.map((c) => ({
      ...c,
      author: { ...c.author, staff_role: roles.get(c.author.id) ?? null },
      replies: apply(c.replies ?? []),
    }));

  return apply(comments);
}

export function isStaffAdmin(role: StaffRole | null): boolean {
  return role === "ceo" || role === "cto";
}

export function canModeratePlatform(role: StaffRole | null): boolean {
  return role === "ceo" || role === "cto" || role === "moderator";
}

export function canAccessTicketBox(role: StaffRole | null, topic: SupportTopic): boolean {
  if (!role) return false;
  if (canModeratePlatform(role)) return true;
  return role === "marketing" && topic === "suggestion";
}

export function canManageStaff(role: StaffRole | null): boolean {
  return isStaffAdmin(role);
}

export function canManageAdvertising(role: StaffRole | null): boolean {
  return role === "ceo" || role === "cto" || role === "marketing";
}

export function canAccessClubRecommendations(role: StaffRole | null): boolean {
  if (!role) return false;
  if (canModeratePlatform(role)) return true;
  return role === "marketing";
}
