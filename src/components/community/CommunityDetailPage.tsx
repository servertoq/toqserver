"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mapPostRow } from "@/lib/feed";
import {
  canModerate,
  groupVisibilityLabel,
  isOwner,
  memberRoleLabel,
} from "@/lib/community";
import { COMMUNITY_GROUP_CONFIG } from "@/lib/communityGroup";
import type { Community, CommunityGroupKind, CommunityMemberRole } from "@/types/community";
import type { FeedPost, PostType, PostVisibility } from "@/types/feed";
import { useAppProfile } from "@/components/app/AppShell";
import { appContentClass } from "@/lib/layout";
import { createPostWithMedia, POST_SELECT } from "@/lib/posts";
import { CreatePostBox } from "@/components/feed/CreatePostBox";
import { FeedTopBar } from "@/components/feed/FeedTopBar";
import { PostCard } from "@/components/feed/PostCard";
import { Suspense } from "react";
import { ClubMemberArea } from "@/components/club/ClubMemberArea";
import { ReportButton } from "@/components/report/ReportButton";
import { CommunityModerationPanel } from "./CommunityModerationPanel";
import { CommunitySettingsForm } from "./CommunitySettingsForm";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import { addressFromRow, formatAddressLines, hasAddress } from "@/lib/address";
import { formatOperatingHoursSummary, parseOperatingHours } from "@/lib/operatingHours";

