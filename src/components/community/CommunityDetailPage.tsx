"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mapPostRow } from "@/lib/feed";
import { enrichPostsWithStaffRoles } from "@/lib/staff";
import {
  canModerate,
} from "@/lib/community";
import { COMMUNITY_GROUP_CONFIG } from "@/lib/communityGroup";
import type { Community, CommunityGroupKind, CommunityMemberRole } from "@/types/community";
import type { FeedPost } from "@/types/feed";
import { type CreatePostSubmitData, toCreatePostInput } from "@/lib/createPost";
import { useAppProfile } from "@/components/app/AppShell";
import { appContentClass } from "@/lib/layout";
import { createPostWithMedia, POST_SELECT } from "@/lib/posts";
import { CreatePostBox } from "@/components/feed/CreatePostBox";
import { FeedTopBar } from "@/components/feed/FeedTopBar";
import { PostCard } from "@/components/feed/PostCard";
import { Suspense } from "react";
import { ClubMemberArea } from "@/components/club/ClubMemberArea";
import { ClubProfileHeader } from "@/components/club/ClubProfileHeader";
import { CommunityModerationPanel } from "./CommunityModerationPanel";
import { CommunitySettingsForm } from "./CommunitySettingsForm";
import { usePostOwnerActions } from "@/lib/usePostOwnerActions";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import { addressFromRow, formatAddressLines, hasAddress } from "@/lib/address";
import { parseOperatingHours } from "@/lib/operatingHours";
import { OperatingHoursSummary } from "@/components/shared/OperatingHoursSummary";
import { ClubContactLinks } from "@/components/club/ClubContactLinks";
import { hasClubContact } from "@/lib/clubContact";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CommunityGalleryManager } from "./CommunityGalleryManager";
import {
  COMMUNITY_GALLERY_SELECT,
  mapGalleryRows,
} from "@/lib/communityGallery";

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
  const [isClubProfessor, setIsClubProfessor] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [pendingInviteId, setPendingInviteId] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { isSubmitting: posting, guard: guardPost } = useSingleSubmit();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showGalleryManager, setShowGalleryManager] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

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

    let c: Community | null = null;
    const { data: comm, error: commErr } = await supabase
      .from("communities")
      .select(`*, ${COMMUNITY_GALLERY_SELECT}`)
      .eq("slug", slug)
      .eq("kind", groupKind)
      .maybeSingle();

    if (commErr?.message?.includes("community_gallery_images")) {
      const { data: fallback, error: fbErr } = await supabase
        .from("communities")
        .select("*")
        .eq("slug", slug)
        .eq("kind", groupKind)
        .maybeSingle();
      if (fbErr || !fallback) {
        setError(config.notFound);
        setLoading(false);
        return;
      }
      c = { ...(fallback as Community), gallery_images: [] };
    } else if (commErr || !comm) {
      setError(config.notFound);
      setLoading(false);
      return;
    } else {
      const raw = comm as Community & { gallery_images?: unknown };
      c = { ...raw, gallery_images: mapGalleryRows(raw.gallery_images) };
    }

    setCommunity(c);

    const { data: membership } = await supabase
      .from("community_members")
      .select("role, is_club_professor")
      .eq("community_id", c.id)
      .eq("user_id", user.id)
      .maybeSingle();

    setMyRole((membership?.role as CommunityMemberRole) ?? null);
    setIsClubProfessor(Boolean(membership?.is_club_professor));

    if ((c.kind ?? groupKind) === "club" && membership) {
      const { data: fav } = await supabase
        .from("community_favorites")
        .select("community_id")
        .eq("user_id", user.id)
        .eq("community_id", c.id)
        .maybeSingle();
      setIsFavorite(!!fav);
    } else {
      setIsFavorite(false);
    }

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
          await enrichPostsWithStaffRoles(
            supabase,
            rawPosts.map((row) =>
              mapPostRow(
                row,
                likesByPost[row.id] ?? 0,
                commentsByPost[row.id] ?? 0,
                likedSet.has(row.id)
              )
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

  const { ownerMenuProps, ownerActionUi } = usePostOwnerActions({
    authorId: profile.id,
    context: "community",
    onRefresh: load,
    onRemove: (postId) => setPosts((items) => items.filter((p) => p.id !== postId)),
    onError: setError,
    avatarUrl: profile.avatar_url,
    username: profile.username,
    displayName: profile.display_name,
  });

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

  async function confirmLeave() {
    if (!community) return;
    setLeaving(true);
    await supabase.rpc("remove_community_member", {
      p_community_id: community.id,
      p_user_id: profile.id,
    });
    setLeaving(false);
    setLeaveConfirmOpen(false);
    router.push(config.basePath);
  }

  async function handleCreatePost(data: CreatePostSubmitData) {
    if (!community || !isMember || posting) return;

    await guardPost(async () => {
      setError(null);
      const { error: createErr } = await createPostWithMedia(
        supabase,
        toCreatePostInput(profile.id, community.id, data)
      );

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
  const clubContact = {
    instagram_url: community.instagram_url ?? null,
    contact_whatsapp: community.contact_whatsapp ?? null,
  };
  const showClubContact = showClubInfo && hasClubContact(clubContact);

  const joinSlot = !isMember ? (
    <div className="space-y-2">
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
          className="w-full rounded-xl toq-btn-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {joining
            ? "Processando…"
            : groupKind === "club" || community.is_private
              ? config.joinPrivate
              : config.joinPublic}
        </button>
      )}
    </div>
  ) : null;

  const infoSlot = showClubInfo ? (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {hasAddress(clubAddress) && (
        <div className="rounded-xl border border-[var(--toq-border)] bg-[var(--toq-surface)]/70 px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-text-muted)]">
            Endereço
          </p>
          <address className="mt-2 space-y-0.5 text-xs not-italic leading-relaxed text-[var(--toq-navy)]">
            {formatAddressLines(clubAddress).map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
        </div>
      )}
      <OperatingHoursSummary hours={clubHours} />
      {showClubContact && <ClubContactLinks clubName={community.name} contact={clubContact} />}
    </div>
  ) : null;

  const profileHeaderProps = {
    community,
    groupKind,
    myRole,
    isClubProfessor,
    isFavorite,
    onFavoriteChange: setIsFavorite,
    onOpenSettings: () => setShowSettings(true),
    onOpenGalleryManager: () => setShowGalleryManager(true),
    onLeave: () => setLeaveConfirmOpen(true),
    profileId: profile.id,
    joinSlot,
    infoSlot,
  };

  return (
    <>
      <FeedTopBar />
      <main className={appContentClass}>
        <Link
          href={config.basePath}
          className="mb-3 inline-block text-xs font-semibold text-[var(--toq-sky)] md:mb-4"
        >
          ← {config.backLabel}
        </Link>

        {/* Desktop: capa + card acima das abas */}
        {isClubPage ? (
          <div className="hidden md:block">
            <ClubProfileHeader {...profileHeaderProps} variant="desktop" />
          </div>
        ) : (
          <ClubProfileHeader {...profileHeaderProps} variant="desktop" />
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {canModerate(myRole) && (
          <div className="mt-4 md:mt-6">
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
                onEditPost={ownerMenuProps.onEditPost}
                onDeletePost={ownerMenuProps.onDeletePost}
                mobileHeader={<ClubProfileHeader {...profileHeaderProps} variant="mobile" />}
              />
            </Suspense>
          ) : (
            <>
              <div className="mt-6">
                <CreatePostBox
                  avatarUrl={profile.avatar_url}
                  username={profile.username}
                  displayName={profile.display_name}
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
                          onEditPost={ownerMenuProps.onEditPost}
                          onDeletePost={ownerMenuProps.onDeletePost}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )
        ) : groupKind === "club" && (community.shop_enabled ?? false) ? (
          <Suspense fallback={<p className="mt-6 text-sm text-[var(--toq-text-muted)]">Carregando loja…</p>}>
            <div className="md:hidden">
              <ClubProfileHeader {...profileHeaderProps} variant="mobile" />
            </div>
            <div className="mt-4 rounded-xl border border-[var(--toq-accent)]/25 bg-[var(--toq-accent)]/5 px-4 py-3 text-sm text-[var(--toq-navy)]">
              <p className="font-semibold">Loja aberta ao público</p>
              <p className="mt-0.5 text-xs text-[var(--toq-text-muted)]">
                Você pode comprar aqui mesmo sem ser membro. Feed e demais áreas ficam só para
                membros.
              </p>
            </div>
            <ClubMemberArea
              community={community}
              myRole={null}
              posts={[]}
              profileId={profile.id}
              avatarUrl={profile.avatar_url}
              username={profile.username}
              posting={false}
              highlightPostId={null}
              highlightCommentId={null}
              onSubmitPost={async () => {}}
              onLikeToggle={async () => {}}
              guestShopOnly
            />
          </Suspense>
        ) : (
          <>
            <div className="md:hidden">
              {isClubPage ? <ClubProfileHeader {...profileHeaderProps} variant="mobile" /> : null}
            </div>
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
          </>
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

      {showGalleryManager && community && canModerate(myRole) && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowGalleryManager(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-gallery-title"
            className="flex max-h-[min(92dvh,100%)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[var(--toq-border)] bg-[var(--toq-card)] shadow-xl sm:rounded-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--toq-border)] px-4 py-3">
              <h2 id="club-gallery-title" className="text-base font-bold text-[var(--toq-navy)]">
                Fotos do {groupKind === "club" ? "clube" : "grupo"}
              </h2>
              <button
                type="button"
                onClick={() => setShowGalleryManager(false)}
                className="rounded-lg px-2 py-1 text-sm text-[var(--toq-text-muted)] hover:bg-[var(--toq-surface)]"
              >
                Fechar
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <CommunityGalleryManager
                communityId={community.id}
                onChanged={() => void load()}
              />
            </div>
          </div>
        </div>
      )}

      {ownerActionUi}

      <ConfirmDialog
        open={leaveConfirmOpen}
        title={groupKind === "club" ? "Sair do clube" : "Sair da comunidade"}
        message={config.leaveConfirm}
        confirmLabel="Sair"
        variant="danger"
        loading={leaving}
        onConfirm={() => void confirmLeave()}
        onCancel={() => {
          if (!leaving) setLeaveConfirmOpen(false);
        }}
      />
    </>
  );
}
