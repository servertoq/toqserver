import type { PostMediaKind } from "@/lib/postMedia";

type Props = {
  items: { url: string; sort_order: number; media_type?: PostMediaKind }[];
  fullBleed?: boolean;
};

export function PostMediaGrid({ items, fullBleed = false }: Props) {
  if (items.length === 0) return null;

  const single = items.length === 1;

  return (
    <div
      className={`post-media-grid grid gap-2 ${single ? "grid-cols-1" : "grid-cols-2"} ${
        fullBleed ? "post-media-grid--bleed md:mt-3" : "mt-3"
      }`}
    >
      {items.map((item) => {
        const isVideo = (item.media_type ?? "image") === "video";

        return (
          <div
            key={item.url}
            className={`overflow-hidden ${
              fullBleed ? "rounded-none md:rounded-lg" : "rounded-lg"
            } ${
              single && !isVideo
                ? "bg-transparent"
                : "bg-[var(--toq-elevated)]"
            } ${
              single && !isVideo
                ? ""
                : isVideo
                  ? "aspect-video"
                  : "aspect-square"
            }`}
          >
            {isVideo ? (
              <video
                src={item.url}
                controls
                playsInline
                preload="metadata"
                className="h-full w-full bg-black object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.url}
                alt=""
                className={
                  single
                    ? `block w-full object-contain ${
                        fullBleed
                          ? "max-h-[min(70vh,36rem)]"
                          : "max-h-[28rem]"
                      }`
                    : "h-full w-full object-cover"
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
