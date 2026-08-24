"use client";

import { useEffect, useState } from "react";

type Props = {
  slides: string[];
  alt?: string;
  className?: string;
  imgClassName?: string;
  /** Autoplay só quando há mais de uma foto. */
  autoplayMs?: number;
};

export function CommunityCoverCarousel({
  slides,
  alt = "",
  className = "",
  imgClassName = "community-cover-img h-full w-full object-cover",
  autoplayMs = 0,
}: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const list = slides.filter(Boolean);
  const key = list.join("|");

  useEffect(() => {
    setIndex(0);
  }, [key]);

  useEffect(() => {
    if (list.length <= 1 || !autoplayMs || paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % list.length);
    }, autoplayMs);
    return () => window.clearInterval(id);
  }, [list.length, autoplayMs, paused]);

  if (list.length === 0) {
    return <div className={className} aria-hidden />;
  }

  const current = list[Math.min(index, list.length - 1)]!;

  return (
    <div
      className={`relative h-full w-full pointer-events-none ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={current} src={current} alt={alt} className={imgClassName} />

      {list.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            className="pointer-events-auto absolute left-2 top-1/2 z-[2] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-lg font-bold text-white transition hover:bg-black/75"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIndex((i) => (i - 1 + list.length) % list.length);
            }}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Próxima foto"
            className="pointer-events-auto absolute right-2 top-1/2 z-[2] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-lg font-bold text-white transition hover:bg-black/75"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIndex((i) => (i + 1) % list.length);
            }}
          >
            ›
          </button>
          <div className="pointer-events-none absolute bottom-2 left-0 right-0 z-[2] flex justify-center gap-1.5">
            {list.map((url, i) => (
              <span
                key={`${url}-${i}`}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === index ? "bg-white" : "bg-white/40"
                }`}
              />
            ))}
          </div>
          <span className="pointer-events-none absolute bottom-2 right-2 z-[2] rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">
            {index + 1}/{list.length}
          </span>
        </>
      )}
    </div>
  );
}
