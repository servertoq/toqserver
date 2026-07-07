"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Community, CommunityMemberRole } from "@/types/community";
import type { ClubTab } from "@/types/clubFeatures";
import type { FeedPost, PostType, PostVisibility } from "@/types/feed";
import { ClubTabs } from "./ClubTabs";
import { ClubFeedPanel } from "./ClubFeedPanel";
import { ClubShopPanel } from "./ClubShopPanel";
import { ClubRankingPanel } from "./ClubRankingPanel";
import { ClubCourtsPanel } from "./ClubCourtsPanel";
import { ClubTournamentsPanel } from "./ClubTournamentsPanel";

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
  onSubmitPost: (data: {
    body: string;
    postType: PostType;
    title: string | null;
    visibility: PostVisibility;
    eventDate: string | null;
    eventTime: string | null;
    files: File[];
  }) => void;
  onLikeToggle: (postId: string, liked: boolean) => void;
  onEditPost?: (post: FeedPost) => void;
  onDeletePost?: (post: FeedPost) => void;
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
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shopEnabled = community.shop_enabled ?? false;

  const tabParam = searchParams.get("tab");
  const initialTab: ClubTab =
    tabParam === "shop" && shopEnabled
      ? "shop"
      : tabParam === "ranking"
        ? "ranking"
        : tabParam === "courts"
          ? "courts"
          : tabParam === "tournaments"
            ? "tournaments"
            : "feed";

  const [tab, setTab] = useState<ClubTab>(initialTab);

  useEffect(() => {
    if (tab === "shop" && !shopEnabled) setTab("feed");
  }, [shopEnabled, tab]);

  function changeTab(next: ClubTab) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "feed") params.delete("tab");
    else params.set("tab", next);
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  return (
    <div className="mt-6 overflow-hidden toq-card-lg">
      <ClubTabs active={tab} onChange={changeTab} shopEnabled={shopEnabled} />
      <div className="px-4 pb-6 sm:px-5">
        {tab === "feed" && (
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
        {tab === "ranking" && <ClubRankingPanel communityId={community.id} myRole={myRole} />}
        {tab === "courts" && (
          <ClubCourtsPanel
            communityId={community.id}
            clubName={community.name}
            myRole={myRole}
            buyerUsername={username}
          />
        )}
        {tab === "tournaments" && (
          <ClubTournamentsPanel
            communityId={community.id}
            clubName={community.name}
            buyerUsername={username}
            myRole={myRole}
          />
        )}
      </div>
    </div>
  );
}
