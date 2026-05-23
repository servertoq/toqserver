"use client";

import { useRouter } from "next/navigation";
import { use, useEffect } from "react";

export default function ConversarPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const router = useRouter();
  const decoded = decodeURIComponent(username);

  useEffect(() => {
    router.replace(`/inicio/mensagens?chat=${encodeURIComponent(decoded)}`);
  }, [decoded, router]);

  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <p className="text-sm text-[var(--toq-text-muted)]">Abrindo conversa…</p>
    </div>
  );
}
