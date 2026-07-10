"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchClubCourtsForPosts, fetchCoachListingsForPosts, mapPostRow } from "@/lib/feed";
import type { FeedPost } from "@/types/feed";
import type { AgendaEvent } from "@/types/agenda";
import {
  addDaysISO,
  hasSeenAgendaReminderToday,
  toLocalDateISO,
} from "@/lib/agenda";
import { useAppProfile } from "@/components/app/AppShell";
import { FeedHomeLayout } from "./FeedHomeLayout";
import { createPostWithMedia, POST_SELECT } from "@/lib/posts";
import { type CreatePostSubmitData, toCreatePostInput } from "@/lib/createPost";
import { CreatePostModal } from "./CreatePostModal";
import { FeedDesktopPostList, FeedMobileTimeline } from "./FeedPostList";
import { usePostOwnerActions } from "@/lib/usePostOwnerActions";
import { loadBoostedFeedPosts, mergeBoostedIntoFeed } from "@/lib/feedBoost";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import { FloatingMessages } from "@/components/messages/FloatingMessages";
import { AgendaReminderDialog } from "@/components/agenda/AgendaReminderDialog";
import { CoachEnrollDialog } from "@/components/coach/CoachEnrollDialog";
import type { FeedCoachListing } from "@/types/feed";