export function CommunityDetailPage({
  slug,
  groupKind = "community",
}: {
  slug: string;
  groupKind?: CommunityGroupKind;
}) {
  const config = COMMUNITY_GROUP_CONFIG[groupKind];
  const supabase = createClient();
  const profile = useAppProfile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightPostId = searchParams.get("post");
  const highlightCommentId = searchParams.get("comment");

  const [community, setCommunity] = useState<Community | null>(null);
  const [myRole, setMyRole] = useState<CommunityMemberRole | null>(null);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [pendingInviteId, setPendingInviteId] = useState<string | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { isSubmitting: posting, guard: guardPost } = useSingleSubmit();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const isMember = myRole !== null;

  const load = useCallback(async () => {
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/";
      return;
    }

    const { data: comm, error: commErr } = await supabase
      .from("communities")
      .select("*")
      .eq("slug", slug)
      .eq("kind", groupKind)
      .maybeSingle();

    if (commErr || !comm) {
      setError(config.notFound);
      setLoading(false);
      return;
    }

    const c = comm as Community;
    setCommunity(c);

    const { data: membership } = await supabase
      .from("community_members")
      .select("role")
      .eq("community_id", c.id)
      .eq("user_id", user.id)
      .maybeSingle();

    setMyRole((membership?.role as CommunityMemberRole) ?? null);

    const { data: pending } = await supabase
      .from("community_join_requests")
      .select("id")
      .eq("community_id", c.id)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle();

    setPendingRequest(!!pending);

    const { data: invite } = await supabase
      .from("community_invites")
      .select("id")
      .eq("community_id", c.id)
      .eq("invitee_id", user.id)
      .eq("status", "pending")
      .maybeSingle();

    setPendingInviteId(invite?.id ?? null);

    if (membership) {
      const { data: rawPosts, error: postsErr } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .eq("community_id", c.id)
        .order("created_at", { ascending: false })
        .limit(50);

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
          rawPosts.map((row) =>
            mapPostRow(
              row,
              likesByPost[row.id] ?? 0,
              commentsByPost[row.id] ?? 0,
              likedSet.has(row.id)
            )
          )
        );
      } else {
        setPosts([]);
      }
    } else {
      setPosts([]);
    }

    setLoading(false);
  }, [config.notFound, groupKind, supabase, slug]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleJoin() {
    if (!community) return;
    setJoining(true);
    setError(null);
    try {
      if (groupKind === "club" || community.is_private) {
        const { error: reqErr } = await supabase.rpc("request_community_join", {
          p_community_id: community.id,
        });
        if (reqErr) {
          setError(reqErr.message);
          return;
        }
      } else {
        const { error: joinErr } = await supabase.rpc("join_public_community", {
          p_community_id: community.id,
        });
        if (joinErr) {
          setError(joinErr.message);
          return;
        }
      }
      await load();
    } finally {
      setJoining(false);
    }
  }

  async function handleRespondInvite(accept: boolean) {
    if (!pendingInviteId) return;
    setJoining(true);
    setError(null);
    const { error: invErr } = await supabase.rpc("respond_community_invite", {
      p_invite_id: pendingInviteId,
      p_accept: accept,
    });
    if (invErr) setError(invErr.message);
    await load();
    setJoining(false);
  }

  async function handleLeave() {
    if (!community || !confirm(config.leaveConfirm)) return;
    await supabase.rpc("remove_community_member", {
      p_community_id: community.id,
      p_user_id: profile.id,
    });
    router.push(config.basePath);
  }

  async function handleCreatePost(data: {
    body: string;
    postType: PostType;
    title: string | null;
    visibility: PostVisibility;
    eventDate: string | null;
    eventTime: string | null;
    files: File[];
  }) {
    if (!community || !isMember || posting) return;

    await guardPost(async () => {
      setError(null);
      const { error: createErr } = await createPostWithMedia(supabase, {
        authorId: profile.id,
        body: data.body,
        postType: data.postType,
        title: data.title,
        visibility: data.visibility,
        communityId: community.id,
        eventDate: data.eventDate,
        eventTime: data.eventTime,
        files: data.files,
      });

      if (createErr) {
        setError(createErr);
        return;
      }

      await load();
    });
  }

  async function handleLikeToggle(postId: string, liked: boolean) {
    if (liked) {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: profile.id });
    } else {
      await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", profile.id);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="text-sm text-[var(--toq-text-muted)]">Carregando…</p>
      </div>
    );
  }

  if (!community) {
    return (
      <main className="px-4 py-12 text-center">
        <p className="text-sm text-red-600">{error ?? config.notFound}</p>
        <Link href={config.basePath} className="mt-4 inline-block text-sm font-semibold text-[var(--toq-sky)]">
          Voltar
        </Link>
      </main>
    );
  }

  const full = community.member_count >= 1000;
  const isClubPage = (community.kind ?? groupKind) === "club";
  const clubAddress = addressFromRow(community);
  const clubHours = parseOperatingHours(community.operating_hours);
  const showClubInfo = isMember && isClubPage;

  return (
    <>
      <FeedTopBar />
      <main className={appContentClass}>
        <Link
          href={config.basePath}
          className="mb-4 inline-block text-xs font-semibold text-[var(--toq-sky)]"
        >
          ← {config.backLabel}
        </Link>

        <header className="overflow-hidden toq-card-lg">
          <div className="community-cover-banner relative aspect-[3/1] max-h-56 w-full overflow-hidden bg-gradient-to-br from-[var(--toq-navy)] to-[var(--toq-accent)]">
            {community.cover_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={community.cover_image_url}
                alt=""
                className="community-cover-img h-full w-full object-cover"
              />
            )}
          </div>
          <div className="p-4" style={{ borderTopWidth: 3, borderTopColor: community.accent_color }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-[var(--toq-navy)]">{community.name}</h1>
                <p className="mt-1 text-sm text-[var(--toq-text-muted)]">{community.description}</p>
                <p className="mt-2 text-xs font-semibold text-[var(--toq-accent)]">
                  {community.member_count.toLocaleString("pt-BR")} / 1.000 membros ·{" "}
                  {groupVisibilityLabel(community.kind ?? groupKind, community.is_private)}
                  {myRole && ` · ${memberRoleLabel(myRole)}`}
                </p>
                {showClubInfo && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {hasAddress(clubAddress) && (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
                          Endereço
                        </p>
                        <address className="mt-1 space-y-0.5 text-xs not-italic text-[var(--toq-navy)]">
                          {formatAddressLines(clubAddress).map((line) => (
                            <span key={line} className="block">
                              {line}
                            </span>
                          ))}
                        </address>
                      </div>
                    )}
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
                          Horários
                        </p>
                        <ul className="mt-1 space-y-0.5 text-xs text-[var(--toq-navy)]">
                          {formatOperatingHoursSummary(clubHours).map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ReportButton
                  userId={profile.id}
                  target={{
                    type: "community",
                    id: community.id,
                    label: `${groupKind === "club" ? "clube" : "comunidade"} ${community.name}`,
                  }}
                />
                {isMember && (
                  <Link
                    href={`/inicio/mensagens?g=${encodeURIComponent(community.id)}`}
                    className="rounded-lg toq-btn-primary px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Chat do grupo
                  </Link>
                )}
                {isOwner(myRole) && (
                  <button
                    type="button"
                    onClick={() => setShowSettings(true)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-[var(--toq-navy)]"
                  >
                    Configurações
                  </button>
                )}
                {isMember && myRole !== "owner" && (
                  <button
                    type="button"
                    onClick={handleLeave}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[var(--toq-text-muted)]"
                  >
                    Sair
                  </button>
                )}
              </div>
            </div>

            {!isMember && (
              <div className="mt-4 space-y-2">
                {pendingInviteId ? (
                  <>
                    <p className="rounded-lg bg-[var(--toq-accent)]/10 px-3 py-2 text-sm font-semibold text-[var(--toq-accent)]">
                      Você foi convidado para este {groupKind === "club" ? "clube" : "grupo"}.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={joining}
                        onClick={() => handleRespondInvite(true)}
                        className="rounded-lg toq-btn-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        Aceitar convite
                      </button>
                      <button
                        type="button"
                        disabled={joining}
                        onClick={() => handleRespondInvite(false)}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-[var(--toq-text-muted)] disabled:opacity-50"
                      >
                        Recusar
                      </button>
                    </div>
                  </>
                ) : pendingRequest ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                    {config.pendingRequest}
                  </p>
                ) : full ? (
                  <p className="text-sm text-[var(--toq-text-muted)]">{config.fullLabel}</p>
                ) : (
                  <button
                    type="button"
                    disabled={joining}
                    onClick={handleJoin}
                    className="rounded-lg toq-btn-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {joining
                      ? "Processando…"
                      : groupKind === "club" || community.is_private
                        ? config.joinPrivate
                        : config.joinPublic}
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        {error && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {canModerate(myRole) && (
          <div className="mt-6">
            <CommunityModerationPanel
              communityId={community.id}
              groupKind={groupKind}
              myRole={myRole!}
              onChanged={load}
            />
          </div>
        )}

        {isMember ? (
          groupKind === "club" ? (
            <Suspense fallback={<p className="mt-6 text-sm text-[var(--toq-text-muted)]">Carregando…</p>}>
              <ClubMemberArea
                community={community}
                myRole={myRole}
                posts={posts}
                profileId={profile.id}
                avatarUrl={profile.avatar_url}
                username={profile.username}
                posting={posting}
                highlightPostId={highlightPostId}
                highlightCommentId={highlightCommentId}
                onSubmitPost={handleCreatePost}
                onLikeToggle={handleLikeToggle}
              />
            </Suspense>
          ) : (
            <>
              <div className="mt-6">
                <CreatePostBox
                  avatarUrl={profile.avatar_url}
                  username={profile.username}
                  loading={posting}
                  context="community"
                  onSubmit={handleCreatePost}
                />
              </div>

              <section className="mt-6">
                <h2 className="mb-3 text-sm font-bold text-[var(--toq-navy)]">{config.feedTitle}</h2>
                {posts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                    <p className="text-sm font-semibold text-[var(--toq-navy)]">Nenhum post ainda</p>
                    <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
                      Publique o primeiro conteúdo visível apenas para membros.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-4">
                    {posts.map((post) => (
                      <li key={post.id}>
                        <PostCard
                          post={post}
                          currentUserId={profile.id}
                          highlightPost={post.id === highlightPostId}
                          highlightCommentId={
                            post.id === highlightPostId ? highlightCommentId : null
                          }
                          onLikeToggle={handleLikeToggle}
                          onCommentCountChange={() => {}}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-[var(--toq-navy)]">{config.memberOnlyFeed}</p>
            <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
              {pendingInviteId
                ? "Aceite o convite para acessar o conteúdo."
                : groupKind === "club"
                  ? "Solicite entrada ou aguarde um convite para ver posts e eventos."
                  : community.is_private
                    ? "Solicite entrada para ver e publicar posts nesta comunidade."
                    : "Entre na comunidade para acessar o feed."}
            </p>
          </div>
        )}
      </main>

      {showSettings && (
        <CommunitySettingsForm
          community={community}
          groupKind={groupKind}
          myRole={myRole}
          onSaved={load}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}
