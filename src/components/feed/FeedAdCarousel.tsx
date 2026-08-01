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
            variant === "inline" ? "feed-inline-ad-placeholder min-h-48" : "min-h-56"
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
        className={`overflow-hidden toq-card-lg ${variant === "inline" ? "feed-inline-ad" : ""}`}
      >
        <Link
          href={`/inicio/publicidade/${ad.slug}`}
          className="flex flex-col"
          aria-label={`Publicidade: ${ad.title}`}
        >
          <div
            className={`relative w-full bg-slate-950 ${
              variant === "inline" ? "aspect-[16/10]" : "aspect-[4/3]"
            }`}
          >
            <Image
              src={ad.card_image_url}
              alt=""
              fill
              className="object-contain"
              unoptimized
            />
            {ads.length > 1 && (
              <div className="pointer-events-none absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5">
                {ads.map((slide, i) => (
                  <button
                    key={slide.id}
                    type="button"
                    aria-label={`Publicidade ${i + 1}: ${slide.title}`}
                    aria-current={i === index ? "true" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      goTo(i);
                    }}
                    className={`pointer-events-auto h-2 rounded-full transition-all ${
                      i === index ? "w-5 bg-white shadow" : "w-2 bg-white/55 hover:bg-white/85"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 bg-[var(--toq-card)] p-4">
            <span className="inline-flex w-fit rounded-full bg-[var(--toq-accent-soft)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--toq-accent)]">
              Publicidade
            </span>
            <p className="line-clamp-3 text-base font-extrabold leading-snug text-[var(--toq-navy)]">
              {ad.title}
            </p>
            {ad.card_excerpt && (
              <p className="line-clamp-2 text-sm leading-snug text-[var(--toq-text-muted)]">
                {ad.card_excerpt}
              </p>
            )}
            <span className="mt-1 inline-flex w-fit rounded-lg toq-btn-primary px-3 py-1.5 text-xs font-bold text-white">
              Ler notícia
            </span>
          </div>
        </Link>
      </div>

      <p className="mt-2 text-center text-[10px] font-medium uppercase tracking-wide text-[var(--toq-text-muted)]">
        Publicidade
      </p>
    </div>
  );
}
