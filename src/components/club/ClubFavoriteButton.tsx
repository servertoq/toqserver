"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  communityId: string;
  favorited: boolean;
  onChange?: (favorited: boolean) => void;
  className?: string;
};

export function ClubFavoriteButton({
  communityId,
  favorited,
  onChange,
  className = "",
}: Props) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [localFav, setLocalFav] = useState(favorited);

  useEffect(() => {
    setLocalFav(favorited);
  }, [favorited]);

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    const next = !localFav;
    setBusy(true);
    setLocalFav(next);
    onChange?.(next);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLocalFav(!next);
      onChange?.(!next);
      setBusy(false);
      return;
    }

    if (next) {
      const { error } = await supabase.from("community_favorites").insert({
        user_id: user.id,
        community_id: communityId,
      });
      if (error) {
        setLocalFav(false);
        onChange?.(false);
      }
    } else {
      const { error } = await supabase
        .from("community_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("community_id", communityId);
      if (error) {
        setLocalFav(true);
        onChange?.(true);
      }
    }

    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={(e) => void toggle(e)}
      disabled={busy}
      aria-pressed={localFav}
      aria-label={localFav ? "Remover dos favoritos" : "Favoritar clube"}
      title={localFav ? "Remover dos favoritos" : "Favoritar clube"}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-60 ${
        localFav
          ? "border-amber-400/50 bg-amber-500/15 text-amber-400"
          : "border-[var(--toq-border)] bg-[var(--toq-card)] text-[var(--toq-text-muted)] hover:border-amber-400/50 hover:text-amber-400"
      } ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill={localFav ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}
