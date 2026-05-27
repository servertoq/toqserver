"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapCourtRow } from "@/lib/courts";
import type { Court } from "@/types/courts";
import { CourtForm } from "@/components/courts/CourtForm";
import { useParams } from "next/navigation";

export default function EditarQuadraPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const [court, setCourt] = useState<Court | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("courts").select("*").eq("id", id).maybeSingle();
      if (data) setCourt(mapCourtRow(data));
      setLoading(false);
    })();
  }, [id, supabase]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="text-sm text-[var(--toq-text-muted)]">Carregando…</p>
      </div>
    );
  }

  if (!court) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-red-600">Quadra não encontrada ou sem permissão.</p>
      </div>
    );
  }

  return <CourtForm initial={court} />;
}
