"use client";

import { MessagesInbox } from "./MessagesInbox";
import type { DmConversation } from "@/types/messages";

type Props = {
  onClose: () => void;
  initialUsername?: string | null;
  onInitialUsernameHandled?: () => void;
  onConversationsChange?: (list: DmConversation[]) => void;
};

export function MessagesPopup({
  onClose,
  initialUsername,
  onInitialUsernameHandled,
  onConversationsChange,
}: Props) {
  return (
    <MessagesInbox
      variant="popup"
      onClose={onClose}
      initialUsername={initialUsername}
      onInitialUsernameHandled={onInitialUsernameHandled}
      onConversationsChange={onConversationsChange}
    />
  );
}
