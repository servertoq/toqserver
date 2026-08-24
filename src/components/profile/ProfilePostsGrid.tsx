"use client";

import type { FeedPost } from "@/types/feed";

type Props = {
  posts: FeedPost[];
  onSeeAll?: () => void;
  limit?: number;
};

export function ProfilePostsGrid({ posts, onSeeAll, limit = 6 }: Props) {
  const items = posts.slice(0, limit);

  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <p className="profile-section-label">Publicações</p>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-xs font-semibold text-[var(--toq-profile-accent)]"
          >
            Ver todos
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--toq-profile-muted)]">Nenhuma publicação ainda.</p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {items.map((post) => {
            const first = post.images?.[0];
            const media = first?.url?.trim();
            const isVideo = first?.media_type === "video";
            return (
              <button
                key={post.id}
                type="button"
                onClick={onSeeAll}
                className="relative aspect-square overflow-hidden rounded-lg bg-slate-100"
              >
                {media ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-2 text-left text-[10px] text-[var(--toq-profile-muted)]">
                    {(post.body ?? "").slice(0, 60) || "Post"}
                  </div>
                )}
                {isVideo && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                    <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
