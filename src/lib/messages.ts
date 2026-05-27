import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DmCommunityConversation,
  DmConversation,
  DmDirectConversation,
  DmMessage,
} from "@/types/messages";
import { groupDetailHref } from "@/lib/communityGroup";

type RawDirectConversation = {
  id: string;
  kind: "direct";
  user_low: string;
  user_high: string;
  last_message_at: string;
  messages: {
    body: string;
    sender_id: string;
    created_at: string;
  }[] | null;
};

type RawCommunityConversation = {
  id: string;
  kind: "community";
  community_id: string;
  last_message_at: string;
  community: {
    id: string;
    name: string;
    slug: string;
    cover_image_url: string | null;
    kind: "community" | "club" | null;
  } | null;
  messages: {
    body: string;
    sender_id: string;
    created_at: string;
    sender: { username: string } | { username: string }[] | null;
  }[] | null;
};

export function otherUserIdFromConversation(
  row: Pick<RawDirectConversation, "user_low" | "user_high">,
  viewerId: string
) {
  return row.user_low === viewerId ? row.user_high : row.user_low;
}

export function conversationTitle(conv: DmConversation): string {
  if (conv.kind === "community") return conv.community.name;
  return conv.other_user.username;
}

export function conversationAvatar(conv: DmConversation): string | null {
  if (conv.kind === "community") return conv.community.cover_image_url;
  return conv.other_user.avatar_url;
}

export function conversationHref(conv: DmConversation): string | null {
  if (conv.kind === "community") {
    return groupDetailHref(conv.community.group_kind, conv.community.slug);
  }
  return null;
}

export async function loadFriendIds(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  const { data } = await supabase
    .from("friendships")
    .select("user_id, friend_id")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

  const ids = new Set<string>();
  for (const row of data ?? []) {
    ids.add(row.user_id === userId ? row.friend_id : row.user_id);
  }
  return ids;
}

export async function markConversationRead(
  supabase: SupabaseClient,
  conversationId: string
): Promise<void> {
  await supabase.rpc("mark_dm_conversation_read", {
    p_conversation_id: conversationId,
  });
}

export function computeIsUnread(
  lastMessage: { sender_id: string; created_at: string } | null,
  userId: string,
  lastReadAt: string | null
): boolean {
  if (!lastMessage) return false;
  if (lastMessage.sender_id === userId) return false;
  if (!lastReadAt) return true;
  return new Date(lastMessage.created_at).getTime() > new Date(lastReadAt).getTime();
}

function pickLastMessage<T extends { created_at: string }>(messages: T[] | null | undefined): T | null {
  if (!messages?.length) return null;
  return [...messages].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];
}

function profileSenderUsername(
  sender: { username: string } | { username: string }[] | null | undefined
): string | null {
  if (!sender) return null;
  if (Array.isArray(sender)) return sender[0]?.username ?? null;
  return sender.username;
}

async function loadReadMap(
  supabase: SupabaseClient,
  userId: string,
  conversationIds: string[]
): Promise<Map<string, string>> {
  if (!conversationIds.length) return new Map();

  const { data: reads } = await supabase
    .from("dm_conversation_reads")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId)
    .in("conversation_id", conversationIds);

  return new Map<string, string>(
    (reads ?? []).map((r) => [r.conversation_id, r.last_read_at as string])
  );
}

async function fetchDirectConversations(
  supabase: SupabaseClient,
  userId: string,
  friendIds: Set<string>
): Promise<DmDirectConversation[]> {
  const { data: rows, error } = await supabase
    .from("dm_conversations")
    .select(
      `
      id,
      kind,
      user_low,
      user_high,
      last_message_at,
      messages:dm_messages(body, sender_id, created_at)
    `
    )
    .eq("kind", "direct")
    .or(`user_low.eq.${userId},user_high.eq.${userId}`)
    .order("last_message_at", { ascending: false })
    .order("created_at", { referencedTable: "dm_messages", ascending: false })
    .limit(1, { referencedTable: "dm_messages" });

  if (error || !rows?.length) return [];

  const typed = rows as RawDirectConversation[];
  const otherIds = typed.map((row) => otherUserIdFromConversation(row, userId));

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", otherIds);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const result: DmDirectConversation[] = [];

  for (const row of typed) {
    const otherId = otherUserIdFromConversation(row, userId);
    const profile = profileById.get(otherId);
    if (!profile) continue;

    const lastMessage = pickLastMessage(row.messages);

    result.push({
      id: row.id,
      kind: "direct",
      last_message_at: row.last_message_at,
      other_user: profile,
      last_message: lastMessage,
      is_friend: friendIds.has(otherId),
      is_unread: false,
    });
  }

  return result;
}