export function FeedPage() {
  const supabase = createClient();
  const profile = useAppProfile();
  const searchParams = useSearchParams();
  const highlightPostId = searchParams.get("post");
  const highlightCommentId = searchParams.get("comment");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { isSubmitting: posting, guard: guardPost } = useSingleSubmit();
  const [error, setError] = useState<string | null>(null);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderEvents, setReminderEvents] = useState<AgendaEvent[]>([]);
  const [enrolledCoachListingIds, setEnrolledCoachListingIds] = useState<Set<string>>(new Set());
  const [enrollTarget, setEnrollTarget] = useState<FeedCoachListing | null>(null);
  const [userEmail, setUserEmail] = useState("");

  const loadFeed = useCallback(async () => {
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/";
      return;
    }

    const { data: rawPosts, error: postsErr } = await supabase
      .from("posts")
      .select(POST_SELECT)
      .or("community_id.is.null,and(community_id.not.is.null,visibility.eq.public)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (postsErr) {
      setError(
        "Não foi possível carregar o feed. Execute as migrations do Supabase."
      );
      setLoading(false);
      return;
    }

    const postIds = (rawPosts ?? []).map((p) => p.id);
    const likesByPost: Record<string, number> = {};
    const commentsByPost: Record<string, number> = {};
    const likedSet = new Set<string>();
    const coachListingsByPostId = await fetchCoachListingsForPosts(supabase, postIds);
    const clubCourtsByPostId = await fetchClubCourtsForPosts(supabase, postIds);

    const [{ data: enrollRows }, { data: profileRow }] = await Promise.all([
      supabase
        .from("coach_listing_enrollments")
        .select("coach_listing_id")
        .eq("student_id", user.id),
      supabase.from("profiles").select("email").eq("id", user.id).single(),
    ]);
    setEnrolledCoachListingIds(
      new Set((enrollRows ?? []).map((row) => row.coach_listing_id as string))
    );
    setUserEmail((profileRow?.email as string) ?? "");

    if (postIds.length > 0) {
      const { data: likes } = await supabase
        .from("post_likes")
        .select("post_id, user_id")
        .in("post_id", postIds);

      for (const row of likes ?? []) {
        likesByPost[row.post_id] = (likesByPost[row.post_id] ?? 0) + 1;
        if (row.user_id === user.id) likedSet.add(row.post_id);
      }

      const { data: comments } = await supabase
        .from("post_comments")
        .select("post_id")
        .in("post_id", postIds);

      for (const row of comments ?? []) {
        commentsByPost[row.post_id] = (commentsByPost[row.post_id] ?? 0) + 1;
      }
    }

    setPosts(
      mergeBoostedIntoFeed(
        (rawPosts ?? []).map((row) =>
          mapPostRow(
            row,
            likesByPost[row.id] ?? 0,
            commentsByPost[row.id] ?? 0,
            likedSet.has(row.id),
            new Set(coachListingsByPostId.keys()),
            coachListingsByPostId,
            clubCourtsByPostId
          )
        ),
        await loadBoostedFeedPosts(supabase, user.id, new Set(postIds))
      )
    );
    setLoading(false);
  }, [supabase]);

  const { ownerMenuProps, ownerActionUi } = usePostOwnerActions({
    authorId: profile?.id ?? "",
    context: "global",
    onRefresh: loadFeed,
    onRemove: (postId) => setPosts((items) => items.filter((p) => p.id !== postId)),
    onError: setError,
    avatarUrl: profile?.avatar_url ?? null,
    username: profile?.username ?? "",
    displayName: profile?.display_name,
  });

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (loading || !profile?.id) return;
    if (hasSeenAgendaReminderToday(profile.id)) return;

    let cancelled = false;
    const today = toLocalDateISO();
    const tomorrow = addDaysISO(today, 1);

    void (async () => {
      const { data, error: agendaErr } = await supabase
        .from("user_agenda_events")
        .select("*")
        .eq("user_id", profile.id)
        .in("event_date", [today, tomorrow])
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true });

      if (cancelled || agendaErr) return;
      const rows = (data as AgendaEvent[]) ?? [];
      if (rows.length === 0) return;
      setReminderEvents(rows);
      setReminderOpen(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, profile?.id, supabase]);

  async function handleCreatePost(data: CreatePostSubmitData) {
    if (!profile || posting) return;

    await guardPost(async () => {
      setError(null);
      const { error: createErr } = await createPostWithMedia(
        supabase,
        toCreatePostInput(profile.id, null, data)
      );

      if (createErr) {
        setError(createErr);
        return;
      }

      await loadFeed();
      setPostModalOpen(false);
    });
  }

  async function handleLikeToggle(postId: string, liked: boolean) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (liked) {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
    } else {
      await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="text-sm text-[var(--toq-text-muted)]">Carregando feed…</p>
      </div>
    );
  }

  return (
    <>
      <div className="feed-page-mobile md:contents">
        <FeedHomeLayout onOpenCreatePost={() => setPostModalOpen(true)}>
        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <section>
          <h2 className="toq-section-label mb-3 hidden md:block">Feed geral</h2>
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="text-sm font-semibold text-[var(--toq-navy)]">Nenhum post ainda</p>
              <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
                Publique o primeiro — eventos, treinos ou novidades. Posts de comunidades ficam no menu Comunidade.
              </p>
            </div>
          ) : (
            <>
              <FeedMobileTimeline
                posts={posts}
                currentUserId={profile!.id}
                highlightPostId={highlightPostId}
                highlightCommentId={highlightCommentId}
                onLikeToggle={handleLikeToggle}
                onEditPost={ownerMenuProps.onEditPost}
                onDeletePost={ownerMenuProps.onDeletePost}
                enrolledCoachListingIds={enrolledCoachListingIds}
                onEnrollCoachListing={setEnrollTarget}
              />
              <FeedDesktopPostList
                posts={posts}
                currentUserId={profile!.id}
                highlightPostId={highlightPostId}
                highlightCommentId={highlightCommentId}
                onLikeToggle={handleLikeToggle}
                onEditPost={ownerMenuProps.onEditPost}
                onDeletePost={ownerMenuProps.onDeletePost}
                enrolledCoachListingIds={enrolledCoachListingIds}
                onEnrollCoachListing={setEnrollTarget}
              />
            </>
          )}
        </section>
        </FeedHomeLayout>
      </div>

      <CreatePostModal
        open={postModalOpen}
        avatarUrl={profile.avatar_url}
        username={profile.username}
        displayName={profile.display_name}
        loading={posting}
        onClose={() => !posting && setPostModalOpen(false)}
        onSubmit={handleCreatePost}
      />

      <AgendaReminderDialog
        open={reminderOpen}
        userId={profile.id}
        events={reminderEvents}
        onClose={() => setReminderOpen(false)}
      />

      <CoachEnrollDialog
        open={!!enrollTarget}
        listingId={enrollTarget?.id ?? ""}
        listingTitle={enrollTarget?.title ?? ""}
        defaultEmail={userEmail}
        onClose={() => setEnrollTarget(null)}
        onSuccess={() => {
          if (enrollTarget) {
            setEnrolledCoachListingIds((prev) => new Set(prev).add(enrollTarget.id));
          }
        }}
      />

      {ownerActionUi}

      <div className="hidden md:contents">
        <FloatingMessages />
      </div>
    </>
  );
}
