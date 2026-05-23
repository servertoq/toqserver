"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { appContentClass } from "@/lib/layout";
import { MessagesInbox } from "@/components/messages/MessagesInbox";

function MensagensPageInner() {
  const searchParams = useSearchParams();
  const chat = searchParams.get("chat");
  const conversationId = searchParams.get("c");

  return (
    <main className={`${appContentClass} !py-4 md:!py-6`}>
      <MessagesInbox
        variant="page"
        initialUsername={chat}
        initialConversationId={conversationId}
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
