export type DmConversationKind = "direct" | "community";

export type DmLastMessage = {
  body: string;
  sender_id: string;
  created_at: string;
  sender_username?: string | null;
};

type DmConversationBase = {
  id: string;
  kind: DmConversationKind;
  last_message_at: string;
  last_message: DmLastMessage | null;
  is_unread: boolean;
};

export type DmDirectConversation = DmConversationBase & {
  kind: "direct";
  other_user: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  is_friend: boolean;
};

export type DmCommunityConversation = DmConversationBase & {
  kind: "community";
  community: {
    id: string;
    name: string;
    slug: string;
    cover_image_url: string | null;
    group_kind: "community" | "club";
  };
};

export type DmConversation = DmDirectConversation | DmCommunityConversation;

export type DmMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: {
    username: string;
    avatar_url: string | null;
  } | null;
};

export type MessagesTab = "friends" | "pending" | "groups";

export function isDirectConversation(
  conv: DmConversation
): conv is DmDirectConversation {
  return conv.kind === "direct";
}

export function isCommunityConversation(
  conv: DmConversation
): conv is DmCommunityConversation {
  return conv.kind === "community";
}
