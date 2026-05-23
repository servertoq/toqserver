"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppProfile } from "@/components/app/AppShell";
import { createClient } from "@/lib/supabase/client";
import { fetchConversations } from "@/lib/messages";
import type { DmConversation } from "@/types/messages";
import {
  floatingMessagesDockClass,
  floatingMessagesPopupClass,
} from "./FloatingMessages";
import { MessagesPopup } from "./MessagesPopup";

export function FloatingMessagesInner() {
  const profile = useAppProfile();
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [initialUsername, setInitialUsername] = useState<string | null>(null);
  const handledChatParam = useRef(false);

  const loadList = useCallback(async () => {
    const list = await fetchConversations(supabase, profile.id);
    setConversations(list);
    return list;
  }, [profile.id, supabase]);

  useEffect(() => {
    loadList();
    const interval = window.setInterval(loadList, 15000);
    return () => window.clearInterval(interval);
  }, [loadList]);

  useEffect(() => {
    const chat = searchParams.get("chat");
    if (!chat || handledChatParam.current) return;
    handledChatParam.current = true;
    setInitialUsername(chat);
    setOpen(true);
    router.replace("/inicio", { scroll: false });
  }, [router, searchParams]);

  const unreadCount = useMemo(() => {
    return conversations.filter((c) => c.is_unread).length;
  }, [conversations]);

  const previewAvatars = useMemo(() => {
    return conversations
      .filter((c) => c.is_unread)
      .slice(0, 2)
      .map((c) => c.other_user);
  }, [conversations]);

  if (pathname.startsWith("/inicio/mensagens")) {
    return null;
  }

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-[55] bg-black/20 md:bg-transparent"
          aria-label="Fechar mensagens"
          onClick={() => setOpen(false)}
        />
      )}
      {open && (
        <div className={floatingMessagesPopupClass}>
          <MessagesPopup
            initialUsername={initialUsername}
            onInitialUsernameHandled={() => setInitialUsername(null)}
            onClose={() => {
              setOpen(false);
              setInitialUsername(null);
            }}
            onConversationsChange={setConversations}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${floatingMessagesDockClass} flex items-center gap-2 rounded-full bg-zinc-800 py-2 pl-2 pr-3 text-white shadow-[0_4px_24px_rgba(0,0,0,0.35)] transition hover:bg-zinc-700`}
        aria-expanded={open}
        aria-label="Mensagens"
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-700">
          <MessengerIcon />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </span>
        <span className="text-[15px] font-semibold">Mensagens</span>
        {previewAvatars.length > 0 && (
          <span className="ml-1 flex -space-x-2">
            {previewAvatars.map((user) => (
              <span
                key={user.id}
                className="inline-flex h-7 w-7 overflow-hidden rounded-full ring-2 ring-zinc-800"
              >
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-[var(--toq-sky)] text-[10px] font-bold">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
            ))}
          </span>
        )}
      </button>
    </>
  );
}

function MessengerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 text-white"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.8-4.2A7.8 7.8 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}
