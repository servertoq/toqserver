"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchCoachListingsForPosts, mapPostRow } from "@/lib/feed";
import { enrichPostsWithStaffRoles } from "@/lib/staff";
import { addressFromRow } from "@/lib/address";
import { POST_SELECT } from "@/lib/posts";
import type { GenderType, PlayerLevelType } from "@/lib/profile";
import type { UserPlan } from "@/types/plans";
import type { StaffRole } from "@/types/staff";
import type { FeedPost } from "@/types/feed";
import type { PublicProfile } from "@/types/profile";
import { useAppProfile } from "@/components/app/AppShell";
import { FeedTopBar } from "@/components/feed/FeedTopBar";
import { PlayerProfileDashboard } from "@/components/profile/PlayerProfileDashboard";
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

    const { data: staffRole } = await supabase.rpc("get_staff_role", {
      p_user_id: row.id,
    });

    const stat = Array.isArray(stats) ? stats[0] : stats;

    setProfile({
      id: row.id,
      username: row.username,
      display_name: row.display_name ?? null,
      avatar_url: row.avatar_url,
      bio: row.bio ?? "",
      birth_date: row.birth_date,
      gender: row.gender as GenderType,
      player_level: (row.player_level as PlayerLevelType) ?? "iniciante",
      plan: (row.plan as UserPlan) ?? "free",
      staff_role: (staffRole as StaffRole | null) ?? null,
      created_at: row.created_at,
      post_count: Number(stat?.post_count ?? 0),
      friend_count: Number(stat?.friend_count ?? 0),
      club_count: Number(stat?.club_count ?? 0),
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

      const coachListingsByPostId = await fetchCoachListingsForPosts(supabase, postIds);

      setPosts(
        await enrichPostsWithStaffRoles(
          supabase,
          rawPosts.map((p) =>
            mapPostRow(
              p,
              likesByPost[p.id] ?? 0,
              commentsByPost[p.id] ?? 0,
              likedSet.has(p.id),
              new Set(coachListingsByPostId.keys()),
              coachListingsByPostId
            )
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
    await load();
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
          <PlayerProfileDashboard
            profileId={profile.id}
            username={profile.username}
            displayName={profile.display_name}
            avatarUrl={profile.avatar_url}
            bio={profile.bio}
            birthDate={profile.birth_date}
            gender={profile.gender}
            playerLevel={profile.player_level}
            createdAt={profile.created_at}
            postCount={profile.post_count}
            friendCount={profile.friend_count}
            clubCount={profile.club_count}
            lastSeenAt={profile.last_seen_at}
            address={profile.address}
            plan={profile.plan}
            staffRole={profile.staff_role}
            posts={posts}
            currentUserId={viewer.id}
            isOwnProfile={isOwnProfile}
            onLikeToggle={handleLikeToggle}
            headerActions={
              isOwnProfile ? (
                <Link
                  href="/inicio/perfil"
                  className="block w-full rounded-xl bg-[var(--toq-profile-accent)] py-2 text-center text-xs font-bold text-white transition hover:opacity-90"
                >
                  Editar perfil
                </Link>
              ) : (
                <PublicProfileFriendActions
                  viewerId={viewer.id}
                  profileId={profile.id}
                  profileUsername={profile.username}
                  reportTarget={{
                    type: "profile",
                    id: profile.id,
                    label: `perfil @${profile.username}`,
                  }}
                />
              )
            }
          />
        )}
      </main>
    </>
  );
}
