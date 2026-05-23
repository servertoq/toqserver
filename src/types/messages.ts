export type DmConversation = {
  id: string;
  last_message_at: string;
  other_user: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  last_message: {
    body: string;
    sender_id: string;
    created_at: string;
  } | null;
  is_friend: boolean;
  is_unread: boolean;
};

export type DmMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type MessagesTab = "friends" | "pending";
