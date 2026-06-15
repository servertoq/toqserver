"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { appContentClass } from "@/lib/layout";
import { MessagesInbox } from "@/components/messages/MessagesInbox";

function MensagensPageInner() {
  const searchParams = useSearchParams();
  const chat = searchParams.get("chat");
  const conversationId = searchParams.get("c");
  const communityId = searchParams.get("g");

  return (
    <main className={`${appContentClass} flex min-h-0 flex-col !py-3 md:!py-6`}>
      <MessagesInbox
        variant="page"
        initialUsername={chat}
        initialConversationId={conversationId}
        initialCommunityId={communityId}
      />
    </main>
  );
}

export default function MensagensPage() {
  return (
    <Suspense
      fallback={
        <main className={appContentClass}>
          <p className="text-sm text-[var(--toq-text-muted)]">Carregando mensagens…</p>
        </main>
      }
    >
      <MensagensPageInner />
    </Suspense>
  );
}
