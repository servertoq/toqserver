import type { PostMediaKind } from "@/lib/postMedia";

type Props = {
  items: { url: string; sort_order: number; media_type?: PostMediaKind }[];
};

export function PostMediaGrid({ items }: Props) {
  if (items.length === 0) return null;

  const single = items.length === 1;

  return (
    <div className={`mt-3 grid gap-2 ${single ? "grid-cols-1" : "grid-cols-2"}`}>
      {items.map((item) => {
        const isVideo = (item.media_type ?? "image") === "video";

        return (
          <div
            key={item.url}
            className={`overflow-hidden rounded-lg bg-slate-100 ${
              single && !isVideo
                ? "max-h-80"
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
                className={`h-full w-full object-cover ${single ? "max-h-80 w-full" : ""}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
