"use client";

import Link from "next/link";
import { use } from "react";
import { FeedTopBar } from "@/components/feed/FeedTopBar";
import { appContentClass } from "@/lib/layout";

export default function ConversarPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const decoded = decodeURIComponent(username);

  return (
    <>
      <FeedTopBar />
      <main className={appContentClass}>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold text-[var(--toq-navy)]">Conversar com @{decoded}</h1>
          <p className="mt-2 text-sm text-[var(--toq-text-muted)]">
            O chat direto entre jogadores estará disponível em breve.
          </p>
          <Link
            href="/inicio"
            className="mt-4 inline-block text-sm font-semibold text-[var(--toq-sky)] hover:underline"
          >
            Voltar ao início
          </Link>
        </div>
      </main>
    </>
  );
}
