"use client";

import { useState } from "react";
import type { PostMediaKind } from "@/lib/postMedia";

type Props = {
  items: { url: string; sort_order: number; media_type?: PostMediaKind }[];
  fullBleed?: boolean;
};

const IG_MIN_RATIO = 4 / 5;
const IG_MAX_RATIO = 1.91;

function clampFeedRatio(width: number, height: number) {
  if (!width || !height) return IG_MIN_RATIO;
  return Math.min(IG_MAX_RATIO, Math.max(IG_MIN_RATIO, width / height));
}

function SingleImage({ src }: { src: string }) {
  const [ratio, setRatio] = useState(IG_MIN_RATIO);

  return (
    <div className="post-media-single" style={{ aspectRatio: String(ratio) }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onLoad={(e) => {
          const img = e.currentTarget;
          setRatio(clampFeedRatio(img.naturalWidth, img.naturalHeight));
        }}
      />
    </div>
  );
}

export function PostMediaGrid({ items, fullBleed = false }: Props) {
  if (items.length === 0) return null;

  const single = items.length === 1;

  return (
    <div
      className={`post-media-grid grid ${single ? "grid-cols-1" : "grid-cols-2"} ${
        fullBleed ? "post-media-grid--bleed" : "mt-3"
      } ${single ? "gap-0" : fullBleed ? "gap-0.5" : "gap-2"}`}
    >
      {items.map((item) => {
        const isVideo = (item.media_type ?? "image") === "video";

        if (single && !isVideo) {
          return (
            <div key={item.url} className={fullBleed ? "" : "overflow-hidden rounded-lg"}>
              <SingleImage src={item.url} />
            </div>
          );
        }

        return (
          <div
            key={item.url}
            className={`post-media-tile overflow-hidden bg-black ${
              fullBleed ? "" : "rounded-lg"
            } ${isVideo ? "aspect-video" : "aspect-square"}`}
          >
            {isVideo ? (
              <video
                src={item.url}
                controls
                playsInline
                preload="metadata"
                className="h-full w-full bg-black object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        );
      })}
    </div>
  );
}
