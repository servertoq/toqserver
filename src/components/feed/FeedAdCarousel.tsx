"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { listCarouselArticles } from "@/lib/advertising";
import type { AdvertisingCarouselItem } from "@/types/advertising";

const ROTATE_MS = 6000;

type Props = {
  variant?: "rail" | "inline";
  className?: string;
};

export function FeedAdCarousel({ variant = "rail", className = "" }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [ads, setAds] = useState<AdvertisingCarouselItem[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await listCarouselArticles(supabase);
      setAds(data);
      setIndex(0);
    }
    void load();
  }, [supabase]);

  const goTo = useCallback(
    (next: number) => {
      if (ads.length === 0) return;
      setIndex((next + ads.length) % ads.length);
    },
    [ads.length]
  );

  useEffect(() => {
    if (paused || ads.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % ads.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused, ads.length]);

  if (ads.length === 0) {
    return (
      <div className={className}>
        <div
          className={`toq-card-lg flex items-center justify-center p-5 text-center ${
            variant === "inline" ? "feed-inline-ad-placeholder aspect-[4/3]" : "aspect-square"
          }`}
        >
          <p className="text-xs text-[var(--toq-text-muted)]">
            Novidades e publicidade em breve.
          </p>
        </div>
        <p className="mt-2 text-center text-[10px] font-medium uppercase tracking-wide text-[var(--toq-text-muted)]">
          Publicidade
        </p>
      </div>
    );
  }

  const ad = ads[index];

  return (
    <div
      className={className}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className={`relative overflow-hidden toq-card-lg ${
          variant === "inline" ? "feed-inline-ad aspect-[4/3]" : "aspect-square"
        }`}
      >
        <Link
          href={`/inicio/publicidade/${ad.slug}`}
          className="relative block h-full w-full"
          aria-label={`Publicidade: ${ad.title}`}
        >
          <Image src={ad.card_image_url} alt="" fill className="object-cover" unoptimized />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10 p-5">
            <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Publicidade
            </span>
            <p className="mt-4 text-xl font-extrabold leading-tight text-white">{ad.title}</p>
            {ad.card_excerpt && (
              <p className="mt-2 line-clamp-3 text-sm leading-snug text-white/90">
                {ad.card_excerpt}
              </p>
            )}
            <span className="mt-5 inline-block rounded-lg toq-btn-primary px-3 py-1.5 text-xs font-bold text-white">
              Ler notícia
            </span>
          </div>
        </Link>

        {ads.length > 1 && (
          <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {ads.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Publicidade ${i + 1}: ${slide.title}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => goTo(i)}
                className={`pointer-events-auto h-2 rounded-full transition-all ${
                  i === index ? "w-5 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <p className="mt-2 text-center text-[10px] font-medium uppercase tracking-wide text-[var(--toq-text-muted)]">
        Publicidade
      </p>
    </div>
  );
}
