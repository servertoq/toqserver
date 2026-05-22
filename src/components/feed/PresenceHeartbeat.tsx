"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const INTERVAL_MS = 45_000;

export function PresenceHeartbeat() {
  useEffect(() => {
    const supabase = createClient();

    async function touch() {
      await supabase.rpc("touch_presence");
    }

    touch();

    const interval = setInterval(touch, INTERVAL_MS);

    function onVisibility() {
      if (document.visibilityState === "visible") touch();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", touch);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", touch);
    };
  }, []);

  return null;
}
