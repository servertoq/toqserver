import type { SupabaseClient } from "@supabase/supabase-js";
import { groupDetailHref } from "@/lib/communityGroup";
import { profilePath } from "@/lib/publicProfile";
import type { ReportTargetType, SupportTicketWithReporter } from "@/types/support";

const TICKET_SELECT = `
  id,
  user_id,
  topic,
  title,
  description,
  image_url,
  target_type,
  target_id,
  status,
  created_at,
  resolved_at,
  resolved_by,
  resolution_note,
  read_at,
  resolution_outcome,
  reporter:profiles!support_tickets_user_id_fkey(id, username, avatar_url, email)
`;

export function mapTicketRow(row: Record<string, unknown>): SupportTicketWithReporter {
  const reporter = Array.isArray(row.reporter) ? row.reporter[0] : row.reporter;
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    topic: row.topic as SupportTicketWithReporter["topic"],
    title: row.title as string,
    description: row.description as string,
    image_url: (row.image_url as string | null) ?? null,
    target_type: (row.target_type as ReportTargetType | null) ?? null,
    target_id: (row.target_id as string | null) ?? null,
    status: row.status as SupportTicketWithReporter["status"],
    created_at: row.created_at as string,
    resolved_at: (row.resolved_at as string | null) ?? null,
    resolved_by: (row.resolved_by as string | null) ?? null,
    resolution_note: (row.resolution_note as string | null) ?? null,
    read_at: (row.read_at as string | null) ?? null,
    resolution_outcome: (row.resolution_outcome as "upheld" | "dismissed" | null) ?? null,
    reporter: reporter as SupportTicketWithReporter["reporter"],
  };
}

export async function loadStaffTickets(
  supabase: SupabaseClient,
  topic: "report" | "suggestion" | "help"
) {
  const { data, error } = await supabase
    .from("support_tickets")
    .select(TICKET_SELECT)
    .eq("topic", topic)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapTicketRow(row as Record<string, unknown>));
}

export async function resolveReportTargetHref(
  supabase: SupabaseClient,
  targetType: ReportTargetType | null,
  targetId: string | null
): Promise<string | null> {
  if (!targetType || !targetId) return null;

  if (targetType === "profile") {
    const { data } = await supabase.from("profiles").select("username").eq("id", targetId).maybeSingle();
    return data?.username ? profilePath(data.username) : null;
  }

  if (targetType === "community") {
    const { data } = await supabase
      .from("communities")
      .select("slug, kind")
      .eq("id", targetId)
      .maybeSingle();
    return data?.slug ? groupDetailHref(data.kind ?? "community", data.slug) : null;
  }

  if (targetType === "post") {
    const { data } = await supabase
      .from("posts")
      .select("id, community_id, communities(slug, kind)")
      .eq("id", targetId)
      .maybeSingle();
    if (!data) return "/inicio";
    const comm = Array.isArray(data.communities) ? data.communities[0] : data.communities;
    const base = comm?.slug
      ? groupDetailHref(comm.kind ?? "community", comm.slug)
      : "/inicio";
    return `${base}?post=${data.id}`;
  }

  if (targetType === "comment") {
    const { data } = await supabase
      .from("post_comments")
      .select("id, post_id, posts(id, community_id, communities(slug, kind))")
      .eq("id", targetId)
      .maybeSingle();
    if (!data?.post_id) return "/inicio";
    const post = Array.isArray(data.posts) ? data.posts[0] : data.posts;
    const comm = post
      ? Array.isArray(post.communities)
        ? post.communities[0]
        : post.communities
      : null;
    const base = comm?.slug
      ? groupDetailHref(comm.kind ?? "community", comm.slug)
      : "/inicio";
    return `${base}?post=${data.post_id}&comment=${data.id}`;
  }

  return null;
}

export function ticketStatusLabel(status: string) {
  if (status === "resolved") return "Resolvido";
  if (status === "in_progress") return "Em andamento";
  return "Aberto";
}