async function fetchCommunityConversations(
  supabase: SupabaseClient,
  userId: string
): Promise<DmCommunityConversation[]> {
  const { data: rows, error } = await supabase
    .from("dm_conversations")
    .select(
      `
      id,
      kind,
      community_id,
      last_message_at,
      community:communities!inner(
        id,
        name,
        slug,
        cover_image_url,
        kind
      ),
      messages:dm_messages(
        body,
        sender_id,
        created_at,
        sender:profiles!dm_messages_sender_id_fkey(username)
      )
    `
    )
    .eq("kind", "community")
    .order("last_message_at", { ascending: false })
    .order("created_at", { referencedTable: "dm_messages", ascending: false })
    .limit(1, { referencedTable: "dm_messages" });

  if (error || !rows?.length) return [];

  const result: DmCommunityConversation[] = [];

  for (const row of rows as unknown as RawCommunityConversation[]) {
    const communityRow = Array.isArray(row.community) ? row.community[0] : row.community;
    if (!communityRow) continue;

    const lastRaw = pickLastMessage(row.messages);
    const lastMessage = lastRaw
      ? {
          body: lastRaw.body,
          sender_id: lastRaw.sender_id,
          created_at: lastRaw.created_at,
          sender_username: profileSenderUsername(lastRaw.sender),
        }
      : null;

    result.push({
      id: row.id,
      kind: "community",
      last_message_at: row.last_message_at,
      community: {
        id: communityRow.id,
        name: communityRow.name,
        slug: communityRow.slug,
        cover_image_url: communityRow.cover_image_url,
        group_kind: communityRow.kind === "club" ? "club" : "community",
      },
      last_message: lastMessage,
      is_unread: false,
    });
  }

  return result;
}

export async function fetchConversations(
  supabase: SupabaseClient,
  userId: string
): Promise<DmConversation[]> {
  const friendIds = await loadFriendIds(supabase, userId);

  const [direct, community] = await Promise.all([
    fetchDirectConversations(supabase, userId, friendIds),
    fetchCommunityConversations(supabase, userId),
  ]);

  const merged = [...direct, ...community];
  const conversationIds = merged.map((c) => c.id);
  const reads = await loadReadMap(supabase, userId, conversationIds);

  for (const conv of merged) {
    const lastMessage = conv.last_message;
    conv.is_unread = computeIsUnread(
      lastMessage,
      userId,
      reads.get(conv.id) ?? null
    );
  }

  return merged.sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  );
}

export async function getOrCreateConversation(
  supabase: SupabaseClient,
  otherUserId: string
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("get_or_create_dm_conversation", {
    p_other_user_id: otherUserId,
  });

  if (error) return { id: null, error: error.message };
  return { id: data as string, error: null };
}

export async function getOrCreateCommunityConversation(
  supabase: SupabaseClient,
  communityId: string
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("get_or_create_community_dm_conversation", {
    p_community_id: communityId,
  });

  if (error) return { id: null, error: error.message };
  return { id: data as string, error: null };
}

export type MessageSearchProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
};

export async function searchProfilesForMessages(
  supabase: SupabaseClient,
  query: string,
  excludeUserId: string,
  limit = 8
): Promise<MessageSearchProfile[]> {
  const q = query.trim().replace(/^@/, "");
  if (q.length < 2) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .ilike("username", `%${q}%`)
    .neq("id", excludeUserId)
    .order("username")
    .limit(limit);

  if (error) return [];
  return data ?? [];
}

export async function findProfileByUsername(
  supabase: SupabaseClient,
  username: string
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .eq("username", username)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

type RawDmMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?:
    | { username: string; avatar_url: string | null }
    | { username: string; avatar_url: string | null }[]
    | null;
};

function mapMessageRow(row: RawDmMessageRow): DmMessage {
  const sender = row.sender;
  const normalizedSender = Array.isArray(sender) ? sender[0] : sender;

  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    body: row.body,
    created_at: row.created_at,
    sender: normalizedSender ?? null,
  };
}

export async function fetchMessages(
  supabase: SupabaseClient,
  conversationId: string,
  options?: { includeSenders?: boolean }
): Promise<DmMessage[]> {
  const includeSenders = options?.includeSenders ?? false;

  if (includeSenders) {
    const { data, error } = await supabase
      .from("dm_messages")
      .select(
        "id, conversation_id, sender_id, body, created_at, sender:profiles!dm_messages_sender_id_fkey(username, avatar_url)"
      )
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) return [];
    return ((data ?? []) as RawDmMessageRow[]).map(mapMessageRow);
  }

  const { data, error } = await supabase
    .from("dm_messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return [];
  return ((data ?? []) as RawDmMessageRow[]).map(mapMessageRow);
}

export async function sendMessage(
  supabase: SupabaseClient,
  conversationId: string,
  senderId: string,
  body: string
): Promise<{ error: string | null }> {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Mensagem vazia." };

  const { error } = await supabase.from("dm_messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body: trimmed,
  });

  return { error: error?.message ?? null };
}

export async function deleteConversation(
  supabase: SupabaseClient,
  conversationId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("dm_conversations")
    .delete()
    .eq("id", conversationId);

  return { error: error?.message ?? null };
}

export function formatMessageTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
