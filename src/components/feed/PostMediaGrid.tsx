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
            className={`overflow-hidden bg-slate-100 ${
              fullBleed ? "rounded-none md:rounded-lg" : "rounded-lg"
            } ${
              single && !isVideo
                ? fullBleed
                  ? "aspect-[4/5] max-h-none md:max-h-80 md:aspect-auto"
                  : "max-h-80"
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
                className={`h-full w-full object-cover ${single && !fullBleed ? "max-h-80 w-full" : ""}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
