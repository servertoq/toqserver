import type { FeedPost } from "@/types/feed";

export type FeedTimelinePost = { kind: "post"; post: FeedPost };
export type FeedTimelineAd = { kind: "ad"; key: string };
export type FeedTimelineSuggestions = { kind: "suggestions"; key: string };

export type FeedTimelineItem = FeedTimelinePost | FeedTimelineAd | FeedTimelineSuggestions;

/** A cada 3 posts: publicidade; a cada 6 posts: sugestões (após mais 3). */
export function buildFeedTimeline(posts: FeedPost[]): FeedTimelineItem[] {
  const items: FeedTimelineItem[] = [];
  let adSeq = 0;
  let sugSeq = 0;

  posts.forEach((post, index) => {
    items.push({ kind: "post", post });
    const count = index + 1;

    if (count % 3 !== 0) return;

    const block = count / 3;
    if (block % 2 === 1) {
      items.push({ kind: "ad", key: `ad-${adSeq++}` });
    } else {
      items.push({ kind: "suggestions", key: `suggestions-${sugSeq++}` });
    }
  });

  return items;
}
