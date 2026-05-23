import type { SupabaseClient } from "@supabase/supabase-js";
import type { DmConversation, DmMessage } from "@/types/messages";

type RawConversation = {
  id: string;
  user_low: string;
  user_high: string;
  last_message_at: string;
  messages: { body: string; sender_id: string; created_at: string }[] | null;
};

export function otherUserIdFromConversation(
  row: Pick<RawConversation, "user_low" | "user_high">,
  viewerId: string
) {
  return row.user_low === viewerId ? row.user_high : row.user_low;
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

export async function markConversationRead(
  supabase: SupabaseClient,
  conversationId: string
): Promise<void> {
  await supabase.rpc("mark_dm_conversation_read", {
    p_conversation_id: conversationId,
  });
}

export async function fetchConversations(
  supabase: SupabaseClient,
  userId: string
): Promise<DmConversation[]> {
  const { data: rows, error } = await supabase
    .from("dm_conversations")
    .select(
      `
      id,
      user_low,
      user_high,
      last_message_at,
      messages:dm_messages(body, sender_id, created_at)
    `
    )
    .or(`user_low.eq.${userId},user_high.eq.${userId}`)
    .order("last_message_at", { ascending: false })
    .order("created_at", { referencedTable: "dm_messages", ascending: false })
    .limit(1, { referencedTable: "dm_messages" });

  if (error || !rows?.length) return [];

  const conversationIds = rows.map((r) => r.id);
  const { data: reads } = await supabase
    .from("dm_conversation_reads")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId)
    .in("conversation_id", conversationIds);

  const readByConversation = new Map<string, string>(
    (reads ?? []).map((r) => [r.conversation_id, r.last_read_at as string])
  );

  const friendIds = await loadFriendIds(supabase, userId);
  const otherIds = rows.map((row) => otherUserIdFromConversation(row, userId));

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", otherIds);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const result: DmConversation[] = [];

  for (const row of rows) {
    const otherId = otherUserIdFromConversation(row, userId);
    const profile = profileById.get(otherId);
    if (!profile) continue;

    const messages = [...(row.messages ?? [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const lastMessage = messages[0] ?? null;

    result.push({
      id: row.id,
      last_message_at: row.last_message_at,
      other_user: profile,
      last_message: lastMessage,
      is_friend: friendIds.has(otherId),
      is_unread: computeIsUnread(
        lastMessage,
        userId,
        readByConversation.get(row.id) ?? null
      ),
    });
  }

  return result;
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

export async function fetchMessages(
  supabase: SupabaseClient,
  conversationId: string
): Promise<DmMessage[]> {
  const { data, error } = await supabase
    .from("dm_messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return [];
  return data ?? [];
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
