"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Community, CommunityMemberRole } from "@/types/community";
import type { ClubTab } from "@/types/clubFeatures";
import type { FeedPost } from "@/types/feed";
import type { CreatePostSubmitData } from "@/lib/createPost";
import { ClubTabs } from "./ClubTabs";
import { ClubFeedPanel } from "./ClubFeedPanel";
import { ClubShopPanel } from "./ClubShopPanel";
import { ClubRankingPanel } from "./ClubRankingPanel";
import { ClubCourtsPanel } from "./ClubCourtsPanel";
import { ClubTournamentsPanel } from "./ClubTournamentsPanel";
import { ClubGalleryPanel } from "./ClubGalleryPanel";

type Props = {
  community: Community;
  myRole: CommunityMemberRole | null;
  posts: FeedPost[];
  profileId: string;
  avatarUrl: string | null;
  username: string;
  posting: boolean;
  highlightPostId: string | null;
  highlightCommentId: string | null;
  onSubmitPost: (data: CreatePostSubmitData) => void | Promise<void>;
  onLikeToggle: (postId: string, liked: boolean) => void | Promise<void>;
  onEditPost?: (post: FeedPost) => void;
  onDeletePost?: (post: FeedPost) => void;
  /** Visitante: só loja pública, sem feed/ranking/quadras. */
  guestShopOnly?: boolean;
  /** No mobile: capa + card entre as abas e o conteúdo. */
  mobileHeader?: ReactNode;
};

export function ClubMemberArea({
  community,
  myRole,
  posts,
  profileId,
  avatarUrl,
  username,
  posting,
  highlightPostId,
  highlightCommentId,
  onSubmitPost,
  onLikeToggle,
  onEditPost,
  onDeletePost,
  guestShopOnly = false,
  mobileHeader,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shopEnabled = community.shop_enabled ?? false;

  const tabParam = searchParams.get("tab");
  const resolvedTab: ClubTab = guestShopOnly
    ? "shop"
    : tabParam === "shop" && shopEnabled
      ? "shop"
      : tabParam === "ranking"
        ? "ranking"
        : tabParam === "courts"
          ? "courts"
          : tabParam === "tournaments"
            ? "tournaments"
            : tabParam === "gallery"
              ? "gallery"
              : "feed";

  const [tab, setTab] = useState<ClubTab>(resolvedTab);

  useEffect(() => {
    setTab(resolvedTab);
  }, [resolvedTab]);

  useEffect(() => {
    if (guestShopOnly) return;
    if (tab === "shop" && !shopEnabled) setTab("feed");
  }, [guestShopOnly, shopEnabled, tab]);

  function changeTab(next: ClubTab) {
    if (guestShopOnly && next !== "shop") return;
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "feed") params.delete("tab");
    else params.set("tab", next);
    params.delete("action");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  const courtsAction = searchParams.get("action");
  const courtsAutoOpen =
    courtsAction === "nova" || courtsAction === "agenda" ? courtsAction : null;

  const clearCourtsAction = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has("action")) return;
    params.delete("action");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return (
    <div className="mt-4 space-y-3 md:mt-6 md:space-y-0 md:overflow-hidden md:toq-card-lg">
      <div className="overflow-hidden rounded-2xl border border-[var(--toq-border)] bg-[var(--toq-card)] md:rounded-none md:border-0 md:bg-transparent">
        <ClubTabs
          active={tab}
          onChange={changeTab}
          shopEnabled={shopEnabled}
          guestShopOnly={guestShopOnly}
        />
      </div>

      {mobileHeader ? <div className="md:hidden">{mobileHeader}</div> : null}

      <div className="min-h-0 rounded-2xl border border-[var(--toq-border)] bg-[var(--toq-card)] px-4 pb-8 pt-1 md:rounded-none md:border-0 md:px-5 md:pt-0">
        {!guestShopOnly && tab === "feed" && (
          <ClubFeedPanel
            posts={posts}
            profileId={profileId}
            avatarUrl={avatarUrl}
            username={username}
            posting={posting}
            highlightPostId={highlightPostId}
            highlightCommentId={highlightCommentId}
            onSubmitPost={onSubmitPost}
            onLikeToggle={onLikeToggle}
            onEditPost={onEditPost}
            onDeletePost={onDeletePost}
          />
        )}
        {tab === "shop" && shopEnabled && (
          <ClubShopPanel
            communityId={community.id}
            clubName={community.name}
            shopWhatsapp={community.shop_whatsapp ?? null}
            buyerUsername={username}
            myRole={myRole}
          />
        )}
        {!guestShopOnly && tab === "ranking" && (
          <ClubRankingPanel
            communityId={community.id}
            clubName={community.name}
            myRole={myRole}
          />
        )}
        {!guestShopOnly && tab === "courts" && (
          <ClubCourtsPanel
            communityId={community.id}
            clubName={community.name}
            clubSlug={community.slug}
            myRole={myRole}
            autoOpen={courtsAutoOpen}
            onAutoOpenConsumed={clearCourtsAction}
          />
        )}
        {!guestShopOnly && tab === "tournaments" && (
          <ClubTournamentsPanel
            communityId={community.id}
            clubName={community.name}
            buyerUsername={username}
            myRole={myRole}
          />
        )}
        {!guestShopOnly && tab === "gallery" && <ClubGalleryPanel community={community} />}
      </div>
    </div>
  );
}
