"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMemberSince } from "@/lib/publicProfile";
import { groupDetailHref } from "@/lib/communityGroup";
import type { CommunityGroupKind } from "@/types/community";

export type ProfileClubRow = {
  community_id: string;
  name: string;
  slug: string;
  cover_image_url: string | null;
  kind: CommunityGroupKind;
  joined_at: string | null;
};

type Props = {
  profileId: string;
  title?: string;
};

export function ProfileClubsList({
  profileId,
  title = "Clubes que participa",
}: Props) {
  const supabase = createClient();
  const [clubs, setClubs] = useState<ProfileClubRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("get_profile_clubs", {
        p_profile_id: profileId,
      });
      if (cancelled) return;
      setClubs((data ?? []) as ProfileClubRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId, supabase]);

  return (
    <section>
      <p className="profile-section-label">{title}</p>
      {loading ? (
        <p className="mt-3 text-sm text-[var(--toq-profile-muted)]">Carregando…</p>
      ) : clubs.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--toq-profile-muted)]">
          Não participa de nenhum clube ainda.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--toq-profile-border)] overflow-hidden rounded-2xl border border-[var(--toq-profile-border)] bg-[var(--toq-card)]">
          {clubs.map((c) => (
            <li key={c.community_id}>
              <Link
                href={groupDetailHref(c.kind === "club" ? "club" : "community", c.slug)}
                className="flex items-center gap-3 px-3 py-3 transition hover:bg-slate-50"
              >
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  {c.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.cover_image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">
                      {c.name.slice(0, 1)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--toq-profile-navy)]">
                    {c.name}
                  </p>
                  {c.joined_at && (
                    <p className="text-[11px] text-[var(--toq-profile-muted)]">
                      Membro desde {formatMemberSince(c.joined_at)}
                    </p>
                  )}
                </div>
                <svg
                  className="h-4 w-4 shrink-0 text-slate-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
