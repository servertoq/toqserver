"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapPostRow } from "@/lib/feed";
import { formatAge, formatMemberSince, genderLabel, profilePath } from "@/lib/publicProfile";
import { addressFromRow, formatAddressLines, hasAddress } from "@/lib/address";
import { POST_SELECT } from "@/lib/posts";
import type { GenderType } from "@/lib/profile";
import type { FeedPost } from "@/types/feed";
import type { PublicProfile } from "@/types/profile";
import { useAppProfile } from "@/components/app/AppShell";
import { FeedTopBar } from "@/components/feed/FeedTopBar";
import { PostCard } from "@/components/feed/PostCard";
import { ProfilePresenceBadge } from "@/components/profile/ProfilePresenceBadge";
import { PublicProfileFriendActions } from "@/components/profile/PublicProfileFriendActions";
import { appContentClass } from "@/lib/layout";

type Props = { username: string };

export function PublicProfileView({ username }: Props) {
  const supabase = createClient();
  const viewer = useAppProfile();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isOwnProfile = profile?.id === viewer.id;

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);

    const { data: rows, error: profileErr } = await supabase.rpc("get_profile_by_username", {
      p_username: username,
    });

    const row = Array.isArray(rows) ? rows[0] : rows;
    if (profileErr || !row) {
      setError("Jogador não encontrado.");
      setProfile(null);
      setPosts([]);
      setLoading(false);
      return;
    }

    const { data: stats } = await supabase.rpc("get_profile_public_stats", {
      p_profile_id: row.id,
    });

    const stat = Array.isArray(stats) ? stats[0] : stats;

    setProfile({
      id: row.id,
      username: row.username,
      avatar_url: row.avatar_url,
      bio: row.bio ?? "",
      birth_date: row.birth_date,
      gender: row.gender as GenderType,
      created_at: row.created_at,
      post_count: Number(stat?.post_count ?? 0),
      friend_count: Number(stat?.friend_count ?? 0),
      last_seen_at: row.last_seen_at ?? null,
      address: addressFromRow(row),
    });

    const { data: rawPosts, error: postsErr } = await supabase
      .from("posts")
      .select(POST_SELECT)
      .eq("author_id", row.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (!postsErr && rawPosts) {
      const postIds = rawPosts.map((p) => p.id);
      const likesByPost: Record<string, number> = {};
      const commentsByPost: Record<string, number> = {};
      const likedSet = new Set<string>();

      if (postIds.length > 0) {
        const { data: likes } = await supabase
          .from("post_likes")
          .select("post_id, user_id")
          .in("post_id", postIds);

        for (const l of likes ?? []) {
          likesByPost[l.post_id] = (likesByPost[l.post_id] ?? 0) + 1;
          if (l.user_id === viewer.id) likedSet.add(l.post_id);
        }

        const { data: comments } = await supabase
          .from("post_comments")
          .select("post_id")
          .in("post_id", postIds);

        for (const c of comments ?? []) {
          commentsByPost[c.post_id] = (commentsByPost[c.post_id] ?? 0) + 1;
        }
      }

      setPosts(
        rawPosts.map((p) =>
          mapPostRow(
            p,
            likesByPost[p.id] ?? 0,
            commentsByPost[p.id] ?? 0,
            likedSet.has(p.id)
          )
        )
      );
    } else {
      setPosts([]);
    }

    setLoading(false);
  }, [supabase, username, viewer.id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleLikeToggle(postId: string, liked: boolean) {
    if (liked) {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: viewer.id });
    } else {
      await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", viewer.id);
    }
  }

  return (
    <>
      <FeedTopBar />
      <main className={appContentClass}>
        {loading ? (
          <p className="text-sm text-[var(--toq-text-muted)]">Carregando perfil…</p>
        ) : error || !profile ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-[var(--toq-navy)]">{error ?? "Perfil não encontrado"}</p>
            <Link href="/inicio" className="mt-3 inline-block text-sm font-semibold text-[var(--toq-sky)]">
              Voltar ao início
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <div className="flex shrink-0 flex-col items-center sm:items-start">
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="h-28 w-28 rounded-full object-cover ring-4 ring-[var(--toq-lime-light)]/40"
                    />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[var(--toq-sky)] text-4xl font-bold text-white">
                      {profile.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <ProfilePresenceBadge lastSeenAt={profile.last_seen_at} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold text-[var(--toq-navy)]">@{profile.username}</h1>
                    {isOwnProfile ? (
                      <Link
                        href="/inicio/perfil"
                        className="rounded-lg bg-[var(--toq-lime-light)] px-3 py-1 text-xs font-bold text-[var(--toq-navy)]"
                      >
                        Editar perfil
                      </Link>
                    ) : (
                      <PublicProfileFriendActions
                        viewerId={viewer.id}
                        profileId={profile.id}
                        profileUsername={profile.username}
                      />
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4">
                    <Stat label="Publicações" value={profile.post_count} />
                    <Stat label="Amigos" value={profile.friend_count} />
                  </div>

                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-[var(--toq-text-muted)]">Membro desde</dt>
                      <dd className="font-semibold text-[var(--toq-navy)]">
                        {formatMemberSince(profile.created_at)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--toq-text-muted)]">Idade</dt>
                      <dd className="font-semibold text-[var(--toq-navy)]">
                        {formatAge(profile.birth_date)} anos
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--toq-text-muted)]">Sexo</dt>
                      <dd className="font-semibold text-[var(--toq-navy)]">
                        {genderLabel(profile.gender)}
                      </dd>
                    </div>
                  </dl>

                  {hasAddress(profile.address) && (
                    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold text-[var(--toq-navy)]">Localização</p>
                      <address className="mt-1 space-y-0.5 text-sm not-italic leading-relaxed text-[var(--toq-text)]">
                        {formatAddressLines(profile.address).map((line) => (
                          <span key={line} className="block">
                            {line}
                          </span>
                        ))}
                      </address>
                    </div>
                  )}

                  {profile.bio ? (
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[var(--toq-text)]">
                      {profile.bio}
                    </p>
                  ) : (
                    <p className="mt-4 text-sm italic text-[var(--toq-text-muted)]">
                      Este jogador ainda não adicionou uma bio.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <section>
              <h2 className="mb-3 text-sm font-bold text-[var(--toq-navy)]">Publicações</h2>
              {posts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <p className="text-sm text-[var(--toq-text-muted)]">
                    Nenhuma publicação visível para você.
                  </p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {posts.map((post) => (
                    <li key={post.id}>
                      <PostCard
                        post={post}
                        currentUserId={viewer.id}
                        onLikeToggle={handleLikeToggle}
                        onCommentCountChange={() => {}}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center sm:text-left">
      <p className="text-xl font-bold text-[var(--toq-navy)]">
        {value.toLocaleString("pt-BR")}
      </p>
      <p className="text-xs text-[var(--toq-text-muted)]">{label}</p>
    </div>
  );
}
