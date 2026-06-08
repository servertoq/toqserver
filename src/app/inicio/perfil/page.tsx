"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { FeedTopBar } from "@/components/feed/FeedTopBar";
import { appContentClass } from "@/lib/layout";
import type { GenderType } from "@/lib/profile";
import { FriendsPanel } from "@/components/profile/FriendsPanel";
import { ProfileEditForm, type EditableProfile } from "@/components/profile/ProfileEditForm";
import { PlayerProfileDashboard } from "@/components/profile/PlayerProfileDashboard";
import { addressFromRow } from "@/lib/address";
import { mapPostRow } from "@/lib/feed";
import { POST_SELECT } from "@/lib/posts";
import type { FeedPost } from "@/types/feed";

export default function PerfilPage() {
  const appProfile = useAppProfile();
  const supabase = createClient();
  const [profile, setProfile] = useState<EditableProfile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, username, email, avatar_url, birth_date, gender, bio, created_at, address_zip, address_street, address_number, address_neighborhood, address_complement, address_city, address_state"
      )
      .eq("id", appProfile.id)
      .single();

    if (data) {
      setProfile({
        ...data,
        id: data.id ?? appProfile.id,
        gender: data.gender as GenderType,
        bio: data.bio ?? "",
        address: addressFromRow(data),
      });
    } else {
      setProfile(null);
    }

    const { data: stats } = await supabase.rpc("get_profile_public_stats", {
      p_profile_id: appProfile.id,
    });
    const stat = Array.isArray(stats) ? stats[0] : stats;
    setFriendCount(Number(stat?.friend_count ?? 0));
    setPostCount(Number(stat?.post_count ?? 0));

    const { data: rawPosts } = await supabase
      .from("posts")
      .select(POST_SELECT)
      .eq("author_id", appProfile.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (rawPosts) {
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
          if (l.user_id === appProfile.id) likedSet.add(l.post_id);
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
  }, [appProfile.id, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSaved() {
    load();
    window.location.reload();
  }

  async function handleLikeToggle(postId: string, liked: boolean) {
    if (liked) {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: appProfile.id });
    } else {
      await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", appProfile.id);
    }
    await load();
  }

  return (
    <>
      <FeedTopBar />
      <main className={appContentClass}>
        {loading ? (
          <p className="text-sm text-[var(--toq-text-muted)]">Carregando perfil…</p>
        ) : profile ? (
          <PlayerProfileDashboard
            username={profile.username}
            avatarUrl={profile.avatar_url}
            bio={profile.bio}
            birthDate={profile.birth_date}
            gender={profile.gender}
            createdAt={profile.created_at}
            postCount={postCount}
            friendCount={friendCount}
            address={profile.address}
            posts={posts}
            currentUserId={appProfile.id}
            isOwnProfile
            onLikeToggle={handleLikeToggle}
            friendsPanel={<FriendsPanel userId={appProfile.id} embedded />}
            editForm={<ProfileEditForm initial={profile} onSaved={handleSaved} />}
          />
        ) : (
          <p className="text-sm text-red-600">
            Não foi possível carregar o perfil. Execute a migration 007_profiles_bio.sql no
            Supabase se o campo bio ainda não existir.
          </p>
        )}
      </main>
    </>
  );
}
