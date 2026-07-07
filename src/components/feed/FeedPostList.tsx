"use client";

import { FeedAdCarousel } from "./FeedAdCarousel";
import { FeedFriendSuggestions } from "./FeedFriendSuggestions";
import { PostCard } from "./PostCard";
import { buildFeedTimeline } from "@/lib/feedTimeline";
import type { FeedPost } from "@/types/feed";

type ListProps = {
  posts: FeedPost[];
  currentUserId: string;
  highlightPostId: string | null;
  highlightCommentId: string | null;
  onLikeToggle: (postId: string, liked: boolean) => Promise<void>;
  onEditPost?: (post: FeedPost) => void;
  onDeletePost?: (post: FeedPost) => void;
};

function PostListItem({
  post,
  currentUserId,
  highlightPostId,
  highlightCommentId,
  onLikeToggle,
  onEditPost,
  onDeletePost,
}: Omit<ListProps, "posts"> & { post: FeedPost }) {
  return (
    <li>
      <PostCard
        post={post}
        currentUserId={currentUserId}
        fullBleed
        highlightPost={post.id === highlightPostId}
        highlightCommentId={post.id === highlightPostId ? highlightCommentId : null}
        onLikeToggle={onLikeToggle}
        onCommentCountChange={() => {}}
        onEditPost={onEditPost}
        onDeletePost={onDeletePost}
      />
    </li>
  );
}

export function FeedDesktopPostList({
  posts,
  currentUserId,
  highlightPostId,
  highlightCommentId,
  onLikeToggle,
  onEditPost,
  onDeletePost,
}: ListProps) {
  return (
    <ul className="feed-post-list hidden space-y-0 md:block md:space-y-4">
      {posts.map((post) => (
        <PostListItem
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          highlightPostId={highlightPostId}
          highlightCommentId={highlightCommentId}
          onLikeToggle={onLikeToggle}
          onEditPost={onEditPost}
          onDeletePost={onDeletePost}
        />
      ))}
    </ul>
  );
}

export function FeedMobileTimeline({
  posts,
  currentUserId,
  highlightPostId,
  highlightCommentId,
  onLikeToggle,
  onEditPost,
  onDeletePost,
}: ListProps) {
  const timeline = buildFeedTimeline(posts);

  return (
    <ul className="feed-post-list feed-mobile-timeline md:hidden">
      {timeline.map((item) => {
        if (item.kind === "post") {
          return (
            <PostListItem
              key={item.post.id}
              post={item.post}
              currentUserId={currentUserId}
              highlightPostId={highlightPostId}
              highlightCommentId={highlightCommentId}
              onLikeToggle={onLikeToggle}
              onEditPost={onEditPost}
              onDeletePost={onDeletePost}
            />
          );
        }

        if (item.kind === "ad") {
          return (
            <li key={item.key} className="feed-mobile-insert feed-mobile-insert--ad">
              <FeedAdCarousel variant="inline" />
            </li>
          );
        }

        return (
          <li key={item.key} className="feed-mobile-insert feed-mobile-insert--suggestions">
            <FeedFriendSuggestions variant="carousel" />
          </li>
        );
      })}
    </ul>
  );
}
