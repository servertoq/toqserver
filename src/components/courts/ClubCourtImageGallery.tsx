"use client";

import { useMemo, useRef, useState } from "react";

type CourtImage = { url: string; sort_order: number };

type Props = {
  images?: CourtImage[] | null;
  /** card = capa na listagem (sem scroll, para o toque abrir o link); detail = carrossel na página da quadra */
  variant?: "card" | "detail";
};

export function ClubCourtImageGallery({ images, variant = "card" }: Props) {
  const sorted = useMemo(
    () => [...(images ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [images]
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  if (sorted.length === 0) return null;

  const aspectClass =
    variant === "card" ? "aspect-[16/10] sm:aspect-[4/3]" : "aspect-[16/10] w-full";
  const wrapClass = variant === "card" ? "relative mb-3" : "relative w-full";

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || sorted.length < 2) return;
    const w = el.clientWidth;
    if (!w) return;
    const next = Math.round(el.scrollLeft / w);
    setIndex(Math.max(0, Math.min(sorted.length - 1, next)));
  };

  if (variant === "card" || sorted.length === 1) {
    return (
      <div className={wrapClass}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sorted[0].url}
          alt=""
          className={`${aspectClass} w-full object-cover ${variant === "card" ? "rounded-xl" : ""}`}
        />
        {variant === "card" && sorted.length > 1 && (
          <span
            className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white"
            aria-hidden
          >
            {sorted.length} fotos
          </span>
        )}
        {variant === "card" && sorted.length > 1 && (
          <p className="sr-only">
            Esta quadra tem {sorted.length} fotos. Abra o card para ver todas.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={`flex ${aspectClass} snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        aria-label={`Fotos da quadra, ${sorted.length} imagens`}
      >
        {sorted.map((img) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={img.url}
            src={img.url}
            alt=""
            className="h-full w-full shrink-0 snap-center object-cover"
            draggable={false}
          />
        ))}
      </div>
      <span
        className="pointer-events-none absolute right-2 top-2 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white"
        aria-hidden
      >
        {index + 1}/{sorted.length}
      </span>
      <div
        className="pointer-events-none absolute bottom-2 left-0 right-0 flex justify-center gap-1.5"
        aria-hidden
      >
        {sorted.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full shadow-sm ${
              i === index ? "bg-white" : "bg-white/45"
            }`}
          />
        ))}
      </div>
      <p className="sr-only">
        Deslize horizontalmente para ver todas as {sorted.length} fotos.
      </p>
    </div>
  );
}
