"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  resolveUserLocationAnchor,
  type UserLocationAnchor,
} from "@/lib/nearbyLocation";

export function useUserLocationAnchor(userId: string | null | undefined) {
  const [anchor, setAnchor] = useState<UserLocationAnchor | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!userId) {
      setAnchor(null);
      setReady(true);
      return;
    }

    let cancelled = false;
    const supabase = createClient();
    setReady(false);

    void resolveUserLocationAnchor(supabase, userId).then((resolved) => {
      if (cancelled) return;
      setAnchor(resolved);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { anchor, ready };
}
